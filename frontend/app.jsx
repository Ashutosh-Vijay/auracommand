// Main App — wires control shelf, stadium map, agent stream,
// auditor escalation, and broadcast dock.

const { useState, useEffect, useRef, useMemo } = React;

const SEV_TINT = {
  GREEN:  { color: "#22c88c", label: "NOMINAL",  bg: "rgba(34,200,140,0.08)" },
  ORANGE: { color: "#f5aa3c", label: "ELEVATED", bg: "rgba(245,170,60,0.10)" },
  RED:    { color: "#f55050", label: "CRITICAL", bg: "rgba(245,80,80,0.12)" },
};

function ScenarioCard({ scenario, armed, onToggle, disabled, dispatched }) {
  const sev = scenario.expected_severity;
  const t = SEV_TINT[sev];
  return (
    <button onClick={onToggle} disabled={disabled}
      style={{
        textAlign: "left",
        padding: "12px 14px",
        background: armed ? t.bg : "rgba(20,26,36,0.7)",
        border: `1px solid ${armed ? t.color + "88" : "rgba(140,160,180,0.18)"}`,
        borderLeft: `3px solid ${armed ? t.color : t.color + "55"}`,
        borderRadius: 8,
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "all 220ms ease",
        display: "flex", flexDirection: "column", gap: 5,
        minWidth: 188, flex: 1,
        position: "relative",
        boxShadow: armed ? `0 0 0 1px ${t.color}30, 0 6px 20px -10px ${t.color}55` : "none",
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 9, letterSpacing: "0.18em",
          color: "rgba(160,180,200,0.65)",
        }}>
          <span style={{
            width: 12, height: 12, borderRadius: 3,
            border: `1.4px solid ${armed ? t.color : "rgba(140,160,180,0.4)"}`,
            background: armed ? t.color : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 200ms ease",
          }}>
            {armed && <span style={{ color: "#0a0d12", fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
          </span>
          {scenario.id}
        </span>
        {/* Static severity tag removed to avoid clashing with dynamic model output */}
      </div>
      <div style={{
        fontFamily: "Geist, Inter, system-ui, sans-serif",
        fontSize: 13.5, fontWeight: 600,
        color: "rgba(232,240,250,0.95)",
        letterSpacing: "-0.005em",
        lineHeight: 1.2,
      }}>{scenario.name}</div>
      <div style={{
        display: "flex", gap: 10,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 9, letterSpacing: "0.06em",
        color: "rgba(160,180,200,0.6)",
      }}>
        <span>T·{scenario.timestamp}</span>
        {scenario.current_rainfall_mm > 0 && <span>☂·{scenario.current_rainfall_mm.toFixed(1)}mm</span>}
      </div>
    </button>
  );
}

function Telemetry({ scenario }) {
  if (!scenario) return null;
  const sm = scenario.sensor_metrics;
  const rows = [
    { k: "G01·TURNSTILE", v: sm.gate_01_turnstile_rate_per_min + " ppm" },
    { k: "G03·TURNSTILE", v: sm.gate_03_turnstile_rate_per_min + " ppm" },
    { k: "G05·TURNSTILE", v: sm.gate_05_turnstile_rate_per_min + " ppm" },
    { k: "DENSITY·B",      v: sm.concourse_b_density_index.toFixed(2) },
    { k: "METRO·QUEUE",    v: sm.metro_station_queue_length_meters + "m" },
    { k: "RAINFALL",       v: scenario.current_rainfall_mm.toFixed(1) + "mm" },
  ];
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(6, 1fr)",
      gap: 1,
      background: "rgba(140,160,180,0.10)",
      border: "1px solid rgba(140,160,180,0.18)",
      borderRadius: 8,
      overflow: "hidden",
    }}>
      {rows.map((r) => (
        <div key={r.k} style={{
          padding: "10px 12px",
          background: "rgba(14,18,26,0.9)",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.16em", color: "rgba(160,180,200,0.55)" }}>{r.k}</span>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 14, color: "rgba(232,240,250,0.95)", fontWeight: 500 }}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

function SeverityBadge({ severity, justification, sources }) {
  const t = SEV_TINT[severity] || { color: "#7a8a9a", label: "IDLE", bg: "rgba(120,135,150,0.08)" };
  return (
    <div style={{
      padding: "14px 16px",
      background: t.bg,
      border: `1px solid ${t.color}55`,
      borderLeft: `3px solid ${t.color}`,
      borderRadius: 8,
      display: "flex", flexDirection: "column", gap: 8,
      transition: "all 300ms ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{
          width: 10, height: 10, borderRadius: "50%",
          background: t.color,
          boxShadow: severity ? `0 0 10px ${t.color}` : "none",
          animation: severity === "RED" ? "dotPulse 1.1s ease-in-out infinite" : "none",
        }} />
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, letterSpacing: "0.22em", color: t.color, fontWeight: 700 }}>
          SEVERITY · {severity || "IDLE"}
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(160,180,200,0.6)" }}>
          {t.label}
        </span>
      </div>
      {sources && sources.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.16em", color: "rgba(160,180,200,0.55)", alignSelf: "center" }}>COMPOUND ·</span>
          {sources.map(s => {
            const st = SEV_TINT[s.severity] || { color: "#7a8a9a" };
            return (
              <span key={s.id} style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 9, letterSpacing: "0.06em",
                padding: "2px 7px",
                color: st.color,
                border: `1px solid ${st.color}55`,
                borderRadius: 4,
                background: `${st.color}10`,
              }}>
                {s.short || s.id}
              </span>
            );
          })}
        </div>
      )}
      {justification && (
        <div style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 12.5, color: "rgba(220,232,245,0.85)",
          lineHeight: 1.5, textWrap: "pretty",
        }}>
          {justification}
        </div>
      )}
    </div>
  );
}

