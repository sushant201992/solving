import { useState } from "react";

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
};

export default function BlogArticle({ onBack, dark = true }) {
  const T = dark ? DARK : LIGHT;

  const article = {
    title: "5 Signs You Need to Make the Switch",
    subtitle: "Are You Feeling Them Now?",
    date: "May 16, 2026",
    tag: "Career Growth",
    thumbnail: "/Gemini_Generated_Image_hdxh8ahdxh8ahdxh.png",
    sections: [
      {
        number: 1,
        title: "SLEEPLESS ON SUNDAY",
        content: "Every Sunday, without fail, you are filled with dread. At night, it is not a tough project keeping you awake, but the mere need to get to office on Monday. Your nervous system is saying something that your resume is not. Remember that discomfort is normal. But chronic dread is a diagnosis."
      },
      {
        number: 2,
        title: "DRAIN THE BRAIN",
        content: "Good careers have intense days and tired days, but you get a sense of satisfaction, learning or energy. Wrong careers drain you without leaving anything. Your days are emotionally heavy even without drama. That distinction between tired versus depleted is the signal to take seriously."
      },
      {
        number: 3,
        title: "HEAVY ON ENVY",
        content: "Face your envy. It is one of the best signals available. Do you repeatedly admire people in very different roles and lifestyles, not their salary but what they are doing and how? Your envy is talking about an unlived preference. Your mental wiring is pointing you to a more honest direction from your current job title."
      },
      {
        number: 4,
        title: "BEST SELF CHECKED OUT",
        content: "You are a cheerleader at home, energiser bunny in side projects, and the glue amongst friends. At work, you are a shadow of your real self. When this gap between your best self and who turns up at work is a chasm, it is not you but your career."
      },
      {
        number: 5,
        title: "ZOMBIE FUTURE",
        content: "You got a great appraisal and everyone is cheering. Yet, each win feels flat to you. When you imagine doing more of this work over the next five years, you feel suffocated. You are simply executing on autopilot but you feel no meaning and stopped learning a long time ago. Competence without growth is slow career erosion."
      }
    ]
  };

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
  `;

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"'DM Sans',sans-serif", color:T.primary, display:"flex", justifyContent:"center", transition:"background 0.3s, color 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=DM+Mono:wght@400;500;600&display=swap');
        * { box-sizing:border-box; margin:0; }
        ::-webkit-scrollbar{ width:4px; height:4px; }
        ::-webkit-scrollbar-track{ background:${T.surface}; }
        ::-webkit-scrollbar-thumb{ background:${T.border}; border-radius:99px; }
        ${rgbCSS}
      `}</style>

      <div style={{ width:"100%", maxWidth:480, minHeight:"100vh", paddingBottom:50, background:T.bg, transition:"background 0.3s" }}>

        {/* Header with Back Button */}
        <div style={{ padding:"16px 16px", display:"flex", alignItems:"center", gap:12, borderBottom:`1px solid ${T.border}`, position:"sticky", top:0, background:T.bg, zIndex:100 }}>
          <button
            onClick={onBack}
            style={{
              background:"transparent",
              border:"none",
              fontSize:20,
              cursor:"pointer",
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              width:36,
              height:36,
              borderRadius:8,
              color:T.cyan,
              transition:"all 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = `${T.cyan}15`}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            ←
          </button>
          <span style={{ fontSize:14, fontWeight:700, color:T.primary }}>Back</span>
        </div>

        {/* Article Container */}
        <div style={{ padding:"16px" }}>

          {/* Thumbnail */}
          <div style={{ borderRadius:14, overflow:"hidden", marginBottom:20, height:280, background:`${T.cyan}08` }}>
            <img
              src={article.thumbnail}
              alt={article.title}
              style={{ width:"100%", height:"100%", objectFit:"cover" }}
            />
          </div>

          {/* Title Section */}
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <span style={{
                fontSize:10,
                color:T.cyan,
                background:`${T.cyan}15`,
                padding:"4px 10px",
                borderRadius:12,
                fontWeight:700,
                letterSpacing:0.3
              }}>
                {article.tag}
              </span>
            </div>
            <h1 style={{
              fontSize:28,
              fontWeight:900,
              color:T.primary,
              marginBottom:8,
              lineHeight:1.2
            }}>
              {article.title}
            </h1>
            <h2 style={{
              fontSize:16,
              fontWeight:600,
              color:T.cyan,
              marginBottom:12
            }}>
              {article.subtitle}
            </h2>
            <div style={{ fontSize:12, color:T.faint, display:"flex", alignItems:"center", gap:6 }}>
              <span>📅</span>
              <span>{article.date}</span>
            </div>
          </div>

          {/* Article Sections */}
          <div className="rgb-card" style={{ marginBottom:20 }}>
            <div className="rgb-card-inner" style={{ background:T.cardBg }}>
              <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
                {article.sections.map((section, idx) => (
                  <div key={idx}>
                    <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:12 }}>
                      <div style={{
                        width:40,
                        height:40,
                        borderRadius:10,
                        background:`linear-gradient(135deg,${T.cyan},${T.emerald})`,
                        display:"flex",
                        alignItems:"center",
                        justifyContent:"center",
                        color:"#fff",
                        fontWeight:900,
                        fontSize:18,
                        flexShrink:0
                      }}>
                        {section.number}
                      </div>
                      <h3 style={{
                        fontSize:16,
                        fontWeight:800,
                        color:T.primary,
                        letterSpacing:0.5
                      }}>
                        {section.title}
                      </h3>
                    </div>
                    <p style={{
                      fontSize:14,
                      color:T.secondary,
                      lineHeight:1.7,
                      marginLeft:52
                    }}>
                      {section.content}
                    </p>
                    {idx < article.sections.length - 1 && (
                      <div style={{ height:1, background:T.border, marginTop:24 }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="rgb-card">
            <div className="rgb-card-inner" style={{ background:T.cardBg, textAlign:"center", padding:"24px 16px" }}>
              <p style={{ fontSize:14, color:T.secondary, marginBottom:16, lineHeight:1.6 }}>
                If you're experiencing these signs, it might be time to explore new career opportunities. Trust your instincts and take action towards a more fulfilling path.
              </p>
              <button
                onClick={onBack}
                style={{
                  width:"100%",
                  padding:"12px",
                  background:`linear-gradient(135deg,${T.cyan},${T.emerald})`,
                  border:"none",
                  borderRadius:10,
                  color:"#fff",
                  fontSize:14,
                  fontWeight:700,
                  cursor:"pointer",
                  transition:"all 0.2s",
                  fontFamily:"'DM Sans',sans-serif"
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
              >
                Back to Calculator
              </button>
            </div>
          </div>
        </div>

        <div style={{ textAlign:"center", marginTop:32, color:T.faint, fontSize:11, paddingBottom:14, opacity:0.5 }}>
          1Rupee.Blog · Career Insights · May 2026
        </div>
      </div>
    </div>
  );
}
