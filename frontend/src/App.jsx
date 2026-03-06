import { useState, useEffect } from "react";

const API = "https://molpredict.onrender.com";

const statusColor = {
  good:    { bg: "#0d2b1a", border: "#1a5c35", text: "#4ade80", dot: "#22c55e" },
  warning: { bg: "#2b1f00", border: "#5c3d00", text: "#fbbf24", dot: "#f59e0b" },
  bad:     { bg: "#2b0d0d", border: "#5c1a1a", text: "#f87171", dot: "#ef4444" },
  neutral: { bg: "#151f2b", border: "#1e3a5c", text: "#93c5fd", dot: "#60a5fa" },
};

function PropertyCard({ prop }) {
  const c = statusColor[prop.status] || statusColor.neutral;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 10, padding: "14px 18px",
      display: "flex", flexDirection: "column", gap: 6,
      transition: "transform 0.15s", cursor: "default",
    }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
          {prop.name}
        </span>
        <span style={{ background: c.dot, borderRadius: "50%", width: 8, height: 8, display: "inline-block" }} />
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: c.text, fontFamily: "'Space Mono', monospace", letterSpacing: "-0.02em" }}>
        {prop.value}
        {prop.unit && <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 4, color: "#64748b" }}>{prop.unit}</span>}
      </div>
      <div style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.5 }}>{prop.description}</div>
    </div>
  );
}

function ToxicityCard({ tox }) {
  const c = statusColor[tox.status] || statusColor.neutral;
  const pct = Math.round(tox.probability * 100);
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 10, padding: "14px 18px",
      display: "flex", flexDirection: "column", gap: 8,
      transition: "transform 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
          {tox.endpoint}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: c.text, fontFamily: "'Space Mono', monospace" }}>
          {pct}%
        </span>
      </div>
      {/* Progress bar */}
      <div style={{ background: "#0a1520", borderRadius: 99, height: 6, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: c.dot, borderRadius: 99,
          transition: "width 0.8s ease",
        }} />
      </div>
      <div style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.5 }}>{tox.description}</div>
    </div>
  );
}

function LipinskiBadge({ lipinski }) {
  const pass = lipinski.pass;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "8px 16px", borderRadius: 99,
      background: pass ? "#0d2b1a" : "#2b0d0d",
      border: `1px solid ${pass ? "#1a5c35" : "#5c1a1a"}`,
      color: pass ? "#4ade80" : "#f87171",
      fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600,
    }}>
      <span style={{ fontSize: 16 }}>{pass ? "✓" : "✗"}</span>
      Lipinski Ro5: {pass ? "PASS" : "FAIL"} ({lipinski.violations} violation{lipinski.violations !== 1 ? "s" : ""})
    </div>
  );
}