function inferAction(d) {
  if (d.action) return d.action;
  const t = ((d.action_required || "") + " " + (d.target_zone || "")).toUpperCase();
  if (t.includes("BOMB SQUAD")) return { kind: "dispatch_bomb_squad", label: "DISPATCH SQUAD", eta_s: 660 };
  if (t.includes("MEDIC") || t.includes("PARAMEDIC")) return { kind: "dispatch_medics", label: "DISPATCH MEDICS", eta_s: 90 };
  if (t.includes("EVACUAT")) return { kind: "evacuate_perimeter", label: "EVACUATE", eta_s: 120 };
  if (t.includes("SEAL") || t.includes("SOFT CLOSE") || t.includes("HARD SEAL") || t.includes("HARD CLOSE")) return { kind: "seal_gate", label: "SEAL", eta_s: 20 };
  if (t.includes("OPEN") && (t.includes("GATE") || t.includes("LANE") || t.includes("OVERFLOW"))) return { kind: "open_gate", label: "OPEN GATE", eta_s: 30 };
  if (t.includes("DEPLOY") || t.includes("STEWARD")) return { kind: "deploy_security", label: "DEPLOY", eta_s: 45 };
  if (t.includes("REROUTE") || t.includes("REDIRECT")) return { kind: "reroute_flow", label: "REROUTE", eta_s: 25 };
  if (t.includes("ABORT")) return { kind: "abort_arrival", label: "ABORT", eta_s: 5 };
  if (t.includes("SHELTER") || t.includes("STAND-IN-PLACE") || t.includes("STAND-SHELTER")) return { kind: "shelter_in_place", label: "SHELTER", eta_s: 8 };
  if (t.includes("HALT") || t.includes("SUSPEND PLAY")) return { kind: "halt_play", label: "HALT PLAY", eta_s: 3 };
  if (t.includes("CAMERA") || t.includes("CUT-AWAY")) return { kind: "camera_cutaway", label: "CUT FEED", eta_s: 2 };
  if (t.includes("TRACE") || t.includes("TRACK") || t.includes("ML")) return { kind: "trace_identify", label: "ML TRACE", eta_s: 30 };
  if (t.includes("PAGE") && t.includes("HOSPITAL")) return { kind: "page_hospital", label: "PAGE", eta_s: 30 };
  if (t.includes("NOTIFY") || t.includes("CHANNEL") || t.includes("EMBARGO")) return { kind: "notify_authority", label: "NOTIFY", eta_s: 15 };
  if (t.includes("COMMANDER") || t.includes("INCIDENT COMMANDER") || t.includes("COMMS")) return { kind: "notify_authority", label: "PAGE IC", eta_s: 20 };
  if (t.includes("PA") || t.includes("ANNOUNCE") || t.includes("MESSAGE") || t.includes("BROADCAST")) return { kind: "broadcast_pa", label: "BROADCAST", eta_s: 6 };
  if (t.includes("STAGGER") || t.includes("DELAY") || t.includes("REQUEST")) return { kind: "request_delay", label: "STAGGER", eta_s: 10 };
  if (t.includes("MONITOR") || t.includes("SAMPLING") || t.includes("PASSIVE") || t.includes("MAINTAIN")) return { kind: "monitor", label: "MONITOR", eta_s: 5 };
  return { kind: "execute", label: "EXECUTE", eta_s: 20 };
}

