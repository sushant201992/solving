import { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";

const C = {
  primary:    "#F1F5F9",
  secondary:  "#CBD5E1",
  muted:      "#94A3B8",
  faint:      "#475569",
  cyan:       "#38BDF8",
  emerald:    "#34D399",
  amber:      "#FBBF24",
  violet:     "#A78BFA",
  rose:       "#FB7185",
  surface:    "#060e1a",
  surfaceAlt: "#0A1628",
  border:     "#1E293B",
};

const fmt = (val) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(2)}L`;
  if (val >= 1000)     return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${Math.round(val).toLocaleString("en-IN")}`;
};
const fmtFull = (val) => "₹" + Math.round(val).toLocaleString("en-IN");

function calcSIP(monthly, rate, years) {
  const n = years * 12, r = rate / 100 / 12;
  const invested = monthly * n;
  const fv = r === 0 ? invested : monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  let balance = 0, totalInvested = 0;
  const rows = [];
  for (let m = 1; m <= n; m++) {
    balance = balance * (1 + r) + monthly;
    totalInvested += monthly;
    rows.push({ month: m, year: Math.ceil(m / 12), monthlyInvested: monthly, totalInvested, balance, returns: balance - totalInvested });
  }
  return { invested, returns: fv - invested, fv, rows };
}
function calcStepUp(monthly, rate, years, stepup) {
  const r = rate / 100 / 12;
  let balance = 0, totalInvested = 0, cur = monthly;
  const rows = [];
  for (let yr = 1; yr <= years; yr++) {
    if (yr > 1) cur *= (1 + stepup / 100);
    for (let m = 1; m <= 12; m++) {
      balance = balance * (1 + r) + cur;
      totalInvested += cur;
      rows.push({ month: (yr - 1) * 12 + m, year: yr, monthlyInvested: Math.round(cur), totalInvested, balance, returns: balance - totalInvested });
    }
  }
  return { invested: totalInvested, returns: balance - totalInvested, fv: balance, rows };
}
function calcLumpsum(principal, rate, years) {
  const fv = principal * Math.pow(1 + rate / 100, years);
  const rows = [];
  for (let yr = 1; yr <= years; yr++) {
    const bal = principal * Math.pow(1 + rate / 100, yr);
    rows.push({ year: yr, invested: principal, balance: bal, returns: bal - principal });
  }
  return { invested: principal, returns: fv - principal, fv, rows };
}

function Slider({ min, max, value, onChange, step = 1 }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ padding: "4px 0" }}>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ WebkitAppearance: "none", appearance: "none", width: "100%", height: 4, borderRadius: 99, outline: "none", cursor: "pointer",
          background: `linear-gradient(to right,${C.cyan} ${pct}%,#1E293B ${pct}%)` }} />
    </div>
  );
}

function InputRow({ label, value, setValue, min, max, step = 1, prefix = "", suffix = "", format }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ color: C.secondary, fontSize: 13, fontWeight: 500 }}>{label}</span>
        <div style={{ background: "#0B1825", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 12px",
          color: C.primary, fontSize: 15, fontWeight: 700, fontFamily: "'DM Mono',monospace", minWidth: 110, textAlign: "right" }}>
          {prefix}{format ? format(value) : value}{suffix}
        </div>
      </div>
      <Slider min={min} max={max} step={step} value={value} onChange={setValue} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ color: C.faint, fontSize: 11 }}>{prefix}{format ? format(min) : min}{suffix}</span>
        <span style={{ color: C.faint, fontSize: 11 }}>{prefix}{format ? format(max) : max}{suffix}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CHART 1 — Speedometer / Semi-circle Gauge  (CAGR / Return rate)
   ══════════════════════════════════════════════════════════════════ */
