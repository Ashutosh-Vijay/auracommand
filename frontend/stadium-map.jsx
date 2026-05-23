// Stylized top-down vector map of M. Chinnaswamy Stadium.
// Original geometry — oval pitch, concentric concourse ring,
// 5 numbered gates, and the MG Road Metro corridor at NE.

const ZONE_COLORS = {
  idle:   { fill: "rgba(120,135,150,0.05)", stroke: "rgba(160,180,200,0.35)", glow: "transparent", label: "rgba(200,215,230,0.55)" },
  green:  { fill: "rgba(34,200,140,0.10)",  stroke: "rgba(34,200,140,0.70)",  glow: "rgba(34,200,140,0.35)",  label: "rgba(140,255,210,0.95)" },
  orange: { fill: "rgba(245,170,60,0.14)",  stroke: "rgba(245,170,60,0.80)",  glow: "rgba(245,170,60,0.45)",  label: "rgba(255,210,140,0.95)" },
  red:    { fill: "rgba(245,80,80,0.18)",   stroke: "rgba(245,80,80,0.90)",   glow: "rgba(245,80,80,0.65)",   label: "rgba(255,180,180,1)" },
};

function ZonePath({ d, state, pulse }) {
  const c = ZONE_COLORS[state] || ZONE_COLORS.idle;
  return (
    <path
      d={d}
      fill={c.fill}
      stroke={c.stroke}
      strokeWidth="1.2"
      style={{
        filter: c.glow !== "transparent" ? `drop-shadow(0 0 10px ${c.glow})` : "none",
        transition: "fill 600ms ease, stroke 600ms ease, filter 600ms ease",
        animation: state === "red" && pulse ? "zonePulse 1.4s ease-in-out infinite" : "none",
      }}
    />
  );
}

function Gate({ cx, cy, label, state, ppm, pulse }) {
  const c = ZONE_COLORS[state] || ZONE_COLORS.idle;
  return (
    <g style={{ transition: "all 600ms ease" }}>
      <circle cx={cx} cy={cy} r="13"
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth="1.4"
        style={{
          filter: c.glow !== "transparent" ? `drop-shadow(0 0 8px ${c.glow})` : "none",
          animation: state === "red" && pulse ? "zonePulse 1.4s ease-in-out infinite" : "none",
        }}
      />
      <text x={cx} y={cy + 3.5} textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="9.5" fontWeight="600"
        fill={c.label}>{label}</text>
      {ppm != null && (
        <text x={cx} y={cy + 26} textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="7.5" letterSpacing="0.05em"
          fill="rgba(180,195,215,0.65)">
          {ppm} ppm
        </text>
      )}
    </g>
  );
}

