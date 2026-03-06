from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

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
    structure_url: Optional[str]   # URL to 2D image via public API
    error: Optional[str] = None


# ── Toxicity Prediction ────────────────────────────────────────────────────────

def predict_toxicity(mol) -> list[ToxicityResult]:
    try:
        from rdkit.Chem import Descriptors, Crippen
        from rdkit.Chem import rdMolDescriptors as rdmd
        from rdkit import Chem

        mw      = Descriptors.MolWt(mol)
        logp    = Crippen.MolLogP(mol)
        tpsa    = Descriptors.TPSA(mol)
        hbd     = rdmd.CalcNumHBD(mol)
        hba     = rdmd.CalcNumHBA(mol)
        arom    = rdmd.CalcNumAromaticRings(mol)

        alerts = {
            "nitro":    "[N+](=O)[O-]",
            "aniline":  "Nc1ccccc1",
            "aldehyde": "[CH]=O",
            "michael":  "C=CC=O",
            "epoxide":  "C1OC1",
            "halo_ar":  "c[F,Cl,Br,I]",
        }
        found = {}
        for k, smarts in alerts.items():
            try:
                found[k] = mol.HasSubstructMatch(Chem.MolFromSmarts(smarts))
            except:
                found[k] = False

        def clamp(x): return round(min(max(x, 0.0), 0.95), 3)

        # Hepatotoxicity
        h = 0.0
        if logp > 3:           h += 0.20
        if mw > 500:           h += 0.15
        if found["nitro"]:     h += 0.30
        if found["aniline"]:   h += 0.20
        if arom >= 3:          h += 0.15

        # Cardiotoxicity (hERG)
        c = 0.0
        if logp > 3.7:         c += 0.25
        if mw > 450:           c += 0.10
        if arom >= 2:          c += 0.20
        if hba >= 4:           c += 0.10
        if found["halo_ar"]:   c += 0.15

        # Mutagenicity
        m = 0.0
        if found["nitro"]:     m += 0.40
        if found["aniline"]:   m += 0.30
        if found["aldehyde"]:  m += 0.25
        if found["epoxide"]:   m += 0.35
        if found["michael"]:   m += 0.20

        # Skin sensitization
        s = 0.0
        if found["michael"]:   s += 0.35
        if found["aldehyde"]:  s += 0.30
        if found["epoxide"]:   s += 0.30
        if 2 < logp < 4:       s += 0.10

        # Aquatic toxicity
        a = 0.0
        if logp > 4:           a += 0.30
        if mw > 400:           a += 0.10
        if arom >= 3:          a += 0.20
        if found["halo_ar"]:   a += 0.20

        # BBB penetration
        b = 0.0
        if 1 <= logp <= 3:     b += 0.40
        if mw < 450:           b += 0.20
        if tpsa < 90:          b += 0.20
        if hbd <= 3:           b += 0.10
        if arom <= 2:          b += 0.10

        return [
            ToxicityResult(endpoint="Hepatotoxicity",       probability=clamp(h),
                status="bad" if h>0.5 else ("warning" if h>0.3 else "good"),
                description="Estimated liver toxicity risk based on structural features."),
            ToxicityResult(endpoint="Cardiotoxicity (hERG)",probability=clamp(c),
                status="bad" if c>0.5 else ("warning" if c>0.3 else "good"),
                description="Estimated hERG channel inhibition risk (cardiac arrhythmia)."),
            ToxicityResult(endpoint="Mutagenicity (Ames)",  probability=clamp(m),
                status="bad" if m>0.4 else ("warning" if m>0.2 else "good"),
                description="Estimated mutagenicity based on structural alerts."),
            ToxicityResult(endpoint="Skin Sensitization",   probability=clamp(s),
                status="bad" if s>0.4 else ("warning" if s>0.2 else "good"),
                description="Risk of allergic skin reaction from reactive groups."),
            ToxicityResult(endpoint="Aquatic Toxicity",     probability=clamp(a),
                status="bad" if a>0.5 else ("warning" if a>0.3 else "good"),
                description="Estimated environmental toxicity to aquatic organisms."),
            ToxicityResult(endpoint="BBB Penetration",      probability=clamp(b),
                status="warning" if b>0.5 else "good",
                description="Likelihood of crossing the blood-brain barrier."),
        ]
    except Exception as e:
        print(f"Toxicity error: {e}")
        return []


# ── Core computation ───────────────────────────────────────────────────────────