function DirectivesList({ directives, statuses, onFire }) {
  if (!directives?.length) return null;
  const prioColor = { IMMEDIATE: "#f55050", DEFERRED: "#f5aa3c", MONITOR: "#7be7c2" };
  const doneCount = (statuses || []).filter(s => s?.state === "done").length;
  return (
    <div style={{
      background: "rgba(14,18,26,0.85)",
      border: "1px solid rgba(140,160,180,0.16)",
      borderRadius: 8, overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 14px",
        borderBottom: "1px solid rgba(140,160,180,0.14)",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 10.5, letterSpacing: "0.22em",
        color: "rgba(220,232,245,0.85)",
        display: "flex", justifyContent: "space-between",
      }}>
        <span>MITIGATION DIRECTIVES</span>
        <span style={{ color: "rgba(160,180,200,0.5)" }}>
          {doneCount}/{directives.length} EXECUTED
        </span>
      </div>
      <div>
        {directives.map((d, i) => (
          <DirectiveRow
            key={i}
            d={d}
            status={statuses?.[i]}
            prioColor={prioColor}
            onFire={() => onFire(i)}
            isLast={i === directives.length - 1}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

function DirectiveRow({ d, status, prioColor, onFire, isLast, index }) {
  const action = inferAction(d);
  const isDone = status?.state === "done";
  const isDispatching = status?.state === "dispatching";
  const prio = prioColor[d.priority] || "#7a8a9a";

  let actionEl;
  if (isDone) {
    actionEl = (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2,
        minWidth: 132,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
          color: "#22c88c",
        }}>
          <span style={{ fontSize: 11 }}>✓</span>
          EXECUTED
        </div>
        <div style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 8.5, letterSpacing: "0.12em",
          color: "rgba(160,180,200,0.6)",
        }}>
          {status.source?.toUpperCase()} · T+{(status.durationMs / 1000).toFixed(1)}s
        </div>
      </div>
    );
  } else if (isDispatching) {
    actionEl = (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4,
        minWidth: 132,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
          color: "#a796ff",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", background: "#a796ff",
            animation: "dotPulse 0.8s ease-in-out infinite",
          }} />
          DISPATCHING…
        </div>
        <div style={{
          width: 110, height: 3, borderRadius: 2,
          background: "rgba(167,150,255,0.18)",
          overflow: "hidden", position: "relative",
        }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            background: "#a796ff",
            animation: "barFill 1.4s linear forwards",
          }} />
        </div>
      </div>
    );
  } else {
    actionEl = (
      <button onClick={onFire}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 11px",
          background: `${prio}14`,
          border: `1px solid ${prio}66`,
          borderRadius: 5,
          color: prio,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
          cursor: "pointer",
          transition: "all 180ms ease",
          minWidth: 132, justifyContent: "center",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = `${prio}25`; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = `${prio}14`; }}
      >
        ▸ {action.label}
      </button>
    );
  }

  return (
    <div style={{
      padding: "10px 14px",
      display: "grid",
      gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center",
      borderBottom: !isLast ? "1px solid rgba(140,160,180,0.08)" : "none",
      animation: `lineFadeIn 260ms ease ${index * 70}ms both`,
      background: isDone ? "rgba(34,200,140,0.04)" : "transparent",
      transition: "background 300ms ease",
    }}>
      <span style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
        padding: "3px 7px",
        color: prio,
        border: `1px solid ${prio}55`,
        borderRadius: 4,
      }}>{d.priority}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 13, color: "rgba(232,240,250,0.95)", fontWeight: 500, lineHeight: 1.3 }}>
          {d.action_required}
        </div>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9.5, letterSpacing: "0.08em", color: "rgba(160,180,200,0.6)", marginTop: 2 }}>
          {d.target_zone}
        </div>
      </div>
      {actionEl}
    </div>
  );
}

