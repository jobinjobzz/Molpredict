import { useState, useEffect } from "react";

const API = "https://molpredict.onrender.com";

const statusColor = {
  good:    { bg: "#0d2b1a", border: "#1a5c35", text: "#4ade80", dot: "#22c55e" },
  warning: { bg: "#2b1f00", border: "#5c3d00", text: "#fbbf24", dot: "#f59e0b" },
  bad:     { bg: "#2b0d0d", border: "#5c1a1a", text: "#f87171", dot: "#ef4444" },
  neutral: { bg: "#151f2b", border: "#1e3a5c", text: "#93c5fd", dot: "#60a5fa" },
};

const statusDot = (s) => statusColor[s]?.dot || "#60a5fa";

function PropertyCard({ prop }) {
  const c = statusColor[prop.status] || statusColor.neutral;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 6, transition: "transform 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>{prop.name}</span>
        <span style={{ background: c.dot, borderRadius: "50%", width: 8, height: 8, display: "inline-block" }} />
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: c.text, fontFamily: "'Space Mono', monospace" }}>
        {prop.value}{prop.unit && <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 4, color: "#64748b" }}>{prop.unit}</span>}
      </div>
      <div style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.5 }}>{prop.description}</div>
    </div>
  );
}

function ToxicityCard({ tox }) {
  const c = statusColor[tox.status] || statusColor.neutral;
  const pct = Math.round(tox.probability * 100);
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8, transition: "transform 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>{tox.endpoint}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: c.text, fontFamily: "'Space Mono', monospace" }}>{pct}%</span>
      </div>
      <div style={{ background: "#0a1520", borderRadius: 99, height: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: c.dot, borderRadius: 99, transition: "width 0.8s ease" }} />
      </div>
      <div style={{ fontSize: 11.5, color: "#475569" }}>{tox.description}</div>
    </div>
  );
}

function LipinskiBadge({ lipinski }) {
  const pass = lipinski.pass;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 99, background: pass ? "#0d2b1a" : "#2b0d0d", border: `1px solid ${pass ? "#1a5c35" : "#5c1a1a"}`, color: pass ? "#4ade80" : "#f87171", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600 }}>
      {pass ? "✓" : "✗"} Lipinski Ro5: {pass ? "PASS" : "FAIL"} ({lipinski.violations} violation{lipinski.violations !== 1 ? "s" : ""})
    </div>
  );
}

