import React, { useState, useEffect } from "react";

const API = "https://molpredict.onrender.com";

// ── Interactive 3D Molecule Viewer using 3Dmol.js ─────────────────────────────
function Molecule3DViewer({ smiles, name }) {
  const viewerRef = React.useRef(null);
  const [status, setStatus] = React.useState("loading"); // loading | ready | error

  React.useEffect(() => {
    if (!smiles) return;
    setStatus("loading");

    // Load 3Dmol.js script if not already loaded
    const load3Dmol = () => new Promise((resolve, reject) => {
      if (window.$3Dmol) { resolve(); return; }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.0.4/3Dmol-min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    // Fetch SDF from PubChem using SMILES → CID → SDF
    const fetchSDF = async () => {
      try {
        // Step 1: SMILES → CID
        const cidRes = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/cids/JSON`
        );
        if (!cidRes.ok) throw new Error("Not found in PubChem");
        const cidData = await cidRes.json();
        const cid = cidData.IdentifierList?.CID?.[0];
        if (!cid) throw new Error("No CID found");

        // Step 2: CID → 3D SDF
        const sdfRes = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`
        );
        if (!sdfRes.ok) throw new Error("No 3D SDF available");
        return await sdfRes.text();
      } catch {
        return null;
      }
    };

    const init = async () => {
      try {
        await load3Dmol();
        const sdf = await fetchSDF();

        if (!viewerRef.current) return;
        viewerRef.current.innerHTML = "";

        const viewer = window.$3Dmol.createViewer(viewerRef.current, {
          backgroundColor: "rgba(10,4,30,0)",
          antialias: true,
        });

        if (sdf) {
          viewer.addModel(sdf, "sdf");
        } else {
          // Fallback: use SMILES via pubchem 2D coords converted
          setStatus("error"); return;
        }

        // Stylized rendering
        viewer.setStyle({}, {
          stick: { radius: 0.15, colorscheme: "rasmol" },
          sphere: { scale: 0.3, colorscheme: "rasmol" }
        });

        // Add surface with transparency
        viewer.addSurface(window.$3Dmol.SurfaceType.VDW, {
          opacity: 0.08,
          color: "lightblue"
        });

        viewer.zoomTo();
        viewer.zoom(0.85);
        viewer.render();

        // Auto-spin
        viewer.spin("y", 0.5);

        setStatus("ready");
      } catch (e) {
        setStatus("error");
      }
    };

    init();
  }, [smiles]);

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={viewerRef}
        style={{
          width: "100%", height: 420, borderRadius: 12,
          background: "radial-gradient(ellipse at center, rgba(30,10,80,0.9) 0%, rgba(5,2,20,0.95) 100%)",
          border: "1px solid rgba(167,139,250,0.2)",
          overflow: "hidden", position: "relative"
        }}
      />
      {status === "loading" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 14,
          background: "radial-gradient(ellipse at center, rgba(20,8,60,0.95) 0%, rgba(5,2,20,0.98) 100%)",
          borderRadius: 12,
        }}>
          <div style={{ width: 48, height: 48, border: "3px solid rgba(124,58,237,0.3)", borderTop: "3px solid #a855f7", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <div style={{ color: "#c4b5fd", fontFamily: "Arial, sans-serif", fontSize: 13 }}>Loading 3D structure from PubChem...</div>
        </div>
      )}
      {status === "error" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 12,
          background: "radial-gradient(ellipse at center, rgba(20,8,60,0.95) 0%, rgba(5,2,20,0.98) 100%)",
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 36 }}>⚗️</div>
          <div style={{ color: "#c4b5fd", fontFamily: "Arial, sans-serif", fontSize: 13, textAlign: "center", maxWidth: 280 }}>
            3D structure not available in PubChem for this molecule.
            <br/><br/>
            <span style={{ color: "#7c5cbf", fontSize: 12 }}>Try a common drug like Aspirin, Ibuprofen, or Caffeine.</span>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Ketcher Molecular Editor ───────────────────────────────────────────────────
