import { useState, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";

/* ─── Theme Tokens ──────────────────────────────────────────────── */
const DARK = {
  bg:         "#030810",
  surface:    "#060e1a",
  surfaceAlt: "#0A1628",
  border:     "#1E293B",
  primary:    "#F1F5F9",
  secondary:  "#CBD5E1",
  muted:      "#94A3B8",
  faint:      "#475569",
  cyan:       "#38BDF8",
  emerald:    "#34D399",
  amber:      "#FBBF24",
  violet:     "#A78BFA",
  inputBg:    "#0B1825",
  cardBg:     "#060e1a",
  trackBg:    "#1E293B",
  resultBg:   "linear-gradient(135deg,#002233,#003355)",
  shadowColor:"rgba(56,189,248,0.08)",
};
const LIGHT = {
  bg:         "#F0FDF4",
  surface:    "#FFFFFF",
  surfaceAlt: "#F8FFFE",
  border:     "#D1FAE5",
  primary:    "#0F172A",
  secondary:  "#1E3A2F",
  muted:      "#4B7A63",
  faint:      "#6B8F7A",
  cyan:       "#059669",
  emerald:    "#10B981",
  amber:      "#D97706",
  violet:     "#7C3AED",
  inputBg:    "#ECFDF5",
  cardBg:     "#FFFFFF",
  trackBg:    "#D1FAE5",
  resultBg:   "linear-gradient(135deg,#ECFDF5,#D1FAE5)",
  shadowColor:"rgba(16,185,129,0.10)",
};

/* ─── Formatters ─────────────────────────────────────────────────── */
const fmt = (val) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(2)}L`;
  if (val >= 1000)     return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${Math.round(val).toLocaleString("en-IN")}`;
};
const fmtFull = (val) => "₹" + Math.round(val).toLocaleString("en-IN");

/* ─── Calculators (Groww-style logic) ────────────────────────────
   FV = P × [((1+r)^n − 1) / r] × (1+r)   where r = annual/12, n = years×12
   Invested amount = monthly × 12 × years  (simple, as shown in Groww)
   ────────────────────────────────────────────────────────────────── */
function calcSIP(monthly, annualRate, years) {
  const n = years * 12;
  const r = annualRate / 100 / 12;
  const invested = monthly * n;
  const fv = r === 0
    ? invested
    : monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  const estReturns = fv - invested;
  let balance = 0, totalInvested = 0;
  const rows = [];
  for (let m = 1; m <= n; m++) {
    balance = balance * (1 + r) + monthly;
    totalInvested += monthly;
    rows.push({
      month: m,
      year: Math.ceil(m / 12),
      monthlyInvested: monthly,
      totalInvested,
      balance,
      returns: balance - totalInvested,
    });
  }
  return { invested, returns: estReturns, fv, rows };
}

function calcStepUp(monthly, annualRate, years, stepupPct) {
  const r = annualRate / 100 / 12;
  let balance = 0, totalInvested = 0, cur = monthly;
  const rows = [];
  for (let yr = 1; yr <= years; yr++) {
    if (yr > 1) cur = cur * (1 + stepupPct / 100);
    for (let m = 1; m <= 12; m++) {
      balance = balance * (1 + r) + cur;
      totalInvested += cur;
      rows.push({
        month: (yr - 1) * 12 + m,
        year: yr,
        monthlyInvested: Math.round(cur),
        totalInvested,
        balance,
        returns: balance - totalInvested,
      });
    }
  }
  return { invested: totalInvested, returns: balance - totalInvested, fv: balance, rows };
}

function calcLumpsum(principal, annualRate, years) {
  const fv = principal * Math.pow(1 + annualRate / 100, years);
  const rows = [];
  for (let yr = 1; yr <= years; yr++) {
    const bal = principal * Math.pow(1 + annualRate / 100, yr);
    rows.push({ year: yr, invested: principal, balance: bal, returns: bal - principal });
  }
  return { invested: principal, returns: fv - principal, fv, rows };
}

/* ─── Slider (theme-aware) ──────────────────────────────────────── */
function Slider({ min, max, value, onChange, step = 1, T }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{
        WebkitAppearance: "none", appearance: "none",
        width: "100%", height: 3, borderRadius: 99, outline: "none", cursor: "pointer",
        background: `linear-gradient(to right,${T.cyan} ${pct}%,${T.trackBg} ${pct}%)`,
        marginTop: 10, marginBottom: 4,
      }} />
  );
}

/* ─── Editable Amount Input ─────────────────────────────────────── */
function AmountInput({ value, setValue, min, max, step, prefix, suffix, label, T, allowManual = false }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  const display = value.toLocaleString("en-IN");

  const startEdit = () => {
    setRaw(String(value));
    setEditing(true);
  };
  const commitEdit = () => {
    const parsed = parseInt(raw.replace(/,/g, ""), 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      setValue(clamped);
    }
    setEditing(false);
  };
  const handleKey = (e) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") setEditing(false);
  };

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ color: T.secondary, fontSize: 13, fontWeight: 500 }}>{label}</span>
        <div
          onClick={allowManual ? startEdit : undefined}
          style={{
            background: T.inputBg,
            border: `1.5px solid ${T.cyan}55`,
            borderRadius: 8,
            padding: "5px 12px",
            minWidth: 120,
            textAlign: "right",
            cursor: allowManual ? "text" : "default",
            display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4,
          }}>
          {prefix && <span style={{ color: T.cyan, fontWeight: 700, fontSize: 14 }}>{prefix}</span>}
          {editing ? (
            <input
              autoFocus
              value={raw}
              onChange={e => setRaw(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={commitEdit}
              onKeyDown={handleKey}
              style={{
                background: "transparent", border: "none", outline: "none",
                color: T.primary, fontSize: 15, fontWeight: 700,
                fontFamily: "'DM Mono',monospace", width: 90, textAlign: "right",
              }}
            />
          ) : (
            <span style={{ color: T.primary, fontSize: 15, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
              {display}
            </span>
          )}
          {suffix && <span style={{ color: T.muted, fontWeight: 600, fontSize: 13 }}>{suffix}</span>}
        </div>
      </div>
      <Slider min={min} max={max} step={step} value={value} onChange={setValue} T={T} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ color: T.faint, fontSize: 10 }}>{prefix}{min.toLocaleString("en-IN")}{suffix}</span>
        <span style={{ color: T.faint, fontSize: 10 }}>{prefix}{max.toLocaleString("en-IN")}{suffix}</span>
      </div>
    </div>
  );
}