function ExamplePill({ mol, onSelect }) {
  return (
    <button onClick={() => onSelect(mol)} style={{ background: "#0f1923", border: "1px solid #1e3a5c", borderRadius: 99, padding: "5px 14px", color: "#60a5fa", fontSize: 12, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s", whiteSpace: "nowrap" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#1e3a5c"; e.currentTarget.style.color = "#bfdbfe"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#0f1923"; e.currentTarget.style.color = "#60a5fa"; }}>
      {mol.name}
    </button>
  );
}

function FormulaDisplay({ formula, mw }) {
  const parts = formula.replace(/(\d+)/g, "|||$1|||").split("|||");
  return <span>{parts.map((p, i) => /^\d+$/.test(p) ? <sub key={i}>{p}</sub> : <span key={i}>{p}</span>)}{mw && <span style={{ color: "#64748b", fontSize: 14, marginLeft: 10 }}>{mw} Da</span>}</span>;
}

// ── Batch Screening Component ──────────────────────────────────────────────────

function BatchScreen() {
  const [text, setText] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Parse textarea: each line is "SMILES  optional_name"
  const parseMolecules = (raw) => {
    return raw.split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"))
      .map(line => {
        const parts = line.split(/\s+/);
        const smiles = parts[0];
        const name = parts.slice(1).join(" ") || null;
        return { smiles, name };
      });
  };

  const molecules = parseMolecules(text);
  const validCount = molecules.filter(m => m.smiles).length;

  const analyze = async () => {
    if (!validCount) return;
    setLoading(true); setError(null); setResults([]);
    try {
      const res = await fetch(`${API}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ molecules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "API error");
      setResults(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const exportExcel = async () => {
    if (!validCount) return;
    setExporting(true);
    try {
      const res = await fetch(`${API}/batch/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ molecules }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "molpredict_results.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
    finally { setExporting(false); }
  };

  const exampleText = `CC(=O)Oc1ccccc1C(=O)O Aspirin
CC(C)Cc1ccc(cc1)C(C)C(=O)O Ibuprofen
Cn1cnc2c1c(=O)n(c(=O)n2C)C Caffeine
CC(=O)Nc1ccc(O)cc1 Paracetamol`;

  return (
    <div>
      <div style={{ background: "#0a1520", border: "1px solid #0f2030", borderRadius: 14, padding: 24, marginBottom: 20 }}>

        {/* Title + format hint */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>
              Paste Molecules
            </div>
            <div style={{ fontSize: 12, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>
              One molecule per line: &nbsp;
              <span style={{ color: "#60a5fa" }}>SMILES&nbsp;&nbsp;Name (optional)</span>
            </div>
          </div>
          <button onClick={() => setText(exampleText)}
            style={{ background: "transparent", border: "1px solid #1e3a5c", borderRadius: 7, padding: "6px 14px", color: "#60a5fa", fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>
            Load examples
          </button>
        </div>

        {/* Big textarea */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={`CC(=O)Oc1ccccc1C(=O)O  Aspirin\nCC(C)Cc1ccc(cc1)C(C)C(=O)O  Ibuprofen\nCn1cnc2c1c(=O)n(c(=O)n2C)C  Caffeine\n...`}
          rows={10}
          style={{
            width: "100%", background: "#060d14", border: "1px solid #1e3a5c",
            borderRadius: 8, padding: "14px 16px", color: "#e2e8f0",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
            outline: "none", resize: "vertical", lineHeight: 1.8,
            transition: "border-color 0.15s",
          }}
          onFocus={e => e.target.style.borderColor = "#3b82f6"}
          onBlur={e => e.target.style.borderColor = "#1e3a5c"}
        />

        {/* Live count */}
        <div style={{ fontSize: 11, color: "#334155", fontFamily: "'JetBrains Mono', monospace", marginTop: 8, marginBottom: 16 }}>
          {validCount > 0 ? `✓ ${validCount} molecule${validCount !== 1 ? "s" : ""} detected` : "Paste SMILES above to begin"}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={analyze} disabled={loading || !validCount}
            style={{ background: validCount ? "linear-gradient(135deg, #1d4ed8, #0ea5e9)" : "#0f1923", border: "none", borderRadius: 8, padding: "11px 26px", color: validCount ? "#fff" : "#334155", fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, cursor: validCount ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 8 }}>
            {loading && <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span>}
            {loading ? `Analyzing ${validCount} molecules...` : `Analyze ${validCount} Molecule${validCount !== 1 ? "s" : ""}`}
          </button>
          {text && (
            <button onClick={() => { setText(""); setResults([]); setError(null); }}
              style={{ background: "transparent", border: "1px solid #1e3a5c", borderRadius: 8, padding: "11px 18px", color: "#475569", fontSize: 12, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: "#2b0d0d", border: "1px solid #5c1a1a", borderRadius: 10, padding: "14px 18px", marginBottom: 20, color: "#f87171", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>✗ {error}</div>
      )}

      {/* Results table */}
      {results.length > 0 && (
        <div style={{ animation: "fadeUp 0.4s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700 }}>
              Results — {results.length} molecule{results.length !== 1 ? "s" : ""}
            </div>
            <button onClick={exportExcel} disabled={exporting}
              style={{ background: "linear-gradient(135deg, #065f46, #047857)", border: "none", borderRadius: 8, padding: "10px 22px", color: "#fff", fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              {exporting ? "⏳ Exporting..." : "⬇ Download Excel"}
            </button>
          </div>

          {/* Scrollable table */}
          <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #0f2030" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ background: "#0a1520" }}>
                  {["#","Name","SMILES","Formula","Lipinski","MW (Da)","LogP","HBD","HBA","TPSA","QED","Hepatotox %","Cardiotox %","Mutagenic %"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", fontSize: 11, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid #0f2030", whiteSpace: "nowrap", textAlign: "center" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const pm = Object.fromEntries(r.properties.map(p => [p.name, p]));
                  const tm = Object.fromEntries(r.toxicity.map(t => [t.endpoint, t]));
                  const rowBg = i % 2 === 0 ? "#060d14" : "#0a1520";

                  const tdStyle = (status) => ({
                    padding: "11px 14px", fontSize: 13, textAlign: "center",
                    borderBottom: "1px solid #0f1f2e", background: rowBg,
                    color: status ? statusColor[status]?.text : "#94a3b8",
                    fontFamily: "'JetBrains Mono', monospace",
                    whiteSpace: "nowrap",
                  });

                  return (
                    <tr key={i}>
                      <td style={tdStyle()}>{i + 1}</td>
                      <td style={{ ...tdStyle(), color: "#e2e8f0", fontWeight: 600 }}>{r.name || "—"}</td>
                      <td style={{ ...tdStyle(), color: "#60a5fa", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }} title={r.smiles}>
                        {r.smiles.length > 20 ? r.smiles.slice(0, 20) + "…" : r.smiles}
                      </td>
                      <td style={tdStyle()}>{r.molecular_formula || "—"}</td>
                      <td style={{ ...tdStyle(), color: r.lipinski.pass ? "#4ade80" : "#f87171" }}>
                        {r.lipinski.pass ? "PASS" : "FAIL"}
                      </td>
                      <td style={tdStyle(pm["Molecular Weight"]?.status)}>{pm["Molecular Weight"]?.value ?? "—"}</td>
                      <td style={tdStyle(pm["LogP (Lipophilicity)"]?.status)}>{pm["LogP (Lipophilicity)"]?.value ?? "—"}</td>
                      <td style={tdStyle(pm["H-Bond Donors"]?.status)}>{pm["H-Bond Donors"]?.value ?? "—"}</td>
                      <td style={tdStyle(pm["H-Bond Acceptors"]?.status)}>{pm["H-Bond Acceptors"]?.value ?? "—"}</td>
                      <td style={tdStyle(pm["TPSA"]?.status)}>{pm["TPSA"]?.value ?? "—"}</td>
                      <td style={tdStyle(pm["QED Score"]?.status)}>{pm["QED Score"]?.value ?? "—"}</td>
                      <td style={tdStyle(tm["Hepatotoxicity"]?.status)}>{tm["Hepatotoxicity"] ? Math.round(tm["Hepatotoxicity"].probability*100)+"%" : "—"}</td>
                      <td style={tdStyle(tm["Cardiotoxicity (hERG)"]?.status)}>{tm["Cardiotoxicity (hERG)"] ? Math.round(tm["Cardiotoxicity (hERG)"].probability*100)+"%" : "—"}</td>
                      <td style={tdStyle(tm["Mutagenicity (Ames)"]?.status)}>{tm["Mutagenicity (Ames)"] ? Math.round(tm["Mutagenicity (Ames)"].probability*100)+"%" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, fontSize: 11.5, color: "#334155", fontFamily: "'JetBrains Mono', monospace" }}>
            ⬇ Click "Download Excel" for the full report including all 9 properties and 6 toxicity endpoints across 3 sheets.
          </div>
        </div>
      )}
    </div>
  );
}


// ── Main App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [smiles, setSmiles] = useState("");
  const [molName, setMolName] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [examples, setExamples] = useState([]);
  const [apiStatus, setApiStatus] = useState("checking");
  const [resultTab, setResultTab] = useState("properties");
  const [mainTab, setMainTab] = useState("single");

  useEffect(() => {
    fetch(`${API}/examples`).then(r => r.json()).then(setExamples).catch(() => {});
    const check = () => fetch(`${API}/health`).then(r => r.ok ? setApiStatus("online") : setApiStatus("offline")).catch(() => setApiStatus("offline"));
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  const predict = async () => {
    if (!smiles.trim()) return;
    setLoading(true); setError(null); setResult(null); setResultTab("properties");
    try {
      const res = await fetch(`${API}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smiles: smiles.trim(), name: molName || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "API error");
      setResult(data);
      if (data.error) setError(data.error);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const selectExample = (mol) => { setSmiles(mol.smiles); setMolName(mol.name); setResult(null); setError(null); };

  return (
    <div style={{ minHeight: "100vh", background: "#060d14", color: "#e2e8f0", fontFamily: "'Inter', sans-serif", padding: "0 0 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=JetBrains+Mono:wght@400;600&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #1e3a5c; color: #bfdbfe; }
        ::-webkit-scrollbar { width: 6px; height: 6px; } ::-webkit-scrollbar-track { background: #060d14; }
        ::-webkit-scrollbar-thumb { background: #1e3a5c; border-radius: 3px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #0f1f2e", padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#08111a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⬡</div>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700 }}>MolPredict</div>
            <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>Drug-likeness Analyzer</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: apiStatus === "online" ? "#22c55e" : apiStatus === "offline" ? "#ef4444" : "#f59e0b" }} />
          <span style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>API {apiStatus}</span>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "40px 24px 0" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 40, animation: "fadeUp 0.5s ease" }}>
          <h1 style={{ fontFamily: "'Space Mono', monospace", fontSize: "clamp(26px, 5vw, 44px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.1, background: "linear-gradient(135deg, #e2e8f0 30%, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 10 }}>
            Molecule Property<br />Predictor
          </h1>
          <p style={{ color: "#475569", fontSize: 15, maxWidth: 460, margin: "0 auto", lineHeight: 1.7 }}>
            Analyze single or multiple molecules for drug-likeness, physicochemical properties, toxicity, and 2D structure.
          </p>
        </div>

        {/* Main mode tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "#0a1520", borderRadius: 10, padding: 4, width: "fit-content", border: "1px solid #0f2030" }}>
          {[["single","⬡ Single Molecule"],["batch","⊞ Batch Screening"]].map(([key, label]) => (
            <button key={key} onClick={() => setMainTab(key)} style={{ background: mainTab===key ? "linear-gradient(135deg, #1d4ed8, #0ea5e9)" : "transparent", border: "none", borderRadius: 7, padding: "9px 22px", color: mainTab===key ? "#fff" : "#475569", fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Single molecule mode */}
        {mainTab === "single" && (
          <>
            <div style={{ background: "#0a1520", border: "1px solid #0f2030", borderRadius: 16, padding: 28, marginBottom: 24, animation: "fadeUp 0.5s ease 0.1s both" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", display: "block", marginBottom: 6 }}>SMILES String *</label>
                  <input value={smiles} onChange={e => setSmiles(e.target.value)} onKeyDown={e => e.key === "Enter" && predict()}
                    placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O"
                    style={{ width: "100%", background: "#060d14", border: "1px solid #1e3a5c", borderRadius: 8, padding: "12px 16px", color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, outline: "none" }}
                    onFocus={e => e.target.style.borderColor="#3b82f6"} onBlur={e => e.target.style.borderColor="#1e3a5c"} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", display: "block", marginBottom: 6 }}>Name (optional)</label>
                  <input value={molName} onChange={e => setMolName(e.target.value)} placeholder="e.g. Aspirin"
                    style={{ background: "#060d14", border: "1px solid #1e3a5c", borderRadius: 8, padding: "12px 16px", color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, outline: "none", width: 180 }}
                    onFocus={e => e.target.style.borderColor="#3b82f6"} onBlur={e => e.target.style.borderColor="#1e3a5c"} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={predict} disabled={loading || !smiles.trim()} style={{ background: smiles.trim() ? "linear-gradient(135deg, #1d4ed8, #0ea5e9)" : "#0f1923", border: "none", borderRadius: 8, padding: "11px 28px", color: smiles.trim() ? "#fff" : "#334155", fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, cursor: smiles.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 8 }}>
                  {loading && <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span>}
                  {loading ? "Analyzing..." : "Analyze Molecule"}
                </button>
                {smiles && <button onClick={() => { setSmiles(""); setMolName(""); setResult(null); setError(null); }} style={{ background: "transparent", border: "1px solid #1e3a5c", borderRadius: 8, padding: "11px 18px", color: "#475569", fontSize: 12, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>Clear</button>}
              </div>
            </div>

            {examples.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 11, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>Try an example →</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {examples.map(mol => <ExamplePill key={mol.name} mol={mol} onSelect={selectExample} />)}
                </div>
              </div>
            )}

            {error && <div style={{ background: "#2b0d0d", border: "1px solid #5c1a1a", borderRadius: 10, padding: "14px 18px", marginBottom: 24, color: "#f87171", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>✗ {error}</div>}

            {result && result.valid && (
              <div style={{ animation: "fadeUp 0.4s ease" }}>
                <div style={{ background: "#0a1520", border: "1px solid #0f2030", borderRadius: 16, padding: 24, marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    {result.name && <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{result.name}</div>}
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#60a5fa", background: "#0f1f2e", padding: "4px 10px", borderRadius: 6, display: "inline-block", marginBottom: 10 }}>
                      {result.smiles.length > 60 ? result.smiles.slice(0,60)+"…" : result.smiles}
                    </div>
                    {result.molecular_formula && <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, color: "#94a3b8" }}><FormulaDisplay formula={result.molecular_formula} mw={result.molecular_weight} /></div>}
                  </div>
                  <LipinskiBadge lipinski={result.lipinski} />
                </div>

                <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#0a1520", borderRadius: 10, padding: 4, width: "fit-content", border: "1px solid #0f2030" }}>
                  {[["properties","⚗ Properties"],["toxicity","⚠ Toxicity"],["structure","🔬 Structure"]].map(([key, label]) => (
                    <button key={key} onClick={() => setResultTab(key)} style={{ background: resultTab===key ? "linear-gradient(135deg, #1d4ed8, #0ea5e9)" : "transparent", border: "none", borderRadius: 7, padding: "8px 18px", color: resultTab===key ? "#fff" : "#475569", fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>{label}</button>
                  ))}
                </div>

                {resultTab === "properties" && (
                  <>
                    <div style={{ background: "#0a1520", border: "1px solid #0f2030", borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 12 }}>
                      {[["MW ≤ 500", result.lipinski.mw_ok],["LogP ≤ 5",result.lipinski.logp_ok],["HBD ≤ 5",result.lipinski.hbd_ok],["HBA ≤ 10",result.lipinski.hba_ok]].map(([label, ok]) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: ok ? "#4ade80" : "#f87171" }}>
                          {ok ? "✓" : "✗"} {label}
                        </div>
                      ))}
                      <div style={{ fontSize: 11, color: "#334155", marginLeft: "auto", alignSelf: "center" }}>Lipinski Rule of Five</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                      {result.properties.map(p => <PropertyCard key={p.name} prop={p} />)}
                    </div>
                  </>
                )}

                {resultTab === "toxicity" && (
                  <>
                    <div style={{ background: "#2b1f00", border: "1px solid #5c3d00", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#fbbf24", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                      ⚠ Rule-based computational estimates. Always validate experimentally.
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                      {result.toxicity.map(t => <ToxicityCard key={t.endpoint} tox={t} />)}
                    </div>
                  </>
                )}

                {resultTab === "structure" && (
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    {result.structure_url ? (
                      <div style={{ background: "#0a1520", border: "1px solid #0f2030", borderRadius: 16, padding: 24, display: "inline-block" }}>
                        <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", marginBottom: 16, textAlign: "center" }}>2D Molecular Structure</div>
                        <img src={result.structure_url} alt="2D structure" style={{ maxWidth: "100%", width: 400, height: 300, borderRadius: 8, display: "block", background: "#fff" }} />
                        {result.name && <div style={{ textAlign: "center", marginTop: 12, fontFamily: "'Space Mono', monospace", fontSize: 14, color: "#94a3b8" }}>{result.name}</div>}
                      </div>
                    ) : (
                      <div style={{ color: "#334155", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, padding: 40 }}>Structure image not available.</div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 24, padding: 16, background: "#08111a", borderRadius: 10, fontSize: 11.5, color: "#334155", fontFamily: "'JetBrains Mono', monospace" }}>
                  ⚠ Computational predictions only. Properties computed using RDKit. QED from Bickerton et al. (2012).
                </div>
              </div>
            )}

            {!result && !loading && !error && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#1e3a5c" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⬡</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>Enter a SMILES string to begin analysis</div>
              </div>
            )}
          </>
        )}

        {/* Batch mode */}
        {mainTab === "batch" && <BatchScreen />}
      </div>
    </div>
  );
}
