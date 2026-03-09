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
    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: T.text }}>
      {parts.map((p, i) => /^\d+$/.test(p) ? <sub key={i}>{p}</sub> : <span key={i}>{p}</span>)}
      {mw && <span style={{ color: T.textMuted, fontSize: 14, marginLeft: 10, fontFamily: "'Lato', sans-serif" }}>{mw} Da</span>}
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
                    <div style={{ background:"rgba(120,80,0,0.3)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:T.radiusSm, padding:"12px 18px", marginBottom:20, color:"#fbbf24", fontSize:12.5, fontFamily:"'Lato', sans-serif" }}>
                      ⚠ Rule-based computational estimates only. Always validate experimentally.
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:14 }}>
                      {result.toxicity.map(t => <ToxicityCard key={t.endpoint} tox={t} />)}
                    </div>
                  </>
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
      </div>
    </div>
  );
}
