import { useState, useEffect } from "react";

const API = "https://molpredict.onrender.com";

// ── Design tokens — light, elegant, violet ─────────────────────────────────────
const T = {
  bg:          "#ddd6f5",
  bgCard:      "rgba(255,255,255,0.88)",
  bgCardHover: "rgba(255,255,255,0.98)",
  bgInput:     "rgba(255,255,255,0.95)",
  border:      "rgba(109,40,217,0.25)",
  borderFocus: "#7c3aed",
  text:        "#1e1040",
  textMuted:   "#6b7280",
  textLight:   "#a78bfa",
  accent:      "#7c3aed",
  accentLight: "#ede9fe",
  accentMid:   "#c4b5fd",
  grad:        "linear-gradient(135deg, #7c3aed, #a855f7)",
  gradSoft:    "linear-gradient(135deg, #ede9fe, #f5f3ff)",
  shadow:      "0 4px 24px rgba(124,58,237,0.10)",
  shadowHover: "0 8px 32px rgba(124,58,237,0.18)",
  radius:      14,
  radiusSm:    8,
};

const statusColor = {
  good:    { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", dot: "#22c55e", bar: "#4ade80" },
  warning: { bg: "#fffbeb", border: "#fde68a", text: "#b45309", dot: "#f59e0b", bar: "#fbbf24" },
  bad:     { bg: "#fff1f2", border: "#fecdd3", text: "#be123c", dot: "#f43f5e", bar: "#fb7185" },
  neutral: { bg: "#f5f3ff", border: "#ddd6fe", text: "#6d28d9", dot: "#8b5cf6", bar: "#a78bfa" },
};

// ── SVG chemical structure backgrounds ────────────────────────────────────────
// Benzene, caffeine-like, aspirin-like rings drawn as decorative SVG paths
const BG_MOLECULES = `
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <defs>
    <style>
      .mol { fill:none; stroke:rgba(109,40,217,0.22); stroke-width:2; stroke-linecap:round; }
      .mol2 { fill:none; stroke:rgba(139,92,246,0.14); stroke-width:1.5; stroke-linecap:round; }
    </style>
  </defs>
  <!-- Benzene ring top-left -->
  <g transform="translate(60,80) scale(2.2)">
    <polygon class="mol" points="20,0 40,11.5 40,34.6 20,46.2 0,34.6 0,11.5"/>
    <polygon class="mol2" points="20,8 32,14.9 32,28.7 20,35.6 8,28.7 8,14.9"/>
    <line class="mol" x1="20" y1="0" x2="20" y2="-18"/>
    <line class="mol" x1="40" y1="11.5" x2="56" y2="2"/>
    <line class="mol" x1="40" y1="34.6" x2="56" y2="43"/>
    <line class="mol" x1="20" y1="46.2" x2="20" y2="64"/>
    <line class="mol" x1="0" y1="34.6" x2="-16" y2="43"/>
  </g>
  <!-- Fused rings center-right -->
  <g transform="translate(680,120) scale(2.0)">
    <polygon class="mol" points="20,0 40,11.5 40,34.6 20,46.2 0,34.6 0,11.5"/>
    <polygon class="mol" points="40,11.5 60,0 80,11.5 80,34.6 60,46.2 40,34.6"/>
    <polygon class="mol2" points="20,8 32,14.9 32,28.7 20,35.6 8,28.7 8,14.9"/>
    <line class="mol" x1="20" y1="0" x2="20" y2="-15"/>
    <line class="mol" x1="80" y1="11.5" x2="96" y2="2"/>
    <line class="mol" x1="80" y1="34.6" x2="96" y2="44"/>
    <line class="mol" x1="60" y1="46.2" x2="60" y2="62"/>
    <line class="mol" x1="0" y1="34.6" x2="-14" y2="44"/>
    <line class="mol" x1="0" y1="11.5" x2="-14" y2="2"/>
  </g>
  <!-- Caffeine-like purine bottom-left -->
  <g transform="translate(40,480) scale(1.8)">
    <polygon class="mol" points="20,0 40,11.5 40,34.6 20,46.2 0,34.6 0,11.5"/>
    <rect class="mol" x="40" y="8" width="38" height="30" rx="3"/>
    <line class="mol" x1="20" y1="46.2" x2="20" y2="62"/>
    <line class="mol" x1="0" y1="11.5" x2="-14" y2="2"/>
    <line class="mol" x1="78" y1="8" x2="92" y2="-2"/>
    <line class="mol" x1="78" y1="38" x2="92" y2="48"/>
    <line class="mol" x1="59" y1="8" x2="59" y2="-8"/>
  </g>
  <!-- Steroid-like fused ring bottom-right -->
  <g transform="translate(760,440) scale(1.9)">
    <polygon class="mol" points="20,0 40,11.5 40,34.6 20,46.2 0,34.6 0,11.5"/>
    <polygon class="mol2" points="40,11.5 60,0 80,11.5 80,34.6 60,46.2 40,34.6"/>
    <polygon class="mol" points="80,11.5 100,0 120,11.5 120,34.6 100,46.2 80,34.6"/>
    <rect class="mol" x="120" y="5" width="32" height="36" rx="3"/>
    <line class="mol" x1="20" y1="46.2" x2="20" y2="62"/>
    <line class="mol" x1="100" y1="46.2" x2="100" y2="62"/>
    <line class="mol" x1="152" y1="5" x2="166" y2="-4"/>
    <line class="mol" x1="0" y1="11.5" x2="-12" y2="2"/>
  </g>
  <!-- Small ring top-center -->
  <g transform="translate(380,20) scale(1.4)">
    <polygon class="mol" points="20,0 40,11.5 40,34.6 20,46.2 0,34.6 0,11.5"/>
    <line class="mol" x1="20" y1="0" x2="20" y2="-14"/>
    <line class="mol" x1="40" y1="11.5" x2="54" y2="2"/>
    <line class="mol" x1="40" y1="34.6" x2="54" y2="43"/>
  </g>
  <!-- Indole-like top-right area -->
  <g transform="translate(820,240) scale(1.6)">
    <polygon class="mol" points="20,0 40,11.5 40,34.6 20,46.2 0,34.6 0,11.5"/>
    <polygon class="mol2" points="40,11.5 58,3 72,18 65,38 45,40 40,34.6"/>
    <line class="mol" x1="20" y1="0" x2="20" y2="-14"/>
    <line class="mol" x1="0" y1="11.5" x2="-14" y2="4"/>
    <line class="mol" x1="72" y1="18" x2="86" y2="10"/>
  </g>
  <!-- Lone ring center-left -->
  <g transform="translate(120,310) scale(1.5)">
    <polygon class="mol" points="20,0 40,11.5 40,34.6 20,46.2 0,34.6 0,11.5"/>
    <polygon class="mol2" points="20,8 32,14.9 32,28.7 20,35.6 8,28.7 8,14.9"/>
    <line class="mol" x1="40" y1="11.5" x2="56" y2="2"/>
    <line class="mol" x1="0" y1="34.6" x2="-14" y2="44"/>
  </g>
</svg>`;

// ── Components ─────────────────────────────────────────────────────────────────

function PropertyCard({ prop }) {
  const c = statusColor[prop.status] || statusColor.neutral;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: T.radius, padding: "16px 20px",
      display: "flex", flexDirection: "column", gap: 7,
      transition: "all 0.2s", cursor: "default",
      boxShadow: "0 2px 8px rgba(124,58,237,0.06)",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = T.shadowHover; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(124,58,237,0.06)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10.5, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}>{prop.name}</span>
        <span style={{ background: c.dot, borderRadius: "50%", width: 8, height: 8, display: "inline-block", boxShadow: `0 0 6px ${c.dot}` }} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: c.text, fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em" }}>
        {prop.value}
        {prop.unit && <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 5, color: T.textMuted, fontFamily: "'Lato', sans-serif" }}>{prop.unit}</span>}
      </div>
      <div style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.6, fontFamily: "'Lato', sans-serif" }}>{prop.description}</div>
    </div>
  );
}

