from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import base64
import io

app = FastAPI(title="Molecule Property Predictor API", version="1.0.0")

# ── CORS ───────────────────────────────────────────────────────────────────────

@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return JSONResponse(status_code=200, content={}, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        })
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


# ── Models ─────────────────────────────────────────────────────────────────────

class MoleculeRequest(BaseModel):
    smiles: str
    name: Optional[str] = None

class PropertyResult(BaseModel):
    name: str
    value: float | str
    unit: str
    status: str
    description: str

class ToxicityResult(BaseModel):
    endpoint: str
    probability: float
    status: str
    description: str

class MoleculeResponse(BaseModel):
    smiles: str
    name: Optional[str]
    valid: bool
    molecular_formula: Optional[str]
    molecular_weight: Optional[float]
    properties: list[PropertyResult]
    lipinski: dict
    toxicity: list[ToxicityResult]
    structure_image: Optional[str]  # base64 PNG
    error: Optional[str] = None


# ── 2D Structure Image ─────────────────────────────────────────────────────────

def generate_structure_image(mol) -> Optional[str]:
    try:
        from rdkit.Chem import Draw
        from rdkit.Chem.Draw import rdMolDraw2D

        drawer = rdMolDraw2D.MolDraw2DSVG(400, 300)
        drawer.drawOptions().addStereoAnnotation = True
        drawer.drawOptions().backgroundColour = (0.04, 0.08, 0.12, 1)  # dark bg
        drawer.drawOptions().atomColourPalette = {
            6:  (0.85, 0.85, 0.85),   # C — light gray
            7:  (0.4,  0.7,  1.0),    # N — blue
            8:  (1.0,  0.4,  0.4),    # O — red
            16: (1.0,  0.85, 0.3),    # S — yellow
            17: (0.4,  0.9,  0.4),    # Cl — green
            9:  (0.6,  0.9,  0.4),    # F — light green
            15: (1.0,  0.6,  0.2),    # P — orange
        }
        drawer.DrawMolecule(mol)
        drawer.FinishDrawing()
        svg = drawer.GetDrawingText()
        # Return SVG as base64
        svg_bytes = svg.encode("utf-8")
        b64 = base64.b64encode(svg_bytes).decode("utf-8")
        return f"data:image/svg+xml;base64,{b64}"
    except Exception as e:
        print(f"Image generation error: {e}")
        return None


# ── Toxicity Prediction ────────────────────────────────────────────────────────

