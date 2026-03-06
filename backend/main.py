"""
Molecule Property Predictor - FastAPI Backend
Requirements: pip install fastapi uvicorn rdkit-pypi scikit-learn numpy pandas
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import math

app = FastAPI(title="Molecule Property Predictor API", version="1.0.0")

# Allow requests from React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Input / Output models ──────────────────────────────────────────────────────

class MoleculeRequest(BaseModel):
    smiles: str
    name: Optional[str] = None

class PropertyResult(BaseModel):
    name: str
    value: float | str
    unit: str
    status: str          # "good", "warning", "bad", "neutral"
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


# ── RDKit helpers ──────────────────────────────────────────────────────────────

def get_rdkit_mol(smiles: str):
    """Return RDKit Mol object or None."""
    try:
        from rdkit import Chem
        mol = Chem.MolFromSmiles(smiles)
        return mol
    except Exception:
        return None


def compute_properties(smiles: str) -> MoleculeResponse:
    try:
        from rdkit import Chem
        from rdkit.Chem import Descriptors, rdMolDescriptors, Crippen, QED
        from rdkit.Chem import rdMolDescriptors as rdmd
    except ImportError:
        raise HTTPException(status_code=500, detail="RDKit not installed. Run: pip install rdkit-pypi")

    mol = get_rdkit_mol(smiles)
    if mol is None:
        return MoleculeResponse(
            smiles=smiles, name=None, valid=False,
            molecular_formula=None, molecular_weight=None,
            properties=[], lipinski={},
            error="Invalid SMILES string. Please check the input."
        )

    # Basic info
    formula = rdMolDescriptors.CalcMolFormula(mol)
    mw = Descriptors.MolWt(mol)

    # Lipinski descriptors
    hbd = rdmd.CalcNumHBD(mol)          # H-bond donors
    hba = rdmd.CalcNumHBA(mol)          # H-bond acceptors
    logp = Crippen.MolLogP(mol)
    tpsa = Descriptors.TPSA(mol)
    rot_bonds = rdmd.CalcNumRotatableBonds(mol)
    rings = rdmd.CalcNumRings(mol)
    arom_rings = rdmd.CalcNumAromaticRings(mol)
    heavy_atoms = mol.GetNumHeavyAtoms()
    qed_score = QED.qed(mol)

    # Lipinski Rule of Five
    lipinski_violations = sum([
        mw > 500,
        logp > 5,
        hbd > 5,
        hba > 10,
    ])
    lipinski_pass = lipinski_violations <= 1

    properties = [
        PropertyResult(
            name="Molecular Weight",
            value=round(mw, 2),
            unit="Da",
            status="good" if mw <= 500 else ("warning" if mw <= 600 else "bad"),
            description="Lipinski limit ≤ 500 Da. Higher MW often reduces oral bioavailability."
        ),
        PropertyResult(
            name="LogP (Lipophilicity)",
            value=round(logp, 3),
            unit="",
            status="good" if -0.5 <= logp <= 5 else ("warning" if logp <= 6 else "bad"),
            description="Lipinski limit ≤ 5. Measures oil/water partitioning. Affects membrane permeability."
        ),
        PropertyResult(
            name="H-Bond Donors",
            value=hbd,
            unit="",
            status="good" if hbd <= 5 else "bad",
            description="Lipinski limit ≤ 5. Donors include -OH and -NH groups."
        ),
        PropertyResult(
            name="H-Bond Acceptors",
            value=hba,
            unit="",
            status="good" if hba <= 10 else "bad",
            description="Lipinski limit ≤ 10. Acceptors include N and O atoms."
        ),
        PropertyResult(
            name="TPSA",
            value=round(tpsa, 2),
            unit="Å²",
            status="good" if tpsa <= 90 else ("warning" if tpsa <= 140 else "bad"),
            description="Topological Polar Surface Area. < 90 Å² good oral absorption; < 60 Å² good CNS penetration."
        ),
        PropertyResult(
            name="Rotatable Bonds",
            value=rot_bonds,
            unit="",
            status="good" if rot_bonds <= 10 else ("warning" if rot_bonds <= 15 else "bad"),
            description="Measures molecular flexibility. > 10 may reduce oral bioavailability."
        ),
        PropertyResult(
            name="Aromatic Rings",
            value=arom_rings,
            unit="",
            status="good" if arom_rings <= 3 else ("warning" if arom_rings <= 4 else "bad"),
            description="More aromatic rings generally increase promiscuity and toxicity risk."
        ),
        PropertyResult(
            name="QED Score",
            value=round(qed_score, 3),
            unit="",
            status="good" if qed_score >= 0.6 else ("warning" if qed_score >= 0.4 else "bad"),
            description="Quantitative Estimate of Drug-likeness. Range 0–1, higher is better."
        ),
        PropertyResult(
            name="Heavy Atom Count",
            value=heavy_atoms,
            unit="",
            status="good" if heavy_atoms <= 30 else ("warning" if heavy_atoms <= 40 else "bad"),
            description="Non-hydrogen atoms. Proxy for molecular complexity."
        ),
    ]

    lipinski = {
        "pass": lipinski_pass,
        "violations": lipinski_violations,
        "mw_ok": mw <= 500,
        "logp_ok": logp <= 5,
        "hbd_ok": hbd <= 5,
        "hba_ok": hba <= 10,
    }

    return MoleculeResponse(
        smiles=smiles,
        name=None,
        valid=True,
        molecular_formula=formula,
        molecular_weight=round(mw, 2),
        properties=properties,
        lipinski=lipinski,
    )


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Molecule Property Predictor API", "version": "1.0.0"}


@app.post("/predict", response_model=MoleculeResponse)
def predict(req: MoleculeRequest):
    result = compute_properties(req.smiles.strip())
    if req.name:
        result.name = req.name
    return result


@app.get("/examples")
def examples():
    """Return a list of example molecules."""
    return [
        {"name": "Aspirin", "smiles": "CC(=O)Oc1ccccc1C(=O)O"},
        {"name": "Ibuprofen", "smiles": "CC(C)Cc1ccc(cc1)C(C)C(=O)O"},
        {"name": "Caffeine", "smiles": "Cn1cnc2c1c(=O)n(c(=O)n2C)C"},
        {"name": "Paracetamol", "smiles": "CC(=O)Nc1ccc(O)cc1"},
        {"name": "Penicillin G", "smiles": "CC1(C)SC2C(NC(=O)Cc3ccccc3)C(=O)N2C1C(=O)O"},
        {"name": "Taxol (Paclitaxel)", "smiles": "O=C(O[C@@H]1C[C@]2(O)C(=O)[C@H](OC(=O)c3ccccc3)[C@@H](O)[C@H](OC(C)=O)[C@@]2(C)[C@@H]2[C@H]1OC(=O)[C@@H](O)[C@@H](NC(=O)c1ccccc1)c1ccccc1)[C@@H]1[C@H]2C=C(C)C[C@@H]1OC(C)=O"},
        {"name": "Metformin", "smiles": "CN(C)C(=N)NC(=N)N"},
        {"name": "Sildenafil", "smiles": "CCCC1=NN(C)C(=C1C(=O)c1ccc(cc1)S(=O)(=O)N1CCN(CC1)C)c1nc(cc(=O)[nH]1)c1cccc(c1)OCC"},
    ]


@app.get("/health")
def health():
    return {"status": "ok"}
