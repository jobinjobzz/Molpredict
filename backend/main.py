from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Molecule Property Predictor API", version="1.0.0")

# ── CORS — handle every request including OPTIONS preflight ────────────────────

@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return JSONResponse(
            status_code=200,
            content={},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        )
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

class MoleculeResponse(BaseModel):
    smiles: str
    name: Optional[str]
    valid: bool
    molecular_formula: Optional[str]
    molecular_weight: Optional[float]
    properties: list[PropertyResult]
    lipinski: dict
    error: Optional[str] = None


# ── Chemistry ──────────────────────────────────────────────────────────────────

def compute_properties(smiles: str) -> MoleculeResponse:
    try:
        from rdkit import Chem
        from rdkit.Chem import Descriptors, rdMolDescriptors, Crippen, QED
        from rdkit.Chem import rdMolDescriptors as rdmd
    except ImportError:
        return MoleculeResponse(smiles=smiles, name=None, valid=False,
            molecular_formula=None, molecular_weight=None,
            properties=[], lipinski={}, error="RDKit not installed.")

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return MoleculeResponse(smiles=smiles, name=None, valid=False,
            molecular_formula=None, molecular_weight=None,
            properties=[], lipinski={}, error="Invalid SMILES string.")

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

    return MoleculeResponse(smiles=smiles, name=None, valid=True,
        molecular_formula=formula, molecular_weight=round(mw, 2),
        properties=properties, lipinski=lipinski)


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
        {"name": "Aspirin", "smiles": "CC(=O)Oc1ccccc1C(=O)O"},
        {"name": "Ibuprofen", "smiles": "CC(C)Cc1ccc(cc1)C(C)C(=O)O"},
        {"name": "Caffeine", "smiles": "Cn1cnc2c1c(=O)n(c(=O)n2C)C"},
        {"name": "Paracetamol", "smiles": "CC(=O)Nc1ccc(O)cc1"},
        {"name": "Penicillin G", "smiles": "CC1(C)SC2C(NC(=O)Cc3ccccc3)C(=O)N2C1C(=O)O"},
        {"name": "Metformin", "smiles": "CN(C)C(=N)NC(=N)N"},
        {"name": "Sildenafil", "smiles": "CCCC1=NN(C)C(=C1C(=O)c1ccc(cc1)S(=O)(=O)N1CCN(CC1)C)c1nc(cc(=O)[nH]1)c1cccc(c1)OCC"},
    ]

@app.post("/predict", response_model=MoleculeResponse)
def predict(req: MoleculeRequest):
    result = compute_properties(req.smiles.strip())
    if req.name:
        result.name = req.name
    return result
