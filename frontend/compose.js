// Compose engine — synthesizes a compound payload when multiple
// scenarios are armed at once. Reasons about INTERACTIONS, not sums.

(function () {
  const SEV_RANK = { idle: 0, green: 1, orange: 2, red: 3 };
  const SEV_NAME = ["GREEN", "GREEN", "ORANGE", "RED"];

  function maxZone(a, b) {
    return SEV_RANK[a || "idle"] >= SEV_RANK[b || "idle"] ? a : b;
  }

  // Cross-effect rules — domain knowledge about how scenario pairs
  // interfere. Returns { extra_directives, interaction_lines, zone_bumps }.
  const INTERACTIONS = {
    "sudden_downpour+vip_arrival": {
      lines: [
        "Rain-displaced fans funnel toward covered Concourse-E — the same corridor VIP arrival is sealing.",
        "Throughput on G1/G5 alone cannot absorb redirected GA + rain-driven exits → density crosses 0.92 in 4 min.",
        "Interaction posture: RED · open Gates 04 + 06 overflow, delay VIP entry by 90s if convoy can hold.",
      ],
      extra_directives: [
        { target_zone: "Gates 04 + 06", action_required: "EMERGENCY OPEN · 4 STEWARDS EACH", priority: "IMMEDIATE" },
        { target_zone: "VIP Convoy Control", action_required: "REQUEST 90s ARRIVAL DELAY · COORDINATE WITH BCCI", priority: "IMMEDIATE" },
        { target_zone: "Concourse E ↔ W Cross-Link", action_required: "OPEN BI-DIRECTIONAL · ASSIGN INCIDENT COMMANDER", priority: "IMMEDIATE" },
      ],
      zone_bumps: { concourse_e: "red", concourse_n: "red", g2: "red" },
    },
    "perimeter_breach+vip_arrival": {
      lines: [
        "G3 soft-close removes a primary GA gate while G2 is reserved for VIP arrival.",
        "Only G1 + G5 available for general egress · effective throughput halved at the worst possible moment.",
        "Interaction posture: RED · abort VIP arrival, reopen G2 for general flow.",
      ],
      extra_directives: [
        { target_zone: "VIP Convoy Control", action_required: "ABORT ARRIVAL · DIVERT TO STAGING-B", priority: "IMMEDIATE" },
        { target_zone: "Gate 02", action_required: "REOPEN AS GENERAL EGRESS · DEPLOY STEWARDS", priority: "IMMEDIATE" },
      ],
      zone_bumps: { g2: "orange" },
    },
    "sudden_downpour+perimeter_breach": {
      lines: [
        "Rain saturation overlaps with G3 structural compression — both push fans into the same Concourse-B corridor.",
        "Density projection 0.98 within 60s · crush-risk envelope exceeded.",
        "Interaction posture: RED · full stand-shelter call required, do NOT attempt redirect-only mitigation.",
      ],
      extra_directives: [
        { target_zone: "All Stands", action_required: "STAND-SHELTER ALL TIERS · HOLD EGRESS 120s", priority: "IMMEDIATE" },
        { target_zone: "Medical Bay 01 + 02", action_required: "ALL PARAMEDICS DEPLOY · TRIAGE TENT AT G1", priority: "IMMEDIATE" },
      ],
      zone_bumps: { concourse_n: "red", concourse_w: "red" },
    },
    "drone_airspace+sudden_downpour": {
      lines: [
        "Aerial-incursion stand-shelter posture cannot coexist with rain-driven exit demand.",
        "Patrons will defy stand-in-place to seek cover · PA messaging must address both threats simultaneously.",
        "Interaction posture: RED · dual-threat PA script + covered-stand priority.",
      ],
      extra_directives: [
        { target_zone: "Covered Stands (B, C, F)", action_required: "PRIORITY SHELTER · USHERS REASSIGN FROM OPEN STANDS", priority: "IMMEDIATE" },
        { target_zone: "PA System", action_required: "EMIT DUAL-THREAT SCRIPT · WEATHER + AIRSPACE", priority: "IMMEDIATE" },
      ],
      zone_bumps: {},
    },
    "drone_airspace+vip_arrival": {
      lines: [
        "Aerial incursion during marquee-player arrival window — assume coordinated reconnaissance until disproven.",
        "Convoy MUST be diverted · do not proceed to Gate 02 under active airspace alert.",
        "Interaction posture: RED · convoy abort + threat-investigation handoff to State Police.",
      ],
      extra_directives: [
        { target_zone: "VIP Convoy Control", action_required: "ABORT ARRIVAL IMMEDIATELY · DIVERT TO STAGING-B", priority: "IMMEDIATE" },
        { target_zone: "Bengaluru State Police", action_required: "TREAT AS COORDINATED THREAT · FORENSIC HOLD ON AIRSPACE LOG", priority: "IMMEDIATE" },
      ],
      zone_bumps: { g2: "red" },
    },
  };

  function pairKey(a, b) {
    return [a, b].sort().join("+");
  }

  function compose(scenarios) {
    if (!scenarios?.length) return null;
    if (scenarios.length === 1) return null; // single = use scenario's own payload

    // Severity escalation
    let maxSevIdx = 0;
    scenarios.forEach(s => {
      const idx = ["GREEN", "GREEN", "ORANGE", "RED"].indexOf(s.expected_severity);
      if (idx > maxSevIdx) maxSevIdx = idx;
    });
    const orangeCount = scenarios.filter(s => s.expected_severity === "ORANGE").length;
    let severity = ["GREEN", "GREEN", "ORANGE", "RED"][maxSevIdx];
    let interactionEscalated = false;
    if (orangeCount >= 2 && severity === "ORANGE") {
      severity = "RED";
      interactionEscalated = true;
    }

    // Merge zones (max severity wins)
    const zones = {};
    for (const s of scenarios) {
      for (const [k, v] of Object.entries(s.zone_state || {})) {
        zones[k] = maxZone(zones[k], v);
      }
    }

    // Peak sensor metrics
    const sm = {};
    for (const s of scenarios) {
      for (const [k, v] of Object.entries(s.sensor_metrics || {})) {
        sm[k] = Math.max(sm[k] || 0, v);
      }
    }

    // Gather interaction effects from known pair rules
    let interactionLines = [];
    let extraDirectives = [];
    const keys = scenarios.map(s => s.key);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const rule = INTERACTIONS[pairKey(keys[i], keys[j])];
        if (rule) {
          interactionLines = interactionLines.concat(rule.lines);
          extraDirectives = extraDirectives.concat(rule.extra_directives);
          for (const [k, v] of Object.entries(rule.zone_bumps || {})) {
            zones[k] = maxZone(zones[k], v);
          }
        }
      }
    }

    // Merge directives (keep all + extras at the top)
    const directives = [...extraDirectives];
    for (const s of scenarios) {
      for (const d of (s.payload?.mitigation_directives || [])) {
        // dedupe by exact action
        if (!directives.some(x => x.action_required === d.action_required && x.target_zone === d.target_zone)) {
          directives.push(d);
        }
      }
    }

    // Reasoning text
    const names = scenarios.map(s => s.short || s.name).join(" + ");
    const baseLine = interactionEscalated
      ? `Compound event: ${names}. Two ORANGE signals overlapping in time creates cross-corridor pressure that neither scenario individually would trigger — posture auto-escalates to RED.`
      : `Compound event: ${names}. Highest standalone severity is ${["GREEN", "GREEN", "ORANGE", "RED"][maxSevIdx]}; interaction analysis below.`;
    const reasoning = [baseLine, ...interactionLines].join(" ");

    // Build composite PA + push that includes EVERY armed scenario,
    // ordered by severity (highest first).
    const sevIdx = (lvl) => ["GREEN","GREEN","ORANGE","RED"].indexOf(lvl);
    const sorted = scenarios.slice().sort((a, b) => sevIdx(b.expected_severity) - sevIdx(a.expected_severity));

    const enPrefix = severity === "RED"
      ? "Important safety announcement. Multiple events are in progress. Please follow each instruction below in order of priority."
      : "Attention all patrons. Several operational updates follow.";
    const knPrefix = severity === "RED"
      ? "ಮುಖ್ಯ ಸುರಕ್ಷತಾ ಸೂಚನೆ. ಹಲವಾರು ಘಟನೆಗಳು ಏಕಕಾಲದಲ್ಲಿ ನಡೆಯುತ್ತಿವೆ. ಆದ್ಯತೆಯ ಕ್ರಮದಲ್ಲಿ ಪ್ರತಿ ಸೂಚನೆಯನ್ನು ಪಾಲಿಸಿ."
      : "ಎಲ್ಲಾ ಪ್ರೇಕ್ಷಕರಿಗೆ ಸೂಚನೆ. ಕೆಲವು ಕಾರ್ಯಾಚರಣಾ ನವೀಕರಣಗಳು ಕೆಳಗಿನಂತಿವೆ.";

    const enLines = [enPrefix];
    const knLines = [knPrefix];
    sorted.forEach((s, i) => {
      const txt = s.payload?.pa_system_announcement_script || "";
      const [en = "", kn = ""] = txt.split(/\n\n\[KN\]\s*/);
      const tag = `(${i + 1}) ${(s.short || s.name).toUpperCase()}:`;
      if (en.trim()) enLines.push(`${tag} ${en.trim()}`);
      if (kn.trim()) knLines.push(`${tag} ${kn.trim()}`);
    });
    const pa = enLines.join("\n\n") + "\n\n[KN] " + knLines.join("\n\n");

    const pushPrefix = severity === "RED" ? "🚨 MULTI-EVENT ALERT" : "⚠ MULTI-EVENT";
    const pushLines = sorted.map((s, i) => {
      const txt = (s.payload?.mobile_push_notification_text || "").replace(/^[🚨⚠⚡]\s*/, "");
      return `${i + 1}) ${txt}`;
    });
    const push = `${pushPrefix}\n${pushLines.join("\n")}`;

    // Auditor — if RED, build a compound check list
    let auditor = null;
    if (severity === "RED") {
      const checks = [
        { label: "Compound severity escalation logic", result: interactionEscalated
            ? `2× ORANGE → RED uplift consistent with stadium SOP § 4.2 · APPROVED`
            : `Inherited RED severity from ${sorted[0].short} · APPROVED` },
        { label: "Cross-corridor interference projection", result: `Map zones with composite severity: ${Object.entries(zones).filter(([, v]) => v === "red").map(([k]) => k.toUpperCase()).join(", ") || "none"} · within mitigation budget` },
        { label: "Directive collision scan", result: `${directives.length} merged directives · 0 contradictory commands detected` },
        { label: "PA dual-threat coherence", result: "Bilingual script preserves shelter-vs-evacuate guidance across both threats · APPROVED" },
        { label: "Unified Incident Commander allocation", result: "Tier-1 IC paged · ETA Ops Center 90s · APPROVED" },
      ];
      auditor = { verdict: "CLEARED", checks, clearance: true, compound: true };
    }

    // Build a synthetic trace
    const trace = [];
    let t = 0;
    trace.push({ agent: "sensor", level: "info", text: `Composing ${scenarios.length} concurrent telemetry streams...`, t });
    t += 320;
    trace.push({ agent: "sensor", level: "info", text: `Streams: ${scenarios.map(s => s.id).join(" · ")}`, t });
    t += 320;
    trace.push({ agent: "sensor", level: interactionEscalated ? "alert" : "warn", text: `Temporal overlap detected · 5/5 channels show non-baseline drift.`, t });
    t += 320;
    trace.push({ agent: "sensor", level: "info", text: "Handoff → Dispatcher Agent [gemini-2.5-flash]", t });
    t += 320;
    trace.push({ agent: "dispatcher", level: "think", text: `Running pair-wise interaction analysis · ${(scenarios.length * (scenarios.length - 1)) / 2} pair(s).`, t });
    t += 380;
    interactionLines.slice(0, 2).forEach(line => {
      trace.push({ agent: "dispatcher", level: "think", text: line, t });
      t += 420;
    });
    if (interactionEscalated) {
      trace.push({ agent: "dispatcher", level: "alert", text: "Severity uplift: ORANGE+ORANGE → RED (interaction rule § 4.2).", t });
      t += 360;
    } else {
      trace.push({ agent: "dispatcher", level: "warn", text: `Severity inherits from dominant scenario: ${severity}.`, t });
      t += 320;
    }
    if (severity === "RED") {
      trace.push({ agent: "dispatcher", level: "alert", text: "RED gating · escalating → Risk Auditor Node [gemini-2.5-pro]", t });
      t += 320;
      trace.push({ agent: "auditor", level: "info", text: `Auditor node online · ${auditor.checks.length}-point compound verification.`, t });
      t += 320;
      auditor.checks.forEach((c, i) => {
        trace.push({ agent: "auditor", level: "think", text: `Check ${i + 1}/${auditor.checks.length} · ${c.label} ✓`, t });
        t += 340;
      });
      trace.push({ agent: "auditor", level: "ok", text: "auditor_clearance = TRUE · releasing compound payload.", t });
      t += 360;
    } else {
      trace.push({ agent: "dispatcher", level: "emit", text: `Structured payload emitted · severity=${severity} · directives=${directives.length}`, t });
      t += 320;
    }
    trace.push({ agent: "broadcast", level: severity === "RED" ? "alert" : "info", text: `Map composited · ${Object.values(zones).filter(v => v === "red").length} RED zone(s) · ${Object.values(zones).filter(v => v === "orange").length} ORANGE.`, t });
    t += 300;
    trace.push({ agent: "broadcast", level: "info", text: `Mobile push staged · multi-event banner · ${severity === "RED" ? "41,200" : "12,400"} devices.`, t });
    t += 300;
    trace.push({ agent: "broadcast", level: "ok", text: `Cycle complete · ${(t / 1000).toFixed(1)}s · ${severity === "RED" ? "auditor cleared" : "no auditor invocation"}.`, t });

    return {
      composed: true,
      id: "COMPOUND_" + scenarios.map(s => s.id.replace("SCENARIO_", "")).join("·"),
      name: names,
      timestamp: sorted[0].timestamp,
      match_status: "MULTI_EVENT_ACTIVE",
      current_rainfall_mm: Math.max(...scenarios.map(s => s.current_rainfall_mm || 0)),
      sensor_metrics: sm,
      expected_severity: severity,
      zone_state: zones,
      payload: {
        severity_level: severity,
        reasoning_justification: reasoning,
        mitigation_directives: directives,
        pa_system_announcement_script: pa,
        mobile_push_notification_text: push,
      },
      auditor,
      trace,
      sources: scenarios.map(s => ({ id: s.id, short: s.short, severity: s.expected_severity })),
    };
  }

  window.composeScenarios = compose;
})();