function StadiumMap({ scenario, pulse }) {
  const zs = scenario?.zone_state || {};
  const sm = scenario?.sensor_metrics || {};

  // Geometry — viewBox 600x420.
  // Outer plot, concentric concourse ring, oval pitch.

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg viewBox="0 0 600 420" style={{ width: "100%", height: "100%", display: "block" }}>
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(140,160,180,0.05)" strokeWidth="0.6" />
          </pattern>
          <radialGradient id="pitchGrad" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(56,88,72,0.55)" />
            <stop offset="100%" stopColor="rgba(28,44,40,0.55)" />
          </radialGradient>
          <linearGradient id="metroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(80,110,140,0.18)" />
            <stop offset="100%" stopColor="rgba(80,110,140,0.04)" />
          </linearGradient>
        </defs>

        {/* grid backdrop */}
        <rect x="0" y="0" width="600" height="420" fill="url(#grid)" />

        {/* compass + scale */}
        <g transform="translate(28, 28)" fontFamily="JetBrains Mono, monospace" fill="rgba(180,195,215,0.45)" fontSize="8">
          <text x="0" y="0" letterSpacing="0.18em">N</text>
          <line x1="0" y1="4" x2="0" y2="20" stroke="rgba(180,195,215,0.35)" strokeWidth="0.6" />
          <line x1="-3" y1="11" x2="3" y2="11" stroke="rgba(180,195,215,0.35)" strokeWidth="0.6" />
        </g>
        <g transform="translate(540, 392)" fontFamily="JetBrains Mono, monospace" fill="rgba(180,195,215,0.45)" fontSize="7">
          <line x1="0" y1="0" x2="40" y2="0" stroke="rgba(180,195,215,0.4)" strokeWidth="0.6" />
          <line x1="0" y1="-3" x2="0" y2="3" stroke="rgba(180,195,215,0.4)" strokeWidth="0.6" />
          <line x1="40" y1="-3" x2="40" y2="3" stroke="rgba(180,195,215,0.4)" strokeWidth="0.6" />
          <text x="20" y="-6" textAnchor="middle" letterSpacing="0.1em">50 M</text>
        </g>

        {/* concourse ring — outer */}
        <ellipse cx="300" cy="210" rx="240" ry="170"
          fill="rgba(40,52,68,0.35)"
          stroke="rgba(140,160,180,0.20)"
          strokeWidth="1" />

        {/* concourse quadrants (split into N/E/S/W via arcs) */}
        {/* North quadrant */}
        <ZonePath state={zs.concourse_n || "idle"} pulse={pulse}
          d="M 78 165 A 240 170 0 0 1 522 165 L 470 188 A 195 130 0 0 0 130 188 Z" />
        {/* South quadrant */}
        <ZonePath state={zs.concourse_s || "idle"} pulse={pulse}
          d="M 78 255 A 240 170 0 0 0 522 255 L 470 232 A 195 130 0 0 1 130 232 Z" />
        {/* East quadrant */}
        <ZonePath state={zs.concourse_e || "idle"} pulse={pulse}
          d="M 522 165 A 240 170 0 0 1 522 255 L 470 232 A 195 130 0 0 0 470 188 Z" />
        {/* West quadrant */}
        <ZonePath state={zs.concourse_w || "idle"} pulse={pulse}
          d="M 78 165 A 240 170 0 0 0 78 255 L 130 232 A 195 130 0 0 1 130 188 Z" />

        {/* inner concourse ring (separator) */}
        <ellipse cx="300" cy="210" rx="195" ry="130"
          fill="none"
          stroke="rgba(140,160,180,0.22)"
          strokeWidth="0.8" strokeDasharray="4 4" />

        {/* pitch */}
        <ellipse cx="300" cy="210" rx="145" ry="92" fill="url(#pitchGrad)" stroke="rgba(180,210,190,0.35)" strokeWidth="1" />
        <ellipse cx="300" cy="210" rx="22" ry="22" fill="none" stroke="rgba(180,210,190,0.40)" strokeWidth="0.8" />
        <line x1="300" y1="118" x2="300" y2="302" stroke="rgba(180,210,190,0.18)" strokeWidth="0.6" />
        <text x="300" y="214" textAnchor="middle"
          fontFamily="JetBrains Mono, monospace" fontSize="7.5"
          letterSpacing="0.3em" fill="rgba(180,210,190,0.55)">PITCH</text>

        {/* Concourse-B density readout (south west) */}
        <g transform="translate(120, 280)" fontFamily="JetBrains Mono, monospace" fill="rgba(180,195,215,0.55)" fontSize="7">
          <text x="0" y="0" letterSpacing="0.12em">CONCOURSE B</text>
          <text x="0" y="12" fontSize="11" fill="rgba(220,232,245,0.85)">
            {(sm.concourse_b_density_index ?? 0).toFixed(2)}
            <tspan fontSize="7" fill="rgba(180,195,215,0.5)" dx="4">density</tspan>
          </text>
        </g>

        {/* MG Road metro corridor — NE */}
        <g>
          <path
            d="M 522 110 Q 560 70 580 30 L 595 30 L 595 60 Q 580 95 545 130 Z"
            fill="url(#metroGrad)"
            stroke={ZONE_COLORS[zs.metro || "idle"].stroke}
            strokeWidth="1.2"
            style={{
              filter: zs.metro && zs.metro !== "idle" && zs.metro !== "green"
                ? `drop-shadow(0 0 10px ${ZONE_COLORS[zs.metro].glow})`
                : "none",
              transition: "all 600ms ease",
            }}
          />
          <text x="555" y="22" textAnchor="middle"
            fontFamily="JetBrains Mono, monospace" fontSize="7"
            letterSpacing="0.15em" fill="rgba(200,215,230,0.75)">MG RD METRO</text>
          <text x="555" y="55" textAnchor="middle"
            fontFamily="JetBrains Mono, monospace" fontSize="9" fontWeight="600"
            fill="rgba(220,232,245,0.9)">
            {sm.metro_station_queue_length_meters ?? 0}m
          </text>
          <text x="555" y="68" textAnchor="middle"
            fontFamily="JetBrains Mono, monospace" fontSize="6"
            letterSpacing="0.1em" fill="rgba(180,195,215,0.5)">QUEUE</text>
        </g>

        {/* connector line from concourse to metro */}
        <path d="M 478 145 Q 510 130 528 118" fill="none"
          stroke="rgba(160,180,200,0.35)" strokeWidth="0.8" strokeDasharray="3 3" />

        {/* Gates — 5 around the perimeter */}
        <Gate cx={78}  cy={210} label="01" state={zs.g1} ppm={sm.gate_01_turnstile_rate_per_min} pulse={pulse} />
        <Gate cx={195} cy={70}  label="02" state={zs.g2} pulse={pulse} />
        <Gate cx={405} cy={70}  label="03" state={zs.g3} ppm={sm.gate_03_turnstile_rate_per_min} pulse={pulse} />
        <Gate cx={522} cy={335} label="04" state={zs.g4} pulse={pulse} />
        <Gate cx={195} cy={350} label="05" state={zs.g5} ppm={sm.gate_05_turnstile_rate_per_min} pulse={pulse} />

        {/* Stadium label */}
        <text x="300" y="400" textAnchor="middle"
          fontFamily="JetBrains Mono, monospace" fontSize="7.5"
          letterSpacing="0.3em" fill="rgba(180,195,215,0.5)">
          M. CHINNASWAMY STADIUM · BENGALURU · 12.9788°N 77.5996°E
        </text>
      </svg>
    </div>
  );
}

window.StadiumMap = StadiumMap;