def compute_properties(smiles: str) -> MoleculeResponse:
    try:
        from rdkit import Chem
        from rdkit.Chem import Descriptors, rdMolDescriptors, Crippen, QED
        from rdkit.Chem import rdMolDescriptors as rdmd
    except ImportError:
        return MoleculeResponse(smiles=smiles, name=None, valid=False,
            molecular_formula=None, molecular_weight=None,
            properties=[], lipinski={}, toxicity=[], structure_url=None,
            error="RDKit not installed.")

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return MoleculeResponse(smiles=smiles, name=None, valid=False,
            molecular_formula=None, molecular_weight=None,
            properties=[], lipinski={}, toxicity=[], structure_url=None,
            error="Invalid SMILES string.")

    formula = rdMolDescriptors.CalcMolFormula(mol)
    mw      = Descriptors.MolWt(mol)
    hbd     = rdmd.CalcNumHBD(mol)
    hba     = rdmd.CalcNumHBA(mol)
    logp    = Crippen.MolLogP(mol)
    tpsa    = Descriptors.TPSA(mol)
    rot     = rdmd.CalcNumRotatableBonds(mol)
    arom    = rdmd.CalcNumAromaticRings(mol)
    heavy   = mol.GetNumHeavyAtoms()
    qed     = QED.qed(mol)

    violations = sum([mw>500, logp>5, hbd>5, hba>10])

    properties = [
        PropertyResult(name="Molecular Weight",    value=round(mw,2),   unit="Da",
            status="good" if mw<=500 else ("warning" if mw<=600 else "bad"),
            description="Lipinski limit ≤ 500 Da."),
        PropertyResult(name="LogP (Lipophilicity)", value=round(logp,3), unit="",
            status="good" if -0.5<=logp<=5 else ("warning" if logp<=6 else "bad"),
            description="Lipinski limit ≤ 5."),
        PropertyResult(name="H-Bond Donors",        value=hbd,           unit="",
            status="good" if hbd<=5 else "bad",
            description="Lipinski limit ≤ 5."),
        PropertyResult(name="H-Bond Acceptors",     value=hba,           unit="",
            status="good" if hba<=10 else "bad",
            description="Lipinski limit ≤ 10."),
        PropertyResult(name="TPSA",                 value=round(tpsa,2), unit="Å²",
            status="good" if tpsa<=90 else ("warning" if tpsa<=140 else "bad"),
            description="< 90 Å² good oral absorption."),
        PropertyResult(name="Rotatable Bonds",      value=rot,           unit="",
            status="good" if rot<=10 else ("warning" if rot<=15 else "bad"),
            description="Measures molecular flexibility."),
        PropertyResult(name="Aromatic Rings",       value=arom,          unit="",
            status="good" if arom<=3 else ("warning" if arom<=4 else "bad"),
            description="More rings increase toxicity risk."),
        PropertyResult(name="QED Score",            value=round(qed,3),  unit="",
            status="good" if qed>=0.6 else ("warning" if qed>=0.4 else "bad"),
            description="Drug-likeness 0–1, higher is better."),
        PropertyResult(name="Heavy Atom Count",     value=heavy,         unit="",
            status="good" if heavy<=30 else ("warning" if heavy<=40 else "bad"),
            description="Non-hydrogen atoms."),
    ]

    lipinski = {
        "pass": violations<=1, "violations": violations,
        "mw_ok": mw<=500, "logp_ok": logp<=5,
        "hbd_ok": hbd<=5, "hba_ok": hba<=10,
    }

    toxicity = predict_toxicity(mol)

    # Use PubChem's free 2D structure image API — no rendering needed on server
    from urllib.parse import quote
    encoded_smiles = quote(smiles, safe="")
    structure_url = f"https://cactus.nci.nih.gov/chemical/structure/{encoded_smiles}/image?width=400&height=300"

    return MoleculeResponse(smiles=smiles, name=None, valid=True,
        molecular_formula=formula, molecular_weight=round(mw,2),
        properties=properties, lipinski=lipinski,
        toxicity=toxicity, structure_url=structure_url)


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
        {"name": "Aspirin",      "smiles": "CC(=O)Oc1ccccc1C(=O)O"},
        {"name": "Ibuprofen",    "smiles": "CC(C)Cc1ccc(cc1)C(C)C(=O)O"},
        {"name": "Caffeine",     "smiles": "Cn1cnc2c1c(=O)n(c(=O)n2C)C"},
        {"name": "Paracetamol",  "smiles": "CC(=O)Nc1ccc(O)cc1"},
        {"name": "Penicillin G", "smiles": "CC1(C)SC2C(NC(=O)Cc3ccccc3)C(=O)N2C1C(=O)O"},
        {"name": "Metformin",    "smiles": "CN(C)C(=N)NC(=N)N"},
        {"name": "Sildenafil",   "smiles": "CCCC1=NN(C)C(=C1C(=O)c1ccc(cc1)S(=O)(=O)N1CCN(CC1)C)c1nc(cc(=O)[nH]1)c1cccc(c1)OCC"},
    ]

@app.post("/predict", response_model=MoleculeResponse)
def predict(req: MoleculeRequest):
    result = compute_properties(req.smiles.strip())
    if req.name:
        result.name = req.name
    return result