function KetcherEditor({ onSmilesChange, initialSmiles }) {
  const iframeRef = React.useRef(null);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState(false);

  // Poll for Ketcher to be ready inside the iframe
  React.useEffect(() => {
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      try {
        const ketcher = iframeRef.current?.contentWindow?.ketcher;
        if (ketcher) {
          setReady(true);
          clearInterval(poll);
          // Load initial SMILES if provided
          if (initialSmiles) {
            ketcher.setMolecule(initialSmiles).catch(() => {});
          }
        }
      } catch(e) {}
      if (attempts > 60) { clearInterval(poll); setError(true); }
    }, 500);
    return () => clearInterval(poll);
  }, []);

  // When initialSmiles changes from outside, push to ketcher
  React.useEffect(() => {
    if (!ready || !initialSmiles) return;
    try {
      const ketcher = iframeRef.current?.contentWindow?.ketcher;
      if (ketcher) ketcher.setMolecule(initialSmiles).catch(() => {});
    } catch(e) {}
  }, [initialSmiles, ready]);

  const getSmiles = async () => {
    try {
      const ketcher = iframeRef.current?.contentWindow?.ketcher;
      if (!ketcher) return;
      const smiles = await ketcher.getSmiles();
      if (smiles && smiles.trim()) onSmilesChange(smiles.trim());
    } catch(e) {
      console.error("Ketcher SMILES error:", e);
    }
  };

  const clearEditor = () => {
    try {
      const ketcher = iframeRef.current?.contentWindow?.ketcher;
      if (ketcher) ketcher.setMolecule("");
    } catch(e) {}
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(167,139,250,0.3)", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
        {!ready && !error && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,4,30,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, zIndex: 10, borderRadius: 12 }}>
            <div style={{ width: 44, height: 44, border: "3px solid rgba(124,58,237,0.3)", borderTop: "3px solid #a855f7", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <div style={{ color: "#c4b5fd", fontFamily: "Arial,sans-serif", fontSize: 13 }}>Loading Ketcher editor…</div>
          </div>
        )}
        {error && (
          <div style={{ height: 400, background: "rgba(10,4,30,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, borderRadius: 12 }}>
            <div style={{ fontSize: 36 }}>⚗️</div>
            <div style={{ color: "#f87171", fontFamily: "Arial,sans-serif", fontSize: 13, textAlign: "center" }}>
              Ketcher editor could not load.<br/>
              <span style={{ fontSize: 11, color: "#a78bfa" }}>Try refreshing or use the SMILES input directly.</span>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src="https://lifescience.opensource.epam.com/KetcherDemoSPA/index.html"
          style={{ width: "100%", height: 480, border: "none", display: "block", background: "#fff" }}
          title="Ketcher Molecular Editor"
          onError={() => setError(true)}
        />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={getSmiles}
          disabled={!ready}
          style={{ background: ready ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "rgba(60,20,100,0.3)", border: "none", borderRadius: 10, padding: "12px 28px", color: "#fff", fontFamily: "Arial,sans-serif", fontSize: 14, fontWeight: 700, cursor: ready ? "pointer" : "not-allowed", boxShadow: ready ? "0 4px 16px rgba(124,58,237,0.4)" : "none", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" }}>
          ⬇ Use This Structure
        </button>
        <button
          onClick={clearEditor}
          disabled={!ready}
          style={{ background: "transparent", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 10, padding: "12px 20px", color: "#a78bfa", fontFamily: "Arial,sans-serif", fontSize: 13, cursor: ready ? "pointer" : "not-allowed" }}>
          🗑 Clear
        </button>
        {!ready && !error && (
          <span style={{ alignSelf: "center", fontSize: 12, color: "#a78bfa", fontFamily: "Arial,sans-serif" }}>⏳ Loading editor…</span>
        )}
        {ready && (
          <span style={{ alignSelf: "center", fontSize: 12, color: "#34d399", fontFamily: "Arial,sans-serif" }}>✓ Editor ready — draw your molecule, then click "Use This Structure"</span>
        )}
      </div>
    </div>
  );
}


// ── AI Chat Assistant ──────────────────────────────────────────────────────────
function AIChatAssistant({ moleculeData, scaffoldResult, painsResult, targetsResult, leadoptResult }) {
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const messagesEndRef = React.useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  React.useEffect(scrollToBottom, [messages]);

  const SUGGESTIONS = [
    "Explain this molecule's drug-likeness in plain English",
    "What are the biggest concerns with this molecule?",
    "Compare this to known drugs with similar properties",
    "Suggest 3 structural modifications to improve bioavailability",
    "What pharmacophore features does this molecule have?",
    "What therapeutic targets could this molecule hit?",
    "How does the ADMET profile compare to approved oral drugs?",
    "What toxicity alerts should I be concerned about?",
  ];

  const buildSystemPrompt = () => {
    if (!moleculeData) return "You are an expert medicinal chemist and drug discovery scientist. Answer questions concisely and helpfully.";

    const props = moleculeData.properties?.map(p => `${p.name}: ${p.value} ${p.unit} (${p.status})`).join(", ") || "";
    const tox = moleculeData.toxicity?.map(t => `${t.endpoint}: ${Math.round(t.probability*100)}% (${t.status})`).join(", ") || "";
    const admet = moleculeData.admet?.map(a => `${a.endpoint}: ${a.value} ${a.unit} (${a.status})`).join(", ") || "";
    const pains = painsResult?.alerts?.length ? `PAINS alerts: ${painsResult.alerts.map(a => a.name).join(", ")}` : "No PAINS alerts detected";
    const targets = targetsResult?.predictions?.slice(0,5).map(t => `${t.target} (${t.family})`).join(", ") || "";
    const scaffold = scaffoldResult?.murcko_scaffold ? `Murcko scaffold: ${scaffoldResult.murcko_scaffold}` : "";
    const leadopt = leadoptResult?.suggestions?.slice(0,3).map(s => s.title).join("; ") || "";

    return `You are an expert medicinal chemist and drug discovery scientist. You are analyzing a specific molecule and answering questions about it.

MOLECULE DATA:
- Name: ${moleculeData.name || "Unnamed"}
- SMILES: ${moleculeData.smiles}
- Formula: ${moleculeData.molecular_formula || "Unknown"}
- Lipinski: ${moleculeData.lipinski?.pass ? "PASS" : "FAIL"} (${moleculeData.lipinski?.violations} violations)
- Properties: ${props}
- Toxicity estimates: ${tox}
- ADMET: ${admet}
- ${pains}
- Predicted targets: ${targets || "Not yet analyzed"}
- ${scaffold}
- Lead opt suggestions: ${leadopt || "Not yet analyzed"}

INSTRUCTIONS:
- Be concise but insightful. Use markdown formatting.
- Reference specific numbers from the data when relevant.
- When comparing to known drugs, use real examples.
- For pharmacophore modeling, describe key features (HBA, HBD, aromatic rings, hydrophobic regions, charges).
- Always distinguish computational predictions from experimental facts.
- Keep responses to ~200-400 words unless the question demands more detail.`;
  };

  const sendMessage = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg) return;
    setInput("");
    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystemPrompt(),
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || "Sorry, I couldn't generate a response.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch(e) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠ Connection error. Please try again." }]);
    }
    setLoading(false);
  };

  const renderMarkdown = (text) => {
    // Simple markdown renderer for bold, italic, code, bullets
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e2d9f3">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em style="color:#c4b5fd">$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:rgba(124,58,237,0.2);padding:1px 6px;border-radius:4px;font-family:monospace;font-size:12px;color:#a78bfa">$1</code>')
      .replace(/^### (.+)$/gm, '<div style="font-size:14px;font-weight:700;color:#e2d9f3;margin:10px 0 4px">$1</div>')
      .replace(/^## (.+)$/gm, '<div style="font-size:15px;font-weight:700;color:#f0eaff;margin:12px 0 6px">$1</div>')
      .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#a78bfa;flex-shrink:0">•</span><span>$1</span></div>')
      .replace(/^\d+\. (.+)$/gm, (m, p1, offset, str) => `<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#a78bfa;flex-shrink:0">${m.match(/^\d+/)[0]}.</span><span>${p1}</span></div>`)
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 600, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, backdropFilter: "blur(12px)", boxShadow: T.shadow, overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, background: "linear-gradient(135deg,rgba(124,58,237,0.15),rgba(168,85,247,0.08))", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: "0 4px 12px rgba(124,58,237,0.4)" }}>🤖</div>
        <div>
          <div style={{ fontFamily: "Arial,sans-serif", fontSize: 15, fontWeight: 700, color: T.text }}>MolPredict AI</div>
          <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "Arial,sans-serif" }}>
            {moleculeData ? `Analyzing: ${moleculeData.name || moleculeData.smiles?.slice(0,30) + "…"}` : "Load a molecule first to unlock full analysis"}
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} style={{ marginLeft: "auto", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "5px 12px", color: "#f87171", fontSize: 11, cursor: "pointer", fontFamily: "Arial,sans-serif" }}>
            Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {!moleculeData ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.5 }}>🧬</div>
                <div style={{ fontFamily: "Arial,sans-serif", fontSize: 14, color: T.textMuted, marginBottom: 6 }}>No molecule loaded</div>
                <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12, color: "rgba(167,139,250,0.5)" }}>Analyze a molecule in Single Molecule mode first,<br/>then come back here to chat about it.</div>
              </div>
            ) : (
              <div>
                <div style={{ fontFamily: "Arial,sans-serif", fontSize: 13, color: T.textMuted, marginBottom: 14, textAlign: "center" }}>
                  💡 Ask anything about this molecule, or try a suggestion:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s)}
                      style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 99, padding: "7px 14px", color: "#c4b5fd", fontSize: 12, cursor: "pointer", fontFamily: "Arial,sans-serif", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(124,58,237,0.25)"; e.currentTarget.style.borderColor = T.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(124,58,237,0.1)"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.3)"; }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", gap: 10, flexDirection: msg.role === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              background: msg.role === "user" ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "rgba(124,58,237,0.15)",
              border: msg.role === "assistant" ? "1px solid rgba(124,58,237,0.3)" : "none" }}>
              {msg.role === "user" ? "👤" : "🤖"}
            </div>
            <div style={{ maxWidth: "80%", background: msg.role === "user" ? "linear-gradient(135deg,rgba(124,58,237,0.3),rgba(168,85,247,0.2))" : "rgba(255,255,255,0.04)",
              border: `1px solid ${msg.role === "user" ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: msg.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
              padding: "10px 14px", fontSize: 13, color: T.text, fontFamily: "Arial,sans-serif", lineHeight: 1.7 }}>
              {msg.role === "assistant"
                ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                : msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🤖</div>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px 14px 14px 14px", padding: "12px 16px", display: "flex", gap: 5, alignItems: "center" }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#a78bfa", animation: `bounce${i} 1.2s ease-in-out infinite`, animationDelay: `${i*0.2}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, background: "rgba(10,4,30,0.4)", display: "flex", gap: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder={moleculeData ? "Ask about this molecule…" : "Load a molecule first…"}
          disabled={!moleculeData || loading}
          style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", color: T.text, fontFamily: "Arial,sans-serif", fontSize: 13, outline: "none" }}
          onFocus={e => e.target.style.borderColor = T.accent}
          onBlur={e => e.target.style.borderColor = T.border}
        />
        <button onClick={() => sendMessage()} disabled={!input.trim() || loading || !moleculeData}
          style={{ background: (input.trim() && !loading && moleculeData) ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "rgba(60,20,100,0.3)", border: "none", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", cursor: (input.trim() && !loading && moleculeData) ? "pointer" : "not-allowed", fontSize: 18, transition: "all 0.2s", boxShadow: (input.trim() && !loading && moleculeData) ? "0 4px 12px rgba(124,58,237,0.4)" : "none" }}>
          ➤
        </button>
      </div>
    </div>
  );
}


// ── Animated Molecular Background ─────────────────────────────────────────────
function MolecularBackground() {
  useEffect(() => {
    const canvas = document.getElementById("mol-bg-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    let animId;

    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", resize);

    // Molecule atom class
    class Atom {
      constructor(x, y, r, color, vx, vy) {
        this.x = x; this.y = y; this.r = r;
        this.color = color; this.vx = vx; this.vy = vy;
        this.angle = Math.random() * Math.PI * 2;
        this.orbitR = 0; this.orbitSpeed = 0;
      }
      update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x < -50) this.x = W + 50;
        if (this.x > W + 50) this.x = -50;
        if (this.y < -50) this.y = H + 50;
        if (this.y > H + 50) this.y = -50;
        this.angle += 0.008;
      }
      draw(ctx) {
        // Glow
        const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 2.5);
        grd.addColorStop(0, this.color.replace("1)", "0.9)"));
        grd.addColorStop(0.4, this.color.replace("1)", "0.4)"));
        grd.addColorStop(1, this.color.replace("1)", "0)"));
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        // Core
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        // Shine
        ctx.beginPath();
        ctx.arc(this.x - this.r * 0.3, this.y - this.r * 0.3, this.r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fill();
      }
    }

    // Molecule: a central atom + bonded atoms
    class Molecule {
      constructor() { this.reset(); }
      reset() {
        this.cx = Math.random() * W;
        this.cy = Math.random() * H;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.angle = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.005;
        const palettes = [
          ["rgba(100,180,255,1)", "rgba(255,80,80,1)", "rgba(200,200,200,1)"],
          ["rgba(140,100,255,1)", "rgba(80,220,180,1)", "rgba(255,200,80,1)"],
          ["rgba(60,160,255,1)",  "rgba(255,120,60,1)", "rgba(180,180,255,1)"],
        ];
        this.palette = palettes[Math.floor(Math.random() * palettes.length)];
        this.bondLen = 40 + Math.random() * 30;
        const types = ["linear", "bent", "trigonal", "tetrahedral"];
        this.type = types[Math.floor(Math.random() * types.length)];
        this.size = 0.5 + Math.random() * 0.8;
      }
      getBondPositions() {
        const positions = [];
        if (this.type === "linear") {
          positions.push([this.angle, this.bondLen], [this.angle + Math.PI, this.bondLen]);
        } else if (this.type === "bent") {
          positions.push([this.angle, this.bondLen], [this.angle + 2.1, this.bondLen * 0.9]);
        } else if (this.type === "trigonal") {
          for (let i = 0; i < 3; i++) positions.push([this.angle + (i * Math.PI * 2) / 3, this.bondLen]);
        } else {
          for (let i = 0; i < 4; i++) positions.push([this.angle + (i * Math.PI * 2) / 4, this.bondLen * (i % 2 === 0 ? 1 : 0.85)]);
        }
        return positions;
      }
      draw(ctx) {
        const bonds = this.getBondPositions();
        const r = 7 * this.size;

        // Draw bonds
        bonds.forEach(([a, d]) => {
          const bx = this.cx + Math.cos(a) * d;
          const by = this.cy + Math.sin(a) * d;
          const grad = ctx.createLinearGradient(this.cx, this.cy, bx, by);
          grad.addColorStop(0, this.palette[0].replace("1)", "0.6)"));
          grad.addColorStop(1, this.palette[1].replace("1)", "0.4)"));
          ctx.beginPath();
          ctx.moveTo(this.cx, this.cy);
          ctx.lineTo(bx, by);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2 * this.size;
          ctx.stroke();
        });

        // Central atom
        new Atom(this.cx, this.cy, r, this.palette[0], 0, 0).draw(ctx);

        // Bonded atoms
        bonds.forEach(([a, d], i) => {
          const bx = this.cx + Math.cos(a) * d;
          const by = this.cy + Math.sin(a) * d;
          const color = i === 0 ? this.palette[1] : (i === 1 ? this.palette[2] : this.palette[i % 3]);
          new Atom(bx, by, r * 0.75, color, 0, 0).draw(ctx);
        });
      }
      update() {
        this.cx += this.vx; this.cy += this.vy;
        this.angle += this.rotSpeed;
        if (this.cx < -100) this.cx = W + 100;
        if (this.cx > W + 100) this.cx = -100;
        if (this.cy < -100) this.cy = H + 100;
        if (this.cy > H + 100) this.cy = -100;
      }
    }

    // DNA helix
    class DNAHelix {
      constructor(x, y) {
        this.x = x; this.y = y;
        this.t = Math.random() * Math.PI * 2;
        this.speed = 0.008 + Math.random() * 0.006;
        this.height = 200 + Math.random() * 150;
        this.width = 25 + Math.random() * 15;
      }
      draw(ctx) {
        const steps = 40;
        const stepH = this.height / steps;
        for (let i = 0; i < steps; i++) {
          const y1 = this.y - this.height / 2 + i * stepH;
          const y2 = y1 + stepH;
          const x1a = this.x + Math.cos(this.t + i * 0.35) * this.width;
          const x1b = this.x - Math.cos(this.t + i * 0.35) * this.width;
          const x2a = this.x + Math.cos(this.t + (i + 1) * 0.35) * this.width;
          const x2b = this.x - Math.cos(this.t + (i + 1) * 0.35) * this.width;

          // Strand A
          ctx.beginPath(); ctx.moveTo(x1a, y1); ctx.lineTo(x2a, y2);
          ctx.strokeStyle = "rgba(100,180,255,0.5)"; ctx.lineWidth = 1.5; ctx.stroke();
          // Strand B
          ctx.beginPath(); ctx.moveTo(x1b, y1); ctx.lineTo(x2b, y2);
          ctx.strokeStyle = "rgba(180,100,255,0.5)"; ctx.lineWidth = 1.5; ctx.stroke();
          // Base pairs every 3 steps
          if (i % 3 === 0) {
            ctx.beginPath(); ctx.moveTo(x1a, y1); ctx.lineTo(x1b, y1);
            const pairGrad = ctx.createLinearGradient(x1a, y1, x1b, y1);
            pairGrad.addColorStop(0, "rgba(100,220,255,0.6)");
            pairGrad.addColorStop(0.5, "rgba(255,150,255,0.6)");
            pairGrad.addColorStop(1, "rgba(100,220,255,0.6)");
            ctx.strokeStyle = pairGrad; ctx.lineWidth = 1; ctx.stroke();
            // Dots at ends
            ctx.beginPath(); ctx.arc(x1a, y1, 2.5, 0, Math.PI*2);
            ctx.fillStyle = "rgba(100,220,255,0.8)"; ctx.fill();
            ctx.beginPath(); ctx.arc(x1b, y1, 2.5, 0, Math.PI*2);
            ctx.fillStyle = "rgba(255,150,255,0.8)"; ctx.fill();
          }
        }
        this.t += this.speed;
      }
    }

    // Floating particles
    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * W; this.y = Math.random() * H;
        this.r = 1 + Math.random() * 2;
        this.vx = (Math.random() - 0.5) * 0.3; this.vy = (Math.random() - 0.5) * 0.3;
        this.alpha = 0.2 + Math.random() * 0.5;
        this.color = Math.random() > 0.5 ? "100,180,255" : "180,100,255";
      }
      update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
      }
      draw(ctx) {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(${this.color},${this.alpha})`; ctx.fill();
      }
    }

    // Create scene objects
    const molecules = Array.from({length: 12}, () => new Molecule());
    const dnaHelices = [
      new DNAHelix(W * 0.15, H * 0.5),
      new DNAHelix(W * 0.85, H * 0.45),
      new DNAHelix(W * 0.5, H * 0.85),
    ];
    const particles = Array.from({length: 80}, () => new Particle());

    // Connection lines between nearby molecules
    const drawConnections = () => {
      for (let i = 0; i < molecules.length; i++) {
        for (let j = i + 1; j < molecules.length; j++) {
          const dx = molecules[i].cx - molecules[j].cx;
          const dy = molecules[i].cy - molecules[j].cy;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 200) {
            ctx.beginPath();
            ctx.moveTo(molecules[i].cx, molecules[i].cy);
            ctx.lineTo(molecules[j].cx, molecules[j].cy);
            ctx.strokeStyle = `rgba(140,100,255,${0.15 * (1 - dist/200)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
    };

    // Animate
    const animate = () => {
      ctx.clearRect(0, 0, W, H);

      // Deep space background
      const bgGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H));
      bgGrad.addColorStop(0, "#1a0840");
      bgGrad.addColorStop(0.5, "#0d0525");
      bgGrad.addColorStop(1, "#050110");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Subtle grid
      ctx.strokeStyle = "rgba(100,60,200,0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

      // Draw particles
      particles.forEach(p => { p.update(); p.draw(ctx); });

      // Draw DNA helices
      dnaHelices.forEach(d => d.draw(ctx));

      // Draw connections
      drawConnections();

      // Draw molecules
      molecules.forEach(m => { m.update(); m.draw(ctx); });

      // Central glow
      const cg = ctx.createRadialGradient(W/2, H*0.35, 0, W/2, H*0.35, 300);
      cg.addColorStop(0, "rgba(120,60,255,0.12)");
      cg.addColorStop(1, "rgba(120,60,255,0)");
      ctx.fillStyle = cg; ctx.fillRect(0,0,W,H);

      animId = requestAnimationFrame(animate);
    };

    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas id="mol-bg-canvas" style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none" }} />;
}



// ── Design tokens — light, elegant, violet ─────────────────────────────────────
const T = {
  bg:          "#0f0a1e",
  bgCard:      "rgba(20,10,50,0.72)",
  bgCardHover: "rgba(25,12,60,0.90)",
  bgInput:     "rgba(255,255,255,0.12)",
  border:      "rgba(167,139,250,0.25)",
  borderFocus: "#7c3aed",
  text:        "#f0eaff",
  textMuted:   "#a78bfa",
  textLight:   "#c4b5fd",
  accent:      "#7c3aed",
  accentLight: "rgba(124,58,237,0.25)",
  accentMid:   "rgba(167,139,250,0.5)",
  grad:        "linear-gradient(135deg, #7c3aed, #a855f7)",
  gradSoft:    "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(168,85,247,0.2))",
  shadow:      "0 4px 24px rgba(0,0,0,0.4)",
  shadowHover: "0 8px 32px rgba(124,58,237,0.4)",
  radius:      14,
  radiusSm:    8,
};

const statusColor = {
  good:    { bg: "rgba(20,83,45,0.35)", border: "rgba(74,222,128,0.3)", text: "#4ade80", dot: "#22c55e", bar: "#4ade80" },
  warning: { bg: "rgba(120,80,0,0.3)", border: "rgba(251,191,36,0.3)", text: "#fbbf24", dot: "#f59e0b", bar: "#fbbf24" },
  bad:     { bg: "rgba(136,19,55,0.3)", border: "rgba(251,113,133,0.3)", text: "#fb7185", dot: "#f43f5e", bar: "#fb7185" },
  neutral: { bg: "rgba(109,40,217,0.2)", border: "rgba(167,139,250,0.3)", text: "#c4b5fd", dot: "#8b5cf6", bar: "#a78bfa" },
};



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
        <span style={{ fontSize: 10.5, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", fontWeight: 700 }}>{prop.name}</span>
        <span style={{ background: c.dot, borderRadius: "50%", width: 8, height: 8, display: "inline-block", boxShadow: `0 0 6px ${c.dot}` }} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: c.text, fontFamily: "Arial, sans-serif" }}>
        {prop.value}
        {prop.unit && <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 5, color: "#a78bfa", fontFamily: "Arial, sans-serif" }}>{prop.unit}</span>}
      </div>
      <div style={{ fontSize: 11.5, color: "#a78bfa", lineHeight: 1.6, fontFamily: "Arial, sans-serif" }}>{prop.description}</div>
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
        <span style={{ fontSize: 10.5, color: "#c4b5fd", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Arial, sans-serif", fontWeight: 700 }}>{tox.endpoint}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: c.text, fontFamily: "Arial, sans-serif" }}>{pct}%</span>
      </div>
      <div style={{ background: "rgba(0,0,0,0.06)", borderRadius: 99, height: 7, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${c.dot}, ${c.bar})`, borderRadius: 99, transition: "width 1s ease" }} />
      </div>
      <div style={{ fontSize: 11.5, color: "#a78bfa", lineHeight: 1.6, fontFamily: "Arial, sans-serif" }}>{tox.description}</div>
    </div>
  );
}

function LipinskiBadge({ lipinski }) {
  const pass = lipinski.pass;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "8px 18px", borderRadius: 99,
      background: pass ? "rgba(20,83,45,0.4)" : "rgba(136,19,55,0.4)",
      border: `1.5px solid ${pass ? "rgba(74,222,128,0.5)" : "rgba(251,113,133,0.5)"}`,
      color: pass ? "#4ade80" : "#fb7185",
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
      background: "rgba(124,58,237,0.3)", border: "1px solid rgba(167,139,250,0.5)",
      borderRadius: 99, padding: "5px 16px",
      color: "#ffffff", fontSize: 12, cursor: "pointer",
      fontFamily: "'Lato', sans-serif", fontWeight: 600,
      transition: "all 0.15s", whiteSpace: "nowrap",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = T.accent; e.currentTarget.style.borderColor = T.accent; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(124,58,237,0.3)"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.5)"; }}
    >
      {mol.name}
    </button>
  );
}

function FormulaDisplay({ formula, mw }) {
  const parts = formula.replace(/(\d+)/g, "|||$1|||").split("|||");
  return (
    <span style={{ fontFamily: "Arial, sans-serif", fontSize: 20, fontWeight: 700, color: "#ffffff" }}>
      {parts.map((p, i) => /^\d+$/.test(p) ? <sub key={i}>{p}</sub> : <span key={i}>{p}</span>)}
      {mw && <span style={{ color: "#a78bfa", fontSize: 14, marginLeft: 10, fontFamily: "Arial, sans-serif" }}>{mw} Da</span>}
    </span>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? T.grad : "rgba(80,40,160,0.3)",
      border: active ? "none" : "1px solid rgba(180,140,255,0.4)",
      borderRadius: T.radiusSm, padding: "8px 20px",
      color: active ? "#fff" : "#e2d9f3",
      fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700,
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
  color: "#f0eaff", fontFamily: "'Lato', sans-serif", fontSize: 14,
  outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
  boxShadow: "0 1px 4px rgba(124,58,237,0.12)",
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
          <div style={{ overflowX: "auto", borderRadius: T.radius, border: "1px solid rgba(167,139,250,0.25)", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900, background: T.bgCard }}>
              <thead>
                <tr style={{ background: "rgba(60,20,120,0.9)" }}>
                  {["#","Name","SMILES","Formula","Lipinski","MW (Da)","LogP","HBD","HBA","TPSA","QED","Hepatotox %","Cardiotox %","Mutagenic %"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", fontSize: 11, color: "#c4b5fd", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "Arial, sans-serif", fontWeight: 700, borderBottom: "1px solid rgba(167,139,250,0.3)", whiteSpace: "nowrap", textAlign: "center" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const pm = Object.fromEntries(r.properties.map(p => [p.name, p]));
                  const tm = Object.fromEntries(r.toxicity.map(t => [t.endpoint, t]));
                  const rowBg = i % 2 === 0 ? "rgba(20,8,50,0.75)" : "rgba(30,12,70,0.65)";
                  const td = (val, status) => ({
                    padding: "11px 14px", fontSize: 13, textAlign: "center",
                    borderBottom: `1px solid ${T.border}`, background: rowBg,
                    color: status ? statusColor[status]?.text : T.text,
                    fontFamily: "'Lato', sans-serif", whiteSpace: "nowrap", fontWeight: status ? 600 : 400,
                  });
                  return (
                    <tr key={i}>
                      <td style={td()}>{i+1}</td>
                      <td style={{ ...td(), fontWeight: 700, color: "#ffffff" }}>{r.name||"—"}</td>
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
  const [nameQuery, setNameQuery] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState(null);
  const [nameSource, setNameSource] = useState(null);
  const [simResults, setSimResults] = useState([]);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState(null);
  const [simSources, setSimSources] = useState([]);
  const [simThreshold, setSimThreshold] = useState(0.7);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [xlsxExporting, setXlsxExporting] = useState(false);
  // Advanced Analysis state
  const [advTab, setAdvTab] = useState("scaffold");
  const [advSmiles, setAdvSmiles] = useState("");
  const [advLoading, setAdvLoading] = useState({});
  const [scaffoldResult, setScaffoldResult] = useState(null);
  const [painsResult, setPainsResult] = useState(null);
  const [targetsResult, setTargetsResult] = useState(null);
  const [leadoptResult, setLeadoptResult] = useState(null);
  const [advError, setAdvError] = useState(null);
  const [batchSmiles, setBatchSmiles] = useState("");
  const [inputMode, setInputMode] = useState("smiles"); // "smiles" | "draw"
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    // Load jsPDF for PDF export
    if (!window.jspdf) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      document.head.appendChild(s);
    }
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

  const lookupName = async () => {
    const q = nameQuery.trim();
    if (!q) return;
    setNameLoading(true); setNameError(null);
    try {
      // Step 1: Try PubChem directly from browser
      let smileResult = null;
      try {
        const pubchemUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(q)}/property/IsomericSMILES,MolecularFormula,MolecularWeight/JSON`;
        const res = await fetch(pubchemUrl);
        const text = await res.text();
        const data = JSON.parse(text);
        const props = data?.PropertyTable?.Properties?.[0];
        if (props?.IsomericSMILES) smileResult = { smiles: props.IsomericSMILES, source: "PubChem" };
      } catch(e1) { /* PubChem direct failed, try backend */ }

      // Step 2: If direct failed, try backend
      if (!smileResult) {
        try {
          const r2 = await fetch(`${API}/lookup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: q })
          });
          const d2 = await r2.json();
          if (d2.found && d2.smiles) smileResult = { smiles: d2.smiles, source: d2.source || "Database" };
        } catch(e2) { /* backend also failed */ }
      }

      if (smileResult) {
        setSmiles(smileResult.smiles || smileResult);
        setMolName(q);
        setNameQuery("");
        setNameError(null);
        if (smileResult.source) setNameSource(smileResult.source);
      } else {
        setNameError(`"${q}" not found in PubChem, ChEMBL, UniChem or ZINC. Try the generic/IUPAC name.`);
      }
    } catch(e) {
      setNameError("Lookup failed — check your connection and try again.");
    } finally {
      setNameLoading(false);
    }
  };

  const runSimilarity = async () => {
    if (!result || !result.smiles) return;
    setSimLoading(true); setSimError(null); setSimResults([]);
    try {
      const res = await fetch(`${API}/similarity`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ smiles: result.smiles, threshold: simThreshold, max_results: 10 }) });
      const data = await res.json();
      if (data.error) setSimError(data.error);
      else { setSimResults(data.results || []); setSimSources(data.sources || []); }
    } catch(e) { setSimError("Similarity search failed."); }
    finally { setSimLoading(false); }
  };

  const exportPDF = async () => {
    if (!result) return;
    setPdfExporting(true);
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210; const PH = 297; const M = 16; const CW = W - M * 2;

      // ── Helpers ──────────────────────────────────────────────────────────────
      let y = 0;
      const newPage = () => {
        doc.addPage();
        y = 20;
        // Page header strip
        doc.setFillColor(124, 58, 237);
        doc.rect(0, 0, W, 8, "F");
        doc.setFontSize(7); doc.setFont("helvetica", "normal");
        doc.setTextColor(255,255,255);
        doc.text(`MolPredict Report — ${result.name || "Molecule"}`, M, 5.5);
        doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, W-M, 5.5, { align:"right" });
      };
      const checkPage = (needed) => { if (y + needed > PH - 16) newPage(); };

      const sectionHeader = (title, color = [124, 58, 237]) => {
        checkPage(14);
        doc.setFillColor(...color);
        doc.rect(M, y, CW, 8, "F");
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(title, M + 4, y + 5.5);
        y += 12;
      };

      const statusColors = {
        good:    { fill:[232,255,240], border:[74,222,128],  text:[21,128,61]  },
        warning: { fill:[255,251,235], border:[251,191,36],  text:[146,64,14]  },
        bad:     { fill:[255,241,242], border:[251,113,133], text:[190,18,60]  },
        neutral: { fill:[245,243,255], border:[167,139,250], text:[109,40,217] },
      };

      const drawCard = (px, py, cw, ch, label, value, unit, status, description) => {
        const sc = statusColors[status] || statusColors.neutral;
        doc.setFillColor(...sc.fill);
        doc.setDrawColor(...sc.border);
        doc.setLineWidth(0.4);
        doc.roundedRect(px, py, cw, ch, 2, 2, "FD");
        // Status dot
        doc.setFillColor(...sc.border);
        doc.circle(px + cw - 4, py + 4, 1.5, "F");
        // Label
        doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
        doc.setTextColor(107, 114, 128);
        doc.text(label.toUpperCase(), px + 3, py + 5.5);
        // Value
        doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.setTextColor(...sc.text);
        doc.text(`${value}${unit ? " " + unit : ""}`, px + 3, py + 13);
        // Description
        if (description && ch > 20) {
          doc.setFontSize(6); doc.setFont("helvetica", "normal");
          doc.setTextColor(107, 114, 128);
          doc.text(description, px + 3, py + 18, { maxWidth: cw - 6 });
        }
      };

      // ── PAGE 1 ───────────────────────────────────────────────────────────────

      // Purple header
      doc.setFillColor(124, 58, 237);
      doc.rect(0, 0, W, 32, "F");
      doc.setFillColor(109, 40, 217);
      doc.rect(0, 26, W, 6, "F");

      // Title
      doc.setFontSize(22); doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("MolPredict", M, 14);
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.setTextColor(221, 214, 254);
      doc.text("Molecule Property Report", M, 21);
      // Date
      doc.setFontSize(8);
      doc.text(new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" }), W-M, 14, { align:"right" });

      y = 40;

      // Molecule identity box
      doc.setFillColor(250, 248, 255);
      doc.setDrawColor(167, 139, 250);
      doc.setLineWidth(0.5);
      doc.roundedRect(M, y, CW, 30, 3, 3, "FD");

      doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 16, 64);
      doc.text(result.name || "Unnamed Molecule", M+5, y+10);

      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(`Formula: ${result.molecular_formula || "—"}`, M+5, y+17);
      doc.text(`Molecular Weight: ${result.molecular_weight || "—"} Da`, M+5, y+22);
      doc.text(`SMILES: ${result.smiles.length > 60 ? result.smiles.slice(0,60)+"..." : result.smiles}`, M+5, y+27);

      // Lipinski badge
      const lip = result.lipinski;
      const lipColor = lip.pass ? [21,128,61] : [190,18,60];
      const lipFill  = lip.pass ? [232,255,240] : [255,241,242];
      const lipBorder= lip.pass ? [74,222,128] : [251,113,133];
      doc.setFillColor(...lipFill); doc.setDrawColor(...lipBorder); doc.setLineWidth(0.4);
      doc.roundedRect(W-M-75, y+7, 73, 12, 3, 3, "FD");
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.setTextColor(...lipColor);
      doc.text(`${lip.pass ? "PASS" : "FAIL"} — Lipinski Ro5`, W-M-38, y+14, { align:"center" });
      doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.text(`${lip.violations} violation(s)`, W-M-38, y+20, { align:"center" });

      y += 36;

      // ── Section 1: Physicochemical Properties ─────────────────────────────
      sectionHeader("1.  PHYSICOCHEMICAL PROPERTIES", [109, 40, 217]);

      const props = result.properties || [];
      const cols3 = 3; const cardW = CW / cols3 - 2; const cardH = 23;
      props.forEach((p, i) => {
        const col = i % cols3;
        const px = M + col * (CW / cols3);
        if (col === 0 && i > 0) { y += cardH + 3; }
        checkPage(cardH + 3);
        drawCard(px, y, cardW, cardH, p.name, p.value, p.unit, p.status, p.description);
      });
      y += cardH + 8;

      // Lipinski detail row
      checkPage(14);
      doc.setFillColor(245, 243, 255); doc.setDrawColor(167, 139, 250); doc.setLineWidth(0.3);
      doc.roundedRect(M, y, CW, 10, 2, 2, "FD");
      const lipItems = [
        ["MW <= 500", lip.mw_ok], ["LogP <= 5", lip.logp_ok],
        ["HBD <= 5", lip.hbd_ok], ["HBA <= 10", lip.hba_ok]
      ];
      lipItems.forEach(([label, ok], i) => {
        const px = M + 5 + i * (CW/4);
        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.setTextColor(ok ? 21 : 190, ok ? 128 : 18, ok ? 61 : 60);
        doc.text(`${ok ? "+" : "x"}  ${label}`, px, y + 6.5);
      });
      y += 16;

      // ── Section 2: Toxicity ───────────────────────────────────────────────
      const toxicity = result.toxicity || [];
      if (toxicity.length > 0) {
        checkPage(20);
        sectionHeader("2.  TOXICITY ESTIMATES", [190, 18, 60]);

        const tCols = 2; const tCardW = CW / tCols - 2; const tCardH = 20;
        toxicity.forEach((t, i) => {
          const col = i % tCols;
          const px = M + col * (CW / tCols);
          if (col === 0 && i > 0) { y += tCardH + 3; }
          checkPage(tCardH + 3);
          const sc = statusColors[t.status] || statusColors.neutral;
          const pct = Math.round(t.probability * 100);

          doc.setFillColor(...sc.fill); doc.setDrawColor(...sc.border);
          doc.setLineWidth(0.4);
          doc.roundedRect(px, y, tCardW, tCardH, 2, 2, "FD");

          doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
          doc.setTextColor(107, 114, 128);
          doc.text(t.endpoint.toUpperCase(), px+3, y+5);

          doc.setFontSize(12); doc.setFont("helvetica", "bold");
          doc.setTextColor(...sc.text);
          doc.text(`${pct}%`, px+3, y+13);

          // Progress bar
          doc.setFillColor(220, 215, 240);
          doc.roundedRect(px+22, y+9, tCardW-26, 3, 1, 1, "F");
          doc.setFillColor(...sc.border);
          doc.roundedRect(px+22, y+9, (tCardW-26)*(pct/100), 3, 1, 1, "F");

          doc.setFontSize(6); doc.setFont("helvetica", "normal");
          doc.setTextColor(107, 114, 128);
          doc.text(t.description, px+3, y+18, { maxWidth: tCardW-6 });
        });
        y += tCardH + 8;
      }

      // ── Section 3: ADMET Profile (new page) ───────────────────────────────
      const admet = result.admet || [];
      if (admet.length > 0) {
        newPage();
        sectionHeader("3.  ADMET PROFILE", [5, 95, 70]);

        const catColors = {
          Absorption:   [37, 99, 235],
          Distribution: [109, 40, 217],
          Metabolism:   [5, 120, 85],
          Excretion:    [180, 100, 14],
          Toxicity:     [190, 18, 60],
        };

        const categories = [...new Set(admet.map(a => a.category))];
        categories.forEach(cat => {
          checkPage(20);
          const cc = catColors[cat] || [100,100,100];
          // Category label
          doc.setFillColor(...cc);
          doc.rect(M, y, 3, 7, "F");
          doc.setFontSize(9); doc.setFont("helvetica", "bold");
          doc.setTextColor(...cc);
          doc.text(cat.toUpperCase(), M+6, y+5.5);
          y += 10;

          const items = admet.filter(a => a.category === cat);
          const aCols = 2; const aCardW = CW/aCols - 2; const aCardH = 22;
          items.forEach((a, i) => {
            const col = i % aCols;
            const px = M + col * (CW/aCols);
            if (col === 0 && i > 0) { y += aCardH + 3; }
            checkPage(aCardH + 3);
            // Clean unit (remove special chars jsPDF can't render)
            const safeUnit = a.unit.replace(/[^-]/g, (c) => {
              const map = {"×":"x","⁻":"","²":"2","¶":"u","Å":"A"};
              return map[c] || "";
            });
            drawCard(px, y, aCardW, aCardH, a.endpoint, a.value, safeUnit, a.status, a.description);
          });
          y += aCardH + 8;
        });
      }

      // ── Footer on every page ──────────────────────────────────────────────
      // ── Section 4: Advanced Analysis ─────────────────────────────────────
      const hasAdvanced = scaffoldResult || painsResult || targetsResult || leadoptResult;
      if (hasAdvanced) {
        newPage();
        sectionHeader("4.  ADVANCED ANALYSIS", [30, 64, 175]);

        // Scaffold
        if (scaffoldResult && !scaffoldResult.error) {
          checkPage(16);
          doc.setFontSize(9); doc.setFont("helvetica", "bold");
          doc.setTextColor(109, 40, 217);
          doc.text("▸ SCAFFOLD ANALYSIS", M, y); y += 7;

          if (scaffoldResult.murcko_scaffold) {
            doc.setFillColor(245, 243, 255); doc.setDrawColor(167, 139, 250); doc.setLineWidth(0.3);
            doc.roundedRect(M, y, CW, 10, 2, 2, "FD");
            doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 20, 120);
            doc.text(`Murcko Scaffold: ${scaffoldResult.murcko_scaffold?.slice(0,80) || "—"}`, M+4, y+6.5);
            y += 14;
          }
          if (scaffoldResult.ring_systems?.length > 0) {
            doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128);
            doc.text(`Ring systems: ${scaffoldResult.ring_systems.join(", ")}`, M, y); y += 6;
          }
          y += 6;
        }

        // PAINS
        if (painsResult && !painsResult.error) {
          checkPage(20);
          doc.setFontSize(9); doc.setFont("helvetica", "bold");
          doc.setTextColor(190, 18, 60);
          doc.text("▸ PAINS FILTER", M, y); y += 7;

          const pCount = painsResult.alerts?.length || 0;
          const pColor = pCount === 0 ? [21, 128, 61] : [190, 18, 60];
          const pFill  = pCount === 0 ? [232, 255, 240] : [255, 241, 242];
          const pBorder= pCount === 0 ? [74, 222, 128] : [251, 113, 133];

          doc.setFillColor(...pFill); doc.setDrawColor(...pBorder); doc.setLineWidth(0.3);
          doc.roundedRect(M, y, CW, 10, 2, 2, "FD");
          doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...pColor);
          doc.text(pCount === 0 ? "✓ No PAINS alerts detected — clean compound" : `✗ ${pCount} PAINS alert(s) detected — review before screening`, M+4, y+6.5);
          y += 14;

          if (painsResult.alerts?.length > 0) {
            painsResult.alerts.forEach(a => {
              checkPage(8);
              doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128);
              doc.text(`• ${a.name}: ${a.smarts || ""}`, M+4, y); y += 6;
            });
          }
          y += 6;
        }

        // Target Prediction
        if (targetsResult?.predictions?.length > 0) {
          checkPage(20);
          doc.setFontSize(9); doc.setFont("helvetica", "bold");
          doc.setTextColor(5, 95, 70);
          doc.text("▸ TARGET PREDICTION", M, y); y += 7;

          const topTargets = targetsResult.predictions.slice(0, 6);
          const tCols = 2; const tCardW = CW / tCols - 2; const tCardH = 16;
          topTargets.forEach((t, i) => {
            const col = i % tCols;
            const px = M + col * (CW / tCols);
            if (col === 0 && i > 0) { y += tCardH + 3; }
            checkPage(tCardH + 3);
            doc.setFillColor(240, 253, 244); doc.setDrawColor(74, 222, 128); doc.setLineWidth(0.3);
            doc.roundedRect(px, y, tCardW, tCardH, 2, 2, "FD");
            doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(21, 128, 61);
            doc.text(t.target?.slice(0, 35) || "Unknown", px+3, y+6);
            doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128);
            doc.text(`Family: ${t.family || "—"}  |  Confidence: ${t.confidence || "—"}`, px+3, y+11.5);
          });
          y += tCardH + 12;
        }

        // Lead Optimisation
        if (leadoptResult && !leadoptResult.error) {
          checkPage(20);
          doc.setFontSize(9); doc.setFont("helvetica", "bold");
          doc.setTextColor(146, 64, 14);
          doc.text("▸ LEAD OPTIMISATION", M, y); y += 7;

          if (leadoptResult.qed_score !== undefined) {
            doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128);
            doc.text(`QED Score: ${leadoptResult.qed_score}  |  Issues: ${leadoptResult.issue_count}  |  Optimisation potential: ${leadoptResult.optimisation_potential}%`, M, y); y += 8;
          }

          if (leadoptResult.suggestions?.length > 0) {
            leadoptResult.suggestions.slice(0, 5).forEach(s => {
              checkPage(12);
              const sColor = s.priority === "high" ? [190, 18, 60] : s.priority === "medium" ? [146, 64, 14] : [109, 40, 217];
              const sFill  = s.priority === "high" ? [255, 241, 242] : s.priority === "medium" ? [255, 251, 235] : [245, 243, 255];
              const sBorder= s.priority === "high" ? [251, 113, 133] : s.priority === "medium" ? [251, 191, 36] : [167, 139, 250];
              doc.setFillColor(...sFill); doc.setDrawColor(...sBorder); doc.setLineWidth(0.3);
              doc.roundedRect(M, y, CW, 12, 2, 2, "FD");
              doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...sColor);
              doc.text(`[${(s.priority||"").toUpperCase()}] ${s.title || ""}`, M+4, y+5.5);
              doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128);
              doc.text(s.impact || "", M+4, y+9.5);
              y += 15;
            });
          }

          if (leadoptResult.bioisosteres?.length > 0) {
            checkPage(10);
            doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(109, 40, 217);
            doc.text("Bioisostere suggestions:", M, y); y += 7;
            leadoptResult.bioisosteres.forEach(b => {
              checkPage(8);
              doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128);
              doc.text(`• ${b.original} → ${b.replacement}: ${b.reason}`, M+4, y, { maxWidth: CW - 8 }); y += 7;
            });
          }
        }
      }

      // ── Footer on every page ──────────────────────────────────────────────
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(245, 243, 255);
        doc.rect(0, PH-10, W, 10, "F");
        doc.setFontSize(6.5); doc.setFont("helvetica","normal");
        doc.setTextColor(107, 114, 128);
        doc.text("Generated by MolPredict  |  Computational predictions only  |  Not for clinical use  |  Properties computed with RDKit", W/2, PH-4, { align:"center" });
        doc.setTextColor(124, 58, 237);
        doc.text(`Page ${p} of ${totalPages}`, W-M, PH-4, { align:"right" });
      }

      doc.save(`${result.name || "molecule"}_molpredict_report.pdf`);
    } catch(e) { console.error("PDF error:", e); alert("PDF export failed: " + e.message); }
    finally { setPdfExporting(false); }
  };

  const exportExcel = async () => {
    if (!result) return;
    setXlsxExporting(true);
    try {
      const payload = {
        smiles: result.smiles,
        name: result.name || null,
        scaffold: scaffoldResult || null,
        pains: painsResult || null,
        targets: targetsResult || null,
        leadopt: leadoptResult || null,
      };
      const res = await fetch(`${API}/export/single`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(result.name || "molecule").replace(/\s+/g,"_").toLowerCase()}_molpredict.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) { alert("Excel export failed: " + e.message); }
    finally { setXlsxExporting(false); }
  };

  return (
    <div style={{ minHeight: "100vh", color: T.text, fontFamily: "'Lato', sans-serif", padding: "0 0 80px", position: "relative", overflow: "hidden" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Cormorant+Garamond:wght@400;600&family=Lato:wght@300;400;600;700&family=Courier+Prime&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #ede9fe; color: #6d28d9; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0f0a1e; }
        ::-webkit-scrollbar-thumb { background: #c4b5fd; border-radius: 3px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
        @keyframes bounce0 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes bounce1 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes bounce2 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
      `}</style>

      {/* Animated molecular background */}
      <MolecularBackground />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 10, borderBottom: `1px solid ${T.border}`, padding: "18px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(10,4,30,0.75)", backdropFilter: "blur(20px)", boxShadow: "0 1px 20px rgba(0,0,0,0.4)" }}>
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
          <div style={{ display: "inline-block", background: "rgba(124,58,237,0.25)", border: "1px solid rgba(167,139,250,0.4)", borderRadius: 99, padding: "5px 18px", fontSize: 12, color: "#c4b5fd", fontFamily: "'Lato', sans-serif", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 18 }}>
            Computational Chemistry · Drug Discovery
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px, 5vw, 54px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, color: T.text, marginBottom: 16 }}>
            Molecule Property<br />
            <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Predictor</span>
          </h1>
          <p style={{ color: "#c4b5fd", fontSize: 16, maxWidth: 480, margin: "0 auto", lineHeight: 1.8, fontFamily: "Arial, sans-serif", fontWeight: 400 }}>
            Analyze molecules for drug-likeness, physicochemical properties, toxicity estimates, and interactive 3D structure visualization.
          </p>
        </div>

        {/* Main tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28, background: "rgba(255,255,255,0.7)", borderRadius: T.radius, padding: 5, width: "fit-content", border: `1px solid ${T.border}`, backdropFilter: "blur(8px)", boxShadow: T.shadow, flexWrap: "wrap" }}>
          {[["single","⬡ Single Molecule"],["batch","⊞ Batch Screening"],["advanced","🔬 Advanced Analysis"],["aichat","🤖 AI Chat"]].map(([key, label]) => (
            <TabBtn key={key} active={mainTab===key} onClick={() => setMainTab(key)}>{label}</TabBtn>
          ))}
        </div>

        {/* Single mode */}
        {mainTab === "single" && (
          <>
            {/* Name → SMILES lookup bar */}
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "16px 24px", marginBottom: 14, boxShadow: T.shadow, backdropFilter: "blur(12px)", animation: "fadeUp 0.5s ease both" }}>
              <div style={{ fontSize: 11, color: "#c4b5fd", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: 10 }}>
                🔍 Name → SMILES Lookup
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input value={nameQuery} onChange={e => setNameQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && lookupName()}
                  placeholder="Type a drug name e.g. Aspirin, Metformin, Sildenafil..."
                  style={{ ...inputStyle, flex: 1, minWidth: 200, fontFamily: "Arial, sans-serif" }}
                  onFocus={e => { e.target.style.borderColor = T.borderFocus; e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.2)"; }}
                  onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }} />
                <button onClick={lookupName} disabled={nameLoading}
                  style={{ background: nameQuery.trim() ? T.grad : "rgba(60,20,100,0.4)", border: "none", borderRadius: T.radiusSm, padding: "11px 22px", color: "#fff", fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, cursor: nameQuery.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap", boxShadow: nameQuery.trim() ? "0 4px 12px rgba(124,58,237,0.3)" : "none" }}>
                  {nameLoading ? "Looking up..." : "Look up"}
                </button>
              </div>
              {nameError && <div style={{ marginTop: 8, fontSize: 12, color: "#fb7185", fontFamily: "Arial, sans-serif" }}>⚠ {nameError}</div>}
              <div style={{ marginTop: 6, fontSize: 11, color: "rgba(167,139,250,0.6)", fontFamily: "Arial, sans-serif", display:"flex", gap:8, alignItems:"center" }}>
                Searches PubChem · ChEMBL · UniChem · ZINC in parallel → fills SMILES automatically
                {nameSource && <span style={{ background:"rgba(124,58,237,0.3)", border:"1px solid rgba(167,139,250,0.4)", borderRadius:99, padding:"1px 10px", fontSize:10, color:"#c4b5fd", fontWeight:700 }}>
                  Found via {nameSource}
                </span>}
              </div>
            </div>

            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 30, marginBottom: 24, boxShadow: T.shadow, backdropFilter: "blur(12px)", animation: "fadeUp 0.5s ease 0.1s both" }}>
              {/* Input mode toggle */}
              <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 4, width: "fit-content", border: `1px solid ${T.border}` }}>
                {[["smiles","✍ SMILES"],["draw","🎨 Draw Molecule"]].map(([mode, label]) => (
                  <button key={mode} onClick={() => setInputMode(mode)}
                    style={{ background: inputMode===mode ? T.grad : "transparent", border: "none", borderRadius: 8, padding: "7px 18px", color: inputMode===mode ? "#fff" : T.textMuted, fontFamily: "Arial,sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", boxShadow: inputMode===mode ? "0 2px 10px rgba(124,58,237,0.3)" : "none" }}>
                    {label}
                  </button>
                ))}
              </div>

              {inputMode === "smiles" && (
                <>
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
                </>
              )}

              {inputMode === "draw" && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Lato', sans-serif", fontWeight: 700, display: "block", marginBottom: 4 }}>Name (optional)</label>
                    <input value={molName} onChange={e => setMolName(e.target.value)} placeholder="e.g. My Compound"
                      style={{ ...inputStyle, maxWidth: 300 }}
                      onFocus={e => { e.target.style.borderColor=T.borderFocus; e.target.style.boxShadow="0 0 0 3px rgba(124,58,237,0.12)"; }}
                      onBlur={e => { e.target.style.borderColor=T.border; e.target.style.boxShadow="0 1px 4px rgba(124,58,237,0.06)"; }} />
                  </div>
                  <KetcherEditor
                    initialSmiles={smiles}
                    onSmilesChange={(s) => {
                      setSmiles(s);
                      setResult(null); setError(null);
                    }}
                  />
                  {smiles && (
                    <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 8, padding: "8px 14px", fontFamily: "'Courier Prime',monospace", fontSize: 12, color: "#c4b5fd", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {smiles}
                      </div>
                      <button onClick={predict} disabled={loading||!smiles.trim()} style={{ background: smiles.trim()?T.grad:"#e5e7eb", border:"none", borderRadius:T.radiusSm, padding:"11px 24px", color:smiles.trim()?"#fff":"#9ca3af", fontFamily:"'Lato', sans-serif", fontSize:14, fontWeight:700, cursor:smiles.trim()?"pointer":"not-allowed", display:"flex", alignItems:"center", gap:9, boxShadow:smiles.trim()?"0 4px 14px rgba(124,58,237,0.3)":"none", flexShrink: 0 }}>
                        {loading && <span style={{ animation:"spin 0.8s linear infinite", display:"inline-block" }}>◌</span>}
                        {loading?"Analyzing...":"Analyze Molecule"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {examples.length > 0 && (
              <div style={{ marginBottom: 32, animation: "fadeUp 0.5s ease 0.2s both" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Lato', sans-serif", fontWeight: 700, marginBottom: 10 }}>Try an example →</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{examples.map(mol => <ExamplePill key={mol.name} mol={mol} onSelect={selectExample} />)}</div>
              </div>
            )}

            {error && <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:T.radiusSm, padding:"14px 18px", marginBottom:24, color:"#be123c", fontFamily:"'Lato', sans-serif", fontSize:13 }}>✗ {error}</div>}

            {result && result.valid && (
              <div style={{ animation:"fadeUp 0.4s ease" }}>
                {/* Molecule header */}
                <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:T.radius, padding:24, marginBottom:20, display:"flex", flexWrap:"wrap", gap:16, alignItems:"center", justifyContent:"space-between", boxShadow:T.shadow, backdropFilter:"blur(12px)" }}>
                  <div>
                    {result.name && <div style={{ fontFamily:"Arial, sans-serif", fontSize:24, fontWeight:700, marginBottom:6, color:"#ffffff" }}>{result.name}</div>}
                    <div style={{ fontFamily:"'Courier Prime', monospace", fontSize:13, color:T.accent, background:T.accentLight, padding:"4px 12px", borderRadius:6, display:"inline-block", marginBottom:10 }}>
                      {result.smiles.length>60?result.smiles.slice(0,60)+"…":result.smiles}
                    </div>
                    {result.molecular_formula && <div><FormulaDisplay formula={result.molecular_formula} mw={result.molecular_weight} /></div>}
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <LipinskiBadge lipinski={result.lipinski} />
                    <button onClick={exportPDF} disabled={pdfExporting}
                      style={{ background: "linear-gradient(135deg, #7c2d12, #b45309)", border: "none", borderRadius: 99, padding: "8px 18px", color: "#fff", fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, boxShadow: "0 4px 12px rgba(180,83,9,0.3)" }}>
                      {pdfExporting ? "⏳ Exporting..." : "📄 Export PDF"}
                    </button>
                    <button onClick={exportExcel} disabled={xlsxExporting}
                      style={{ background: "linear-gradient(135deg, #065f46, #047857)", border: "none", borderRadius: 99, padding: "8px 18px", color: "#fff", fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, boxShadow: "0 4px 12px rgba(4,120,87,0.3)" }}>
                      {xlsxExporting ? "⏳ Exporting..." : "⬇ Export Excel"}
                    </button>
                  </div>
                </div>

                {/* Result tabs */}
                <div style={{ display:"flex", gap:6, marginBottom:20, background:"rgba(255,255,255,0.7)", borderRadius:T.radius, padding:5, width:"fit-content", border:`1px solid ${T.border}`, backdropFilter:"blur(8px)", flexWrap:"wrap" }}>
                  {[["properties","⚗ Properties"],["toxicity","⚠ Toxicity"],["admet","📊 ADMET"],["similarity","🔗 Similarity"],["structure","🔬 Structure"],["chat","🤖 AI Chat"]].map(([key,label]) => (
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
                    <div style={{ background:"rgba(120,80,0,0.3)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:T.radiusSm, padding:"12px 18px", marginBottom:20, color:"#fbbf24", fontSize:12.5, fontFamily:"Arial, sans-serif" }}>
                      ⚠ Rule-based computational estimates only. Always validate experimentally.
                    </div>
                    {(!result.toxicity || result.toxicity.length === 0) && (
                      <div style={{ textAlign:"center", padding:"40px 0", color:"#4a2f8f", fontFamily:"Arial, sans-serif" }}>
                        <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
                        <div style={{ fontSize:14, color:"#c4b5fd" }}>Toxicity data loading — re-analyze in ~1 minute after backend deploys.</div>
                      </div>
                    )}
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:14 }}>
                      {(result.toxicity || []).map(t => <ToxicityCard key={t.endpoint} tox={t} />)}
                    </div>
                  </>
                )}

                {resultTab==="admet" && (
                  <div style={{ animation: "fadeUp 0.3s ease" }}>
                    <div style={{ background: "rgba(20,8,50,0.6)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: T.radiusSm, padding: "12px 18px", marginBottom: 20, fontSize: 12, color: "#c4b5fd", fontFamily: "Arial, sans-serif" }}>
                      📊 Computational ADMET predictions based on physicochemical descriptors. Validate experimentally before use.
                    </div>
                    {(!result.admet || result.admet.length === 0) && (
                      <div style={{ textAlign: "center", padding: "40px 0", color: "#4a2f8f", fontFamily: "Arial, sans-serif" }}>
                        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                        <div style={{ fontSize: 14, marginBottom: 6, color: "#c4b5fd" }}>ADMET data not yet available</div>
                        <div style={{ fontSize: 12, color: "#7c5cbf" }}>The backend is deploying. Re-analyze the molecule in ~1 minute once Render finishes updating.</div>
                      </div>
                    )}
                    {["Absorption","Distribution","Metabolism","Excretion","Toxicity"].map(cat => {
                      const items = (result.admet || []).filter(a => a.category === cat);
                      if (!items.length) return null;
                      const catColors = { Absorption:"#60a5fa", Distribution:"#a78bfa", Metabolism:"#34d399", Excretion:"#fbbf24", Toxicity:"#fb7185" };
                      return (
                        <div key={cat} style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 11, color: catColors[cat], textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 3, height: 14, background: catColors[cat], borderRadius: 2 }} />
                            {cat}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                            {items.map(a => {
                              const c = statusColor[a.status] || statusColor.neutral;
                              return (
                                <div key={a.endpoint} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px", transition: "all 0.2s" }}
                                  onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow=T.shadowHover; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 10, color: c.text, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "Arial, sans-serif", fontWeight: 700 }}>{a.endpoint}</span>
                                    <span style={{ background: c.dot, borderRadius: "50%", width: 7, height: 7, display: "inline-block", boxShadow: `0 0 5px ${c.dot}` }} />
                                  </div>
                                  <div style={{ fontSize: 22, fontWeight: 700, color: c.text, fontFamily: "Arial, sans-serif", marginBottom: 4 }}>
                                    {a.value} <span style={{ fontSize: 11, fontWeight: 400, color: "#a78bfa" }}>{a.unit}</span>
                                  </div>
                                  <div style={{ fontSize: 10.5, color: "#a78bfa", lineHeight: 1.6, fontFamily: "Arial, sans-serif" }}>{a.description}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {resultTab==="similarity" && (
                  <div style={{ animation: "fadeUp 0.3s ease" }}>
                    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "18px 22px", marginBottom: 20, boxShadow: T.shadow }}>
                      <div style={{ fontSize: 13, color: "#e2d9f3", fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: 14 }}>
                        Find similar compounds in PubChem
                      </div>
                      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <label style={{ fontSize: 11, color: "#c4b5fd", fontFamily: "Arial, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Tanimoto Threshold
                          </label>
                          <input type="range" min="0.5" max="0.95" step="0.05" value={simThreshold}
                            onChange={e => setSimThreshold(parseFloat(e.target.value))}
                            style={{ width: 120, accentColor: "#7c3aed" }} />
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa", fontFamily: "Arial, sans-serif", minWidth: 36 }}>{simThreshold}</span>
                        </div>
                        <button onClick={runSimilarity} disabled={simLoading}
                          style={{ background: T.grad, border: "none", borderRadius: T.radiusSm, padding: "10px 24px", color: "#fff", fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(124,58,237,0.3)", display: "flex", alignItems: "center", gap: 8 }}>
                          {simLoading && <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span>}
                          {simLoading ? "Searching PubChem..." : "Search Similarity"}
                        </button>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 11, color: "rgba(167,139,250,0.6)", fontFamily: "Arial, sans-serif" }}>
                        Uses 2D fingerprint (Tanimoto) similarity against PubChem's database of 100M+ compounds
                      </div>
                    </div>
                    {simError && <div style={{ background: "rgba(136,19,55,0.3)", border: "1px solid rgba(251,113,133,0.3)", borderRadius: T.radiusSm, padding: "12px 16px", marginBottom: 16, color: "#fb7185", fontFamily: "Arial, sans-serif", fontSize: 13 }}>⚠ {simError}</div>}
                    {simResults.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, color: "#a78bfa", fontFamily: "Arial, sans-serif", marginBottom: 14 }}>
                          Found <strong style={{ color: "#c4b5fd" }}>{simResults.length}</strong> similar compounds (Tanimoto ≥ {simThreshold})
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                          {simResults.map((r, i) => (
                            <div key={i} style={{ background: "rgba(20,8,50,0.8)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: T.radius, overflow: "hidden", transition: "all 0.2s" }}
                              onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow=T.shadowHover; e.currentTarget.style.borderColor="rgba(167,139,250,0.5)"; }}
                              onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; e.currentTarget.style.borderColor="rgba(167,139,250,0.2)"; }}>
                              <div style={{ background: "rgba(30,10,70,0.8)", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#e2d9f3", fontFamily: "Arial, sans-serif" }}>{r.name}</span>
                                <a href={r.pubchem_url} target="_blank" rel="noopener noreferrer"
                                  style={{ fontSize: 10, color: "#7c3aed", background: "rgba(124,58,237,0.2)", padding: "3px 8px", borderRadius: 99, textDecoration: "none", fontFamily: "Arial, sans-serif" }}>
                                  PubChem ↗
                                </a>
                              </div>
                              <img src={r.structure_url} alt={r.name} style={{ width: "100%", height: 140, objectFit: "contain", background: "#fff", padding: 6 }} />
                              <div style={{ padding: "12px 14px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                                  {[["Formula", r.formula], ["MW", r.mw ? r.mw+" Da" : "—"], ["XLogP", r.xlogp ?? "—"], ["TPSA", r.tpsa ? r.tpsa+" Å²" : "—"]].map(([k,v]) => (
                                    <div key={k}>
                                      <div style={{ fontSize: 9, color: "#7c5cbf", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "Arial, sans-serif" }}>{k}</div>
                                      <div style={{ fontSize: 12, color: "#e2d9f3", fontWeight: 600, fontFamily: "Arial, sans-serif" }}>{v || "—"}</div>
                                    </div>
                                  ))}
                                </div>
                                <button onClick={() => { setSmiles(r.smiles); setMolName(r.name); setMainTab("single"); setResultTab("properties"); window.scrollTo(0,0); }}
                                  style={{ width: "100%", background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.5)", borderRadius: T.radiusSm, padding: "8px", color: "#c4b5fd", fontSize: 12, cursor: "pointer", fontFamily: "Arial, sans-serif", fontWeight: 600 }}>
                                  Analyze this molecule →
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!simLoading && simResults.length === 0 && !simError && (
                      <div style={{ textAlign: "center", padding: "50px 0", color: "#4a2f8f", fontFamily: "Arial, sans-serif", fontSize: 14 }}>
                        Click "Search Similarity" to find structurally related compounds
                      </div>
                    )}
                  </div>
                )}

                                {resultTab==="structure" && (
                  <div style={{ display:"flex", justifyContent:"center" }}>
                    <div style={{ background:"rgba(10,4,30,0.85)", border:"1px solid rgba(167,139,250,0.3)", borderRadius:T.radius, padding:24, width:"100%", maxWidth:680, boxShadow:T.shadow, backdropFilter:"blur(12px)" }}>
                      <div style={{ fontSize:11, color:"#c4b5fd", textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"Arial, sans-serif", fontWeight:700, marginBottom:12, textAlign:"center" }}>Interactive 3D Structure</div>
                      <Molecule3DViewer smiles={result.smiles} name={result.name} />
                      <div style={{ fontSize:11, color:"rgba(167,139,250,0.6)", textAlign:"center", marginTop:10, fontFamily:"Arial, sans-serif" }}>
                        🖱 Drag to rotate · Scroll to zoom · Right-click to pan
                      </div>
                    </div>
                  </div>
                )}

                {resultTab==="chat" && (
                  <AIChatAssistant
                    moleculeData={result}
                    scaffoldResult={scaffoldResult}
                    painsResult={painsResult}
                    targetsResult={targetsResult}
                    leadoptResult={leadoptResult}
                  />
                )}

                <div style={{ marginTop:24, padding:"14px 18px", background:"rgba(255,255,255,0.08)", borderRadius:T.radiusSm, fontSize:12, color:"rgba(255,255,255,0.7)", fontFamily:"'Lato', sans-serif", border:"1px solid rgba(255,255,255,0.15)" }}>
                  ⚠ Computational predictions only. Properties computed using RDKit. QED from Bickerton et al. (2012).
                </div>
              </div>
            )}

            {!result && !loading && !error && (
              <div style={{ textAlign:"center", padding:"70px 0", color:T.accentMid }}>
                <div style={{ fontSize:52, marginBottom:14, opacity:0.4 }}>⬡</div>
                <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:16, color:"#7c5cbf" }}>Enter a SMILES string to begin analysis</div>
              </div>
            )}
          </>
        )}

        {mainTab==="batch" && <BatchScreen />}

        {mainTab==="aichat" && (
          <div style={{ animation: "fadeUp 0.5s ease both" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 6 }}>🤖 AI Drug Discovery Assistant</div>
              <div style={{ fontSize: 13, color: T.textMuted, fontFamily: "Arial,sans-serif", lineHeight: 1.6 }}>
                Powered by Claude. Ask anything about your molecule — drug-likeness, pharmacophore features, structural improvements, target predictions, comparison with known drugs, and more.
                {!result && <span style={{ color: "#f87171" }}> Analyze a molecule in Single Molecule mode first to unlock molecule-specific insights.</span>}
              </div>
            </div>
            <AIChatAssistant
              moleculeData={result}
              scaffoldResult={scaffoldResult}
              painsResult={painsResult}
              targetsResult={targetsResult}
              leadoptResult={leadoptResult}
            />
          </div>
        )}

        {/* ── Advanced Analysis Panel ─────────────────────────────── */}
        {mainTab==="advanced" && (
          <div style={{ animation: "fadeUp 0.5s ease both" }}>
            {/* SMILES input for advanced */}
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "20px 24px", marginBottom: 20, backdropFilter: "blur(12px)", boxShadow: T.shadow }}>
              <div style={{ fontSize: 11, color: "#c4b5fd", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, fontFamily: "Arial,sans-serif", marginBottom: 10 }}>
                🔬 Advanced Analysis — Enter SMILES
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <input value={advSmiles} onChange={e => setAdvSmiles(e.target.value)}
                  placeholder="Paste SMILES string here… or click an example above"
                  style={{ flex: 1, background: "rgba(15,10,40,0.7)", border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", color: T.text, fontFamily: "Courier Prime, monospace", fontSize: 13, outline: "none" }}
                />
                <button onClick={() => { if(smiles) setAdvSmiles(smiles); }}
                  style={{ background: "rgba(124,58,237,0.3)", border: `1px solid ${T.accent}`, color: "#c4b5fd", borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontFamily: "Arial,sans-serif", fontSize: 12, fontWeight: 700 }}>
                  ← Use current
                </button>
              </div>
              <div style={{ fontSize: 11, color: "rgba(167,139,250,0.5)", marginTop: 6, fontFamily: "Arial,sans-serif" }}>
                Tip: Analyse a molecule in Single mode first, then click "Use current" to carry it over
              </div>
            </div>

            {/* Advanced sub-tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
              {[["scaffold","🏗 Scaffold"],["pains","⚠️ PAINS Filter"],["targets","🎯 Target Prediction"],["leadopt","💡 Lead Optimisation"]].map(([key,label]) => (
                <button key={key} onClick={() => setAdvTab(key)}
                  style={{ padding: "10px 20px", borderRadius: 99, border: `1px solid ${advTab===key ? T.accent : T.border}`,
                    background: advTab===key ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "rgba(255,255,255,0.04)",
                    color: advTab===key ? "#fff" : T.textMuted, fontFamily: "Arial,sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Run button */}
            <button onClick={async () => {
              const smi = advSmiles.trim();
              if (!smi) { setAdvError("Please enter a SMILES string"); return; }
              setAdvError(null);
              const endpoint = advTab === "scaffold" ? "/scaffold" : advTab === "pains" ? "/pains" : advTab === "targets" ? "/targets" : "/leadopt";
              const setter = advTab === "scaffold" ? setScaffoldResult : advTab === "pains" ? setPainsResult : advTab === "targets" ? setTargetsResult : setLeadoptResult;
              setAdvLoading(p => ({...p, [advTab]: true}));
              try {
                const r = await fetch(API + endpoint, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ smiles: smi }) });
                const d = await r.json();
                setter(d);
              } catch(e) { setAdvError("Request failed: " + e.message); }
              setAdvLoading(p => ({...p, [advTab]: false}));
            }}
              disabled={advLoading[advTab]}
              style={{ background: advLoading[advTab] ? "rgba(124,58,237,0.3)" : "linear-gradient(135deg,#7c3aed,#a855f7)",
                border: "none", borderRadius: 12, padding: "13px 36px", color: "#fff", fontFamily: "Arial,sans-serif",
                fontSize: 15, fontWeight: 700, cursor: advLoading[advTab] ? "not-allowed" : "pointer", marginBottom: 24,
                boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>
              {advLoading[advTab] ? "⏳ Analysing…" : `Run ${advTab==="scaffold"?"Scaffold Analysis":advTab==="pains"?"PAINS Screen":advTab==="targets"?"Target Prediction":"Lead Optimisation"}`}
            </button>

            {advError && <div style={{ color: "#f87171", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontFamily: "Arial,sans-serif", fontSize: 13 }}>{advError}</div>}

            {/* ── Scaffold Results ── */}
            {advTab==="scaffold" && scaffoldResult && !scaffoldResult.error && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Core scaffold info */}
                <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 24, backdropFilter: "blur(12px)" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "Arial,sans-serif", marginBottom: 16 }}>🏗 Murcko Scaffold</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    {[["Core Scaffold SMILES", scaffoldResult.scaffold_smiles || "None"],
                      ["Generic Scaffold", scaffoldResult.generic_scaffold_smiles || "None"],
                      ["Ring Count", scaffoldResult.ring_count],
                      ["Ring Sizes", (scaffoldResult.ring_sizes||[]).join(", ") + "-membered"],
                      ["Framework Atoms", scaffoldResult.framework_atoms],
                      ["Side-chain Atoms", scaffoldResult.side_chain_atoms],
                    ].map(([k,v]) => (
                      <div key={k} style={{ background: "rgba(124,58,237,0.08)", borderRadius: 10, padding: "12px 16px", border: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{k}</div>
                        <div style={{ fontSize: 13, color: T.text, fontFamily: "Courier Prime, monospace", wordBreak: "break-all" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {scaffoldResult.ring_types && scaffoldResult.ring_types.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Ring Systems</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {scaffoldResult.ring_types.map((rt,i) => (
                          <span key={i} style={{ background: "rgba(124,58,237,0.2)", border: `1px solid ${T.accent}`, borderRadius: 99, padding: "4px 14px", fontSize: 12, color: "#c4b5fd", fontFamily: "Arial,sans-serif" }}>{rt}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Structure visualizations side by side */}
                <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 20, backdropFilter: "blur(12px)" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "Arial,sans-serif", marginBottom: 14 }}>🖼 Structure Visualisation</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {[["Full Molecule", advSmiles], ["Murcko Scaffold", scaffoldResult.scaffold_smiles], ["Generic Scaffold", scaffoldResult.generic_scaffold_smiles]].filter(([,s]) => s && s !== "None").map(([label, smi]) => (
                      <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ background: "rgba(124,58,237,0.15)", padding: "8px 14px", fontSize: 11, color: "#c4b5fd", fontFamily: "Arial,sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                        <div style={{ background: "#fff", padding: 8, display: "flex", justifyContent: "center", alignItems: "center", minHeight: 160 }}>
                          <img
                            src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smi)}/PNG?image_size=300x200`}
                            alt={label}
                            style={{ maxWidth: "100%", maxHeight: 180, objectFit: "contain" }}
                            onError={e => { e.target.parentNode.innerHTML = '<div style="color:#888;font-size:12px;padding:20px;text-align:center">Structure not available</div>'; }}
                          />
                        </div>
                        <div style={{ padding: "6px 10px", fontSize: 10, color: T.textMuted, fontFamily: "Courier Prime,monospace", wordBreak: "break-all", background: "rgba(0,0,0,0.3)" }}>{smi.length > 60 ? smi.slice(0,60)+"…" : smi}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Scaffold properties */}
                {scaffoldResult.scaffold_props && Object.keys(scaffoldResult.scaffold_props).length > 0 && (
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 24, backdropFilter: "blur(12px)" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: "Arial,sans-serif", marginBottom: 14 }}>📊 Scaffold Properties</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {[["MW", scaffoldResult.scaffold_props.mw + " Da"],["Formula", scaffoldResult.scaffold_props.formula],["Heavy Atoms", scaffoldResult.scaffold_props.heavy_atoms],["Rings", scaffoldResult.scaffold_props.rings]].map(([k,v]) => (
                        <div key={k} style={{ background: "rgba(124,58,237,0.08)", borderRadius: 10, padding: "12px 20px", border: `1px solid ${T.border}`, textAlign: "center" }}>
                          <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "Arial,sans-serif", marginBottom: 4 }}>{k}</div>
                          <div style={{ fontSize: 16, color: T.accent, fontWeight: 700, fontFamily: "Arial,sans-serif" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PAINS Results ── */}
            {advTab==="pains" && painsResult && !painsResult.error && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Verdict banner */}
                <div style={{ background: painsResult.verdict==="clean" ? "rgba(16,185,129,0.1)" : painsResult.verdict==="fail" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                  border: `2px solid ${painsResult.verdict==="clean" ? "#10b981" : painsResult.verdict==="fail" ? "#ef4444" : "#f59e0b"}`,
                  borderRadius: T.radius, padding: "20px 24px", backdropFilter: "blur(12px)" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{painsResult.verdict==="clean" ? "✅" : painsResult.verdict==="fail" ? "🚨" : "⚠️"}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: painsResult.verdict==="clean" ? "#10b981" : painsResult.verdict==="fail" ? "#f87171" : "#fbbf24", fontFamily: "Arial,sans-serif", marginBottom: 4 }}>
                    {painsResult.verdict==="clean" ? "PAINS Clean" : painsResult.verdict==="fail" ? "PAINS Alert!" : "Structural Warning"}
                  </div>
                  <div style={{ fontSize: 14, color: T.textMuted, fontFamily: "Arial,sans-serif" }}>{painsResult.verdict_text}</div>
                  <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {[["PAINS Alerts", painsResult.pains_count, "#ef4444"],["Custom Alerts", painsResult.custom_hits?.length||0, "#f59e0b"],["Total Flags", painsResult.total_alerts, "#a78bfa"]].map(([k,v,c]) => (
                      <div key={k} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 26, fontWeight: 900, color: v>0?c:"#10b981", fontFamily: "Arial,sans-serif" }}>{v}</div>
                        <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "Arial,sans-serif" }}>{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Structure image */}
                <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 20, backdropFilter: "blur(12px)" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "Arial,sans-serif", marginBottom: 12 }}>🖼 Molecular Structure</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ background: "rgba(124,58,237,0.15)", padding: "8px 14px", fontSize: 11, color: "#c4b5fd", fontFamily: "Arial,sans-serif", fontWeight: 700 }}>FULL STRUCTURE</div>
                      <div style={{ background: "#fff", padding: 8, display: "flex", justifyContent: "center", minHeight: 160 }}>
                        <img src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(advSmiles)}/PNG?image_size=300x200`}
                          alt="Structure" style={{ maxWidth: "100%", maxHeight: 180, objectFit: "contain" }}
                          onError={e => { e.target.parentNode.innerHTML = '<div style="color:#888;font-size:12px;padding:20px;text-align:center">Preview not available</div>'; }} />
                      </div>
                    </div>
                    <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 11, color: "#fca5a5", fontFamily: "Arial,sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>⚠️ Alert Groups Found</div>
                      {[...(painsResult.pains_hits||[]), ...(painsResult.custom_hits||[])].length === 0 ? (
                        <div style={{ color: "#6ee7b7", fontSize: 13, fontFamily: "Arial,sans-serif" }}>✅ No problematic groups detected</div>
                      ) : (
                        [...(painsResult.pains_hits||[]), ...(painsResult.custom_hits||[])].map((h,i) => (
                          <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 12, color: i < (painsResult.pains_hits||[]).length ? "#fca5a5" : "#fde68a", fontWeight: 700, fontFamily: "Arial,sans-serif" }}>
                              {i < (painsResult.pains_hits||[]).length ? "🚨" : "⚠️"} {h.name}
                            </div>
                            {h.smarts && <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "Courier Prime,monospace", marginTop: 3, wordBreak: "break-all" }}>{h.smarts}</div>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                {/* PAINS hits detail */}
                {painsResult.pains_hits?.length > 0 && (
                  <div style={{ background: T.bgCard, border: `1px solid rgba(239,68,68,0.3)`, borderRadius: T.radius, padding: 20, backdropFilter: "blur(12px)" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f87171", fontFamily: "Arial,sans-serif", marginBottom: 12 }}>🚨 PAINS Alerts — Structural Detail (Baell & Holloway 2010)</div>
                    {painsResult.pains_hits.map((h,i) => (
                      <div key={i} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: 14, marginBottom: 10, display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
                        <div>
                          <div style={{ fontSize: 13, color: "#fca5a5", fontWeight: 700, fontFamily: "Arial,sans-serif", marginBottom: 4 }}>{h.name}</div>
                          <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "Arial,sans-serif", marginBottom: 6 }}>{h.source}</div>
                          <div style={{ fontSize: 11, color: "#fca5a5", fontFamily: "Arial,sans-serif", lineHeight: 1.5 }}>
                            This functional group is known to cause false positives in HTS assays through non-specific reactivity, fluorescence interference, or aggregation.
                          </div>
                        </div>
                        <div style={{ background: "#fff", borderRadius: 8, padding: 4, minWidth: 100 }}>
                          <img src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(advSmiles)}/PNG?image_size=120x100`}
                            alt={h.name} style={{ width: 100, height: 80, objectFit: "contain" }}
                            onError={e => { e.target.style.display='none'; }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Custom alerts detail */}
                {painsResult.custom_hits?.length > 0 && (
                  <div style={{ background: T.bgCard, border: `1px solid rgba(245,158,11,0.3)`, borderRadius: T.radius, padding: 20, backdropFilter: "blur(12px)" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", fontFamily: "Arial,sans-serif", marginBottom: 12 }}>⚠️ Additional Structural Alerts</div>
                    {painsResult.custom_hits.map((h,i) => (
                      <div key={i} style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: 14, marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: "#fde68a", fontWeight: 700, fontFamily: "Arial,sans-serif", marginBottom: 6 }}>{h.name}</div>
                            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "4px 10px", display: "inline-block", marginBottom: 6 }}>
                              <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "Arial,sans-serif" }}>SMARTS: </span>
                              <span style={{ fontSize: 11, color: "#fde68a", fontFamily: "Courier Prime,monospace" }}>{h.smarts}</span>
                            </div>
                            <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "Arial,sans-serif", lineHeight: 1.5 }}>
                              Reactive functional group that may interfere with biochemical assays or cause toxicity concerns.
                            </div>
                          </div>
                          {h.smarts && (
                            <div style={{ background: "#fff", borderRadius: 8, padding: 4, flexShrink: 0 }}>
                              <img src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(h.smarts.replace(/\[|\]/g,''))}/PNG?image_size=100x80`}
                                alt={h.name} style={{ width: 90, height: 70, objectFit: "contain" }}
                                onError={e => { e.target.style.display='none'; }} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {painsResult.verdict==="clean" && (
                  <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: T.radius, padding: 16, fontFamily: "Arial,sans-serif", fontSize: 13, color: "#6ee7b7" }}>
                    ✅ No PAINS or structural alerts found. This compound is suitable for HTS campaigns.
                  </div>
                )}
              </div>
            )}

            {/* ── Target Prediction Results ── */}
            {advTab==="targets" && targetsResult && !targetsResult.error && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {targetsResult.count === 0 ? (
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 24, fontFamily: "Arial,sans-serif", color: T.textMuted, textAlign: "center" }}>
                    No pharmacophore patterns matched. This may be a novel scaffold or very small fragment.
                  </div>
                ) : (
                  <>
                    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "14px 20px", fontFamily: "Arial,sans-serif", fontSize: 13, color: T.textMuted, backdropFilter: "blur(12px)" }}>
                      🎯 Found <strong style={{ color: T.text }}>{targetsResult.count}</strong> potential target class{targetsResult.count!==1?"es":""} based on pharmacophore SMARTS matching.
                      Results ranked by confidence. Rule-based prediction — use as hypothesis generation only.
                    </div>
                    {targetsResult.targets.map((t,i) => (
                      <div key={i} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 20, backdropFilter: "blur(12px)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "Arial,sans-serif" }}>{t.emoji} {t.target}</div>
                            <div style={{ fontSize: 12, color: T.textMuted, fontFamily: "Arial,sans-serif", marginTop: 2 }}>{t.family}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: t.confidence>=70?"#10b981":t.confidence>=40?"#f59e0b":"#a78bfa", fontFamily: "Arial,sans-serif" }}>{t.confidence}%</div>
                            <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "Arial,sans-serif" }}>confidence</div>
                          </div>
                        </div>
                        {/* Confidence bar */}
                        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 99, height: 6, marginBottom: 12, overflow: "hidden" }}>
                          <div style={{ width: `${t.confidence}%`, height: "100%", borderRadius: 99, background: t.confidence>=70?"linear-gradient(90deg,#10b981,#34d399)":t.confidence>=40?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,#7c3aed,#a855f7)", transition: "width 0.6s ease" }} />
                        </div>
                        <div style={{ fontSize: 13, color: T.textMuted, fontFamily: "Arial,sans-serif", marginBottom: 10, lineHeight: 1.5 }}>{t.description}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "Arial,sans-serif" }}>Known drugs:</span>
                          {t.examples.map(ex => (
                            <span key={ex} style={{ background: "rgba(124,58,237,0.2)", border: `1px solid ${T.accent}`, borderRadius: 99, padding: "2px 10px", fontSize: 11, color: "#c4b5fd", fontFamily: "Arial,sans-serif" }}>{ex}</span>
                          ))}
                          <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto", fontFamily: "Arial,sans-serif" }}>{t.patterns_matched}/{t.patterns_total} patterns matched</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── Lead Optimisation Results ── */}
            {advTab==="leadopt" && leadoptResult && !leadoptResult.error && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Overview */}
                <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 24, backdropFilter: "blur(12px)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "Arial,sans-serif" }}>💡 Lead Optimisation Report</div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color: leadoptResult.qed_score>=0.7?"#10b981":leadoptResult.qed_score>=0.4?"#f59e0b":"#ef4444", fontFamily: "Arial,sans-serif" }}>{Math.round(leadoptResult.qed_score*100)}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "Arial,sans-serif" }}>QED Score</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    <span style={{ background: leadoptResult.lipinski_pass?"rgba(16,185,129,0.2)":"rgba(239,68,68,0.2)", border: `1px solid ${leadoptResult.lipinski_pass?"#10b981":"#ef4444"}`, borderRadius: 99, padding: "4px 14px", fontSize: 12, color: leadoptResult.lipinski_pass?"#34d399":"#f87171", fontFamily: "Arial,sans-serif", fontWeight: 700 }}>
                      {leadoptResult.lipinski_pass?"✅ Lipinski Pass":"❌ Lipinski Fail"}
                    </span>
                    <span style={{ background: "rgba(124,58,237,0.2)", border: `1px solid ${T.accent}`, borderRadius: 99, padding: "4px 14px", fontSize: 12, color: "#c4b5fd", fontFamily: "Arial,sans-serif" }}>
                      {leadoptResult.issue_count} issue{leadoptResult.issue_count!==1?"s":""} found
                    </span>
                    {leadoptResult.optimisation_potential > 0 && (
                      <span style={{ background: "rgba(245,158,11,0.2)", border: "1px solid #f59e0b", borderRadius: 99, padding: "4px 14px", fontSize: 12, color: "#fbbf24", fontFamily: "Arial,sans-serif" }}>
                        ~{leadoptResult.optimisation_potential}% improvement potential
                      </span>
                    )}
                  </div>
                  {/* Current properties mini-grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                    {leadoptResult.current_properties && Object.entries(leadoptResult.current_properties).map(([k,v]) => (
                      <div key={k} style={{ background: "rgba(124,58,237,0.06)", borderRadius: 8, padding: "8px 12px", textAlign: "center", border: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "Arial,sans-serif", textTransform: "uppercase" }}>{k}</div>
                        <div style={{ fontSize: 14, color: T.text, fontWeight: 700, fontFamily: "Arial,sans-serif" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suggestions */}
                {leadoptResult.suggestions?.length > 0 && (
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 20, backdropFilter: "blur(12px)" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: "Arial,sans-serif", marginBottom: 14 }}>🎯 Optimisation Suggestions</div>
                    {leadoptResult.suggestions.map((s,i) => (
                      <div key={i} style={{ background: s.priority==="high"?"rgba(239,68,68,0.06)":s.priority==="medium"?"rgba(245,158,11,0.06)":"rgba(124,58,237,0.06)",
                        border: `1px solid ${s.priority==="high"?"rgba(239,68,68,0.3)":s.priority==="medium"?"rgba(245,158,11,0.3)":"rgba(124,58,237,0.3)"}`,
                        borderRadius: 10, padding: "14px 18px", marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "Arial,sans-serif" }}>{s.icon} {s.title}</div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 99, fontFamily: "Arial,sans-serif",
                            background: s.priority==="high"?"rgba(239,68,68,0.2)":s.priority==="medium"?"rgba(245,158,11,0.2)":"rgba(124,58,237,0.2)",
                            color: s.priority==="high"?"#f87171":s.priority==="medium"?"#fbbf24":"#c4b5fd" }}>
                            {s.priority.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: T.textMuted, fontFamily: "Arial,sans-serif", lineHeight: 1.5, marginBottom: 6 }}>{s.detail}</div>
                        <div style={{ fontSize: 12, color: "#a78bfa", fontFamily: "Arial,sans-serif", fontStyle: "italic" }}>Impact: {s.impact}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bioisostere suggestions */}
                {leadoptResult.bioisosteres?.length > 0 && (
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 20, backdropFilter: "blur(12px)" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: "Arial,sans-serif", marginBottom: 14 }}>🔄 Bioisostere Replacements</div>
                    {leadoptResult.bioisosteres.map((b,i) => (
                      <div key={i} style={{ background: "rgba(124,58,237,0.06)", border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                          <span style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "4px 12px", fontSize: 12, color: "#fca5a5", fontFamily: "Courier Prime,monospace" }}>{b.original}</span>
                          <span style={{ color: T.textMuted, fontSize: 18 }}>→</span>
                          <span style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, padding: "4px 12px", fontSize: 12, color: "#6ee7b7", fontFamily: "Courier Prime,monospace" }}>{b.replacement}</span>
                        </div>
                        <div style={{ fontSize: 13, color: T.textMuted, fontFamily: "Arial,sans-serif", lineHeight: 1.5 }}>{b.reason}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Chemical structure diagram with annotations */}
                <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 20, backdropFilter: "blur(12px)" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: "Arial,sans-serif", marginBottom: 6 }}>🖼 Current Structure</div>
                  <div style={{ fontSize: 12, color: T.textMuted, fontFamily: "Arial,sans-serif", marginBottom: 14 }}>
                    Use the issues and suggestions above to guide structural modifications. Focus on HIGH priority items first.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {/* Structure image */}
                    <div style={{ background: "#fff", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <img src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(advSmiles)}/PNG?image_size=320x240`}
                        alt="Current molecule" style={{ maxWidth: "100%", maxHeight: 220, objectFit: "contain" }}
                        onError={e => { e.target.parentNode.innerHTML = '<div style="color:#888;font-size:12px;padding:30px;text-align:center">Structure preview not available<br/>Check SMILES validity</div>'; }} />
                      <div style={{ fontSize: 10, color: "#666", marginTop: 6, fontFamily: "Arial,sans-serif" }}>Current structure</div>
                    </div>
                    {/* Property radar / issues at a glance */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: "Arial,sans-serif", marginBottom: 4 }}>📊 Parameter Status</div>
                      {leadoptResult.current_properties && [
                        ["MW", leadoptResult.current_properties.mw, 500, "Da", "≤500"],
                        ["LogP", leadoptResult.current_properties.logp, 5, "", "0–5"],
                        ["HBD", leadoptResult.current_properties.hbd, 5, "", "≤5"],
                        ["HBA", leadoptResult.current_properties.hba, 10, "", "≤10"],
                        ["TPSA", leadoptResult.current_properties.tpsa, 140, "Ų", "≤140"],
                        ["Rot. Bonds", leadoptResult.current_properties.rotb, 10, "", "≤10"],
                      ].map(([k, val, max, unit, target]) => {
                        const pct = Math.min((val / (max * 1.4)) * 100, 100);
                        const ok = val <= max && (k !== "LogP" || val >= 0);
                        return (
                          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 70, fontSize: 11, color: T.textMuted, fontFamily: "Arial,sans-serif", flexShrink: 0 }}>{k}</div>
                            <div style={{ flex: 1, background: "rgba(255,255,255,0.08)", borderRadius: 99, height: 8, overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: ok ? "linear-gradient(90deg,#10b981,#34d399)" : "linear-gradient(90deg,#ef4444,#f87171)", transition: "width 0.5s" }} />
                            </div>
                            <div style={{ width: 60, fontSize: 11, fontFamily: "Arial,sans-serif", color: ok ? "#34d399" : "#f87171", fontWeight: 700, textAlign: "right" }}>{val}{unit}</div>
                            <div style={{ width: 32, fontSize: 9, color: ok ? "#34d399" : "#f87171" }}>{ok ? "✅" : "❌"}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Modification guide */}
                  {leadoptResult.issues?.length > 0 && (
                    <div style={{ marginTop: 16, background: "rgba(124,58,237,0.06)", borderRadius: 10, padding: 14, border: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#c4b5fd", fontFamily: "Arial,sans-serif", marginBottom: 10 }}>✏️ Suggested Structural Changes</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {leadoptResult.issues.map((issue, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontFamily: "Arial,sans-serif" }}>
                            <span style={{ background: issue.severity==="high"?"rgba(239,68,68,0.2)":"rgba(245,158,11,0.2)", border: `1px solid ${issue.severity==="high"?"rgba(239,68,68,0.5)":"rgba(245,158,11,0.5)"}`, borderRadius: 6, padding: "2px 8px", color: issue.severity==="high"?"#f87171":"#fbbf24", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{issue.param}</span>
                            <span style={{ color: T.textMuted }}>current: <strong style={{ color: T.text }}>{issue.value}</strong></span>
                            <span style={{ color: T.textMuted }}>→ target: <strong style={{ color: "#34d399" }}>{issue.target}</strong></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {leadoptResult.issue_count === 0 && (
                  <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: T.radius, padding: 20, fontFamily: "Arial,sans-serif", fontSize: 14, color: "#6ee7b7", textAlign: "center" }}>
                    ✅ All key parameters are within optimal ranges. This molecule has good drug-like properties!
                  </div>
                )}
              </div>
            )}

            {/* Error states for advanced results */}
            {advTab==="scaffold" && scaffoldResult?.error && <div style={{ color: "#f87171", fontFamily: "Arial,sans-serif", padding: 16 }}>Error: {scaffoldResult.error}</div>}
            {advTab==="pains" && painsResult?.error && <div style={{ color: "#f87171", fontFamily: "Arial,sans-serif", padding: 16 }}>Error: {painsResult.error}</div>}
            {advTab==="targets" && targetsResult?.error && <div style={{ color: "#f87171", fontFamily: "Arial,sans-serif", padding: 16 }}>Error: {targetsResult.error}</div>}
            {advTab==="leadopt" && leadoptResult?.error && <div style={{ color: "#f87171", fontFamily: "Arial,sans-serif", padding: 16 }}>Error: {leadoptResult.error}</div>}
          </div>
        )}

      </div>
    </div>
  );
}