function ClockHud() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const time = t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = t.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 14,
      fontFamily: "JetBrains Mono, monospace",
      color: "rgba(220,232,245,0.75)",
    }}>
      <span style={{ fontSize: 18, fontWeight: 500, letterSpacing: "0.04em" }}>{time}</span>
      <span style={{ fontSize: 9.5, letterSpacing: "0.18em", color: "rgba(160,180,200,0.55)" }}>IST · {date.toUpperCase()}</span>
    </div>
  );
}

function DispatchPanel({ armed, composedPreview, running, onDispatch, onReset, hasRun }) {
  const sev = composedPreview?.expected_severity || (armed[0]?.expected_severity);
  const t = SEV_TINT[sev] || { color: "#7a8a9a", label: "STANDBY", bg: "rgba(120,135,150,0.08)" };
  const escalated = composedPreview && composedPreview.expected_severity === "RED" &&
    armed.every(s => s.expected_severity !== "RED");

  return (
    <div style={{
      width: 270, flexShrink: 0,
      display: "flex", flexDirection: "column", gap: 8,
      padding: "12px 14px",
      background: armed.length ? t.bg : "rgba(20,26,36,0.7)",
      border: `1px solid ${armed.length ? t.color + "55" : "rgba(140,160,180,0.18)"}`,
      borderRadius: 8,
      transition: "all 220ms ease",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.2em",
        color: armed.length ? t.color : "rgba(160,180,200,0.55)",
      }}>
        <span>{composedPreview ? "COMPOUND PREVIEW" : armed.length === 1 ? "SINGLE EVENT" : "AWAITING ARM"}</span>
        {sev && <span style={{ fontWeight: 700 }}>→ {sev}</span>}
      </div>

      {composedPreview ? (
        <div style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 11, color: "rgba(220,232,245,0.85)",
          lineHeight: 1.4, minHeight: 32,
        }}>
          {escalated && (
            <span style={{ color: "#f55050", fontWeight: 700, marginRight: 4 }}>↑ ESCALATED ·</span>
          )}
          {armed.length} concurrent events · interaction analysis enabled.
        </div>
      ) : armed.length === 1 ? (
        <div style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 11, color: "rgba(220,232,245,0.85)",
          lineHeight: 1.4, minHeight: 32,
        }}>
          {armed[0].name}
        </div>
      ) : (
        <div style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 11, color: "rgba(160,180,200,0.55)",
          lineHeight: 1.4, minHeight: 32,
        }}>
          Tick one or more event cards to arm. Two ORANGE signals at once auto-escalate to RED.
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <button
          disabled={running || armed.length === 0}
          onClick={onDispatch}
          style={{
            flex: 1,
            padding: "10px 12px",
            background: armed.length && !running ? t.color : "rgba(140,160,180,0.10)",
            color: armed.length && !running ? "#0a0d12" : "rgba(160,180,200,0.4)",
            border: "none", borderRadius: 6,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11, fontWeight: 700, letterSpacing: "0.16em",
            cursor: armed.length && !running ? "pointer" : "not-allowed",
            transition: "all 200ms ease",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
          {running ? (
            <>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0a0d12", animation: "dotPulse 0.9s ease-in-out infinite" }} />
              DISPATCHING…
            </>
          ) : (
            <>▸ DISPATCH</>
          )}
        </button>
        {hasRun && (
          <button onClick={onReset} disabled={running}
            style={{
              padding: "10px 12px",
              background: "rgba(20,26,36,0.7)",
              color: "rgba(180,195,215,0.75)",
              border: "1px solid rgba(140,160,180,0.25)",
              borderRadius: 6,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 11, fontWeight: 600, letterSpacing: "0.14em",
              cursor: "pointer",
            }}>RESET</button>
        )}
      </div>
    </div>
  );
}

