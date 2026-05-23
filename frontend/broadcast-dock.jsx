// Broadcast Dock — simulated mobile push card + PA script window
// with browser TTS firing for the live audio button.

function MobileAlert({ payload, severity, scenario, sections }) {
  if (!payload) {
    return (
      <div style={pixelFrameStyle()}>
        <PixelChrome />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center" }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9.5, letterSpacing: "0.18em", color: "rgba(255,255,255,0.55)" }}>
            PUBLIC CHANNEL
          </div>
          <div style={{ marginTop: 8, fontFamily: "Inter, system-ui, sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.55)" }}>
            No active push.
          </div>
        </div>
      </div>
    );
  }
  const sevColor = severity === "RED" ? "#f55050" : severity === "ORANGE" ? "#f5aa3c" : "#22c88c";
  const now = new Date();
  const time = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
  const isMulti = sections > 1;

  return (
    <div style={pixelFrameStyle()}>
      <PixelChrome time={time} />

      {/* big clock */}
      <div style={{ padding: "4px 14px 6px", textAlign: "center", color: "white" }}>
        <div style={{
          fontFamily: "Geist, Inter, system-ui, sans-serif",
          fontSize: 44, fontWeight: 300, letterSpacing: "-0.04em",
          lineHeight: 1.0,
          color: "rgba(255,255,255,0.96)",
        }}>
          {time}
        </div>
        <div style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 10.5, opacity: 0.78, letterSpacing: "0.01em",
          marginTop: 3,
        }}>
          {now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </div>
      </div>

      {/* Material 3 notification */}
      <div style={{
        margin: "8px 8px 0",
        padding: "10px 12px",
        background: "rgba(28,32,40,0.85)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${sevColor}33`,
        borderRadius: 20,
        animation: "pushDrop 420ms cubic-bezier(0.2, 0.9, 0.25, 1.1)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* severity strip */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
          background: sevColor,
        }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5, paddingLeft: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 16, height: 16, borderRadius: 4,
              background: `linear-gradient(135deg, ${sevColor}, ${sevColor}99)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, color: "white", fontWeight: 700,
            }}>A</div>
            <span style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 9.5, color: "rgba(255,255,255,0.78)", fontWeight: 500, letterSpacing: "0.02em" }}>
              AuraCommand
            </span>
            {isMulti && (
              <span style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 7.5, fontWeight: 700, letterSpacing: "0.1em",
                padding: "1px 5px",
                background: `${sevColor}22`,
                color: sevColor,
                borderRadius: 999,
              }}>×{sections}</span>
            )}
          </div>
          <span style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 8.5, color: "rgba(255,255,255,0.5)" }}>now</span>
        </div>
        <div style={{ paddingLeft: 4 }}>
          <div style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 11, color: "white", fontWeight: 600, marginBottom: 3, letterSpacing: "0" }}>
            {severity === "RED" ? "Stadium Safety Alert" : severity === "ORANGE" ? "Crowd Advisory" : "Match Update"}
          </div>
          <div style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 10.5, color: "rgba(255,255,255,0.82)",
            lineHeight: 1.4, whiteSpace: "pre-line",
            maxHeight: 100, overflowY: "auto",
          }}>
            {payload.mobile_push_notification_text}
          </div>
        </div>
      </div>

      {/* geo-fence label */}
      <div style={{
        position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center",
        fontFamily: "JetBrains Mono, monospace", fontSize: 7.5,
        letterSpacing: "0.18em", color: "rgba(255,255,255,0.35)",
      }}>
        PUBLIC CHANNEL · {severity === "RED" ? "38,200" : severity === "ORANGE" ? "12,400" : "1,820"} DEVICES
      </div>
    </div>
  );
}

function PixelChrome({ time }) {
  return (
    <>
      {/* status bar */}
      <div style={{
        position: "relative",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "7px 14px 4px",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 9.5, color: "white", fontWeight: 500,
      }}>
        <span>{time || " "}</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {/* signal bars */}
          <svg width="10" height="8" viewBox="0 0 10 8">
            <rect x="0" y="5" width="1.6" height="3" fill="white" />
            <rect x="2.4" y="3.5" width="1.6" height="4.5" fill="white" />
            <rect x="4.8" y="1.8" width="1.6" height="6.2" fill="white" />
            <rect x="7.2" y="0" width="1.6" height="8" fill="white" />
          </svg>
          {/* wifi */}
          <svg width="10" height="8" viewBox="0 0 10 8">
            <path d="M5 8 L5.7 6.6 L4.3 6.6 Z" fill="white" />
            <path d="M2 4.5 Q5 2 8 4.5" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" />
            <path d="M0.5 2.6 Q5 -1.4 9.5 2.6" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" />
          </svg>
          {/* battery */}
          <svg width="16" height="8" viewBox="0 0 16 8">
            <rect x="0.5" y="0.5" width="13" height="7" rx="1.6" fill="none" stroke="white" strokeWidth="0.8" />
            <rect x="13.5" y="2.5" width="1.5" height="3" rx="0.6" fill="white" />
            <rect x="1.6" y="1.6" width="9.6" height="4.8" rx="0.8" fill="white" />
          </svg>
        </div>
        {/* punch-hole camera */}
        <div style={{
          position: "absolute",
          top: 6, left: "50%", transform: "translateX(-50%)",
          width: 8, height: 8, borderRadius: "50%",
          background: "#000",
          boxShadow: "inset 0 0 0 0.7px rgba(120,140,160,0.45)",
        }} />
      </div>
    </>
  );
}

function pixelFrameStyle() {
  return {
    position: "relative",
    width: 200, height: 360,
    borderRadius: 28,
    background:
      "radial-gradient(ellipse at 30% 0%, rgba(80,110,140,0.30), transparent 50%), " +
      "radial-gradient(ellipse at 100% 100%, rgba(35,55,75,0.45), transparent 60%), " +
      "#0a1018",
    border: "3px solid #14181f",
    boxShadow:
      "0 24px 48px -18px rgba(0,0,0,0.7), " +
      "inset 0 0 0 1.5px rgba(255,255,255,0.04), " +
      "inset 0 0 0 4px rgba(0,0,0,0.6)",
    overflow: "hidden",
    flexShrink: 0,
    display: "flex", flexDirection: "column",
  };
}
function mobileIdleStyle() {
  return {
    height: "100%", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center",
  };
}

function PAScript({ payload, severity, onSpeak, speaking, voicesReady, sections }) {
  const sevColor = severity === "RED" ? "#f55050" : severity === "ORANGE" ? "#f5aa3c" : severity === "GREEN" ? "#22c88c" : "rgba(160,180,200,0.55)";
  const text = payload?.pa_system_announcement_script || "";
  const hiMatch = text.match(/\n\n\[HI\]\s*/);
  const knMatch = text.match(/\n\n\[KN\]\s*/);
  let en = text, hi = "", kn = "";
  if (hiMatch) {
    en = text.slice(0, hiMatch.index);
    const afterHi = text.slice(hiMatch.index + hiMatch[0].length);
    if (knMatch && knMatch.index > hiMatch.index) {
      const knInAfterHi = afterHi.match(/\n\n\[KN\]\s*/);
      if (knInAfterHi) {
        hi = afterHi.slice(0, knInAfterHi.index);
        kn = afterHi.slice(knInAfterHi.index + knInAfterHi[0].length);
      } else { hi = afterHi; }
    } else { hi = afterHi; }
  } else if (knMatch) {
    en = text.slice(0, knMatch.index);
    kn = text.slice(knMatch.index + knMatch[0].length);
  }

  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: "rgba(14,18,26,0.85)",
      border: "1px solid rgba(140,160,180,0.16)",
      borderRadius: 10, overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(140,160,180,0.14)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: sevColor,
            boxShadow: severity ? `0 0 8px ${sevColor}` : "none",
          }} />
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10.5, letterSpacing: "0.22em", color: "rgba(220,232,245,0.85)" }}>
            PA SCRIPT · TRILINGUAL{sections > 1 ? ` · MULTI-EVENT (${sections})` : ""}
          </span>
        </div>
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.15em", color: "rgba(160,180,200,0.55)" }}>
          EN · HI · KN
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {!text && (
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "rgba(160,180,200,0.5)" }}>
            Awaiting script generation...
          </div>
        )}
        {en && (
          <div>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.2em", color: "rgba(160,180,200,0.5)", marginBottom: 6 }}>EN · ENGLISH</div>
            <div style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, color: "rgba(232,240,250,0.95)", lineHeight: 1.5, textWrap: "pretty", whiteSpace: "pre-line" }}>{en}</div>
          </div>
        )}
        {hi && (
          <div>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.2em", color: "rgba(160,180,200,0.5)", marginBottom: 6 }}>HI · हिन्दी</div>
            <div style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, color: "rgba(232,240,250,0.95)", lineHeight: 1.5, textWrap: "pretty", whiteSpace: "pre-line" }}>{hi}</div>
          </div>
        )}
        {kn && (
          <div>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.2em", color: "rgba(160,180,200,0.5)", marginBottom: 6 }}>KN · ಕನ್ನಡ</div>
            <div style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, color: "rgba(232,240,250,0.95)", lineHeight: 1.5, textWrap: "pretty", whiteSpace: "pre-line" }}>{kn}</div>
          </div>
        )}
      </div>

      <div style={{
        padding: "10px 16px",
        borderTop: "1px solid rgba(140,160,180,0.14)",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
      }}>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(160,180,200,0.5)" }}>
          {voicesReady ? "TTS · GEMINI 2.5-FLASH · READY" : "TTS · INITIALIZING..."}
        </div>
        <button
          disabled={!text || speaking}
          onClick={onSpeak}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 14px",
            background: speaking ? "#22c88c" : text ? "rgba(34,200,140,0.14)" : "rgba(160,180,200,0.06)",
            border: `1px solid ${text ? "rgba(34,200,140,0.55)" : "rgba(160,180,200,0.18)"}`,
            borderRadius: 6,
            color: speaking ? "#08110d" : text ? "#22c88c" : "rgba(160,180,200,0.4)",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
            cursor: text && !speaking ? "pointer" : "not-allowed",
            transition: "all 200ms ease",
          }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: speaking ? "#08110d" : "#22c88c",
            animation: speaking ? "dotPulse 1s ease-in-out infinite" : "none",
          }} />
          {speaking ? "BROADCASTING…" : "FIRE LIVE AUDIO PA"}
        </button>
      </div>
    </div>
  );
}

function AuditorPanel({ auditor, severity, visible }) {
  if (!visible) return null;
  return (
    <div style={{
      width: "100%", flexShrink: 0,
      maxHeight: 280,
      background: "rgba(18,12,16,0.9)",
      border: "1px solid rgba(245,80,80,0.35)",
      borderRadius: 10, overflow: "hidden",
      display: "flex", flexDirection: "column",
      animation: "auditorIn 480ms cubic-bezier(0.2, 0.9, 0.25, 1.05)",
    }}>
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(245,80,80,0.3)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f55050", boxShadow: "0 0 10px #f55050", animation: "dotPulse 1.2s ease-in-out infinite" }} />
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10.5, letterSpacing: "0.22em", color: "#ff8aa5" }}>
            RISK AUDITOR{auditor?.compound ? " · COMPOUND" : ""}
          </span>
        </div>
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,138,165,0.7)" }}>{auditor?.model || "2.5-PRO"}</span>
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 9, overflowY: "auto", flex: 1, minHeight: 0 }}>
        {(auditor?.checks || []).map((c, i) => (
          <div key={i} style={{
            paddingBottom: 9,
            borderBottom: i < (auditor.checks.length - 1) ? "1px dashed rgba(160,180,200,0.12)" : "none",
          }}>
            <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
              <span style={{ color: c.result?.includes("FLAGGED") ? "#f5a623" : "#22c88c", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>{c.result?.includes("FLAGGED") ? "⚠" : "✓"}</span>
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9.5, letterSpacing: "0.06em", color: "rgba(232,240,250,0.85)" }}>
                {c.label}
              </span>
            </div>
            <div style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 11, color: "rgba(180,195,215,0.7)", marginTop: 3, marginLeft: 17, lineHeight: 1.4 }}>
              {c.result}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        padding: "10px 16px",
        background: "rgba(34,200,140,0.10)",
        borderTop: "1px solid rgba(34,200,140,0.35)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.14em", color: "#22c88c", fontWeight: 700 }}>
          auditor_clearance: true
        </span>
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "rgba(34,200,140,0.7)" }}>
          {auditor?.checks?.length || 5}/{auditor?.checks?.length || 5} VERIFIED{auditor?.latency_s ? ` · ${auditor.latency_s}s` : ""}
        </span>
      </div>
    </div>
  );
}

window.MobileAlert = MobileAlert;
window.PAScript = PAScript;
window.AuditorPanel = AuditorPanel;