/* ─── Chart 1: Speedometer ──────────────────────────────────────── */
function SpeedometerChart({ invested, fv, years, T }) {
  const cagr = invested > 0 ? (Math.pow(fv / invested, 1 / years) - 1) * 100 : 0;
  const maxCagr = 40;
  const pct = Math.min(1, cagr / maxCagr);
  const cx = 70, cy = 62, R = 50, strokeW = 10;
  const circumference = Math.PI * R;
  const filled = pct * circumference;
  const angle = -180 + pct * 180;
  const rad = (angle * Math.PI) / 180;
  const nx = cx + (R - 6) * Math.cos(rad);
  const ny = cy + (R - 6) * Math.sin(rad);
  const color = cagr < 8 ? T.amber : cagr < 15 ? T.cyan : cagr < 25 ? T.emerald : T.violet;
  const label = cagr < 8 ? "Low" : cagr < 15 ? "Good" : cagr < 25 ? "Great" : "Excellent";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, marginBottom: 4, letterSpacing: 0.5 }}>CAGR GAUGE</div>
      <svg width="100%" viewBox="0 0 140 80" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="gaugeGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={T.amber}/><stop offset="40%" stopColor={T.cyan}/>
            <stop offset="75%" stopColor={T.emerald}/><stop offset="100%" stopColor={T.violet}/>
          </linearGradient>
        </defs>
        <path d={`M ${cx-R},${cy} A ${R},${R} 0 0,1 ${cx+R},${cy}`} fill="none" stroke={T.trackBg} strokeWidth={strokeW} strokeLinecap="round"/>
        <path d={`M ${cx-R},${cy} A ${R},${R} 0 0,1 ${cx+R},${cy}`} fill="none" stroke="url(#gaugeGrad2)" strokeWidth={strokeW} strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`} style={{ transition: "stroke-dasharray 0.8s ease" }}/>
        {[0,0.25,0.5,0.75,1].map((f,i) => {
          const a = (-180 + f*180)*Math.PI/180;
          return <line key={i} x1={cx+(R+strokeW/2+1)*Math.cos(a)} y1={cy+(R+strokeW/2+1)*Math.sin(a)}
            x2={cx+(R+strokeW/2+5)*Math.cos(a)} y2={cy+(R+strokeW/2+5)*Math.sin(a)} stroke={T.faint} strokeWidth={1}/>;
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={T.primary} strokeWidth={1.5} strokeLinecap="round" style={{ transition:"all 0.8s ease" }}/>
        <circle cx={cx} cy={cy} r={4} fill={color} style={{ transition:"fill 0.4s" }}/>
        <text x={cx} y={cy-8} textAnchor="middle" fill={color} fontSize={14} fontWeight={800} fontFamily="DM Mono,monospace">{cagr.toFixed(1)}%</text>
        <text x={cx} y={cy+6} textAnchor="middle" fill={T.muted} fontSize={8} fontFamily="DM Sans,sans-serif">CAGR</text>
        <text x={cx} y={cy+18} textAnchor="middle" fill={color} fontSize={8} fontWeight={700} fontFamily="DM Sans,sans-serif">{label}</text>
      </svg>
    </div>
  );
}

/* ─── Chart 2: Stacked Bar ──────────────────────────────────────── */
function StackedBarChart({ rows, mode, T }) {
  const [hovIdx, setHovIdx] = useState(null);
  const decades = useMemo(() => {
    const yearly = mode === "lumpsum" ? rows : (() => {
      const map = {}; rows.forEach(r => { map[r.year] = r; }); return Object.values(map);
    })();
    const step = Math.max(1, Math.floor(yearly.length / 6));
    const groups = [];
    for (let i = step - 1; i < yearly.length; i += step) {
      const r = yearly[i];
      const inv = mode === "lumpsum" ? r.invested : r.totalInvested;
      groups.push({ year: r.year, inv, ret: r.returns, total: r.balance });
    }
    return groups.slice(0, 6);
  }, [rows, mode]);
  const maxTotal = Math.max(...decades.map(d => d.total));
  const barH = 68;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, marginBottom: 4, letterSpacing: 0.5 }}>INV vs RETURNS</div>
      <svg width="100%" viewBox={`0 0 ${decades.length*26+10} 88`} style={{ display: "block", overflow: "visible" }}>
        {decades.map((d, i) => {
          const x = i*26+8, invH = (d.inv/maxTotal)*barH, retH = (d.ret/maxTotal)*barH, isHov = hovIdx===i;
          return (
            <g key={i} style={{ cursor:"pointer" }} onMouseEnter={()=>setHovIdx(i)} onMouseLeave={()=>setHovIdx(null)}
              onTouchStart={()=>setHovIdx(i)} onTouchEnd={()=>setHovIdx(null)}>
              <rect x={x} y={barH-invH-retH} width={18} height={retH} fill={T.emerald} rx={2} opacity={isHov?1:0.8}/>
              <rect x={x} y={barH-invH} width={18} height={invH} fill={T.cyan} rx={2} opacity={isHov?1:0.7}/>
              <text x={x+9} y={barH+10} textAnchor="middle" fill={T.faint} fontSize={7} fontFamily="DM Sans,sans-serif">Y{d.year}</text>
              {isHov && <>
                <rect x={x-8} y={barH-invH-retH-28} width={54} height={26} rx={4} fill={T.surfaceAlt} stroke={T.border} strokeWidth={0.5}/>
                <text x={x+19} y={barH-invH-retH-15} textAnchor="middle" fill={T.cyan} fontSize={7} fontFamily="DM Mono,monospace">{fmt(d.inv)}</text>
                <text x={x+19} y={barH-invH-retH-5} textAnchor="middle" fill={T.emerald} fontSize={7} fontFamily="DM Mono,monospace">+{fmt(d.ret)}</text>
              </>}
            </g>
          );
        })}
        <rect x={0} y={80} width={7} height={5} fill={T.cyan} rx={1}/>
        <text x={9} y={85} fill={T.faint} fontSize={7} fontFamily="DM Sans,sans-serif">Inv</text>
        <rect x={34} y={80} width={7} height={5} fill={T.emerald} rx={1}/>
        <text x={43} y={85} fill={T.faint} fontSize={7} fontFamily="DM Sans,sans-serif">Ret</text>
      </svg>
    </div>
  );
}

/* ─── Chart 3: Radial Rings ─────────────────────────────────────── */
function RadialProgressChart({ invested, fv, returns, T }) {
  const retPct = Math.min(100, (returns/fv)*100);
  const invPct = Math.min(100, (invested/fv)*100);
  const cx = 66, cy = 60;
  const rings = [
    { r:50, pct:100, color:T.cyan,    label:"Value",   val:fmtFull(fv)    },
    { r:38, pct:retPct, color:T.emerald, label:"Returns", val:fmt(returns) },
    { r:26, pct:invPct, color:T.amber,   label:"Invested",val:fmt(invested)},
  ];
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:10, color:T.muted, fontWeight:600, marginBottom:4, letterSpacing:0.5 }}>GOAL RINGS</div>
      <svg width="100%" viewBox="0 0 132 120" style={{ display:"block", overflow:"visible" }}>
        {rings.map((ring,i) => {
          const circ = 2*Math.PI*ring.r, filled=(ring.pct/100)*circ;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={ring.r} fill="none" stroke={T.trackBg} strokeWidth={7}/>
              <circle cx={cx} cy={cy} r={ring.r} fill="none" stroke={ring.color} strokeWidth={7}
                strokeLinecap="round" strokeDasharray={`${filled} ${circ}`} strokeDashoffset={circ/4}
                style={{ transition:"stroke-dasharray 0.9s cubic-bezier(.4,0,.2,1)" }}/>
            </g>
          );
        })}
        <text x={cx} y={cy-4} textAnchor="middle" fill={T.primary} fontSize={9} fontWeight={800} fontFamily="DM Mono,monospace">{fmt(fv)}</text>
        <text x={cx} y={cy+9} textAnchor="middle" fill={T.muted} fontSize={7} fontFamily="DM Sans,sans-serif">Total</text>
        {rings.map((ring,i) => (
          <g key={i}>
            <rect x={4+i*42} y={108} width={7} height={7} rx={2} fill={ring.color}/>
            <text x={13+i*42} y={115} fill={T.faint} fontSize={7} fontFamily="DM Sans,sans-serif">{ring.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ─── Chart 4: Inflation-adjusted ──────────────────────────────── */
function InflationChart({ fv, invested, years, T }) {
  const INF = 6;
  const realFv  = fv / Math.pow(1 + INF/100, years);
  const realRet = Math.max(0, realFv - invested);
  const bars = [
    { label:"Nominal",  val:fv,        color:T.cyan,    pct:100 },
    { label:"Real Val", val:realFv,    color:T.violet,  pct:(realFv/fv)*100 },
    { label:"Invested", val:invested,  color:T.amber,   pct:(invested/fv)*100 },
    { label:"Real Ret", val:realRet,   color:T.emerald, pct:(realRet/fv)*100 },
  ];
  const [hovIdx, setHovIdx] = useState(null);
  const barAreaH = 68;
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:10, color:T.muted, fontWeight:600, marginBottom:4, letterSpacing:0.5 }}>REAL vs NOMINAL</div>
      <svg width="100%" viewBox="0 0 132 96" style={{ display:"block", overflow:"visible" }}>
        {bars.map((bar,i) => {
          const bW=22, gap=10, x=i*(bW+gap)+6, h=(bar.pct/100)*barAreaH, isHov=hovIdx===i;
          return (
            <g key={i} style={{ cursor:"pointer" }} onMouseEnter={()=>setHovIdx(i)} onMouseLeave={()=>setHovIdx(null)}
              onTouchStart={()=>setHovIdx(i)} onTouchEnd={()=>setHovIdx(null)}>
              <rect x={x} y={barAreaH-h} width={bW} height={h} rx={4} fill={bar.color} opacity={isHov?1:0.72}
                style={{ transition:"all 0.7s cubic-bezier(.4,0,.2,1)" }}/>
              <text x={x+bW/2} y={barAreaH+10} textAnchor="middle" fill={T.faint} fontSize={6.5} fontFamily="DM Sans,sans-serif">{bar.label}</text>
              {isHov && <text x={x+bW/2} y={barAreaH-h-4} textAnchor="middle" fill={bar.color} fontSize={7} fontFamily="DM Mono,monospace">{fmt(bar.val)}</text>}
            </g>
          );
        })}
        <text x={66} y={93} textAnchor="middle" fill={T.faint} fontSize={6.5} fontFamily="DM Sans,sans-serif">@ {INF}% inflation assumed</text>
      </svg>
    </div>
  );
}

/* ─── Donut Chart ───────────────────────────────────────────────── */
function DonutChart({ invested, returns, T }) {
  const total = invested + returns;
  const invPct = (invested/total)*100, retPct = (returns/total)*100;
  const R=68, cx=88, cy=88, stroke=22, circ=2*Math.PI*R;
  const invDash=(invested/total)*circ, retDash=(returns/total)*circ;
  const [hov, setHov] = useState(null);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
      <svg width={176} height={176} style={{ flexShrink:0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={T.trackBg} strokeWidth={stroke}/>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={hov==="ret" ? T.trackBg : T.cyan}
          strokeWidth={stroke} strokeDasharray={`${invDash} ${circ-invDash}`} strokeDashoffset={circ/4} strokeLinecap="butt"
          style={{ transition:"all 0.3s", cursor:"pointer" }}
          onMouseEnter={()=>setHov("inv")} onMouseLeave={()=>setHov(null)} onTouchStart={()=>setHov("inv")} onTouchEnd={()=>setHov(null)}/>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={hov==="inv" ? T.trackBg : T.emerald}
          strokeWidth={stroke} strokeDasharray={`${retDash} ${circ-retDash}`} strokeDashoffset={circ/4-invDash} strokeLinecap="butt"
          style={{ transition:"all 0.3s", cursor:"pointer" }}
          onMouseEnter={()=>setHov("ret")} onMouseLeave={()=>setHov(null)} onTouchStart={()=>setHov("ret")} onTouchEnd={()=>setHov(null)}/>
        <text x={cx} y={cy-12} textAnchor="middle" fill={T.primary} fontSize={16} fontWeight={800} fontFamily="DM Mono,monospace">
          {hov==="inv" ? invPct.toFixed(1) : retPct.toFixed(1)}%</text>
        <text x={cx} y={cy+6} textAnchor="middle" fill={T.muted} fontSize={10} fontFamily="DM Sans,sans-serif">
          {hov==="inv" ? "invested" : "returns"}</text>
        <text x={cx} y={cy+22} textAnchor="middle" fill={hov==="inv" ? T.cyan : T.emerald} fontSize={9} fontFamily="DM Mono,monospace">
          {hov==="inv" ? fmt(invested) : fmt(returns)}</text>
      </svg>
      <div style={{ flex:1 }}>
        {[
          { label:"Invested", val:invested, pct:invPct, color:T.cyan },
          { label:"Returns",  val:returns,  pct:retPct, color:T.emerald },
          { label:"Total",    val:total,    pct:100,    color:T.amber },
        ].map(item => (
          <div key={item.label} style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:3, background:item.color }}/>
                <span style={{ fontSize:12, color:T.secondary, fontWeight:500 }}>{item.label}</span>
              </div>
              <span style={{ fontSize:12, fontFamily:"'DM Mono',monospace", color:item.color, fontWeight:700 }}>{item.pct.toFixed(1)}%</span>
            </div>
            <div style={{ background:T.trackBg, borderRadius:4, height:5, overflow:"hidden" }}>
              <div style={{ width:`${item.pct}%`, height:"100%", background:item.color, borderRadius:4, transition:"width 0.7s cubic-bezier(.4,0,.2,1)" }}/>
            </div>
            <div style={{ fontSize:11, color:T.muted, marginTop:3, fontFamily:"'DM Mono',monospace" }}>{fmtFull(item.val)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Area Line Chart ───────────────────────────────────────────── */
function AreaLineChart({ rows, mode, T }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef();
  const yearly = useMemo(() => {
    if (mode==="lumpsum") return rows;
    const map={}; rows.forEach(r=>{ map[r.year]=r; }); return Object.values(map);
  }, [rows, mode]);
  const W=320, H=150, PAD={t:14,r:12,b:30,l:44};
  const chartW=W-PAD.l-PAD.r, chartH=H-PAD.t-PAD.b;
  const maxV=Math.max(...yearly.map(r=>r.balance));
  const getX=i=>PAD.l+(yearly.length===1?chartW/2:(i/(yearly.length-1))*chartW);
  const getY=v=>PAD.t+chartH-(v/maxV)*chartH;
  const balPts=yearly.map((r,i)=>`${getX(i)},${getY(r.balance)}`).join(" ");
  const invPts=yearly.map((r,i)=>`${getX(i)},${getY(mode==="lumpsum"?r.invested:r.totalInvested)}`).join(" ");
  const balArea=`M ${balPts.split(" ").join(" L ")} L ${getX(yearly.length-1)},${PAD.t+chartH} L ${PAD.l},${PAD.t+chartH} Z`;
  const invArea=`M ${invPts.split(" ").join(" L ")} L ${getX(yearly.length-1)},${PAD.t+chartH} L ${PAD.l},${PAD.t+chartH} Z`;
  const yTicks=[0,.25,.5,.75,1].map(f=>({v:f*maxV,y:PAD.t+chartH-f*chartH}));
  const xStep=Math.max(1,Math.floor(yearly.length/7));
  const handleInteract=e=>{
    const rect=svgRef.current.getBoundingClientRect();
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const relX=(clientX-rect.left)*(W/rect.width)-PAD.l;
    const idx=Math.max(0,Math.min(yearly.length-1,Math.round((relX/chartW)*(yearly.length-1))));
    setTooltip({idx,r:yearly[idx]});
  };
  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible",touchAction:"none",display:"block" }}
      onMouseMove={handleInteract} onTouchMove={handleInteract} onMouseLeave={()=>setTooltip(null)} onTouchEnd={()=>setTooltip(null)}>
      <defs>
        <linearGradient id="bGr2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.cyan} stopOpacity="0.35"/><stop offset="100%" stopColor={T.cyan} stopOpacity="0.02"/>
        </linearGradient>
        <linearGradient id="iGr2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.emerald} stopOpacity="0.25"/><stop offset="100%" stopColor={T.emerald} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      {yTicks.map((t,i)=>(
        <g key={i}><line x1={PAD.l} y1={t.y} x2={W-PAD.r} y2={t.y} stroke={T.trackBg} strokeWidth={1}/>
          <text x={PAD.l-4} y={t.y+3} textAnchor="end" fill={T.faint} fontSize={7.5} fontFamily="DM Mono,monospace">{fmt(t.v)}</text></g>
      ))}
      {yearly.map((r,i)=>i%xStep===0&&<text key={i} x={getX(i)} y={H-5} textAnchor="middle" fill={T.faint} fontSize={8} fontFamily="DM Sans,sans-serif">Y{r.year}</text>)}
      <path d={invArea} fill="url(#iGr2)"/><path d={balArea} fill="url(#bGr2)"/>
      <polyline points={invPts} fill="none" stroke={T.emerald} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>
      <polyline points={balPts} fill="none" stroke={T.cyan} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
      {tooltip&&(()=>{
        const x=getX(tooltip.idx),yb=getY(tooltip.r.balance);
        const inv=mode==="lumpsum"?tooltip.r.invested:tooltip.r.totalInvested, yi=getY(inv);
        const boxW=115,boxH=58,bx=x+10+boxW>W?x-boxW-10:x+10;
        return (<g>
          <line x1={x} y1={PAD.t} x2={x} y2={PAD.t+chartH} stroke={T.faint} strokeWidth={1} strokeDasharray="3,3" opacity={0.4}/>
          <circle cx={x} cy={yb} r={4.5} fill={T.cyan} stroke={T.primary} strokeWidth={1.5}/>
          <circle cx={x} cy={yi} r={3.5} fill={T.emerald} stroke={T.primary} strokeWidth={1.5}/>
          <rect x={bx} y={PAD.t} width={boxW} height={boxH} rx={7} fill={T.surfaceAlt} stroke={T.border} strokeWidth={1}/>
          <text x={bx+9} y={PAD.t+15} fill={T.muted} fontSize={9} fontFamily="DM Sans,sans-serif">Year {tooltip.r.year}</text>
          <text x={bx+9} y={PAD.t+29} fill={T.cyan} fontSize={9} fontFamily="DM Mono,monospace">Val: {fmt(tooltip.r.balance)}</text>
          <text x={bx+9} y={PAD.t+43} fill={T.emerald} fontSize={9} fontFamily="DM Mono,monospace">Inv: {fmt(inv)}</text>
        </g>);
      })()}
    </svg>
  );
}

/* ─── Milestone Chart ───────────────────────────────────────────── */
function MilestoneChart({ fv, T }) {
  const milestones = useMemo(()=>{
    const all=[100000,500000,1000000,2500000,5000000,10000000,25000000,50000000,100000000,250000000];
    const visible=all.filter(m=>m<=fv*1.5).slice(-7);
    if(!visible.length||visible[visible.length-1]<fv){ const next=all.find(m=>m>fv); if(next&&!visible.includes(next))visible.push(next); }
    return visible;
  },[fv]);
  return (
    <div>
      {milestones.map((m,i)=>{
        const reached=fv>=m, pct=Math.min(100,(fv/m)*100);
        return (
          <div key={i} style={{ marginBottom:12, opacity:reached?1:0.45 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:13 }}>{reached?"✅":"🎯"}</span>
                <span style={{ fontSize:12, color:reached?T.primary:T.muted, fontFamily:"'DM Mono',monospace", fontWeight:reached?600:400 }}>{fmt(m)}</span>
              </div>
              {reached
                ? <span style={{ fontSize:10, color:T.emerald, fontWeight:700, background:`${T.emerald}18`, border:`1px solid ${T.emerald}44`, borderRadius:4, padding:"2px 7px" }}>REACHED</span>
                : <span style={{ fontSize:10, color:T.faint }}>{pct.toFixed(0)}% done</span>}
            </div>
            <div style={{ background:T.trackBg, borderRadius:5, height:6, overflow:"hidden" }}>
              <div style={{ width:`${reached?100:pct}%`, height:"100%", borderRadius:5, transition:"width 0.9s cubic-bezier(.4,0,.2,1)",
                background:reached?`linear-gradient(to right,${T.emerald},${T.cyan})`:`linear-gradient(to right,${T.cyan}88,${T.cyan}33)` }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Return Rate Gauge ─────────────────────────────────────────── */
function ReturnGauge({ rate, T }) {
  const color = rate<8 ? T.amber : rate<15 ? T.cyan : T.emerald;
  const label = rate<8 ? "Conservative" : rate<15 ? "Moderate" : "Aggressive";
  const segs=[{start:0,end:8},{start:8,end:15},{start:15,end:30}];
  const segColors=[T.amber,T.cyan,T.emerald];
  return (
    <div style={{ marginBottom:4 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
        <span style={{ fontSize:12, color:T.muted, fontWeight:500 }}>Return Rate</span>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <span style={{ fontSize:10, color, background:`${color}15`, border:`1px solid ${color}44`, borderRadius:5, padding:"2px 8px", fontWeight:700 }}>{label}</span>
          <span style={{ fontSize:14, fontWeight:800, color, fontFamily:"'DM Mono',monospace" }}>{rate}% p.a.</span>
        </div>
      </div>
      <div style={{ display:"flex", gap:3, height:5, borderRadius:6, overflow:"hidden" }}>
        {segs.map((s,i)=>{
          const segLen=s.end-s.start, filled=Math.max(0,Math.min(rate-s.start,segLen));
          return <div key={i} style={{ flex:segLen, background:T.trackBg, borderRadius:3, overflow:"hidden" }}>
            <div style={{ width:`${(filled/segLen)*100}%`, height:"100%", background:segColors[i], transition:"width 0.5s ease" }}/>
          </div>;
        })}
      </div>
      <div style={{ display:"flex", marginTop:3 }}>
        <span style={{ flex:8, fontSize:9, color:T.faint }}>1–8%</span>
        <span style={{ flex:7, fontSize:9, color:T.faint }}>8–15%</span>
        <span style={{ flex:15, fontSize:9, color:T.faint, textAlign:"right" }}>15–30%</span>
      </div>
    </div>
  );
}

/* ─── Wealth Badge ──────────────────────────────────────────────── */
function WealthBadge({ invested, fv, T }) {
  const mult = fv/invested;
  const emoji = mult<2?"🌱":mult<5?"🌿":mult<10?"🌳":mult<20?"🚀":mult<50?"💎":"👑";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, width:"100%" }}>
      <div style={{ fontSize:36, lineHeight:1 }}>{emoji}</div>
      <div style={{ flex:1 }}>
        <div style={{ color:T.muted, fontSize:11, fontWeight:500 }}>Wealth Multiplier</div>
        <div style={{ fontSize:26, fontWeight:900, fontFamily:"'DM Mono',monospace", color:T.amber, lineHeight:1.1 }}>{mult.toFixed(1)}x</div>
        <div style={{ fontSize:11, color:T.faint, marginTop:2 }}>grows {mult.toFixed(1)} times</div>
      </div>
      <div style={{ textAlign:"right" }}>
        <div style={{ color:T.muted, fontSize:10, marginBottom:3, fontWeight:500 }}>TOTAL GAIN</div>
        <div style={{ fontSize:18, fontWeight:800, color:T.emerald, fontFamily:"'DM Mono',monospace" }}>{((mult-1)*100).toFixed(0)}%</div>
      </div>
    </div>
  );
}

/* ─── Month Table ───────────────────────────────────────────────── */
function MonthTable({ rows, mode, T }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? rows : rows.slice(0, 24);
  const tdS = { padding:"7px 8px", color:T.secondary, textAlign:"right", borderBottom:`1px solid ${T.border}`, fontSize:11, fontFamily:"'DM Mono',monospace" };
  const headers = mode==="lumpsum"
    ? ["Year","Invested","Balance","Returns","Gain%"]
    : ["Mo","Yr","Monthly","Total Inv","Balance","Returns","Gain%"];
  return (
    <div>
      <div style={{ overflowX:"auto", borderRadius:10, border:`1px solid ${T.border}` }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:mode==="lumpsum"?280:420 }}>
          <thead>
            <tr style={{ background:T.surfaceAlt }}>
              {headers.map(h=><th key={h} style={{ ...tdS,color:T.cyan,fontWeight:700,borderBottom:`1px solid ${T.border}`,padding:"10px 8px",whiteSpace:"nowrap",fontSize:12 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {displayed.map((r,i)=>(
              <tr key={i} style={{ background:i%2===0?T.surface:T.surfaceAlt }}>
                {mode==="lumpsum"?<>
                  <td style={{ ...tdS,color:T.muted }}>{r.year}</td>
                  <td style={tdS}>{fmt(r.invested)}</td>
                  <td style={{ ...tdS,color:T.cyan,fontWeight:600 }}>{fmt(r.balance)}</td>
                  <td style={{ ...tdS,color:T.emerald,fontWeight:600 }}>{fmt(r.returns)}</td>
                  <td style={{ ...tdS,color:T.amber,fontWeight:600 }}>{((r.returns/r.invested)*100).toFixed(1)}%</td>
                </>:<>
                  <td style={{ ...tdS,color:T.muted }}>{r.month}</td>
                  <td style={{ ...tdS,color:T.muted }}>{r.year}</td>
                  <td style={tdS}>{fmt(r.monthlyInvested)}</td>
                  <td style={tdS}>{fmt(r.totalInvested)}</td>
                  <td style={{ ...tdS,color:T.cyan,fontWeight:600 }}>{fmt(r.balance)}</td>
                  <td style={{ ...tdS,color:T.emerald,fontWeight:600 }}>{fmt(r.returns)}</td>
                  <td style={{ ...tdS,color:T.amber,fontWeight:600 }}>{((r.returns/r.totalInvested)*100).toFixed(1)}%</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length>24&&<button onClick={()=>setShowAll(!showAll)}
        style={{ width:"100%",marginTop:8,padding:"9px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.cyan,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600 }}>
        {showAll?`Show Less ▲`:`Show All ${rows.length} ${mode==="lumpsum"?"Years":"Months"} ▼`}
      </button>}
    </div>
  );
}

/* ─── Excel Export ──────────────────────────────────────────────── */
function downloadExcel(result, mode, params) {
  const wb = XLSX.utils.book_new();
  const sum=[
    ["1Rupee.Blog — Investment Report"],["Mode",mode.toUpperCase()],["Generated",new Date().toLocaleDateString("en-IN")],[],
    ["SUMMARY"],["Total Invested",result.invested],["Est. Returns",result.returns],["Future Value",result.fv],
    ["Wealth Multiplier",(result.fv/result.invested).toFixed(2)+"x"],["Total Gain %",((result.returns/result.invested)*100).toFixed(2)+"%"],[],
    ["PARAMETERS"],...Object.entries(params).map(([k,v])=>[k,v]),
  ];
  const ws1=XLSX.utils.aoa_to_sheet(sum); ws1["!cols"]=[{wch:24},{wch:20}];
  XLSX.utils.book_append_sheet(wb,ws1,"Summary");
  const detail=mode==="lumpsum"
    ?[["Year","Invested (₹)","Balance (₹)","Returns (₹)","Return %"],...result.rows.map(r=>[r.year,Math.round(r.invested),Math.round(r.balance),Math.round(r.returns),((r.returns/r.invested)*100).toFixed(2)+"%"])]
    :[["Month","Year","Monthly (₹)","Total Invested (₹)","Balance (₹)","Returns (₹)","Return %"],...result.rows.map(r=>[r.month,r.year,Math.round(r.monthlyInvested),Math.round(r.totalInvested),Math.round(r.balance),Math.round(r.returns),((r.returns/r.totalInvested)*100).toFixed(2)+"%"])];
  const ws2=XLSX.utils.aoa_to_sheet(detail); ws2["!cols"]=detail[0].map(()=>({wch:20}));
  XLSX.utils.book_append_sheet(wb,ws2,"Detail");
  XLSX.writeFile(wb,`1rupee-blog-${mode}.xlsx`);
}

/* ─── Card & Section Header ─────────────────────────────────────── */
function Card({ children, T }) {
  return <div className="rgb-card"><div className="rgb-card-inner" style={{ background:T.cardBg }}>{children}</div></div>;
}
function SH({ icon, title, T }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
      <span style={{ fontSize:15 }}>{icon}</span>
      <span style={{ fontSize:14, fontWeight:700, color:T.primary, letterSpacing:0.2 }}>{title}</span>
    </div>
  );
}

/* ─── Theme Toggle Button ───────────────────────────────────────── */
function ThemeToggle({ dark, onToggle, T }) {
  return (
    <button onClick={onToggle} style={{
      display:"flex", alignItems:"center", gap:6,
      background:T.inputBg, border:`1px solid ${T.border}`,
      borderRadius:20, padding:"5px 12px", cursor:"pointer",
      fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:600,
      color:T.secondary, transition:"all 0.2s",
    }}>
      <span style={{ fontSize:14 }}>{dark?"☀️":"🌙"}</span>
      {dark?"Light":"Dark"}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   APP
   ═══════════════════════════════════════════════════════════════════ */
export default function App() {
  const [dark, setDark] = useState(true);
  const T = dark ? DARK : LIGHT;

  const [tab, setTab] = useState("sip");
  const [showTable, setShowTable] = useState(false);

  /* SIP */
  const [sipAmount, setSipAmount] = useState(10000);
  const [sipRate,   setSipRate]   = useState(12);
  const [sipYears,  setSipYears]  = useState(20);
  /* Step-up */
  const [stAmount,  setStAmount]  = useState(10000);
  const [stRate,    setStRate]    = useState(12);
  const [stYears,   setStYears]   = useState(20);
  const [stStepup,  setStStepup]  = useState(10);
  /* Lumpsum */
  const [lsAmount,  setLsAmount]  = useState(500000);
  const [lsRate,    setLsRate]    = useState(12);
  const [lsYears,   setLsYears]   = useState(15);

  const result = useMemo(() => {
    if (tab==="sip")    return calcSIP(sipAmount, sipRate, sipYears);
    if (tab==="stepup") return calcStepUp(stAmount, stRate, stYears, stStepup);
    return calcLumpsum(lsAmount, lsRate, lsYears);
  }, [tab,sipAmount,sipRate,sipYears,stAmount,stRate,stYears,stStepup,lsAmount,lsRate,lsYears]);

  const excelParams = useMemo(()=>{
    if(tab==="sip")    return {"Monthly SIP":`₹${sipAmount.toLocaleString("en-IN")}`,"Annual Return":`${sipRate}%`,"Duration":`${sipYears} yrs`};
    if(tab==="stepup") return {"Initial SIP":`₹${stAmount.toLocaleString("en-IN")}`,"Annual Return":`${stRate}%`,"Duration":`${stYears} yrs`,"Step-up":`${stStepup}%`};
    return {"Lumpsum":`₹${lsAmount.toLocaleString("en-IN")}`,"Annual Return":`${lsRate}%`,"Duration":`${lsYears} yrs`};
  },[tab,sipAmount,sipRate,sipYears,stAmount,stRate,stYears,stStepup,lsAmount,lsRate,lsYears]);

  const currentRate  = tab==="sip"?sipRate:tab==="stepup"?stRate:lsRate;
  const currentYears = tab==="sip"?sipYears:tab==="stepup"?stYears:lsYears;
  const tabs = [{id:"sip",label:"SIP",icon:"📈"},{id:"stepup",label:"Step-up",icon:"🚀"},{id:"lumpsum",label:"Lumpsum",icon:"💰"}];

  /* RGB border CSS — thinner (1px) + more elegant */
  const rgbCSS = `
    @property --angle { syntax:'<angle>'; initial-value:0deg; inherits:false; }
    @keyframes spin-border { to { --angle:360deg; } }
    .rgb-card {
      position:relative; border-radius:16px; padding:1px;
      background:conic-gradient(from var(--angle),#ff0040,#ff6600,#ffe500,#00ff88,#0088ff,#8800ff,#ff0040);
      animation:spin-border 4s linear infinite;
    }
    .rgb-card::before {
      content:''; position:absolute; inset:0; border-radius:16px;
      background:conic-gradient(from var(--angle),#ff0040,#ff6600,#ffe500,#00ff88,#0088ff,#8800ff,#ff0040);
      filter:blur(5px); opacity:0.35; animation:spin-border 4s linear infinite; z-index:-1;
    }
    .rgb-card-inner { border-radius:15px; padding:16px; position:relative; z-index:1; }
    .mini-chart-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .mini-chart-cell { border-radius:12px; padding:10px 8px; }
  `;

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"'DM Sans',sans-serif", color:T.primary, display:"flex", justifyContent:"center", transition:"background 0.3s, color 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=DM+Mono:wght@400;500;600&display=swap');
        * { box-sizing:border-box; margin:0; }
        input[type=range]{ -webkit-appearance:none; appearance:none; display:block; }
        input[type=range]::-webkit-slider-thumb{ -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:#fff; border:2.5px solid ${T.cyan}; box-shadow:0 0 6px ${T.cyan}88; cursor:pointer; }
        input[type=range]::-moz-range-thumb{ width:18px; height:18px; border-radius:50%; background:#fff; border:2.5px solid ${T.cyan}; cursor:pointer; }
        ::-webkit-scrollbar{ width:4px; height:4px; }
        ::-webkit-scrollbar-track{ background:${T.surface}; }
        ::-webkit-scrollbar-thumb{ background:${T.border}; border-radius:99px; }
        @keyframes pulse{ 0%,100%{opacity:1} 50%{opacity:.35} }
        ${rgbCSS}
      `}</style>

      <div style={{ width:"100%", maxWidth:480, minHeight:"100vh", paddingBottom:50, background:T.bg, transition:"background 0.3s" }}>

        {/* ── Header ── */}
        <div style={{ padding:"20px 16px 0", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:11, background:`linear-gradient(135deg,${T.cyan},#0055bb)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:900, color:"#fff" }}>1₹</div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, letterSpacing:-0.3, color:T.primary }}>1Rupee.Blog</div>
            <div style={{ fontSize:9, color:T.faint, letterSpacing:1.8, fontWeight:600 }}>SMART INVESTMENT CALCULATOR</div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
            <ThemeToggle dark={dark} onToggle={()=>setDark(!dark)} T={T} />
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <div style={{ width:6, height:6, borderRadius:99, background:T.emerald, boxShadow:`0 0 5px ${T.emerald}`, animation:"pulse 2s infinite" }}/>
              <span style={{ fontSize:10, color:T.emerald, fontWeight:700 }}>LIVE</span>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display:"flex", margin:"14px 16px 0", background:dark?"#080F1C":"#E6F7F1", borderRadius:13, padding:4, gap:3 }}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>{ setTab(t.id); setShowTable(false); }} style={{
              flex:1, padding:"9px 2px", borderRadius:10, border:"none", cursor:"pointer",
              background:tab===t.id?`linear-gradient(135deg,${T.cyan}22,${T.cyan}11)`:"transparent",
              color:tab===t.id?T.cyan:T.faint,
              fontWeight:tab===t.id?700:500, fontSize:12,
              borderBottom:tab===t.id?`2px solid ${T.cyan}`:"2px solid transparent",
              fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s",
              display:"flex", alignItems:"center", justifyContent:"center", gap:4,
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Input Card ── */}
        <div style={{ margin:"14px 16px 0" }}>
          <div className="rgb-card">
            <div className="rgb-card-inner" style={{ background:T.cardBg, padding:"18px 16px" }}>
              <div style={{ marginBottom:18 }}><ReturnGauge rate={currentRate} T={T}/></div>

              {tab==="sip" && <>
                <AmountInput label="Monthly investment" value={sipAmount} setValue={setSipAmount}
                  min={500} max={1000000} step={500} prefix="₹" T={T} allowManual />
                <AmountInput label="Expected annual return" value={sipRate} setValue={setSipRate}
                  min={1} max={30} step={0.5} suffix="%" T={T} />
                <AmountInput label="Time period" value={sipYears} setValue={setSipYears}
                  min={1} max={40} step={1} suffix=" Yr" T={T} />
              </>}

              {tab==="stepup" && <>
                <AmountInput label="Initial monthly SIP" value={stAmount} setValue={setStAmount}
                  min={500} max={1000000} step={500} prefix="₹" T={T} allowManual />
                <AmountInput label="Expected annual return" value={stRate} setValue={setStRate}
                  min={1} max={30} step={0.5} suffix="%" T={T} />
                <AmountInput label="Time period" value={stYears} setValue={setStYears}
                  min={1} max={40} step={1} suffix=" Yr" T={T} />
                <AmountInput label="Annual step-up %" value={stStepup} setValue={setStStepup}
                  min={1} max={50} step={1} suffix="%" T={T} />
              </>}

              {tab==="lumpsum" && <>
                <AmountInput label="Lumpsum amount" value={lsAmount} setValue={setLsAmount}
                  min={10000} max={10000000} step={10000} prefix="₹" T={T} allowManual />
                <AmountInput label="Expected annual return" value={lsRate} setValue={setLsRate}
                  min={1} max={30} step={0.5} suffix="%" T={T} />
                <AmountInput label="Time period" value={lsYears} setValue={setLsYears}
                  min={1} max={40} step={1} suffix=" Yr" T={T} />
              </>}
            </div>
          </div>
        </div>

        {/* ── Results Card (Groww-style: 3 rows) ── */}
        <div style={{ margin:"12px 16px 0" }}>
          <div className="rgb-card">
            <div className="rgb-card-inner" style={{ background:T.resultBg, padding:"20px 18px" }}>
              {/* 3-row Groww layout */}
              {[
                { label:"Invested amount", val:result.invested, color:T.primary },
                { label:"Est. returns",    val:result.returns,  color:T.emerald },
                { label:"Total value",     val:result.fv,       color:T.cyan, big:true },
              ].map((item,i)=>(
                <div key={i} style={{
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"12px 0",
                  borderBottom: i<2 ? `1px solid ${dark?"#ffffff12":"#00000010"}` : "none",
                }}>
                  <span style={{ fontSize:13, color:T.muted, fontWeight:500 }}>{item.label}</span>
                  <span style={{
                    fontSize: item.big ? 22 : 17,
                    fontWeight: item.big ? 900 : 700,
                    fontFamily:"'DM Mono',monospace",
                    color: item.color,
                    letterSpacing: item.big ? -0.5 : 0,
                  }}>
                    {fmtFull(item.val)}
                  </span>
                </div>
              ))}
              {/* gain pill */}
              <div style={{ display:"flex", justifyContent:"flex-end", marginTop:10 }}>
                <div style={{ background:`${T.emerald}20`, border:`1px solid ${T.emerald}55`, borderRadius:20, padding:"4px 14px", display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:T.emerald }}>▲</span>
                  <span style={{ fontSize:12, fontWeight:700, color:T.emerald, fontFamily:"'DM Mono',monospace" }}>
                    {((result.returns/result.invested)*100).toFixed(1)}% gain
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Wealth Badge ── */}
        <div style={{ margin:"12px 16px 0" }}>
          <div className="rgb-card">
            <div className="rgb-card-inner" style={{ background:T.cardBg, padding:"16px" }}>
              <WealthBadge invested={result.invested} fv={result.fv} T={T}/>
            </div>
          </div>
        </div>

        {/* ── 4 Mini Charts (2×2) ── */}
        <div style={{ margin:"12px 16px 0" }}>
          <Card T={T}>
            <SH icon="📊" title="Visual Analytics" T={T}/>
            <div className="mini-chart-grid">
              <div className="mini-chart-cell" style={{ background:T.surfaceAlt, border:`1px solid ${T.border}` }}>
                <SpeedometerChart invested={result.invested} fv={result.fv} years={currentYears} T={T}/>
              </div>
              <div className="mini-chart-cell" style={{ background:T.surfaceAlt, border:`1px solid ${T.border}` }}>
                <StackedBarChart rows={result.rows} mode={tab} T={T}/>
              </div>
              <div className="mini-chart-cell" style={{ background:T.surfaceAlt, border:`1px solid ${T.border}` }}>
                <RadialProgressChart invested={result.invested} fv={result.fv} returns={result.returns} T={T}/>
              </div>
              <div className="mini-chart-cell" style={{ background:T.surfaceAlt, border:`1px solid ${T.border}` }}>
                <InflationChart fv={result.fv} invested={result.invested} years={currentYears} T={T}/>
              </div>
            </div>
            <div style={{ marginTop:10, fontSize:10, color:T.faint, textAlign:"center" }}>Tap / hover for details</div>
          </Card>
        </div>

        {/* ── Donut ── */}
        <div style={{ margin:"12px 16px 0" }}>
          <Card T={T}>
            <SH icon="🥧" title="Portfolio Breakdown" T={T}/>
            <DonutChart invested={result.invested} returns={result.returns} T={T}/>
            <div style={{ marginTop:12, padding:"9px 12px", background:T.surfaceAlt, borderRadius:10, fontSize:11, color:T.faint, textAlign:"center" }}>
              👆 Tap segments to highlight
            </div>
          </Card>
        </div>

        {/* ── Area Line Chart ── */}
        <div style={{ margin:"12px 16px 0" }}>
          <Card T={T}>
            <SH icon="📈" title="Growth Over Time" T={T}/>
            <div style={{ display:"flex", gap:14, marginBottom:10 }}>
              {[{color:T.cyan,label:"Portfolio Value"},{color:T.emerald,label:"Amount Invested"}].map(l=>(
                <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <div style={{ width:12, height:3, borderRadius:2, background:l.color }}/>
                  <span style={{ fontSize:11, color:T.muted, fontWeight:500 }}>{l.label}</span>
                </div>
              ))}
            </div>
            <AreaLineChart rows={result.rows} mode={tab} T={T}/>
            <div style={{ marginTop:8, fontSize:10, color:T.faint, textAlign:"center" }}>Slide / hover to see year-wise values</div>
          </Card>
        </div>

        {/* ── Milestones ── */}
        <div style={{ margin:"12px 16px 0" }}>
          <Card T={T}><SH icon="🏆" title="Wealth Milestones" T={T}/><MilestoneChart fv={result.fv} T={T}/></Card>
        </div>

        {/* ── Month Table ── */}
        <div style={{ margin:"12px 16px 0" }}>
          <Card T={T}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:showTable?14:0 }}>
              <SH icon="📋" title={`${tab==="lumpsum"?"Year":"Month"}-wise Breakdown`} T={T}/>
              <button onClick={()=>setShowTable(!showTable)}
                style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:8, color:T.cyan, fontSize:12, padding:"5px 12px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600, marginBottom:14 }}>
                {showTable?"Hide ▲":"View ▼"}
              </button>
            </div>
            {showTable && <MonthTable rows={result.rows} mode={tab} T={T}/>}
          </Card>
        </div>

        {/* ── Download ── */}
        <div style={{ margin:"12px 16px 0" }}>
          <div className="rgb-card">
            <div className="rgb-card-inner" style={{ background:T.cardBg, padding:"4px" }}>
              <button onClick={()=>downloadExcel(result,tab,excelParams)} style={{
                width:"100%", padding:"13px", background:"transparent", border:"none", borderRadius:12,
                color:T.cyan, fontSize:15, fontWeight:700, cursor:"pointer",
                fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:10,
              }}>
                ⬇️ Download Excel Report
              </button>
            </div>
          </div>
          <p style={{ textAlign:"center", color:T.faint, fontSize:11, marginTop:8 }}>
            Summary + full {tab==="lumpsum"?"year":"month"}-wise detail with gain %
          </p>
        </div>

        <div style={{ textAlign:"center", marginTop:32, color:T.faint, fontSize:11, paddingBottom:14, opacity:0.5 }}>
          1Rupee.Blog · Estimates only · Not financial advice
        </div>

      </div>
    </div>
  );
}
