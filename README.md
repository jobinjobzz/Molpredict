# MolPredict — Molecule Property Predictor

A full-stack web application for predicting drug-likeness and physicochemical properties of molecules from SMILES strings.

---

## Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | React + Vite                      |
| Backend  | Python FastAPI                    |
| Chemistry| RDKit                             |
| Hosting  | Run locally or deploy to any cloud|

---

## Features

- Input any valid SMILES string
- Computes 9 physicochemical properties:
  - Molecular Weight
  - LogP (Lipophilicity)
  - H-Bond Donors & Acceptors
  - TPSA (Topological Polar Surface Area)
  - Rotatable Bonds
  - Aromatic Rings
  - QED Score (Drug-likeness)
  - Heavy Atom Count
- Lipinski Rule of Five compliance check
- 8 built-in example drugs (Aspirin, Ibuprofen, Caffeine, etc.)
- Color-coded status indicators (good / warning / bad)

---

## Setup

### 1. Backend (FastAPI)

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn rdkit-pypi

# Run the server
uvicorn main:app --reload --port 8000
```

The API will be available at: http://localhost:8000

API docs (auto-generated): http://localhost:8000/docs

---

### 2. Frontend (React + Vite)

```bash
cd frontend

# Install Node dependencies
npm install

# Start development server
npm run dev
```

The app will be available at: http://localhost:5173

---

## Project Structure

```
molpredict/
├── backend/
│   └── main.py          ← FastAPI app (all logic here)
│
└── frontend/
    ├── src/
    │   └── App.jsx      ← React app (all UI here)
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## API Endpoints

| Method | Endpoint   | Description                        |
|--------|------------|------------------------------------|
| POST   | /predict   | Predict properties from SMILES     |
| GET    | /examples  | Return list of example molecules   |
| GET    | /health    | API health check                   |

### Example POST /predict

```json
// Request
{
  "smiles": "CC(=O)Oc1ccccc1C(=O)O",
  "name": "Aspirin"
}

// Response
{
  "smiles": "CC(=O)Oc1ccccc1C(=O)O",
  "name": "Aspirin",
  "valid": true,
  "molecular_formula": "C9H8O4",
  "molecular_weight": 180.16,
  "properties": [...],
  "lipinski": {
    "pass": true,
    "violations": 0,
    ...
  }
}
```

---

## Next Steps (Suggested Expansions)

1. **Add 2D molecule visualization** using RDKit SVG rendering
2. **Toxicity prediction** using a trained ML model (e.g. from Tox21 dataset)
3. **Similarity search** against ChEMBL or PubChem
4. **Virtual screening** — upload a CSV of molecules, rank all of them
5. **ADMET prediction** — Absorption, Distribution, Metabolism, Excretion, Toxicity
6. **Export results** as PDF or CSV report

---

## Dependencies

### Backend
- `fastapi` — web framework
- `uvicorn` — ASGI server
- `rdkit-pypi` — cheminformatics toolkit

### Frontend
- `react` — UI library
- `vite` — build tool (fast dev server)
