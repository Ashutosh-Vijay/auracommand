// Team Channels — routes mitigation directives to the right ops team
// and renders compact per-team brief cards.

const TEAMS = {
  medical: {
    label: "Medical Response",
    channel: "MED-1",
    color: "#22c88c",
    icon: (size = 12) => (
      <svg width={size} height={size} viewBox="0 0 12 12">
        <path d="M5 1 H7 V5 H11 V7 H7 V11 H5 V7 H1 V5 H5 Z" fill="currentColor" />
      </svg>
    ),
  },
  security: {
    label: "Stadium Security",
    channel: "SEC-1",
    color: "#a796ff",
    icon: (size = 12) => (
      <svg width={size} height={size} viewBox="0 0 12 12">
        <path d="M6 1 L11 3 V6 C11 9 8.5 11 6 11 C3.5 11 1 9 1 6 V3 Z"
          fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
  ops: {
    label: "Ground Operations",
    channel: "OPS-1",
    color: "#7be7c2",
    icon: (size = 12) => (
      <svg width={size} height={size} viewBox="0 0 12 12">
        <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="6" cy="6" r="1.4" fill="currentColor" />
      </svg>
    ),
  },
  comms: {
    label: "Comms & Broadcast",
    channel: "COM-1",
    color: "#7fd0ff",
    icon: (size = 12) => (
      <svg width={size} height={size} viewBox="0 0 12 12">
        <path d="M2 4 V8 H4 L7 10 V2 L4 4 Z" fill="currentColor" />
        <path d="M9 4 C10 5 10 7 9 8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  external: {
    label: "External Agencies",
    channel: "EXT-1",
    color: "#ff8aa5",
    icon: (size = 12) => (
      <svg width={size} height={size} viewBox="0 0 12 12">
        <path d="M1 6 L4 3 V5 H8 V3 L11 6 L8 9 V7 H4 V9 Z" fill="currentColor" />
      </svg>
    ),
  },
};

const ACTION_TO_TEAM = {
  dispatch_medics: "medical",
  page_hospital: "medical",
  deploy_security: "security",
  seal_gate: "security",
  evacuate_perimeter: "security",
  dispatch_bomb_squad: "external",
  notify_authority: "external",
  open_gate: "ops",
  reroute_flow: "ops",
  halt_play: "ops",
  signal_umpires: "ops",
  request_delay: "ops",
  monitor: "ops",
  abort_arrival: "ops",
  shelter_in_place: "ops",
  broadcast_pa: "comms",
  camera_cutaway: "comms",
  trace_identify: "comms",
  execute: "ops",
};

function routeToTeams(payload, statuses) {
  if (!payload) return [];
  const buckets = {};
  payload.mitigation_directives.forEach((d, i) => {
    const action = (window.inferAction || (() => ({ kind: "execute", label: "EXECUTE" })))(d);
    const teamKey = ACTION_TO_TEAM[action.kind] || "ops";
    if (!buckets[teamKey]) buckets[teamKey] = { key: teamKey, directives: [] };
    buckets[teamKey].directives.push({ d, action, idx: i, status: statuses?.[i] });
  });
  // Order: medical, security, external, ops, comms (priority of response)
  const order = ["medical", "security", "external", "ops", "comms"];
  return order
    .filter(k => buckets[k])
    .map(k => ({ ...buckets[k], meta: TEAMS[k] }));
}

function TeamCard({ team, severity, onFire }) {
  const meta = team.meta;
  const total = team.directives.length;
  const done = team.directives.filter(x => x.status?.state === "done").length;
  const allDone = done === total;
  const sevLabel = severity === "RED" ? "PRIORITY" : severity === "ORANGE" ? "ACTIVE" : "STANDBY";

  return (
    <div style={{
      background: "rgba(20,26,36,0.7)",
      border: `1px solid ${meta.color}30`,
      borderLeft: `3px solid ${meta.color}`,
      borderRadius: 7,
      padding: "9px 11px",
      display: "flex", flexDirection: "column", gap: 6,
      transition: "all 220ms ease",
    }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{
            width: 22, height: 22, borderRadius: 5,
            background: `${meta.color}18`,
            color: meta.color,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>{meta.icon(13)}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "Geist, Inter, system-ui, sans-serif",
              fontSize: 12, fontWeight: 600,
              color: "rgba(232,240,250,0.95)",
              letterSpacing: "-0.005em",
              lineHeight: 1.1,
            }}>{meta.label}</div>
            <div style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 8.5, letterSpacing: "0.16em",
              color: "rgba(160,180,200,0.55)",
              marginTop: 1,
            }}>RADIO · {meta.channel}</div>
          </div>
        </div>
        <span style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
          padding: "2px 7px",
          color: allDone ? "#22c88c" : meta.color,
          border: `1px solid ${allDone ? "#22c88c" : meta.color}55`,
          borderRadius: 999,
          background: allDone ? "rgba(34,200,140,0.10)" : `${meta.color}10`,
        }}>
          {allDone ? "✓ DONE" : `${done}/${total} · ${sevLabel}`}
        </span>
      </div>

      {/* directive bullets */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {team.directives.map((x, i) => {
          const isDone = x.status?.state === "done";
          const isDisp = x.status?.state === "dispatching";
          const dotColor = isDone ? "#22c88c" : isDisp ? meta.color : "rgba(160,180,200,0.35)";
          return (
            <div key={i} style={{
              display: "grid",
              gridTemplateColumns: "10px 1fr auto",
              gap: 8, alignItems: "center",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 11,
              color: isDone ? "rgba(180,200,220,0.65)" : "rgba(220,232,245,0.92)",
              lineHeight: 1.3,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: dotColor,
                animation: isDisp ? "dotPulse 0.9s ease-in-out infinite" : "none",
                margin: "auto",
              }} />
              <span style={{
                textDecoration: isDone ? "line-through" : "none",
                opacity: isDone ? 0.7 : 1,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                <b style={{ fontWeight: 600 }}>{x.action.label}</b>
                <span style={{ color: "rgba(160,180,200,0.65)" }}> → {x.d.target_zone}</span>
              </span>
              {!isDone && !isDisp && (
                <button onClick={() => onFire(x.idx)}
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em",
                    padding: "2px 6px",
                    background: "transparent",
                    color: meta.color,
                    border: `1px solid ${meta.color}55`,
                    borderRadius: 3,
                    cursor: "pointer",
                  }}>FIRE</button>
              )}
              {isDisp && (
                <span style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 8.5, letterSpacing: "0.1em",
                  color: meta.color,
                }}>↻</span>
              )}
              {isDone && (
                <span style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 8.5, letterSpacing: "0.1em",
                  color: "#22c88c",
                }}>✓ {x.status.source === "agent" ? "AUTO" : "MAN"}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamChannels({ payload, severity, statuses, onFire }) {
  const routed = routeToTeams(payload, statuses);
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
          <span className="dot-pulse" />
          <span style={{
            fontFamily: "JetBrains Mono, monospace", fontSize: 10.5,
            letterSpacing: "0.22em", color: "rgba(220,232,245,0.85)",
          }}>TEAM CHANNELS</span>
        </div>
        <span style={{
          fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.16em",
          color: "rgba(160,180,200,0.55)",
        }}>{routed.length} ACTIVE</span>
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        padding: 10,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {routed.length === 0 ? (
          <div style={{
            padding: "20px 8px",
            fontFamily: "JetBrains Mono, monospace", fontSize: 10.5,
            color: "rgba(160,180,200,0.5)", lineHeight: 1.6,
          }}>
            <div>$ aura-routing --listen</div>
            <div>5 radio channels armed · awaiting payload from Dispatcher.</div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
              {Object.values(TEAMS).map(t => (
                <div key={t.channel} style={{ display: "flex", alignItems: "center", gap: 8, color: t.color }}>
                  <span style={{ display: "inline-flex" }}>{t.icon(11)}</span>
                  <span>{t.channel} · {t.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          routed.map(t => (
            <TeamCard key={t.key} team={t} severity={severity} onFire={onFire} />
          ))
        )}
      </div>
    </div>
  );
}

window.TeamChannels = TeamChannels;
window.routeToTeams = routeToTeams;
window.TEAMS = TEAMS;