function SpeedometerChart({ rate, invested, fv, years }) {
  const cagr = (Math.pow(fv / invested, 1 / years) - 1) * 100;
  const maxCagr = 40;
  const pct = Math.min(1, cagr / maxCagr);
  // SVG half-donut
  const cx = 70, cy = 68, R = 52, strokeW = 14;
  const circumference = Math.PI * R; // half circle
  const filled = pct * circumference;
  // needle angle: -180 deg (left) to 0 deg (right), mapped to pct
  const angle = -180 + pct * 180;
  const rad = (angle * Math.PI) / 180;
  const nx = cx + (R - 8) * Math.cos(rad);
  const ny = cy + (R - 8) * Math.sin(rad);
  const color = cagr < 8 ? C.amber : cagr < 15 ? C.cyan : cagr < 25 ? C.emerald : C.violet;
  const label = cagr < 8 ? "Low" : cagr < 15 ? "Good" : cagr < 25 ? "Great" : "Excellent";

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6, letterSpacing: 0.5 }}>CAGR GAUGE</div>
      <svg width="100%" viewBox="0 0 140 80" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={C.amber}   />
            <stop offset="40%"  stopColor={C.cyan}    />
            <stop offset="75%"  stopColor={C.emerald} />
            <stop offset="100%" stopColor={C.violet}  />
          </linearGradient>
        </defs>
        {/* bg arc */}
        <path d={`M ${cx - R},${cy} A ${R},${R} 0 0,1 ${cx + R},${cy}`}
          fill="none" stroke="#1E293B" strokeWidth={strokeW} strokeLinecap="round" />
        {/* filled arc — clip with dasharray on the half-circle path */}
        <path d={`M ${cx - R},${cy} A ${R},${R} 0 0,1 ${cx + R},${cy}`}
          fill="none" stroke="url(#gaugeGrad)" strokeWidth={strokeW} strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`} style={{ transition: "stroke-dasharray 0.8s ease" }} />
        {/* tick marks */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const a = (-180 + f * 180) * Math.PI / 180;
          const x1 = cx + (R + strokeW / 2 + 2) * Math.cos(a);
          const y1 = cy + (R + strokeW / 2 + 2) * Math.sin(a);
          const x2 = cx + (R + strokeW / 2 + 7) * Math.cos(a);
          const y2 = cy + (R + strokeW / 2 + 7) * Math.sin(a);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.faint} strokeWidth={1} />;
        })}
        {/* needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.primary} strokeWidth={2} strokeLinecap="round" style={{ transition: "all 0.8s ease" }} />
        <circle cx={cx} cy={cy} r={5} fill={color} style={{ transition: "fill 0.4s" }} />
        {/* labels */}
        <text x={cx - R - 4} y={cy + 18} textAnchor="middle" fill={C.faint} fontSize={7} fontFamily="DM Mono,monospace">0%</text>
        <text x={cx + R + 4} y={cy + 18} textAnchor="middle" fill={C.faint} fontSize={7} fontFamily="DM Mono,monospace">40%</text>
        {/* value */}
        <text x={cx} y={cy - 10} textAnchor="middle" fill={color} fontSize={16} fontWeight={800} fontFamily="DM Mono,monospace" style={{ transition: "fill 0.4s" }}>
          {cagr.toFixed(1)}%
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle" fill={C.muted} fontSize={8} fontFamily="DM Sans,sans-serif">CAGR</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fill={color} fontSize={8} fontWeight={700} fontFamily="DM Sans,sans-serif">{label}</text>
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CHART 2 — Stacked Bar: Invested vs Returns by decade
   ══════════════════════════════════════════════════════════════════ */
function StackedBarChart({ rows, mode }) {
  const [hovIdx, setHovIdx] = useState(null);
  const decades = useMemo(() => {
    const yearly = mode === "lumpsum" ? rows : (() => {
      const map = {}; rows.forEach(r => { map[r.year] = r; }); return Object.values(map);
    })();
    const groups = [];
    const step = Math.max(1, Math.floor(yearly.length / 6));
    for (let i = step - 1; i < yearly.length; i += step) {
      const r = yearly[i];
      const inv = mode === "lumpsum" ? r.invested : r.totalInvested;
      groups.push({ year: r.year, inv, ret: r.returns, total: r.balance });
    }
    return groups.slice(0, 6);
  }, [rows, mode]);

  const maxTotal = Math.max(...decades.map(d => d.total));
  const barH = 72;

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6, letterSpacing: 0.5 }}>INVESTED vs RETURNS</div>
      <svg width="100%" viewBox={`0 0 ${decades.length * 26 + 10} 90`} style={{ display: "block", overflow: "visible" }}>
        {decades.map((d, i) => {
          const x = i * 26 + 8;
          const invH = (d.inv / maxTotal) * barH;
          const retH = (d.ret / maxTotal) * barH;
          const isHov = hovIdx === i;
          return (
            <g key={i} style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovIdx(i)} onMouseLeave={() => setHovIdx(null)}
              onTouchStart={() => setHovIdx(i)} onTouchEnd={() => setHovIdx(null)}>
              {/* returns on top */}
              <rect x={x} y={barH - invH - retH} width={18} height={retH}
                fill={C.emerald} rx={2} opacity={isHov ? 1 : 0.85}
                style={{ transition: "opacity 0.2s" }} />
              {/* invested below */}
              <rect x={x} y={barH - invH} width={18} height={invH}
                fill={C.cyan} rx={2} opacity={isHov ? 1 : 0.75}
                style={{ transition: "opacity 0.2s" }} />
              <text x={x + 9} y={barH + 10} textAnchor="middle" fill={C.faint} fontSize={7} fontFamily="DM Sans,monospace">Y{d.year}</text>
              {isHov && (
                <g>
                  <rect x={x - 10} y={barH - invH - retH - 32} width={58} height={30} rx={4} fill="#080f1c" stroke={C.border} strokeWidth={0.5} />
                  <text x={x + 9 + 10} y={barH - invH - retH - 18} textAnchor="middle" fill={C.cyan} fontSize={7} fontFamily="DM Mono,monospace">{fmt(d.inv)}</text>
                  <text x={x + 9 + 10} y={barH - invH - retH - 7} textAnchor="middle" fill={C.emerald} fontSize={7} fontFamily="DM Mono,monospace">+{fmt(d.ret)}</text>
                </g>
              )}
            </g>
          );
        })}
        {/* legend */}
        <rect x={0} y={82} width={8} height={5} fill={C.cyan} rx={1} />
        <text x={10} y={87} fill={C.faint} fontSize={7} fontFamily="DM Sans,sans-serif">Invested</text>
        <rect x={44} y={82} width={8} height={5} fill={C.emerald} rx={1} />
        <text x={54} y={87} fill={C.faint} fontSize={7} fontFamily="DM Sans,sans-serif">Returns</text>
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CHART 3 — Radial Progress Ring: Goal completion
   ══════════════════════════════════════════════════════════════════ */
function RadialProgressChart({ invested, fv, returns }) {
  const retPct = Math.min(100, (returns / fv) * 100);
  const invPct = Math.min(100, (invested / fv) * 100);
  const cx = 66, cy = 66;
  const rings = [
    { r: 50, pct: 100,    color: C.cyan,    label: "Value",    val: fmtFull(fv) },
    { r: 38, pct: retPct, color: C.emerald, label: "Returns",  val: fmt(returns) },
    { r: 26, pct: invPct, color: C.amber,   label: "Invested", val: fmt(invested) },
  ];
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6, letterSpacing: 0.5 }}>GOAL RINGS</div>
      <svg width="100%" viewBox="0 0 132 132" style={{ display: "block", overflow: "visible" }}>
        {rings.map((ring, i) => {
          const circ = 2 * Math.PI * ring.r;
          const filled = (ring.pct / 100) * circ;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={ring.r} fill="none" stroke="#1E293B" strokeWidth={8} />
              <circle cx={cx} cy={cy} r={ring.r} fill="none" stroke={ring.color} strokeWidth={8}
                strokeLinecap="round" strokeDasharray={`${filled} ${circ}`}
                strokeDashoffset={circ / 4}
                style={{ transition: "stroke-dasharray 0.9s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 4px ${ring.color}88)` }} />
            </g>
          );
        })}
        <text x={cx} y={cx - 6} textAnchor="middle" fill={C.primary} fontSize={10} fontWeight={800} fontFamily="DM Mono,monospace">{fmt(fv)}</text>
        <text x={cx} y={cx + 8} textAnchor="middle" fill={C.muted} fontSize={8} fontFamily="DM Sans,sans-serif">Total Value</text>
        {/* legend below */}
        {rings.map((ring, i) => (
          <g key={i}>
            <rect x={4 + i * 42} y={118} width={7} height={7} rx={2} fill={ring.color} />
            <text x={13 + i * 42} y={125} fill={C.faint} fontSize={7} fontFamily="DM Sans,sans-serif">{ring.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CHART 4 — Inflation-adjusted Real vs Nominal Value bar
   ══════════════════════════════════════════════════════════════════ */
function InflationChart({ fv, invested, years }) {
  const INF = 6; // assumed inflation %
  const realFv     = fv / Math.pow(1 + INF / 100, years);
  const realReturn = realFv - invested;
  const maxVal     = fv;

  const bars = [
    { label: "Nominal",   val: fv,         color: C.cyan,    pct: 100 },
    { label: "Real Value",val: realFv,      color: C.violet,  pct: (realFv / maxVal) * 100 },
    { label: "Inv.",      val: invested,    color: C.amber,   pct: (invested / maxVal) * 100 },
    { label: "Real Ret.", val: Math.max(0, realReturn), color: C.emerald, pct: (Math.max(0, realReturn) / maxVal) * 100 },
  ];
  const [hovIdx, setHovIdx] = useState(null);
  const barAreaH = 72;

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6, letterSpacing: 0.5 }}>REAL vs NOMINAL</div>
      <svg width="100%" viewBox="0 0 132 100" style={{ display: "block", overflow: "visible" }}>
        {bars.map((bar, i) => {
          const bW = 22, gap = 10;
          const x = i * (bW + gap) + 6;
          const h = (bar.pct / 100) * barAreaH;
          const isHov = hovIdx === i;
          return (
            <g key={i} style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovIdx(i)} onMouseLeave={() => setHovIdx(null)}
              onTouchStart={() => setHovIdx(i)} onTouchEnd={() => setHovIdx(null)}>
              <rect x={x} y={barAreaH - h} width={bW} height={h} rx={4}
                fill={bar.color} opacity={isHov ? 1 : 0.75}
                style={{ transition: "all 0.7s cubic-bezier(.4,0,.2,1), opacity 0.2s" }} />
              <text x={x + bW / 2} y={barAreaH + 10} textAnchor="middle" fill={C.faint} fontSize={6.5} fontFamily="DM Sans,sans-serif">{bar.label}</text>
              {isHov && (
                <text x={x + bW / 2} y={barAreaH - h - 5} textAnchor="middle" fill={bar.color} fontSize={7} fontFamily="DM Mono,monospace">{fmt(bar.val)}</text>
              )}
            </g>
          );
        })}
        <text x={66} y={96} textAnchor="middle" fill={C.faint} fontSize={7} fontFamily="DM Sans,sans-serif">@ {INF}% inflation assumed</text>
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   EXISTING CHARTS
   ══════════════════════════════════════════════════════════════════ */
function DonutChart({ invested, returns }) {
  const total = invested + returns;
  const invPct = (invested / total) * 100;
  const retPct = (returns / total) * 100;
  const R = 68, cx = 88, cy = 88, stroke = 22;
  const circ = 2 * Math.PI * R;
  const invDash = (invested / total) * circ;
  const retDash = (returns / total) * circ;
  const [hov, setHov] = useState(null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width={176} height={176} style={{ flexShrink: 0 }}>
        <defs>
          <filter id="gf1"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gf2"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#0B1825" strokeWidth={stroke} />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={hov === "ret" ? "#0d2030" : C.cyan}
          strokeWidth={stroke} strokeDasharray={`${invDash} ${circ - invDash}`} strokeDashoffset={circ / 4} strokeLinecap="butt"
          filter={hov === "inv" ? "url(#gf1)" : "none"} style={{ transition: "all 0.3s", cursor: "pointer" }}
          onMouseEnter={() => setHov("inv")} onMouseLeave={() => setHov(null)}
          onTouchStart={() => setHov("inv")} onTouchEnd={() => setHov(null)} />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={hov === "inv" ? "#0d2030" : C.emerald}
          strokeWidth={stroke} strokeDasharray={`${retDash} ${circ - retDash}`} strokeDashoffset={circ / 4 - invDash} strokeLinecap="butt"
          filter={hov === "ret" ? "url(#gf2)" : "none"} style={{ transition: "all 0.3s", cursor: "pointer" }}
          onMouseEnter={() => setHov("ret")} onMouseLeave={() => setHov(null)}
          onTouchStart={() => setHov("ret")} onTouchEnd={() => setHov(null)} />
        <text x={cx} y={cy - 12} textAnchor="middle" fill={C.primary} fontSize={16} fontWeight={800} fontFamily="DM Mono,monospace">
          {hov === "inv" ? invPct.toFixed(1) : retPct.toFixed(1)}%
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle" fill={C.muted} fontSize={10} fontFamily="DM Sans,sans-serif">
          {hov === "inv" ? "invested" : "returns"}
        </text>
        <text x={cx} y={cy + 22} textAnchor="middle" fill={hov === "inv" ? C.cyan : C.emerald} fontSize={9} fontFamily="DM Mono,monospace">
          {hov === "inv" ? fmt(invested) : fmt(returns)}
        </text>
      </svg>
      <div style={{ flex: 1 }}>
        {[
          { label: "Invested", val: invested, pct: invPct, color: C.cyan },
          { label: "Returns",  val: returns,  pct: retPct, color: C.emerald },
          { label: "Total",    val: total,    pct: 100,    color: C.amber },
        ].map(item => (
          <div key={item.label} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 3, background: item.color, boxShadow: `0 0 5px ${item.color}88` }} />
                <span style={{ fontSize: 12, color: C.secondary, fontWeight: 500 }}>{item.label}</span>
              </div>
              <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: item.color, fontWeight: 700 }}>{item.pct.toFixed(1)}%</span>
            </div>
            <div style={{ background: "#0B1825", borderRadius: 4, height: 5, overflow: "hidden" }}>
              <div style={{ width: `${item.pct}%`, height: "100%", background: item.color, borderRadius: 4, transition: "width 0.7s cubic-bezier(.4,0,.2,1)", boxShadow: `0 0 8px ${item.color}44` }} />
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3, fontFamily: "'DM Mono',monospace" }}>{fmtFull(item.val)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AreaLineChart({ rows, mode }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef();
  const yearly = useMemo(() => {
    if (mode === "lumpsum") return rows;
    const map = {}; rows.forEach(r => { map[r.year] = r; }); return Object.values(map);
  }, [rows, mode]);
  const W = 320, H = 150, PAD = { t: 14, r: 12, b: 30, l: 44 };
  const chartW = W - PAD.l - PAD.r, chartH = H - PAD.t - PAD.b;
  const maxV = Math.max(...yearly.map(r => r.balance));
  const getX = (i) => PAD.l + (yearly.length === 1 ? chartW / 2 : (i / (yearly.length - 1)) * chartW);
  const getY = (v) => PAD.t + chartH - (v / maxV) * chartH;
  const balPts = yearly.map((r, i) => `${getX(i)},${getY(r.balance)}`).join(" ");
  const invPts = yearly.map((r, i) => `${getX(i)},${getY(mode === "lumpsum" ? r.invested : r.totalInvested)}`).join(" ");
  const balArea = `M ${balPts.split(" ").join(" L ")} L ${getX(yearly.length - 1)},${PAD.t + chartH} L ${PAD.l},${PAD.t + chartH} Z`;
  const invArea = `M ${invPts.split(" ").join(" L ")} L ${getX(yearly.length - 1)},${PAD.t + chartH} L ${PAD.l},${PAD.t + chartH} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: f * maxV, y: PAD.t + chartH - f * chartH }));
  const xStep = Math.max(1, Math.floor(yearly.length / 7));
  const handleInteract = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const relX = (clientX - rect.left) * (W / rect.width) - PAD.l;
    const idx = Math.max(0, Math.min(yearly.length - 1, Math.round((relX / chartW) * (yearly.length - 1))));
    setTooltip({ idx, r: yearly[idx] });
  };
  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", touchAction: "none", display: "block" }}
      onMouseMove={handleInteract} onTouchMove={handleInteract} onMouseLeave={() => setTooltip(null)} onTouchEnd={() => setTooltip(null)}>
      <defs>
        <linearGradient id="bGr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.cyan} stopOpacity="0.4"/><stop offset="100%" stopColor={C.cyan} stopOpacity="0.02"/></linearGradient>
        <linearGradient id="iGr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.emerald} stopOpacity="0.3"/><stop offset="100%" stopColor={C.emerald} stopOpacity="0.02"/></linearGradient>
      </defs>
      {yTicks.map((t, i) => (
        <g key={i}><line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke="#1E293B" strokeWidth={1}/>
          <text x={PAD.l - 4} y={t.y + 3} textAnchor="end" fill={C.faint} fontSize={7.5} fontFamily="DM Mono,monospace">{fmt(t.v)}</text></g>
      ))}
      {yearly.map((r, i) => i % xStep === 0 && (
        <text key={i} x={getX(i)} y={H - 5} textAnchor="middle" fill={C.faint} fontSize={8} fontFamily="DM Sans,sans-serif">Y{r.year}</text>
      ))}
      <path d={invArea} fill="url(#iGr)"/>
      <path d={balArea} fill="url(#bGr)"/>
      <polyline points={invPts} fill="none" stroke={C.emerald} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>
      <polyline points={balPts} fill="none" stroke={C.cyan} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
      {tooltip && (() => {
        const x = getX(tooltip.idx), yb = getY(tooltip.r.balance);
        const inv = mode === "lumpsum" ? tooltip.r.invested : tooltip.r.totalInvested;
        const yi = getY(inv), boxW = 115, boxH = 58;
        const bx = x + 10 + boxW > W ? x - boxW - 10 : x + 10;
        return (
          <g>
            <line x1={x} y1={PAD.t} x2={x} y2={PAD.t + chartH} stroke="#ffffff18" strokeWidth={1} strokeDasharray="3,3"/>
            <circle cx={x} cy={yb} r={4.5} fill={C.cyan} stroke={C.primary} strokeWidth={1.5}/>
            <circle cx={x} cy={yi} r={3.5} fill={C.emerald} stroke={C.primary} strokeWidth={1.5}/>
            <rect x={bx} y={PAD.t} width={boxW} height={boxH} rx={7} fill="#080f1c" stroke={C.border} strokeWidth={1}/>
            <text x={bx + 9} y={PAD.t + 15} fill={C.muted} fontSize={9} fontFamily="DM Sans,sans-serif">Year {tooltip.r.year}</text>
            <text x={bx + 9} y={PAD.t + 29} fill={C.cyan} fontSize={9} fontFamily="DM Mono,monospace">Val: {fmt(tooltip.r.balance)}</text>
            <text x={bx + 9} y={PAD.t + 43} fill={C.emerald} fontSize={9} fontFamily="DM Mono,monospace">Inv: {fmt(inv)}</text>
          </g>
        );
      })()}
    </svg>
  );
}

function MilestoneChart({ fv }) {
  const milestones = useMemo(() => {
    const all = [100000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000, 50000000, 100000000, 250000000];
    const visible = all.filter(m => m <= fv * 1.5).slice(-7);
    if (!visible.length || visible[visible.length - 1] < fv) {
      const next = all.find(m => m > fv);
      if (next && !visible.includes(next)) visible.push(next);
    }
    return visible;
  }, [fv]);
  return (
    <div>
      {milestones.map((m, i) => {
        const reached = fv >= m, pct = Math.min(100, (fv / m) * 100);
        return (
          <div key={i} style={{ marginBottom: 13, opacity: reached ? 1 : 0.45 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 14 }}>{reached ? "✅" : "🎯"}</span>
                <span style={{ fontSize: 12, color: reached ? C.primary : C.muted, fontFamily: "'DM Mono',monospace", fontWeight: reached ? 600 : 400 }}>{fmt(m)}</span>
              </div>
              {reached
                ? <span style={{ fontSize: 10, color: C.emerald, fontWeight: 700, background: "#0d2818", border: `1px solid ${C.emerald}44`, borderRadius: 4, padding: "2px 7px" }}>REACHED</span>
                : <span style={{ fontSize: 10, color: C.faint }}>{pct.toFixed(0)}% done</span>}
            </div>
            <div style={{ background: "#0B1825", borderRadius: 5, height: 7, overflow: "hidden" }}>
              <div style={{ width: `${reached ? 100 : pct}%`, height: "100%", borderRadius: 5, transition: "width 0.9s cubic-bezier(.4,0,.2,1)",
                background: reached ? `linear-gradient(to right,${C.emerald},${C.cyan})` : `linear-gradient(to right,${C.cyan}88,#0055aa88)`,
                boxShadow: reached ? `0 0 10px ${C.emerald}55` : "none" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReturnGauge({ rate }) {
  const color = rate < 8 ? C.amber : rate < 15 ? C.cyan : C.emerald;
  const label = rate < 8 ? "Conservative" : rate < 15 ? "Moderate" : "Aggressive";
  const segs = [{ start: 0, end: 8 }, { start: 8, end: 15 }, { start: 15, end: 30 }];
  const segColors = [C.amber, C.cyan, C.emerald];
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Return Rate</span>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 10, color, background: `${color}15`, border: `1px solid ${color}44`, borderRadius: 5, padding: "2px 8px", fontWeight: 700 }}>{label}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color, fontFamily: "'DM Mono',monospace" }}>{rate}% p.a.</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 3, height: 6, borderRadius: 6, overflow: "hidden" }}>
        {segs.map((s, i) => {
          const segLen = s.end - s.start;
          const filled = Math.max(0, Math.min(rate - s.start, segLen));
          return <div key={i} style={{ flex: segLen, background: "#0B1825", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${(filled / segLen) * 100}%`, height: "100%", background: segColors[i], transition: "width 0.5s ease" }} />
          </div>;
        })}
      </div>
      <div style={{ display: "flex", marginTop: 4 }}>
        <span style={{ flex: 8, fontSize: 9, color: C.faint }}>1–8%</span>
        <span style={{ flex: 7, fontSize: 9, color: C.faint }}>8–15%</span>
        <span style={{ flex: 15, fontSize: 9, color: C.faint, textAlign: "right" }}>15–30%</span>
      </div>
    </div>
  );
}

function WealthBadge({ invested, fv }) {
  const mult = fv / invested;
  const emoji = mult < 2 ? "🌱" : mult < 5 ? "🌿" : mult < 10 ? "🌳" : mult < 20 ? "🚀" : mult < 50 ? "💎" : "👑";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
      <div style={{ fontSize: 38, lineHeight: 1 }}>{emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: C.muted, fontSize: 11, fontWeight: 500, letterSpacing: 0.3 }}>Wealth Multiplier</div>
        <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'DM Mono',monospace", color: C.amber, lineHeight: 1.1 }}>{mult.toFixed(1)}x</div>
        <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>your money grows {mult.toFixed(1)} times</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: C.muted, fontSize: 10, marginBottom: 3, letterSpacing: 0.5, fontWeight: 500 }}>TOTAL GAIN</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.emerald, fontFamily: "'DM Mono',monospace" }}>{((mult - 1) * 100).toFixed(0)}%</div>
      </div>
    </div>
  );
}

const tdS = { padding: "7px 8px", color: C.secondary, textAlign: "right", borderBottom: "1px solid #0F1C2A", fontSize: 11, fontFamily: "'DM Mono',monospace" };

function MonthTable({ rows, mode }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? rows : rows.slice(0, 24);
  const headers = mode === "lumpsum"
    ? ["Year", "Invested", "Balance", "Returns", "Gain%"]
    : ["Mo", "Yr", "Monthly", "Total Inv", "Balance", "Returns", "Gain%"];
  return (
    <div>
      <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${C.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: mode === "lumpsum" ? 280 : 420 }}>
          <thead>
            <tr style={{ background: "#0A1422" }}>
              {headers.map(h => <th key={h} style={{ ...tdS, color: C.cyan, fontWeight: 700, borderBottom: `1px solid ${C.border}`, padding: "10px 8px", whiteSpace: "nowrap", fontSize: 12 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {displayed.map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? C.surface : "#070D18" }}>
                {mode === "lumpsum" ? <>
                  <td style={{ ...tdS, color: C.muted }}>{r.year}</td>
                  <td style={tdS}>{fmt(r.invested)}</td>
                  <td style={{ ...tdS, color: C.cyan, fontWeight: 600 }}>{fmt(r.balance)}</td>
                  <td style={{ ...tdS, color: C.emerald, fontWeight: 600 }}>{fmt(r.returns)}</td>
                  <td style={{ ...tdS, color: C.amber, fontWeight: 600 }}>{((r.returns / r.invested) * 100).toFixed(1)}%</td>
                </> : <>
                  <td style={{ ...tdS, color: C.muted }}>{r.month}</td>
                  <td style={{ ...tdS, color: C.muted }}>{r.year}</td>
                  <td style={tdS}>{fmt(r.monthlyInvested)}</td>
                  <td style={tdS}>{fmt(r.totalInvested)}</td>
                  <td style={{ ...tdS, color: C.cyan, fontWeight: 600 }}>{fmt(r.balance)}</td>
                  <td style={{ ...tdS, color: C.emerald, fontWeight: 600 }}>{fmt(r.returns)}</td>
                  <td style={{ ...tdS, color: C.amber, fontWeight: 600 }}>{((r.returns / r.totalInvested) * 100).toFixed(1)}%</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 24 && (
        <button onClick={() => setShowAll(!showAll)}
          style={{ width: "100%", marginTop: 8, padding: "9px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.cyan, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>
          {showAll ? "Show Less ▲" : `Show All ${rows.length} ${mode === "lumpsum" ? "Years" : "Months"} ▼`}
        </button>
      )}
    </div>
  );
}

function downloadExcel(result, mode, params) {
  const wb = XLSX.utils.book_new();
  const sum = [
    ["Kompound — Investment Report"], ["Mode", mode.toUpperCase()], ["Generated", new Date().toLocaleDateString("en-IN")], [],
    ["SUMMARY"], ["Total Invested", result.invested], ["Est. Returns", result.returns], ["Future Value", result.fv],
    ["Wealth Multiplier", (result.fv / result.invested).toFixed(2) + "x"], ["Total Gain %", ((result.returns / result.invested) * 100).toFixed(2) + "%"], [],
    ["PARAMETERS"], ...Object.entries(params).map(([k, v]) => [k, v]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(sum);
  ws1["!cols"] = [{ wch: 24 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");
  const detail = mode === "lumpsum"
    ? [["Year", "Invested (₹)", "Balance (₹)", "Returns (₹)", "Return %"],
       ...result.rows.map(r => [r.year, Math.round(r.invested), Math.round(r.balance), Math.round(r.returns), ((r.returns / r.invested) * 100).toFixed(2) + "%"])]
    : [["Month", "Year", "Monthly (₹)", "Total Invested (₹)", "Balance (₹)", "Returns (₹)", "Return %"],
       ...result.rows.map(r => [r.month, r.year, Math.round(r.monthlyInvested), Math.round(r.totalInvested), Math.round(r.balance), Math.round(r.returns), ((r.returns / r.totalInvested) * 100).toFixed(2) + "%"])];
  const ws2 = XLSX.utils.aoa_to_sheet(detail);
  ws2["!cols"] = detail[0].map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws2, "Detail");
  XLSX.writeFile(wb, `kompound-${mode}.xlsx`);
}

function Card({ children }) {
  return (
    <div className="rgb-card">
      <div className="rgb-card-inner">{children}</div>
    </div>
  );
}

function SH({ icon, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: C.primary, letterSpacing: 0.2 }}>{title}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   APP
   ══════════════════════════════════════════════════════════════════ */
export default function App() {
  const [tab, setTab] = useState("sip");
  const [showTable, setShowTable] = useState(false);
  const [sipAmount, setSipAmount] = useState(10000);
  const [sipRate,   setSipRate]   = useState(12);
  const [sipYears,  setSipYears]  = useState(20);
  const [stAmount,  setStAmount]  = useState(10000);
  const [stRate,    setStRate]    = useState(12);
  const [stYears,   setStYears]   = useState(20);
  const [stStepup,  setStStepup]  = useState(10);
  const [lsAmount,  setLsAmount]  = useState(500000);
  const [lsRate,    setLsRate]    = useState(12);
  const [lsYears,   setLsYears]   = useState(15);

  const result = useMemo(() => {
    if (tab === "sip")    return calcSIP(sipAmount, sipRate, sipYears);
    if (tab === "stepup") return calcStepUp(stAmount, stRate, stYears, stStepup);
    return calcLumpsum(lsAmount, lsRate, lsYears);
  }, [tab, sipAmount, sipRate, sipYears, stAmount, stRate, stYears, stStepup, lsAmount, lsRate, lsYears]);

  const excelParams = useMemo(() => {
    if (tab === "sip")    return { "Monthly SIP": `₹${sipAmount.toLocaleString("en-IN")}`, "Annual Return": `${sipRate}%`, "Duration": `${sipYears} yrs` };
    if (tab === "stepup") return { "Initial SIP": `₹${stAmount.toLocaleString("en-IN")}`, "Annual Return": `${stRate}%`, "Duration": `${stYears} yrs`, "Step-up": `${stStepup}%` };
    return { "Lumpsum": `₹${lsAmount.toLocaleString("en-IN")}`, "Annual Return": `${lsRate}%`, "Duration": `${lsYears} yrs` };
  }, [tab, sipAmount, sipRate, sipYears, stAmount, stRate, stYears, stStepup, lsAmount, lsRate, lsYears]);

  const currentRate = tab === "sip" ? sipRate : tab === "stepup" ? stRate : lsRate;
  const currentYears = tab === "sip" ? sipYears : tab === "stepup" ? stYears : lsYears;
  const tabs = [{ id: "sip", label: "SIP", icon: "📈" }, { id: "stepup", label: "Step-up", icon: "🚀" }, { id: "lumpsum", label: "Lumpsum", icon: "💰" }];

  return (
    <div style={{ minHeight: "100vh", background: "#030810", fontFamily: "'DM Sans',sans-serif", color: C.primary, display: "flex", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=DM+Mono:wght@400;500;600&display=swap');
        * { box-sizing:border-box; margin:0; }
        body { background:#030810; }
        input[type=range]{ -webkit-appearance:none; appearance:none; }
        input[type=range]::-webkit-slider-thumb{ -webkit-appearance:none; width:20px; height:20px; border-radius:50%; background:#fff; border:3px solid ${C.cyan}; box-shadow:0 0 8px ${C.cyan}88; cursor:pointer; }
        input[type=range]::-moz-range-thumb{ width:20px; height:20px; border-radius:50%; background:#fff; border:3px solid ${C.cyan}; cursor:pointer; }
        ::-webkit-scrollbar{ width:4px; height:4px; }
        ::-webkit-scrollbar-track{ background:${C.surface}; }
        ::-webkit-scrollbar-thumb{ background:#1E293B; border-radius:99px; }
        @keyframes pulse{ 0%,100%{opacity:1} 50%{opacity:.35} }
        @property --angle { syntax:'<angle>'; initial-value:0deg; inherits:false; }
        @keyframes spin-border { to { --angle:360deg; } }
        .gemini-border-wrap { width:100%; max-width:480px; min-height:100vh; padding-bottom:50px; background:#030810; }
        .rgb-card { position:relative; border-radius:16px; padding:2px; background:conic-gradient(from var(--angle),#ff0040,#ff6600,#ffee00,#00ff88,#0088ff,#8800ff,#ff0040); animation:spin-border 3s linear infinite; }
        .rgb-card::before { content:''; position:absolute; inset:0; border-radius:16px; padding:2px; background:conic-gradient(from var(--angle),#ff0040,#ff6600,#ffee00,#00ff88,#0088ff,#8800ff,#ff0040); filter:blur(7px); opacity:0.55; animation:spin-border 3s linear infinite; z-index:-1; }
        .rgb-card-inner { background:${C.surface}; border-radius:14px; padding:16px; position:relative; z-index:1; }
        .mini-chart-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .mini-chart-cell { background:#0A1628; border-radius:12px; padding:10px 8px; border:1px solid #1E293B; }
        .divider { width:100%; height:1px; background:linear-gradient(to right,transparent,${C.border},transparent); margin:4px 0 12px; }
      `}</style>

      <div className="gemini-border-wrap">

        {/* Header */}
        <div style={{ padding: "22px 16px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg,${C.cyan},#0055bb)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 900, color: "#fff" }}>K</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: C.primary }}>Kompound</div>
            <div style={{ fontSize: 9, color: C.faint, letterSpacing: 1.8, fontWeight: 600 }}>SMART INVESTMENT CALCULATOR</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: 99, background: C.emerald, boxShadow: `0 0 6px ${C.emerald}`, animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 10, color: C.emerald, fontWeight: 700, letterSpacing: 0.5 }}>LIVE</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", margin: "16px 16px 0", background: "#080F1C", borderRadius: 13, padding: 4, gap: 3 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setShowTable(false); }} style={{
              flex: 1, padding: "9px 2px", borderRadius: 10, border: "none", cursor: "pointer",
              background: tab === t.id ? `linear-gradient(135deg,${C.cyan}18,#0066cc28)` : "transparent",
              color: tab === t.id ? C.cyan : C.faint,
              fontWeight: tab === t.id ? 700 : 500, fontSize: 12,
              borderBottom: tab === t.id ? `2px solid ${C.cyan}` : "2px solid transparent",
              fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Input Card */}
        <div style={{ margin: "14px 16px 0" }}>
          <div className="rgb-card">
            <div className="rgb-card-inner" style={{ padding: "18px 16px" }}>
              <div style={{ marginBottom: 18 }}><ReturnGauge rate={currentRate} /></div>
              {tab === "sip" && <>
                <InputRow label="Monthly investment" value={sipAmount} setValue={setSipAmount} min={500} max={1000000} step={500} prefix="₹" format={v => v.toLocaleString("en-IN")} />
                <InputRow label="Expected annual return" value={sipRate} setValue={setSipRate} min={1} max={30} step={0.5} suffix="%" />
                <InputRow label="Time period" value={sipYears} setValue={setSipYears} min={1} max={40} suffix=" yr" />
              </>}
              {tab === "stepup" && <>
                <InputRow label="Initial monthly SIP" value={stAmount} setValue={setStAmount} min={500} max={1000000} step={500} prefix="₹" format={v => v.toLocaleString("en-IN")} />
                <InputRow label="Expected annual return" value={stRate} setValue={setStRate} min={1} max={30} step={0.5} suffix="%" />
                <InputRow label="Time period" value={stYears} setValue={setStYears} min={1} max={40} suffix=" yr" />
                <InputRow label="Annual step-up %" value={stStepup} setValue={setStStepup} min={1} max={50} suffix="%" />
              </>}
              {tab === "lumpsum" && <>
                <InputRow label="Lumpsum amount" value={lsAmount} setValue={setLsAmount} min={10000} max={10000000} step={10000} prefix="₹" format={v => v.toLocaleString("en-IN")} />
                <InputRow label="Expected annual return" value={lsRate} setValue={setLsRate} min={1} max={30} step={0.5} suffix="%" />
                <InputRow label="Time period" value={lsYears} setValue={setLsYears} min={1} max={40} suffix=" yr" />
              </>}
            </div>
          </div>
        </div>

        {/* Future Value Banner */}
        <div style={{ margin: "12px 16px 0" }}>
          <div className="rgb-card">
            <div className="rgb-card-inner" style={{ background: "linear-gradient(135deg,#002233,#003355)", padding: "20px 18px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -35, right: -35, width: 130, height: 130, borderRadius: "50%", background: `${C.cyan}08` }} />
              <div style={{ position: "absolute", bottom: -25, left: -25, width: 90, height: 90, borderRadius: "50%", background: `${C.cyan}06` }} />
              <div style={{ color: C.muted, fontSize: 11, letterSpacing: 1.5, fontWeight: 700 }}>FUTURE VALUE</div>
              <div style={{ fontSize: 34, fontWeight: 900, fontFamily: "'DM Mono',monospace", letterSpacing: -1, marginTop: 5, color: C.primary }}>{fmtFull(result.fv)}</div>
              <div style={{ display: "flex", gap: 22, marginTop: 14, flexWrap: "wrap" }}>
                {[
                  { label: "INVESTED", val: result.invested, color: C.secondary },
                  { label: "RETURNS",  val: result.returns,  color: C.emerald },
                  { label: "GAIN",     val: null, pct: ((result.returns / result.invested) * 100).toFixed(1) + "%", color: C.amber },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 9, color: C.faint, letterSpacing: 1.2, fontWeight: 600, marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: item.color }}>
                      {item.val != null ? fmt(item.val) : item.pct}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Wealth Badge */}
        <div style={{ margin: "12px 16px 0" }}>
          <div className="rgb-card">
            <div className="rgb-card-inner" style={{ padding: "16px" }}>
              <WealthBadge invested={result.invested} fv={result.fv} />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            4 MINI CHARTS — 2 × 2 GRID inside one rgb-card
            ═══════════════════════════════════════════════════════════ */}
        <div style={{ margin: "12px 16px 0" }}>
          <Card>
            <SH icon="📊" title="Visual Analytics" />
            <div className="mini-chart-grid">
              {/* Chart 1: Speedometer */}
              <div className="mini-chart-cell">
                <SpeedometerChart rate={currentRate} invested={result.invested} fv={result.fv} years={currentYears} />
              </div>
              {/* Chart 2: Stacked Bar */}
              <div className="mini-chart-cell">
                <StackedBarChart rows={result.rows} mode={tab} />
              </div>
              {/* Chart 3: Radial Rings */}
              <div className="mini-chart-cell">
                <RadialProgressChart invested={result.invested} fv={result.fv} returns={result.returns} />
              </div>
              {/* Chart 4: Inflation Bar */}
              <div className="mini-chart-cell">
                <InflationChart fv={result.fv} invested={result.invested} years={currentYears} />
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: C.faint, textAlign: "center" }}>
              Tap / hover bars & segments for details
            </div>
          </Card>
        </div>

        {/* Portfolio Breakdown (Donut) */}
        <div style={{ margin: "12px 16px 0" }}>
          <Card>
            <SH icon="🥧" title="Portfolio Breakdown" />
            <DonutChart invested={result.invested} returns={result.returns} />
            <div style={{ marginTop: 12, padding: "9px 12px", background: "#0A1628", borderRadius: 10, fontSize: 11, color: C.faint, textAlign: "center" }}>
              👆 Tap segments to highlight
            </div>
          </Card>
        </div>

        {/* Area Line Chart */}
        <div style={{ margin: "12px 16px 0" }}>
          <Card>
            <SH icon="📈" title="Growth Over Time" />
            <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
              {[{ color: C.cyan, label: "Portfolio Value" }, { color: C.emerald, label: "Amount Invested" }].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 14, height: 3, borderRadius: 2, background: l.color }} />
                  <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{l.label}</span>
                </div>
              ))}
            </div>
            <AreaLineChart rows={result.rows} mode={tab} />
            <div style={{ marginTop: 8, fontSize: 10, color: C.faint, textAlign: "center" }}>Slide / hover to see year-wise values</div>
          </Card>
        </div>

        {/* Milestones */}
        <div style={{ margin: "12px 16px 0" }}>
          <Card>
            <SH icon="🏆" title="Wealth Milestones" />
            <MilestoneChart fv={result.fv} />
          </Card>
        </div>

        {/* Month Table */}
        <div style={{ margin: "12px 16px 0" }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showTable ? 14 : 0 }}>
              <SH icon="📋" title={`${tab === "lumpsum" ? "Year" : "Month"}-wise Breakdown`} />
              <button onClick={() => setShowTable(!showTable)}
                style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.cyan, fontSize: 12, padding: "5px 12px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: 600, marginBottom: 14 }}>
                {showTable ? "Hide ▲" : "View ▼"}
              </button>
            </div>
            {showTable && <MonthTable rows={result.rows} mode={tab} />}
          </Card>
        </div>

        {/* Download */}
        <div style={{ margin: "12px 16px 0" }}>
          <div className="rgb-card">
            <div className="rgb-card-inner" style={{ padding: "4px" }}>
              <button onClick={() => downloadExcel(result, tab, excelParams)} style={{
                width: "100%", padding: "14px", background: "transparent", border: "none", borderRadius: 12, color: C.cyan,
                fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10, letterSpacing: 0.3
              }}>
                ⬇️ Download Excel Report
              </button>
            </div>
          </div>
          <p style={{ textAlign: "center", color: C.faint, fontSize: 11, marginTop: 8 }}>
            Summary + full {tab === "lumpsum" ? "year" : "month"}-wise detail with gain %
          </p>
        </div>

        <div style={{ textAlign: "center", marginTop: 36, color: C.faint, fontSize: 11, paddingBottom: 14, opacity: 0.5 }}>
          Kompound · Estimates only · Not financial advice
        </div>
      </div>
    </div>
  );
}