function ExamplePill({ mol, onSelect }) {
  return (
    <button onClick={() => onSelect(mol)} style={{
      background: "#0f1923", border: "1px solid #1e3a5c", borderRadius: 99,
      padding: "5px 14px", color: "#60a5fa", fontSize: 12, cursor: "pointer",
      fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s", whiteSpace: "nowrap",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = "#1e3a5c"; e.currentTarget.style.color = "#bfdbfe"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#0f1923"; e.currentTarget.style.color = "#60a5fa"; }}
    >
      {mol.name}
    </button>
  );
}

function FormulaDisplay({ formula, mw }) {
  const parts = formula.replace(/(\d+)/g, "|||$1|||").split("|||");
  return (
    <span>
      {parts.map((p, i) => /^\d+$/.test(p) ? <sub key={i}>{p}</sub> : <span key={i}>{p}</span>)}
      {mw && <span style={{ color: "#64748b", fontSize: 14, marginLeft: 10 }}>{mw} Da</span>}
    </span>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 16, marginTop: 28 }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>
        {title}
      </div>
      {subtitle && <div style={{ fontSize: 12, color: "#475569" }}>{subtitle}</div>}
    </div>
  );
}

export default function App() {
  const [smiles, setSmiles] = useState("");
  const [molName, setMolName] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [examples, setExamples] = useState([]);
  const [apiStatus, setApiStatus] = useState("checking");
  const [activeTab, setActiveTab] = useState("properties");

  useEffect(() => {
    fetch(`${API}/examples`).then(r => r.json()).then(setExamples).catch(() => {});
    const checkHealth = () => {
      fetch(`${API}/health`)
        .then(r => r.ok ? setApiStatus("online") : setApiStatus("offline"))
        .catch(() => setApiStatus("offline"));
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const predict = async () => {
    if (!smiles.trim()) return;
    setLoading(true); setError(null); setResult(null); setActiveTab("properties");
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

  const selectExample = (mol) => {
    setSmiles(mol.smiles); setMolName(mol.name);
    setResult(null); setError(null);
  };

  const tabs = ["properties", "toxicity", "structure"];

  return (
    <div style={{ minHeight: "100vh", background: "#060d14", color: "#e2e8f0", fontFamily: "'Inter', sans-serif", padding: "0 0 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=JetBrains+Mono:wght@400;600&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #1e3a5c; color: #bfdbfe; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #060d14; }
        ::-webkit-scrollbar-thumb { background: #1e3a5c; border-radius: 3px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        @keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
        @keyframes barFill { from{width:0%;} to{width:var(--target-width);} }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #0f1f2e", padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#08111a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⬡</div>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>MolPredict</div>
            <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>Drug-likeness Analyzer</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: apiStatus === "online" ? "#22c55e" : apiStatus === "offline" ? "#ef4444" : "#f59e0b", animation: apiStatus === "checking" ? "pulse 1.2s infinite" : "none" }} />
          <span style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>API {apiStatus}</span>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "48px 24px 0" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 48, animation: "fadeUp 0.5s ease" }}>
          <h1 style={{ fontFamily: "'Space Mono', monospace", fontSize: "clamp(28px, 5vw, 46px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.1, background: "linear-gradient(135deg, #e2e8f0 30%, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 12 }}>
            Molecule Property<br />Predictor
          </h1>
          <p style={{ color: "#475569", fontSize: 15, maxWidth: 460, margin: "0 auto", lineHeight: 1.7 }}>
            Input a SMILES string to compute drug-likeness, physicochemical properties, toxicity estimates, and 2D structure.
          </p>
        </div>

        {/* Input Card */}
        <div style={{ background: "#0a1520", border: "1px solid #0f2030", borderRadius: 16, padding: 28, marginBottom: 24, animation: "fadeUp 0.5s ease 0.1s both" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", display: "block", marginBottom: 6 }}>SMILES String *</label>
              <input value={smiles} onChange={e => setSmiles(e.target.value)} onKeyDown={e => e.key === "Enter" && predict()}
                placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O"
                style={{ width: "100%", background: "#060d14", border: "1px solid #1e3a5c", borderRadius: 8, padding: "12px 16px", color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, outline: "none", transition: "border-color 0.15s" }}
                onFocus={e => e.target.style.borderColor = "#3b82f6"}
                onBlur={e => e.target.style.borderColor = "#1e3a5c"}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", display: "block", marginBottom: 6 }}>Name (optional)</label>
              <input value={molName} onChange={e => setMolName(e.target.value)} placeholder="e.g. Aspirin"
                style={{ background: "#060d14", border: "1px solid #1e3a5c", borderRadius: 8, padding: "12px 16px", color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, outline: "none", width: 180, transition: "border-color 0.15s" }}
                onFocus={e => e.target.style.borderColor = "#3b82f6"}
                onBlur={e => e.target.style.borderColor = "#1e3a5c"}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={predict} disabled={loading || !smiles.trim()} style={{ background: smiles.trim() ? "linear-gradient(135deg, #1d4ed8, #0ea5e9)" : "#0f1923", border: "none", borderRadius: 8, padding: "11px 28px", color: smiles.trim() ? "#fff" : "#334155", fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, cursor: smiles.trim() ? "pointer" : "not-allowed", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8 }}>
              {loading && <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span>}
              {loading ? "Analyzing..." : "Analyze Molecule"}
            </button>
            {smiles && (
              <button onClick={() => { setSmiles(""); setMolName(""); setResult(null); setError(null); }} style={{ background: "transparent", border: "1px solid #1e3a5c", borderRadius: 8, padding: "11px 18px", color: "#475569", fontSize: 12, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Examples */}
        {examples.length > 0 && (
          <div style={{ marginBottom: 36, animation: "fadeUp 0.5s ease 0.2s both" }}>
            <div style={{ fontSize: 11, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>Try an example →</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {examples.map(mol => <ExamplePill key={mol.name} mol={mol} onSelect={selectExample} />)}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: "#2b0d0d", border: "1px solid #5c1a1a", borderRadius: 10, padding: "14px 18px", marginBottom: 24, color: "#f87171", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, animation: "fadeUp 0.3s ease" }}>
            ✗ {error}
          </div>
        )}

        {/* Results */}
        {result && result.valid && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>

            {/* Molecule header */}
            <div style={{ background: "#0a1520", border: "1px solid #0f2030", borderRadius: 16, padding: 24, marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
              <div>
                {result.name && <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{result.name}</div>}
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#60a5fa", background: "#0f1f2e", padding: "4px 10px", borderRadius: 6, display: "inline-block", marginBottom: 10 }}>
                  {result.smiles.length > 60 ? result.smiles.slice(0, 60) + "…" : result.smiles}
                </div>
                {result.molecular_formula && (
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, color: "#94a3b8" }}>
                    <FormulaDisplay formula={result.molecular_formula} mw={result.molecular_weight} />
                  </div>
                )}
              </div>
              <LipinskiBadge lipinski={result.lipinski} />
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#0a1520", borderRadius: 10, padding: 4, width: "fit-content", border: "1px solid #0f2030" }}>
              {tabs.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  background: activeTab === tab ? "linear-gradient(135deg, #1d4ed8, #0ea5e9)" : "transparent",
                  border: "none", borderRadius: 7, padding: "8px 20px",
                  color: activeTab === tab ? "#fff" : "#475569",
                  fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", textTransform: "capitalize", transition: "all 0.2s",
                  letterSpacing: "0.03em",
                }}>
                  {tab === "properties" ? "⚗ Properties" : tab === "toxicity" ? "⚠ Toxicity" : "🔬 Structure"}
                </button>
              ))}
            </div>

            {/* Tab: Properties */}
            {activeTab === "properties" && (
              <>
                <div style={{ background: "#0a1520", border: "1px solid #0f2030", borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {[
                    { label: "MW ≤ 500", ok: result.lipinski.mw_ok },
                    { label: "LogP ≤ 5", ok: result.lipinski.logp_ok },
                    { label: "HBD ≤ 5",  ok: result.lipinski.hbd_ok },
                    { label: "HBA ≤ 10", ok: result.lipinski.hba_ok },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: r.ok ? "#4ade80" : "#f87171" }}>
                      <span>{r.ok ? "✓" : "✗"}</span><span>{r.label}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: "#334155", marginLeft: "auto", alignSelf: "center" }}>Lipinski Rule of Five</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                  {result.properties.map(p => <PropertyCard key={p.name} prop={p} />)}
                </div>
              </>
            )}

            {/* Tab: Toxicity */}
            {activeTab === "toxicity" && (
              <>
                <div style={{ background: "#2b1f00", border: "1px solid #5c3d00", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#fbbf24", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                  ⚠ These are rule-based computational estimates using structural alerts, not experimental measurements. Always validate experimentally.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {result.toxicity.map(t => <ToxicityCard key={t.endpoint} tox={t} />)}
                </div>
              </>
            )}

            {/* Tab: Structure */}
            {activeTab === "structure" && (
              <div style={{ display: "flex", justifyContent: "center" }}>
                {result.structure_url ? (
                  <div style={{ background: "#0a1520", border: "1px solid #0f2030", borderRadius: 16, padding: 24, display: "inline-block" }}>
                    <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", marginBottom: 16, textAlign: "center" }}>
                      2D Molecular Structure
                    </div>
                    <img src={result.structure_url} alt="2D structure" style={{ maxWidth: "100%", width: 400, height: 300, borderRadius: 8, display: "block" }} />
                    {result.name && (
                      <div style={{ textAlign: "center", marginTop: 12, fontFamily: "'Space Mono', monospace", fontSize: 14, color: "#94a3b8" }}>
                        {result.name}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: "#334155", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, padding: 40 }}>
                    Structure image not available for this molecule.
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: 24, padding: 16, background: "#08111a", borderRadius: 10, fontSize: 11.5, color: "#334155", lineHeight: 1.7, fontFamily: "'JetBrains Mono', monospace" }}>
              ⚠ Computational predictions only. Actual biological activity requires experimental validation. Properties computed using RDKit. QED from Bickerton et al. (2012).
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#1e3a5c" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⬡</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>Enter a SMILES string to begin analysis</div>
          </div>
        )}
      </div>
    </div>
  );
}