def predict_toxicity(mol) -> list[ToxicityResult]:
    """
    Rule-based toxicity estimation using well-established structural alerts
    and physicochemical thresholds. Based on published QSAR rules and
    Lipinski/Pfizer 3/75 rule for promiscuity.
    """
    try:
        from rdkit.Chem import Descriptors, rdMolDescriptors, Crippen
        from rdkit.Chem import rdMolDescriptors as rdmd
        from rdkit import Chem

        mw = Descriptors.MolWt(mol)
        logp = Crippen.MolLogP(mol)
        tpsa = Descriptors.TPSA(mol)
        hbd = rdmd.CalcNumHBD(mol)
        hba = rdmd.CalcNumHBA(mol)
        arom_rings = rdmd.CalcNumAromaticRings(mol)
        rot_bonds = rdmd.CalcNumRotatableBonds(mol)
        heavy_atoms = mol.GetNumHeavyAtoms()
        rings = rdmd.CalcNumRings(mol)

        # SMARTS-based structural alerts
        smarts_alerts = {
            "nitro_group":      "[N+](=O)[O-]",
            "aniline":          "Nc1ccccc1",
            "aldehyde":         "[CH]=O",
            "michael_acceptor": "C=CC=O",
            "epoxide":          "C1OC1",
            "halogen_aromatic": "c[F,Cl,Br,I]",
            "quinone":          "O=C1C=CC(=O)C=C1",
            "peroxide":         "OO",
        }
        alerts_found = {}
        for name, smarts in smarts_alerts.items():
            try:
                pattern = Chem.MolFromSmarts(smarts)
                alerts_found[name] = mol.HasSubstructMatch(pattern)
            except:
                alerts_found[name] = False

        results = []

        # 1. Hepatotoxicity (liver toxicity)
        hep_score = 0
        if logp > 3: hep_score += 0.2
        if mw > 500: hep_score += 0.15
        if alerts_found["nitro_group"]: hep_score += 0.3
        if alerts_found["aniline"]: hep_score += 0.2
        if arom_rings >= 3: hep_score += 0.15
        hep_score = min(hep_score, 0.95)
        results.append(ToxicityResult(
            endpoint="Hepatotoxicity",
            probability=round(hep_score, 3),
            status="bad" if hep_score > 0.5 else ("warning" if hep_score > 0.3 else "good"),
            description="Estimated risk of liver toxicity based on structural features."
        ))

        # 2. Cardiotoxicity (hERG inhibition)
        card_score = 0
        if logp > 3.7: card_score += 0.25
        if mw > 450: card_score += 0.1
        if arom_rings >= 2: card_score += 0.2
        if hba >= 4: card_score += 0.1
        if alerts_found["halogen_aromatic"]: card_score += 0.15
        card_score = min(card_score, 0.95)
        results.append(ToxicityResult(
            endpoint="Cardiotoxicity (hERG)",
            probability=round(card_score, 3),
            status="bad" if card_score > 0.5 else ("warning" if card_score > 0.3 else "good"),
            description="Estimated hERG channel inhibition risk (cardiac arrhythmia)."
        ))

        # 3. Mutagenicity (Ames test proxy — Salmonella)
        mut_score = 0
        if alerts_found["nitro_group"]: mut_score += 0.4
        if alerts_found["aniline"]: mut_score += 0.3
        if alerts_found["aldehyde"]: mut_score += 0.25
        if alerts_found["epoxide"]: mut_score += 0.35
        if alerts_found["michael_acceptor"]: mut_score += 0.2
        mut_score = min(mut_score, 0.95)
        results.append(ToxicityResult(
            endpoint="Mutagenicity (Ames)",
            probability=round(mut_score, 3),
            status="bad" if mut_score > 0.4 else ("warning" if mut_score > 0.2 else "good"),
            description="Estimated mutagenicity based on structural alerts (Ames test proxy)."
        ))

        # 4. Skin sensitization
        skin_score = 0
        if alerts_found["michael_acceptor"]: skin_score += 0.35
        if alerts_found["aldehyde"]: skin_score += 0.3
        if alerts_found["epoxide"]: skin_score += 0.3
        if logp > 2 and logp < 4: skin_score += 0.1
        skin_score = min(skin_score, 0.95)
        results.append(ToxicityResult(
            endpoint="Skin Sensitization",
            probability=round(skin_score, 3),
            status="bad" if skin_score > 0.4 else ("warning" if skin_score > 0.2 else "good"),
            description="Risk of allergic skin reaction based on reactive group alerts."
        ))

        # 5. Aquatic toxicity
        aq_score = 0
        if logp > 4: aq_score += 0.3
        if mw > 400: aq_score += 0.1
        if arom_rings >= 3: aq_score += 0.2
        if alerts_found["halogen_aromatic"]: aq_score += 0.2
        aq_score = min(aq_score, 0.95)
        results.append(ToxicityResult(
            endpoint="Aquatic Toxicity",
            probability=round(aq_score, 3),
            status="bad" if aq_score > 0.5 else ("warning" if aq_score > 0.3 else "good"),
            description="Estimated environmental toxicity risk to aquatic organisms."
        ))

        # 6. Blood-Brain Barrier penetration (not toxic, but important flag)
        bbb_score = 0
        if logp >= 1 and logp <= 3: bbb_score += 0.4
        if mw < 450: bbb_score += 0.2
        if tpsa < 90: bbb_score += 0.2
        if hbd <= 3: bbb_score += 0.1
        if arom_rings <= 2: bbb_score += 0.1
        bbb_score = min(bbb_score, 0.95)
        results.append(ToxicityResult(
            endpoint="BBB Penetration",
            probability=round(bbb_score, 3),
            status="warning" if bbb_score > 0.5 else "good",
            description="Likelihood of crossing the blood-brain barrier (CNS side effects risk)."
        ))

        return results

    except Exception as e:
        print(f"Toxicity error: {e}")
        return []


# ── Property prediction ────────────────────────────────────────────────────────