function ToxicityCard({ tox }) {
  const c = statusColor[tox.status] || statusColor.neutral;
  const pct = Math.round(tox.probability * 100);
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: T.radius, padding: "16px 20px",
      display: "flex", flexDirection: "column", gap: 9,
      transition: "all 0.2s", boxShadow: "0 2px 8px rgba(124,58,237,0.06)",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = T.shadowHover; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(124,58,237,0.06)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}>{tox.endpoint}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: c.text, fontFamily: "'Playfair Display', serif" }}>{pct}%</span>
      </div>
      <div style={{ background: "rgba(0,0,0,0.06)", borderRadius: 99, height: 7, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${c.dot}, ${c.bar})`, borderRadius: 99, transition: "width 1s ease" }} />
      </div>
      <div style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.6, fontFamily: "'Lato', sans-serif" }}>{tox.description}</div>
    </div>
  );
}

function LipinskiBadge({ lipinski }) {
  const pass = lipinski.pass;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "8px 18px", borderRadius: 99,
      background: pass ? "#f0fdf4" : "#fff1f2",
      border: `1.5px solid ${pass ? "#bbf7d0" : "#fecdd3"}`,
      color: pass ? "#15803d" : "#be123c",
      fontFamily: "'Lato', sans-serif", fontSize: 13, fontWeight: 700,
      boxShadow: pass ? "0 2px 8px rgba(34,197,94,0.15)" : "0 2px 8px rgba(244,63,94,0.15)",
    }}>
      <span style={{ fontSize: 15 }}>{pass ? "✓" : "✗"}</span>
      Lipinski Ro5: {pass ? "PASS" : "FAIL"} &nbsp;·&nbsp; {lipinski.violations} violation{lipinski.violations !== 1 ? "s" : ""}
    </div>
  );
}

function ExamplePill({ mol, onSelect }) {
  return (
    <button onClick={() => onSelect(mol)} style={{
      background: T.accentLight, border: `1px solid ${T.accentMid}`,
      borderRadius: 99, padding: "5px 16px",
      color: T.accent, fontSize: 12, cursor: "pointer",
      fontFamily: "'Lato', sans-serif", fontWeight: 600,
      transition: "all 0.15s", whiteSpace: "nowrap",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = T.accent; e.currentTarget.style.color = "#fff"; }}
      onMouseLeave={e => { e.currentTarget.style.background = T.accentLight; e.currentTarget.style.color = T.accent; }}
    >
      {mol.name}
    </button>
  );
}

function FormulaDisplay({ formula, mw }) {
  const parts = formula.replace(/(\d+)/g, "|||$1|||").split("|||");
  return (
    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: T.text }}>
      {parts.map((p, i) => /^\d+$/.test(p) ? <sub key={i}>{p}</sub> : <span key={i}>{p}</span>)}
      {mw && <span style={{ color: T.textMuted, fontSize: 14, marginLeft: 10, fontFamily: "'Lato', sans-serif" }}>{mw} Da</span>}
    </span>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? T.grad : "transparent",
      border: active ? "none" : `1px solid ${T.border}`,
      borderRadius: T.radiusSm, padding: "8px 20px",
      color: active ? "#fff" : T.textMuted,
      fontFamily: "'Lato', sans-serif", fontSize: 13, fontWeight: 700,
      cursor: "pointer", transition: "all 0.2s",
      boxShadow: active ? "0 4px 12px rgba(124,58,237,0.3)" : "none",
    }}>
      {children}
    </button>
  );
}

const inputStyle = {
  width: "100%", background: T.bgInput,
  border: `1.5px solid ${T.border}`,
  borderRadius: T.radiusSm, padding: "11px 16px",
  color: T.text, fontFamily: "'Lato', sans-serif", fontSize: 14,
  outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
  boxShadow: "0 1px 4px rgba(124,58,237,0.06)",
};

// ── Batch ──────────────────────────────────────────────────────────────────────

function BatchScreen() {
  const [text, setText] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const parseMolecules = (raw) =>
    raw.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
      .map(l => { const p = l.split(/\s+/); return { smiles: p[0], name: p.slice(1).join(" ") || null }; });

  const molecules = parseMolecules(text);
  const validCount = molecules.filter(m => m.smiles).length;

  const analyze = async () => {
    if (!validCount) return;
    setLoading(true); setError(null); setResults([]);
    try {
      const res = await fetch(`${API}/batch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ molecules }) });
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
      const res = await fetch(`${API}/batch/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ molecules }) });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "molpredict_results.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
    finally { setExporting(false); }
  };

  const exampleText = `CC(=O)Oc1ccccc1C(=O)O Aspirin\nCC(C)Cc1ccc(cc1)C(C)C(=O)O Ibuprofen\nCn1cnc2c1c(=O)n(c(=O)n2C)C Caffeine\nCC(=O)Nc1ccc(O)cc1 Paracetamol`;

  return (
    <div>
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 28, marginBottom: 20, boxShadow: T.shadow, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>Paste Molecules</div>
            <div style={{ fontSize: 12.5, color: T.textMuted, fontFamily: "'Lato', sans-serif" }}>
              One per line: &nbsp;<span style={{ color: T.accent, fontWeight: 600 }}>SMILES &nbsp; Name (optional)</span>
            </div>
          </div>
          <button onClick={() => setText(exampleText)} style={{ background: T.accentLight, border: `1px solid ${T.accentMid}`, borderRadius: T.radiusSm, padding: "7px 16px", color: T.accent, fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif", fontWeight: 600 }}>
            Load examples
          </button>
        </div>

        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder={"CC(=O)Oc1ccccc1C(=O)O  Aspirin\nCC(C)Cc1ccc(cc1)C(C)C(=O)O  Ibuprofen\n..."}
          rows={10}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.9, fontFamily: "'Courier Prime', monospace", fontSize: 13 }}
          onFocus={e => { e.target.style.borderColor = T.borderFocus; e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.12)"; }}
          onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "0 1px 4px rgba(124,58,237,0.06)"; }}
        />

        <div style={{ fontSize: 12, color: validCount > 0 ? "#15803d" : T.textMuted, fontFamily: "'Lato', sans-serif", marginTop: 8, marginBottom: 18, fontWeight: validCount > 0 ? 600 : 400 }}>
          {validCount > 0 ? `✓ ${validCount} molecule${validCount !== 1 ? "s" : ""} detected` : "Paste SMILES above to begin"}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={analyze} disabled={loading || !validCount} style={{ background: validCount ? T.grad : "#e5e7eb", border: "none", borderRadius: T.radiusSm, padding: "11px 28px", color: validCount ? "#fff" : "#9ca3af", fontFamily: "'Lato', sans-serif", fontSize: 14, fontWeight: 700, cursor: validCount ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 9, boxShadow: validCount ? "0 4px 14px rgba(124,58,237,0.3)" : "none", transition: "all 0.2s" }}>
            {loading && <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span>}
            {loading ? `Analyzing ${validCount} molecules...` : `Analyze ${validCount} Molecule${validCount !== 1 ? "s" : ""}`}
          </button>
          {text && <button onClick={() => { setText(""); setResults([]); setError(null); }} style={{ background: "transparent", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, padding: "11px 20px", color: T.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>Clear</button>}
        </div>
      </div>

      {error && <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: T.radiusSm, padding: "14px 18px", marginBottom: 20, color: "#be123c", fontFamily: "'Lato', sans-serif", fontSize: 13 }}>✗ {error}</div>}

      {results.length > 0 && (
        <div style={{ animation: "fadeUp 0.4s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: T.text }}>
              Results — {results.length} molecule{results.length !== 1 ? "s" : ""}
            </div>
            <button onClick={exportExcel} disabled={exporting} style={{ background: "linear-gradient(135deg, #065f46, #047857)", border: "none", borderRadius: T.radiusSm, padding: "10px 22px", color: "#fff", fontFamily: "'Lato', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(4,120,87,0.3)" }}>
              {exporting ? "⏳ Exporting..." : "⬇ Download Excel"}
            </button>
          </div>
          <div style={{ overflowX: "auto", borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900, background: T.bgCard }}>
              <thead>
                <tr style={{ background: T.accentLight }}>
                  {["#","Name","SMILES","Formula","Lipinski","MW (Da)","LogP","HBD","HBA","TPSA","QED","Hepatotox %","Cardiotox %","Mutagenic %"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", fontSize: 11, color: T.accent, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Lato', sans-serif", fontWeight: 700, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap", textAlign: "center" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const pm = Object.fromEntries(r.properties.map(p => [p.name, p]));
                  const tm = Object.fromEntries(r.toxicity.map(t => [t.endpoint, t]));
                  const rowBg = i % 2 === 0 ? "rgba(255,255,255,0.9)" : "rgba(245,243,255,0.6)";
                  const td = (val, status) => ({
                    padding: "11px 14px", fontSize: 13, textAlign: "center",
                    borderBottom: `1px solid ${T.border}`, background: rowBg,
                    color: status ? statusColor[status]?.text : T.text,
                    fontFamily: "'Lato', sans-serif", whiteSpace: "nowrap", fontWeight: status ? 600 : 400,
                  });
                  return (
                    <tr key={i}>
                      <td style={td()}>{i+1}</td>
                      <td style={{ ...td(), fontWeight: 700, color: T.text }}>{r.name||"—"}</td>
                      <td style={{ ...td(), color: T.accent, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Courier Prime', monospace", fontSize: 12 }} title={r.smiles}>{r.smiles.length>22?r.smiles.slice(0,22)+"…":r.smiles}</td>
                      <td style={td()}>{r.molecular_formula||"—"}</td>
                      <td style={{ ...td(), color: r.lipinski.pass?"#15803d":"#be123c", fontWeight:700 }}>{r.lipinski.pass?"PASS":"FAIL"}</td>
                      <td style={td(null,pm["Molecular Weight"]?.status)}>{pm["Molecular Weight"]?.value??"—"}</td>
                      <td style={td(null,pm["LogP (Lipophilicity)"]?.status)}>{pm["LogP (Lipophilicity)"]?.value??"—"}</td>
                      <td style={td(null,pm["H-Bond Donors"]?.status)}>{pm["H-Bond Donors"]?.value??"—"}</td>
                      <td style={td(null,pm["H-Bond Acceptors"]?.status)}>{pm["H-Bond Acceptors"]?.value??"—"}</td>
                      <td style={td(null,pm["TPSA"]?.status)}>{pm["TPSA"]?.value??"—"}</td>
                      <td style={td(null,pm["QED Score"]?.status)}>{pm["QED Score"]?.value??"—"}</td>
                      <td style={td(null,tm["Hepatotoxicity"]?.status)}>{tm["Hepatotoxicity"]?Math.round(tm["Hepatotoxicity"].probability*100)+"%":"—"}</td>
                      <td style={td(null,tm["Cardiotoxicity (hERG)"]?.status)}>{tm["Cardiotoxicity (hERG)"]?Math.round(tm["Cardiotoxicity (hERG)"].probability*100)+"%":"—"}</td>
                      <td style={td(null,tm["Mutagenicity (Ames)"]?.status)}>{tm["Mutagenicity (Ames)"]?Math.round(tm["Mutagenicity (Ames)"].probability*100)+"%":"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 11.5, color: T.textMuted, fontFamily: "'Lato', sans-serif" }}>⬇ Download Excel for the full 3-sheet report with all properties and toxicity endpoints.</div>
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
    check(); const iv = setInterval(check, 30000); return () => clearInterval(iv);
  }, []);

  const predict = async () => {
    if (!smiles.trim()) return;
    setLoading(true); setError(null); setResult(null); setResultTab("properties");
    try {
      const res = await fetch(`${API}/predict`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ smiles: smiles.trim(), name: molName || null }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "API error");
      setResult(data); if (data.error) setError(data.error);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const selectExample = (mol) => { setSmiles(mol.smiles); setMolName(mol.name); setResult(null); setError(null); };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Lato', sans-serif", padding: "0 0 80px", position: "relative", overflow: "hidden" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Cormorant+Garamond:wght@400;600&family=Lato:wght@300;400;600;700&family=Courier+Prime&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #ede9fe; color: #6d28d9; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f5f3ff; }
        ::-webkit-scrollbar-thumb { background: #c4b5fd; border-radius: 3px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
        @keyframes floatSlow { 0%,100%{transform:translateY(0px) rotate(0deg);} 50%{transform:translateY(-12px) rotate(1deg);} }
      `}</style>

      {/* Chemical structure background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", animation: "floatSlow 18s ease-in-out infinite" }}
        dangerouslySetInnerHTML={{ __html: BG_MOLECULES }} />

      {/* Soft gradient overlay */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "radial-gradient(ellipse at 20% 20%, rgba(200,185,240,0.25) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(180,165,230,0.2) 0%, transparent 60%)" }} />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 10, borderBottom: `1px solid ${T.border}`, padding: "18px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)", boxShadow: "0 1px 20px rgba(124,58,237,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: T.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, boxShadow: "0 4px 12px rgba(124,58,237,0.35)" }}>⬡</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>MolPredict</div>
            <div style={{ fontSize: 10.5, color: T.textLight, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'Lato', sans-serif" }}>Drug-likeness Analyzer</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: apiStatus==="online"?"#22c55e":apiStatus==="offline"?"#f43f5e":"#f59e0b", boxShadow: apiStatus==="online"?"0 0 6px #22c55e":"none" }} />
          <span style={{ fontSize: 11.5, color: T.textMuted, fontFamily: "'Lato', sans-serif" }}>API {apiStatus}</span>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "52px 24px 0", position: "relative", zIndex: 10 }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 52, animation: "fadeUp 0.6s ease" }}>
          <div style={{ display: "inline-block", background: T.accentLight, border: `1px solid ${T.accentMid}`, borderRadius: 99, padding: "5px 18px", fontSize: 12, color: T.accent, fontFamily: "'Lato', sans-serif", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 18 }}>
            Computational Chemistry · Drug Discovery
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px, 5vw, 54px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, color: T.text, marginBottom: 16 }}>
            Molecule Property<br />
            <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Predictor</span>
          </h1>
          <p style={{ color: T.textMuted, fontSize: 16, maxWidth: 480, margin: "0 auto", lineHeight: 1.8, fontFamily: "'Lato', sans-serif", fontWeight: 300 }}>
            Analyze molecules for drug-likeness, physicochemical properties, toxicity estimates, and 2D structure visualization.
          </p>
        </div>

        {/* Main tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28, background: "rgba(255,255,255,0.7)", borderRadius: T.radius, padding: 5, width: "fit-content", border: `1px solid ${T.border}`, backdropFilter: "blur(8px)", boxShadow: T.shadow }}>
          {[["single","⬡ Single Molecule"],["batch","⊞ Batch Screening"]].map(([key, label]) => (
            <TabBtn key={key} active={mainTab===key} onClick={() => setMainTab(key)}>{label}</TabBtn>
          ))}
        </div>

        {/* Single mode */}
        {mainTab === "single" && (
          <>
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 30, marginBottom: 24, boxShadow: T.shadow, backdropFilter: "blur(12px)", animation: "fadeUp 0.5s ease 0.1s both" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, marginBottom: 18 }}>
                <div>
                  <label style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Lato', sans-serif", fontWeight: 700, display: "block", marginBottom: 7 }}>SMILES String *</label>
                  <input value={smiles} onChange={e => setSmiles(e.target.value)} onKeyDown={e => e.key==="Enter" && predict()}
                    placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O"
                    style={{ ...inputStyle, fontFamily: "'Courier Prime', monospace" }}
                    onFocus={e => { e.target.style.borderColor=T.borderFocus; e.target.style.boxShadow="0 0 0 3px rgba(124,58,237,0.12)"; }}
                    onBlur={e => { e.target.style.borderColor=T.border; e.target.style.boxShadow="0 1px 4px rgba(124,58,237,0.06)"; }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Lato', sans-serif", fontWeight: 700, display: "block", marginBottom: 7 }}>Name (optional)</label>
                  <input value={molName} onChange={e => setMolName(e.target.value)} placeholder="e.g. Aspirin"
                    style={{ ...inputStyle, width: 190 }}
                    onFocus={e => { e.target.style.borderColor=T.borderFocus; e.target.style.boxShadow="0 0 0 3px rgba(124,58,237,0.12)"; }}
                    onBlur={e => { e.target.style.borderColor=T.border; e.target.style.boxShadow="0 1px 4px rgba(124,58,237,0.06)"; }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={predict} disabled={loading||!smiles.trim()} style={{ background: smiles.trim()?T.grad:"#e5e7eb", border:"none", borderRadius:T.radiusSm, padding:"11px 30px", color:smiles.trim()?"#fff":"#9ca3af", fontFamily:"'Lato', sans-serif", fontSize:14, fontWeight:700, cursor:smiles.trim()?"pointer":"not-allowed", display:"flex", alignItems:"center", gap:9, boxShadow:smiles.trim()?"0 4px 14px rgba(124,58,237,0.3)":"none", transition:"all 0.2s" }}>
                  {loading && <span style={{ animation:"spin 0.8s linear infinite", display:"inline-block" }}>◌</span>}
                  {loading?"Analyzing...":"Analyze Molecule"}
                </button>
                {smiles && <button onClick={() => { setSmiles(""); setMolName(""); setResult(null); setError(null); }} style={{ background:"transparent", border:`1.5px solid ${T.border}`, borderRadius:T.radiusSm, padding:"11px 20px", color:T.textMuted, fontSize:13, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>Clear</button>}
              </div>
            </div>

            {examples.length > 0 && (
              <div style={{ marginBottom: 32, animation: "fadeUp 0.5s ease 0.2s both" }}>
                <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Lato', sans-serif", fontWeight: 700, marginBottom: 10 }}>Try an example →</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{examples.map(mol => <ExamplePill key={mol.name} mol={mol} onSelect={selectExample} />)}</div>
              </div>
            )}

            {error && <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:T.radiusSm, padding:"14px 18px", marginBottom:24, color:"#be123c", fontFamily:"'Lato', sans-serif", fontSize:13 }}>✗ {error}</div>}

            {result && result.valid && (
              <div style={{ animation:"fadeUp 0.4s ease" }}>
                {/* Molecule header */}
                <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:T.radius, padding:24, marginBottom:20, display:"flex", flexWrap:"wrap", gap:16, alignItems:"center", justifyContent:"space-between", boxShadow:T.shadow, backdropFilter:"blur(12px)" }}>
                  <div>
                    {result.name && <div style={{ fontFamily:"'Playfair Display', serif", fontSize:24, fontWeight:700, marginBottom:6, color:T.text }}>{result.name}</div>}
                    <div style={{ fontFamily:"'Courier Prime', monospace", fontSize:13, color:T.accent, background:T.accentLight, padding:"4px 12px", borderRadius:6, display:"inline-block", marginBottom:10 }}>
                      {result.smiles.length>60?result.smiles.slice(0,60)+"…":result.smiles}
                    </div>
                    {result.molecular_formula && <div><FormulaDisplay formula={result.molecular_formula} mw={result.molecular_weight} /></div>}
                  </div>
                  <LipinskiBadge lipinski={result.lipinski} />
                </div>

                {/* Result tabs */}
                <div style={{ display:"flex", gap:6, marginBottom:20, background:"rgba(255,255,255,0.7)", borderRadius:T.radius, padding:5, width:"fit-content", border:`1px solid ${T.border}`, backdropFilter:"blur(8px)" }}>
                  {[["properties","⚗ Properties"],["toxicity","⚠ Toxicity"],["structure","🔬 Structure"]].map(([key,label]) => (
                    <TabBtn key={key} active={resultTab===key} onClick={() => setResultTab(key)}>{label}</TabBtn>
                  ))}
                </div>

                {resultTab==="properties" && (
                  <>
                    <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:T.radius, padding:"14px 22px", marginBottom:20, display:"flex", flexWrap:"wrap", gap:14, boxShadow:T.shadow }}>
                      {[["MW ≤ 500",result.lipinski.mw_ok],["LogP ≤ 5",result.lipinski.logp_ok],["HBD ≤ 5",result.lipinski.hbd_ok],["HBA ≤ 10",result.lipinski.hba_ok]].map(([label,ok]) => (
                        <div key={label} style={{ display:"flex", alignItems:"center", gap:6, fontFamily:"'Lato', sans-serif", fontSize:13, fontWeight:600, color:ok?"#15803d":"#be123c" }}>
                          {ok?"✓":"✗"} {label}
                        </div>
                      ))}
                      <div style={{ fontSize:11, color:T.textMuted, marginLeft:"auto", alignSelf:"center", fontFamily:"'Lato', sans-serif" }}>Lipinski Rule of Five</div>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:14 }}>
                      {result.properties.map(p => <PropertyCard key={p.name} prop={p} />)}
                    </div>
                  </>
                )}

                {resultTab==="toxicity" && (
                  <>
                    <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:T.radiusSm, padding:"12px 18px", marginBottom:20, color:"#b45309", fontSize:12.5, fontFamily:"'Lato', sans-serif" }}>
                      ⚠ Rule-based computational estimates only. Always validate experimentally.
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:14 }}>
                      {result.toxicity.map(t => <ToxicityCard key={t.endpoint} tox={t} />)}
                    </div>
                  </>
                )}

                {resultTab==="structure" && (
                  <div style={{ display:"flex", justifyContent:"center" }}>
                    {result.structure_url ? (
                      <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:T.radius, padding:28, display:"inline-block", boxShadow:T.shadow, backdropFilter:"blur(12px)" }}>
                        <div style={{ fontSize:11, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", fontFamily:"'Lato', sans-serif", fontWeight:700, marginBottom:16, textAlign:"center" }}>2D Molecular Structure</div>
                        <img src={result.structure_url} alt="2D structure" style={{ maxWidth:"100%", width:400, height:300, borderRadius:10, display:"block", border:`1px solid ${T.border}` }} />
                        {result.name && <div style={{ textAlign:"center", marginTop:14, fontFamily:"'Playfair Display', serif", fontSize:16, color:T.textMuted }}>{result.name}</div>}
                      </div>
                    ) : (
                      <div style={{ color:T.textMuted, fontFamily:"'Lato', sans-serif", fontSize:13, padding:40 }}>Structure image not available.</div>
                    )}
                  </div>
                )}

                <div style={{ marginTop:24, padding:"14px 18px", background:"rgba(255,251,235,0.8)", borderRadius:T.radiusSm, fontSize:12, color:"#92400e", fontFamily:"'Lato', sans-serif", border:"1px solid #fde68a" }}>
                  ⚠ Computational predictions only. Properties computed using RDKit. QED from Bickerton et al. (2012).
                </div>
              </div>
            )}

            {!result && !loading && !error && (
              <div style={{ textAlign:"center", padding:"70px 0", color:T.accentMid }}>
                <div style={{ fontSize:52, marginBottom:14, opacity:0.4 }}>⬡</div>
                <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:16, color:T.textMuted }}>Enter a SMILES string to begin analysis</div>
              </div>
            )}
          </>
        )}

        {mainTab==="batch" && <BatchScreen />}
      </div>
    </div>
  );
}
