from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional
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

class BatchRequest(BaseModel):
    molecules: list[MoleculeRequest]

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
    structure_url: Optional[str]
    error: Optional[str] = None


# ── Toxicity ───────────────────────────────────────────────────────────────────

def predict_toxicity(mol) -> list[ToxicityResult]:
    try:
        from rdkit.Chem import Descriptors, Crippen
        from rdkit.Chem import rdMolDescriptors as rdmd
        from rdkit import Chem

        mw   = Descriptors.MolWt(mol)
        logp = Crippen.MolLogP(mol)
        tpsa = Descriptors.TPSA(mol)
        hbd  = rdmd.CalcNumHBD(mol)
        arom = rdmd.CalcNumAromaticRings(mol)
        hba  = rdmd.CalcNumHBA(mol)

        alerts = {
            "nitro":   "[N+](=O)[O-]",
            "aniline": "Nc1ccccc1",
            "aldehyde":"[CH]=O",
            "michael": "C=CC=O",
            "epoxide": "C1OC1",
            "halo_ar": "c[F,Cl,Br,I]",
        }
        found = {}
        for k, smarts in alerts.items():
            try: found[k] = mol.HasSubstructMatch(Chem.MolFromSmarts(smarts))
            except: found[k] = False

        def clamp(x): return round(min(max(x, 0.0), 0.95), 3)

        h = sum([logp>3 and 0.20, mw>500 and 0.15, found["nitro"] and 0.30,
                 found["aniline"] and 0.20, arom>=3 and 0.15])
        c = sum([logp>3.7 and 0.25, mw>450 and 0.10, arom>=2 and 0.20,
                 hba>=4 and 0.10, found["halo_ar"] and 0.15])
        m = sum([found["nitro"] and 0.40, found["aniline"] and 0.30,
                 found["aldehyde"] and 0.25, found["epoxide"] and 0.35,
                 found["michael"] and 0.20])
        s = sum([found["michael"] and 0.35, found["aldehyde"] and 0.30,
                 found["epoxide"] and 0.30, (2<logp<4) and 0.10])
        a = sum([logp>4 and 0.30, mw>400 and 0.10, arom>=3 and 0.20,
                 found["halo_ar"] and 0.20])
        b = sum([1<=logp<=3 and 0.40, mw<450 and 0.20, tpsa<90 and 0.20,
                 hbd<=3 and 0.10, arom<=2 and 0.10])

        return [
            ToxicityResult(endpoint="Hepatotoxicity", probability=clamp(h),
                status="bad" if h>0.5 else ("warning" if h>0.3 else "good"),
                description="Estimated liver toxicity risk."),
            ToxicityResult(endpoint="Cardiotoxicity (hERG)", probability=clamp(c),
                status="bad" if c>0.5 else ("warning" if c>0.3 else "good"),
                description="Estimated hERG channel inhibition risk."),
            ToxicityResult(endpoint="Mutagenicity (Ames)", probability=clamp(m),
                status="bad" if m>0.4 else ("warning" if m>0.2 else "good"),
                description="Estimated mutagenicity risk."),
            ToxicityResult(endpoint="Skin Sensitization", probability=clamp(s),
                status="bad" if s>0.4 else ("warning" if s>0.2 else "good"),
                description="Risk of allergic skin reaction."),
            ToxicityResult(endpoint="Aquatic Toxicity", probability=clamp(a),
                status="bad" if a>0.5 else ("warning" if a>0.3 else "good"),
                description="Environmental toxicity risk."),
            ToxicityResult(endpoint="BBB Penetration", probability=clamp(b),
                status="warning" if b>0.5 else "good",
                description="Likelihood of crossing blood-brain barrier."),
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
    mw   = Descriptors.MolWt(mol)
    hbd  = rdmd.CalcNumHBD(mol)
    hba  = rdmd.CalcNumHBA(mol)
    logp = Crippen.MolLogP(mol)
    tpsa = Descriptors.TPSA(mol)
    rot  = rdmd.CalcNumRotatableBonds(mol)
    arom = rdmd.CalcNumAromaticRings(mol)
    heavy= mol.GetNumHeavyAtoms()
    qed  = QED.qed(mol)
    viol = sum([mw>500, logp>5, hbd>5, hba>10])

    properties = [
        PropertyResult(name="Molecular Weight",    value=round(mw,2),   unit="Da",
            status="good" if mw<=500 else ("warning" if mw<=600 else "bad"),
            description="Lipinski limit ≤ 500 Da."),
        PropertyResult(name="LogP (Lipophilicity)", value=round(logp,3), unit="",
            status="good" if -0.5<=logp<=5 else ("warning" if logp<=6 else "bad"),
            description="Lipinski limit ≤ 5."),
        PropertyResult(name="H-Bond Donors",        value=hbd,           unit="",
            status="good" if hbd<=5 else "bad",   description="Lipinski limit ≤ 5."),
        PropertyResult(name="H-Bond Acceptors",     value=hba,           unit="",
            status="good" if hba<=10 else "bad",  description="Lipinski limit ≤ 10."),
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
        "pass": viol<=1, "violations": viol,
        "mw_ok": mw<=500, "logp_ok": logp<=5,
        "hbd_ok": hbd<=5, "hba_ok": hba<=10,
    }

    from urllib.parse import quote
    structure_url = f"https://cactus.nci.nih.gov/chemical/structure/{quote(smiles, safe='')}/image?width=400&height=300"

    return MoleculeResponse(smiles=smiles, name=None, valid=True,
        molecular_formula=formula, molecular_weight=round(mw,2),
        properties=properties, lipinski=lipinski,
        toxicity=predict_toxicity(mol), structure_url=structure_url)


# ── Excel export helper ────────────────────────────────────────────────────────

def results_to_excel(results: list[MoleculeResponse]) -> bytes:
    import openpyxl
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()

    # ── Sheet 1: Summary ──────────────────────────────────────────────────────
    ws1 = wb.active
    ws1.title = "Summary"

    header_fill  = PatternFill("solid", fgColor="0D1F2D")
    good_fill    = PatternFill("solid", fgColor="0D2B1A")
    warning_fill = PatternFill("solid", fgColor="2B1F00")
    bad_fill     = PatternFill("solid", fgColor="2B0D0D")
    alt_fill     = PatternFill("solid", fgColor="0A1520")

    header_font  = Font(bold=True, color="60A5FA", size=11)
    title_font   = Font(bold=True, color="E2E8F0", size=13)
    white_font   = Font(color="E2E8F0", size=10)
    good_font    = Font(color="4ADE80", size=10)
    warn_font    = Font(color="FBBF24", size=10)
    bad_font     = Font(color="F87171", size=10)
    center       = Alignment(horizontal="center", vertical="center")
    thin         = Border(
        left=Side(style="thin", color="0F2030"),
        right=Side(style="thin", color="0F2030"),
        top=Side(style="thin", color="0F2030"),
        bottom=Side(style="thin", color="0F2030"),
    )

    def status_font(s):
        return good_font if s=="good" else (warn_font if s=="warning" else bad_font)

    prop_names = ["Molecular Weight","LogP (Lipophilicity)","H-Bond Donors",
                  "H-Bond Acceptors","TPSA","Rotatable Bonds",
                  "Aromatic Rings","QED Score","Heavy Atom Count"]
    tox_names  = ["Hepatotoxicity","Cardiotoxicity (hERG)","Mutagenicity (Ames)",
                  "Skin Sensitization","Aquatic Toxicity","BBB Penetration"]

    headers = ["#","Name","SMILES","Formula","Valid","Lipinski Pass","Violations"] \
            + prop_names + [t+" (%)" for t in tox_names]

    for ci, h in enumerate(headers, 1):
        cell = ws1.cell(row=1, column=ci, value=h)
        cell.fill   = header_fill
        cell.font   = header_font
        cell.alignment = center
        cell.border = thin

    ws1.row_dimensions[1].height = 28

    for ri, r in enumerate(results, 2):
        row_fill = alt_fill if ri % 2 == 0 else PatternFill("solid", fgColor="060D14")
        col = 1

        def wc(val, font=None, fill=None, align=center):
            cell = ws1.cell(row=ri, column=col, value=val)
            cell.fill      = fill or row_fill
            cell.font      = font or white_font
            cell.alignment = align
            cell.border    = thin
            return cell

        # Index
        wc(ri-1); col+=1
        # Name
        wc(r.name or "—"); col+=1
        # SMILES
        c = ws1.cell(row=ri, column=col, value=r.smiles)
        c.fill=row_fill; c.font=white_font; c.border=thin
        c.alignment = Alignment(horizontal="left", vertical="center")
        col+=1
        # Formula
        wc(r.molecular_formula or "—"); col+=1
        # Valid
        wc("Yes" if r.valid else "No",
           font=good_font if r.valid else bad_font); col+=1
        # Lipinski
        lp = r.lipinski.get("pass", False)
        wc("PASS" if lp else "FAIL",
           font=good_font if lp else bad_font); col+=1
        # Violations
        viol = r.lipinski.get("violations", "—")
        wc(viol, font=good_font if viol==0 else (warn_font if viol==1 else bad_font)); col+=1

        # Properties
        prop_map = {p.name: p for p in r.properties}
        for pn in prop_names:
            p = prop_map.get(pn)
            if p:
                val = f"{p.value} {p.unit}".strip()
                wc(val, font=status_font(p.status)); col+=1
            else:
                wc("—"); col+=1

        # Toxicity
        tox_map = {t.endpoint: t for t in r.toxicity}
        for tn in tox_names:
            t = tox_map.get(tn)
            if t:
                pct = round(t.probability * 100, 1)
                wc(pct, font=status_font(t.status)); col+=1
            else:
                wc("—"); col+=1

    # Column widths
    col_widths = [4, 16, 40, 12, 7, 14, 10] + [16]*len(prop_names) + [22]*len(tox_names)
    for i, w in enumerate(col_widths, 1):
        ws1.column_dimensions[get_column_letter(i)].width = w

    # ── Sheet 2: Properties Detail ────────────────────────────────────────────
    ws2 = wb.create_sheet("Properties Detail")
    h2 = ["#","Name","SMILES"] + prop_names
    for ci, h in enumerate(h2, 1):
        cell = ws2.cell(row=1, column=ci, value=h)
        cell.fill=header_fill; cell.font=header_font
        cell.alignment=center; cell.border=thin

    for ri, r in enumerate(results, 2):
        row_fill = alt_fill if ri%2==0 else PatternFill("solid", fgColor="060D14")
        ws2.cell(row=ri,column=1,value=ri-1).fill=row_fill
        ws2.cell(row=ri,column=2,value=r.name or "—").fill=row_fill
        ws2.cell(row=ri,column=3,value=r.smiles).fill=row_fill
        prop_map = {p.name: p for p in r.properties}
        for ci, pn in enumerate(prop_names, 4):
            p = prop_map.get(pn)
            cell = ws2.cell(row=ri, column=ci,
                            value=f"{p.value} {p.unit}".strip() if p else "—")
            cell.fill  = row_fill
            cell.font  = status_font(p.status) if p else white_font
            cell.alignment = center
            cell.border = thin

    for i, w in enumerate([4,16,40]+[16]*len(prop_names), 1):
        ws2.column_dimensions[get_column_letter(i)].width = w

    # ── Sheet 3: Toxicity Detail ──────────────────────────────────────────────
    ws3 = wb.create_sheet("Toxicity Detail")
    h3 = ["#","Name","SMILES"] + [t+" (%)" for t in tox_names]
    for ci, h in enumerate(h3, 1):
        cell = ws3.cell(row=1, column=ci, value=h)
        cell.fill=header_fill; cell.font=header_font
        cell.alignment=center; cell.border=thin

    for ri, r in enumerate(results, 2):
        row_fill = alt_fill if ri%2==0 else PatternFill("solid", fgColor="060D14")
        ws3.cell(row=ri,column=1,value=ri-1).fill=row_fill
        ws3.cell(row=ri,column=2,value=r.name or "—").fill=row_fill
        ws3.cell(row=ri,column=3,value=r.smiles).fill=row_fill
        tox_map = {t.endpoint: t for t in r.toxicity}
        for ci, tn in enumerate(tox_names, 4):
            t = tox_map.get(tn)
            pct = round(t.probability*100,1) if t else "—"
            cell = ws3.cell(row=ri, column=ci, value=pct)
            cell.fill  = row_fill
            cell.font  = status_font(t.status) if t else white_font
            cell.alignment = center
            cell.border = thin

    for i, w in enumerate([4,16,40]+[22]*len(tox_names), 1):
        ws3.column_dimensions[get_column_letter(i)].width = w

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


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

@app.post("/batch")
def batch_predict(req: BatchRequest):
    results = []
    for m in req.molecules:
        r = compute_properties(m.smiles.strip())
        if m.name:
            r.name = m.name
        results.append(r)
    return results

@app.post("/batch/export")
def batch_export(req: BatchRequest):
    results = []
    for m in req.molecules:
        r = compute_properties(m.smiles.strip())
        if m.name:
            r.name = m.name
        results.append(r)
    excel_bytes = results_to_excel(results)
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=molpredict_results.xlsx"}
    )