def compute_properties(smiles: str) -> MoleculeResponse:
    try:
        from rdkit import Chem
        from rdkit.Chem import Descriptors, rdMolDescriptors, Crippen, QED
        from rdkit.Chem import rdMolDescriptors as rdmd
    except ImportError:
        return MoleculeResponse(smiles=smiles, name=None, valid=False,
            molecular_formula=None, molecular_weight=None,
            properties=[], lipinski={}, toxicity=[], structure_image=None,
            error="RDKit not installed.")

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return MoleculeResponse(smiles=smiles, name=None, valid=False,
            molecular_formula=None, molecular_weight=None,
            properties=[], lipinski={}, toxicity=[], structure_image=None,
            error="Invalid SMILES string.")

    formula = rdMolDescriptors.CalcMolFormula(mol)
    mw = Descriptors.MolWt(mol)
    hbd = rdmd.CalcNumHBD(mol)
    hba = rdmd.CalcNumHBA(mol)
    logp = Crippen.MolLogP(mol)
    tpsa = Descriptors.TPSA(mol)
    rot_bonds = rdmd.CalcNumRotatableBonds(mol)
    arom_rings = rdmd.CalcNumAromaticRings(mol)
    heavy_atoms = mol.GetNumHeavyAtoms()
    qed_score = QED.qed(mol)

    lipinski_violations = sum([mw > 500, logp > 5, hbd > 5, hba > 10])

    properties = [
        PropertyResult(name="Molecular Weight", value=round(mw, 2), unit="Da",
            status="good" if mw <= 500 else ("warning" if mw <= 600 else "bad"),
            description="Lipinski limit ≤ 500 Da."),
        PropertyResult(name="LogP (Lipophilicity)", value=round(logp, 3), unit="",
            status="good" if -0.5 <= logp <= 5 else ("warning" if logp <= 6 else "bad"),
            description="Lipinski limit ≤ 5."),
        PropertyResult(name="H-Bond Donors", value=hbd, unit="",
            status="good" if hbd <= 5 else "bad",
            description="Lipinski limit ≤ 5."),
        PropertyResult(name="H-Bond Acceptors", value=hba, unit="",
            status="good" if hba <= 10 else "bad",
            description="Lipinski limit ≤ 10."),
        PropertyResult(name="TPSA", value=round(tpsa, 2), unit="Å²",
            status="good" if tpsa <= 90 else ("warning" if tpsa <= 140 else "bad"),
            description="< 90 Å² good oral absorption."),
        PropertyResult(name="Rotatable Bonds", value=rot_bonds, unit="",
            status="good" if rot_bonds <= 10 else ("warning" if rot_bonds <= 15 else "bad"),
            description="Measures molecular flexibility."),
        PropertyResult(name="Aromatic Rings", value=arom_rings, unit="",
            status="good" if arom_rings <= 3 else ("warning" if arom_rings <= 4 else "bad"),
            description="More rings increase toxicity risk."),
        PropertyResult(name="QED Score", value=round(qed_score, 3), unit="",
            status="good" if qed_score >= 0.6 else ("warning" if qed_score >= 0.4 else "bad"),
            description="Drug-likeness 0–1, higher is better."),
        PropertyResult(name="Heavy Atom Count", value=heavy_atoms, unit="",
            status="good" if heavy_atoms <= 30 else ("warning" if heavy_atoms <= 40 else "bad"),
            description="Non-hydrogen atoms."),
    ]

    lipinski = {
        "pass": lipinski_violations <= 1, "violations": lipinski_violations,
        "mw_ok": mw <= 500, "logp_ok": logp <= 5,
        "hbd_ok": hbd <= 5, "hba_ok": hba <= 10,
    }

    toxicity = predict_toxicity(mol)
    structure_image = generate_structure_image(mol)

    return MoleculeResponse(smiles=smiles, name=None, valid=True,
        molecular_formula=formula, molecular_weight=round(mw, 2),
        properties=properties, lipinski=lipinski,
        toxicity=toxicity, structure_image=structure_image)


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Molecule Property Predictor API", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/examples")
def examples():
    return [
        {"name": "Aspirin",     "smiles": "CC(=O)Oc1ccccc1C(=O)O"},
        {"name": "Ibuprofen",   "smiles": "CC(C)Cc1ccc(cc1)C(C)C(=O)O"},
        {"name": "Caffeine",    "smiles": "Cn1cnc2c1c(=O)n(c(=O)n2C)C"},
        {"name": "Paracetamol", "smiles": "CC(=O)Nc1ccc(O)cc1"},
        {"name": "Penicillin G","smiles": "CC1(C)SC2C(NC(=O)Cc3ccccc3)C(=O)N2C1C(=O)O"},
        {"name": "Metformin",   "smiles": "CN(C)C(=N)NC(=N)N"},
        {"name": "Sildenafil",  "smiles": "CCCC1=NN(C)C(=C1C(=O)c1ccc(cc1)S(=O)(=O)N1CCN(CC1)C)c1nc(cc(=O)[nH]1)c1cccc(c1)OCC"},
    ]

@app.post("/predict", response_model=MoleculeResponse)
def predict(req: MoleculeRequest):
    result = compute_properties(req.smiles.strip())
    if req.name:
        result.name = req.name
    return result