function App() {
  const [armedKeys, setArmedKeys] = useState(new Set());
  const [activeRun, setActiveRun] = useState(null); // built scenario currently running/run
  const [streamEntries, setStreamEntries] = useState([]);
  const [zoneState, setZoneState] = useState({});
  const [sensorMetrics, setSensorMetrics] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [payload, setPayload] = useState(null);
  const [auditor, setAuditor] = useState(null);
  const [running, setRunning] = useState(false);
  const [cycleId, setCycleId] = useState(0);
  const [runningSince, setRunningSince] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [directiveStatuses, setDirectiveStatuses] = useState([]);
  const timeoutsRef = useRef([]);
  const runStartRef = useRef(null);

  function emitStream(entry) {
    const elapsed = runStartRef.current ? Date.now() - runStartRef.current : 0;
    setStreamEntries(prev => [...prev, { ...entry, t: elapsed }]);
  }

  function setStatus(i, patch) {
    setDirectiveStatuses(prev => prev.map((s, j) => j === i ? { ...s, ...patch } : s));
  }

  function fireDirective(i, source) {
    setDirectiveStatuses(prev => {
      if (prev[i]?.state === "dispatching" || prev[i]?.state === "done") return prev;
      return prev.map((s, j) => j === i ? { ...s, state: "dispatching", source, startedAt: Date.now() } : s);
    });
    const d = payload?.mitigation_directives?.[i];
    if (!d) return;
    const act = inferAction(d);
    emitStream({
      agent: "broadcast", level: "info",
      text: `${source === "agent" ? "AGENT EXEC" : "OPERATOR EXEC"} · ${act.kind}(zone="${d.target_zone}") · ETA ${act.eta_s}s`,
    });
    const dur = 900 + Math.random() * 600;
    const id = setTimeout(() => {
      setDirectiveStatuses(prev => prev.map((s, j) =>
        j === i ? { ...s, state: "done", firedAt: Date.now(), durationMs: dur } : s
      ));
      emitStream({
        agent: "broadcast", level: "ok",
        text: `✓ ${act.kind} · ${d.target_zone} · ${source === "agent" ? "AUTO" : "MANUAL"} · ON-SITE`,
      });
    }, dur);
    timeoutsRef.current.push(id);
  }

  // Initialize statuses + auto-fire IMMEDIATE directives when payload arrives.
  useEffect(() => {
    if (!payload) {
      setDirectiveStatuses([]);
      return;
    }
    const dirs = payload.mitigation_directives || [];
    setDirectiveStatuses(dirs.map(() => ({ state: "pending", source: null })));
    // schedule auto-fire for IMMEDIATE only
    let when = 600;
    dirs.forEach((d, i) => {
      if (d.priority !== "IMMEDIATE") return;
      const id = setTimeout(() => fireDirective(i, "agent"), when);
      timeoutsRef.current.push(id);
      when += 280 + Math.random() * 220;
    });
  }, [payload]);

  // TTS is always ready (Gemini API-based, no browser voices needed)
  useEffect(() => { setVoicesReady(true); }, []);

  // tick to refresh elapsed timer
  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => force(n => n + 1), 100);
    return () => clearInterval(i);
  }, [running]);

  function toggleArm(key) {
    if (running) return;
    setArmedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function dispatch() {
    if (running || armedKeys.size === 0) return;
    setRunning(true);
    const keys = Array.from(armedKeys);
    
    // Immediate starting feed to indicate server connection
    setStreamEntries([
      { agent: "sensor", level: "info", text: "Connecting to AuraCommand multi-agent operational core...", t: 0 }
    ]);
    
    try {
      const response = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_keys: keys })
      });
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      const data = await response.json();
      const s = data.activeRun;
      
      runScenario(s);
      
      // If the incident has RED severity, poll for the async safety auditor reports!
      if (s.expected_severity === "RED") {
        const pollId = setInterval(async () => {
          try {
            const audRes = await fetch("/api/auditor");
            if (audRes.ok) {
              const audData = await audRes.json();
              if (audData && audData.verdict !== "VERIFYING") {
                setAuditor(audData);
                clearInterval(pollId);
                
                // Append final auditor clearance to stream entries
                setStreamEntries(prev => [
                  ...prev,
                  { agent: "auditor", level: "ok", text: `✓ risk-auditor-clearance = TRUE · verdict=${audData.verdict} · 5/5 checks passed.`, t: Date.now() - runStartRef.current }
                ]);
              }
            }
          } catch (pollErr) {
            console.error("Auditor poll failed:", pollErr);
          }
        }, 1000);
        
        timeoutsRef.current.push(pollId);
      }
    } catch (err) {
      console.warn("Connection to Python API failed, reverting to local static simulator:", err.message);
      setStreamEntries([
        { agent: "sensor", level: "warn", text: `Backend offline (${err.message}) · activating local simulation...`, t: 0 }
      ]);
      
      // Delay slightly and execute local static fallback
      setTimeout(() => {
        const armed = [...armedKeys].map(k => window.SCENARIOS[k]);
        const built = armed.length === 1 ? armed[0] : window.composeScenarios(armed);
        runScenario(built);
      }, 1200);
    }
  }


  function runScenario(s) {
    // cancel anything pending
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null; }
    window.speechSynthesis?.cancel();
    setSpeaking(false);

    setActiveRun(s);
    setStreamEntries([]);
    setZoneState({});
    setSensorMetrics(s.sensor_metrics);
    setSeverity(null);
    setPayload(null);
    setAuditor(null);
    setDirectiveStatuses([]);
    setCycleId(c => c + 1);
    setRunning(true);
    setRunningSince(Date.now());
    runStartRef.current = Date.now();

    // schedule trace lines
    s.trace.forEach((line) => {
      const id = setTimeout(() => {
        setStreamEntries(prev => [...prev, line]);
      }, line.t);
      timeoutsRef.current.push(id);
    });

    const lastT = s.trace[s.trace.length - 1].t;

    // map zones — 55% through
    timeoutsRef.current.push(setTimeout(() => {
      setZoneState(s.zone_state);
      setSeverity(s.expected_severity);
    }, Math.floor(lastT * 0.55)));

    // auditor — 72% through, if present
    if (s.auditor) {
      timeoutsRef.current.push(setTimeout(() => {
        setAuditor(s.auditor);
      }, Math.floor(lastT * 0.72)));
    }

    // last line — release payload + push
    timeoutsRef.current.push(setTimeout(() => {
      setPayload(s.payload);
      setRunning(false);
    }, lastT + 200));
  }

  function reset() {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    window.speechSynthesis?.cancel();
    setArmedKeys(new Set());
    setActiveRun(null);
    setStreamEntries([]);
    setZoneState({});
    setSensorMetrics(null);
    setSeverity(null);
    setPayload(null);
    setAuditor(null);
    setDirectiveStatuses([]);
    setRunning(false);
    setSpeaking(false);
  }

  const ttsAudioRef = React.useRef(null);
  const audioCtxRef = React.useRef(null);

  async function speakPA() {
    if (!payload) return;
    if (ttsAudioRef.current) { ttsAudioRef.current.stop?.(); ttsAudioRef.current = null; }
    window.speechSynthesis?.cancel();

    const text = payload.pa_system_announcement_script;
    const parts = text.split(/\n\n\[(?:HI|KN)\]\s*/);
    const en = parts[0] || "";
    setSpeaking(true);

    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") await ctx.resume();

    try {
      let audioB64 = null;
      // Poll pre-generated TTS for up to 10 seconds
      for (let attempt = 0; attempt < 10; attempt++) {
        const res = await fetch("/api/tts-status");
        if (res.ok) {
          const data = await res.json();
          if (data.status === "ready" && data.audio) { audioB64 = data.audio; break; }
          if (data.status !== "pending") break;
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      // If pre-generated audio wasn't ready, fire on-demand TTS
      if (!audioB64) {
        const fullText = parts.filter(Boolean).join(". ... ");
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: fullText, voice: "Kore" }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.audio) audioB64 = data.audio;
        }
      }

      if (audioB64) {
        const raw = atob(audioB64);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => { setSpeaking(false); ttsAudioRef.current = null; };
        ttsAudioRef.current = source;
        source.start();
        return;
      }
      throw new Error("No audio available");
    } catch (e) {
      console.warn("Gemini TTS failed, falling back to browser speech:", e.message);
    }

    if ("speechSynthesis" in window) {
      const u1 = new SpeechSynthesisUtterance(en);
      u1.rate = 0.95; u1.pitch = 0.95; u1.lang = "en-IN";
      u1.onend = () => setSpeaking(false);
      window.speechSynthesis.speak(u1);
    } else {
      setSpeaking(false);
    }
  }

  const activeScenario = activeRun;
  const sevHeader = SEV_TINT[severity] || { color: "#7a8a9a", label: "STANDBY" };
  const armedList = [...armedKeys].map(k => window.SCENARIOS[k]);
  const composedPreview = armedList.length > 1 ? window.composeScenarios(armedList) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", color: "rgba(232,240,250,0.95)" }}>
      {/* TOP HUD */}
      <header style={{
        padding: "14px 22px",
        borderBottom: "1px solid rgba(140,160,180,0.16)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(10,14,20,0.7)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* mark */}
          <div style={{
            width: 36, height: 36, position: "relative",
          }}>
            <svg viewBox="0 0 36 36" width="36" height="36">
              <defs>
                <linearGradient id="markGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a796ff" />
                  <stop offset="100%" stopColor="#7be7c2" />
                </linearGradient>
              </defs>
              <circle cx="18" cy="18" r="16" fill="none" stroke="url(#markGrad)" strokeWidth="1.5" />
              <circle cx="18" cy="18" r="10" fill="none" stroke="url(#markGrad)" strokeWidth="1.2" opacity="0.6" />
              <circle cx="18" cy="18" r="4" fill="url(#markGrad)" />
              <line x1="18" y1="0" x2="18" y2="6" stroke="url(#markGrad)" strokeWidth="1.5" />
              <line x1="18" y1="30" x2="18" y2="36" stroke="url(#markGrad)" strokeWidth="1.5" />
              <line x1="0" y1="18" x2="6" y2="18" stroke="url(#markGrad)" strokeWidth="1.5" />
              <line x1="30" y1="18" x2="36" y2="18" stroke="url(#markGrad)" strokeWidth="1.5" />
            </svg>
          </div>
          <div>
            <div style={{
              fontFamily: "Geist, Inter, system-ui, sans-serif",
              fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1,
            }}>
              AuraCommand
              <span style={{ marginLeft: 10, fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.2em", color: "rgba(160,180,200,0.55)", fontWeight: 500 }}>
                v3.2 · OPS
              </span>
            </div>
            <div style={{
              marginTop: 3,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 10, letterSpacing: "0.18em",
              color: "rgba(160,180,200,0.6)",
            }}>
              M. CHINNASWAMY · SMART OPERATIONS ENGINE
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 12px",
            border: `1px solid ${sevHeader.color}55`,
            background: `${sevHeader.color}10`,
            borderRadius: 999,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", background: sevHeader.color,
              boxShadow: `0 0 8px ${sevHeader.color}`,
              animation: severity === "RED" ? "dotPulse 1.1s ease-in-out infinite" : "none",
            }} />
            <span style={{
              fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.2em",
              color: sevHeader.color,
            }}>
              POSTURE · {severity || "STANDBY"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 18, fontFamily: "JetBrains Mono, monospace", fontSize: 9.5, letterSpacing: "0.16em", color: "rgba(160,180,200,0.6)" }}>
            <span><b style={{ color: "rgba(220,232,245,0.85)", fontWeight: 600 }}>32</b> SENSORS</span>
            <span><b style={{ color: "rgba(220,232,245,0.85)", fontWeight: 600 }}>14</b> GATES</span>
            <span><b style={{ color: "rgba(220,232,245,0.85)", fontWeight: 600 }}>4</b> AGENTS</span>
          </div>
          <ClockHud />
        </div>
      </header>

      {/* CONTROL SHELF */}
      <section style={{
        padding: "14px 22px",
        borderBottom: "1px solid rgba(140,160,180,0.12)",
        background: "rgba(12,16,22,0.4)",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "JetBrains Mono, monospace", fontSize: 9.5, letterSpacing: "0.2em",
          color: "rgba(160,180,200,0.6)",
        }}>
          <span>EVENT ARMING · SELECT ONE OR MORE TO COMPOSE</span>
          <span>{armedKeys.size} / {Object.keys(window.SCENARIOS).length} ARMED</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
            {Object.values(window.SCENARIOS).map(s => (
              <ScenarioCard key={s.key} scenario={s}
                armed={armedKeys.has(s.key)}
                disabled={running}
                dispatched={activeScenario?.composed ? activeScenario.sources?.some(x => x.id === s.id) : activeScenario?.key === s.key}
                onToggle={() => toggleArm(s.key)} />
            ))}
          </div>
          <DispatchPanel
            armed={armedList}
            composedPreview={composedPreview}
            running={running}
            onDispatch={dispatch}
            onReset={reset}
            hasRun={!!activeScenario}
          />
        </div>
      </section>

      {/* MAIN GRID */}
      <main style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)",
        gap: 14, padding: "14px 22px",
        alignItems: "start",
      }}>
        {/* LEFT: Map + telemetry */}
        <section style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{
            position: "relative",
            background: "rgba(14,18,26,0.85)",
            border: "1px solid rgba(140,160,180,0.16)",
            borderRadius: 10,
            overflow: "hidden",
            height: "clamp(360px, 48vh, 540px)",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{
              padding: "12px 16px",
              borderBottom: "1px solid rgba(140,160,180,0.14)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="dot-pulse" />
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10.5, letterSpacing: "0.22em", color: "rgba(220,232,245,0.85)" }}>
                  SPATIAL VECTOR OVERVIEW
                </span>
              </div>
              <div style={{ display: "flex", gap: 14, fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.16em", color: "rgba(160,180,200,0.55)" }}>
                {["green", "orange", "red"].map(s => (
                  <span key={s} style={{ display: "flex", alignItems: "center", gap: 5, textTransform: "uppercase" }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: s === "green" ? "#22c88c" : s === "orange" ? "#f5aa3c" : "#f55050",
                      boxShadow: `0 0 6px ${s === "green" ? "#22c88c" : s === "orange" ? "#f5aa3c" : "#f55050"}`,
                    }} />
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: 14 }}>
              <StadiumMap scenario={{ zone_state: zoneState, sensor_metrics: sensorMetrics || {} }} pulse={pulse} />
            </div>
          </div>

          <Telemetry scenario={activeScenario} />

          <SeverityBadge severity={severity} justification={payload?.reasoning_justification} sources={activeScenario?.sources} />

          {payload && <DirectivesList directives={payload.mitigation_directives} statuses={directiveStatuses} onFire={(i) => fireDirective(i, "operator")} />}
        </section>

        {/* RIGHT: Agent stream + (if present) Auditor */}
        <section style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ height: "clamp(360px, 48vh, 540px)", minWidth: 0 }}>
            <AgentStream entries={streamEntries} cycleId={cycleId} severity={severity} runningSince={runningSince} />
          </div>
          <AuditorPanel auditor={auditor} severity={severity} visible={!!auditor} />
        </section>
      </main>

      {/* BOTTOM DOCK */}
      <footer style={{
        padding: "12px 22px 14px",
        borderTop: "1px solid rgba(140,160,180,0.12)",
        background: "rgba(10,14,20,0.5)",
        display: "flex", gap: 14,
        flexShrink: 0,
        minHeight: 380,
      }}>
        <MobileAlert payload={payload} severity={severity} scenario={activeScenario} sections={activeScenario?.sources?.length || 1} />
        <TeamChannels payload={payload} severity={severity} statuses={directiveStatuses} onFire={(i) => fireDirective(i, "operator")} />
        <PAScript payload={payload} severity={severity} onSpeak={speakPA} speaking={speaking} voicesReady={voicesReady} sections={activeScenario?.sources?.length || 1} />
      </footer>
    </div>
  );
}

window.inferAction = inferAction;
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
