// Agent Intelligence Stream — running log terminal showing
// asynchronous reasoning across Sensor → Dispatcher → (Auditor) → Broadcast.

const AGENT_META = {
  sensor:     { label: "SENSOR-PARSER",     color: "#7fd0ff", model: "rule-engine"    },
  dispatcher: { label: "DISPATCHER",        color: "#a796ff", model: "gemini-2.5-flash" },
  auditor:    { label: "RISK-AUDITOR",      color: "#ff8aa5", model: "gemini-2.5-pro"   },
  broadcast:  { label: "BROADCAST",         color: "#7be7c2", model: "fan-out"        },
};

const LEVEL_GLYPH = {
  info:  { glyph: "›", color: "rgba(180,200,220,0.85)" },
  think: { glyph: "·", color: "rgba(180,200,220,0.55)" },
  warn:  { glyph: "▲", color: "#f5aa3c" },
  alert: { glyph: "■", color: "#f55050" },
  ok:    { glyph: "✓", color: "#22c88c" },
  emit:  { glyph: "↦", color: "#a796ff" },
};

function StreamLine({ entry, now }) {
  const meta = AGENT_META[entry.agent] || AGENT_META.dispatcher;
  const lev = LEVEL_GLYPH[entry.level] || LEVEL_GLYPH.info;
  const ts = `T+${(entry.t / 1000).toFixed(2)}s`;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "62px 110px 14px 1fr",
      gap: "10px",
      padding: "5px 12px",
      borderLeft: `2px solid ${meta.color}40`,
      animation: "lineFadeIn 240ms ease",
      alignItems: "baseline",
      fontFamily: "JetBrains Mono, monospace",
      fontSize: "11.5px",
      lineHeight: 1.45,
    }}>
      <span style={{ color: "rgba(160,180,200,0.45)", letterSpacing: "0.04em" }}>{ts}</span>
      <span style={{ color: meta.color, fontWeight: 600, letterSpacing: "0.06em" }}>{meta.label}</span>
      <span style={{ color: lev.color, fontWeight: 700, textAlign: "center" }}>{lev.glyph}</span>
      <span style={{ color: entry.level === "think" ? "rgba(210,222,236,0.72)" : "rgba(232,240,250,0.95)" }}>
        {entry.text}
      </span>
    </div>
  );
}

function AgentStream({ entries, cycleId, severity, runningSince }) {
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  const elapsed = runningSince ? ((Date.now() - runningSince) / 1000).toFixed(2) : "0.00";

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "rgba(14,18,26,0.85)",
      border: "1px solid rgba(140,160,180,0.16)",
      borderRadius: "10px",
      overflow: "hidden",
    }}>
      {/* header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(140,160,180,0.14)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="dot-pulse" />
          <div style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "10.5px", letterSpacing: "0.22em",
            color: "rgba(220,232,245,0.85)",
          }}>AGENT INTELLIGENCE STREAM</div>
        </div>
        <div style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "10px", letterSpacing: "0.15em",
          color: "rgba(160,180,200,0.55)",
          display: "flex", gap: "14px",
        }}>
          <span>CYCLE {String(cycleId).padStart(4, "0")}</span>
          <span>{elapsed}s</span>
        </div>
      </div>

      {/* agent topology strip */}
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid rgba(140,160,180,0.10)",
        display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap",
      }}>
        {["sensor", "dispatcher", "auditor", "broadcast"].map((k, i) => {
          const m = AGENT_META[k];
          const active = entries.some(e => e.agent === k);
          const skipped = k === "auditor" && entries.length && severity !== "RED";
          return (
            <React.Fragment key={k}>
              <div style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "4px 9px",
                borderRadius: "999px",
                border: `1px solid ${active ? m.color + "70" : "rgba(140,160,180,0.18)"}`,
                background: active ? `${m.color}14` : "transparent",
                opacity: skipped ? 0.35 : 1,
                transition: "all 300ms ease",
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: active ? m.color : "rgba(140,160,180,0.3)",
                  boxShadow: active ? `0 0 8px ${m.color}` : "none",
                }} />
                <span style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "9.5px", letterSpacing: "0.12em",
                  color: active ? m.color : "rgba(160,180,200,0.55)",
                  fontWeight: 600,
                }}>{m.label}</span>
                <span style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "8.5px",
                  color: "rgba(160,180,200,0.45)",
                }}>{m.model}</span>
              </div>
              {i < 3 && (
                <span style={{
                  color: "rgba(140,160,180,0.35)",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "10px",
                }}>→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* scrolling log */}
      <div ref={scrollRef} style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        padding: "8px 0",
      }}>
        {entries.length === 0 && (
          <div style={{
            padding: "24px 16px",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            color: "rgba(160,180,200,0.45)",
            letterSpacing: "0.05em",
          }}>
            <div style={{ marginBottom: 6 }}>$ auracommand --watch</div>
            <div>idle · awaiting scenario trigger from control shelf...</div>
            <div style={{ marginTop: 14 }}>
              <span style={{ color: "rgba(180,200,220,0.5)" }}>fleet:</span> sensor-parser · gemini-2.5-flash · gemini-2.5-pro · broadcast-fan-out
            </div>
            <div>
              <span style={{ color: "rgba(180,200,220,0.5)" }}>budget:</span> 5.00 USD / 1000 cycles · current burn 0.00
            </div>
          </div>
        )}
        {entries.map((e, i) => <StreamLine key={i} entry={e} now={Date.now()} />)}
      </div>

      {/* footer */}
      <div style={{
        padding: "8px 16px",
        borderTop: "1px solid rgba(140,160,180,0.14)",
        display: "flex", justifyContent: "space-between",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "9.5px", letterSpacing: "0.14em",
        color: "rgba(160,180,200,0.55)",
      }}>
        <span>STREAM · WS://AGENT-FABRIC/V3</span>
        <span>{entries.length.toString().padStart(3, "0")} EVENTS</span>
      </div>
    </div>
  );
}

window.AgentStream = AgentStream;
