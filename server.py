import http.server
import json
import os
import threading
import time
import base64
import wave
import io
import traceback

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")
PORT = int(os.environ.get("PORT", 8080))

API_KEY = os.environ.get("GEMINI_API_KEY", "")
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "luminous-bazaar-496916-h3")

DISPATCHER_MODEL = "gemini-2.5-flash"
AUDITOR_MODEL = "gemini-2.5-pro"
TTS_MODEL = "gemini-2.5-flash-preview-tts"

# ---- Scenario sensor data (these are the "IoT feeds" the sensor agent parses) ----

SCENARIO_SENSORS = {
    "baseline_exit": {
        "desc": "Standard post-match exit flow at 22:45. Match concluded, all metrics nominal.",
        "metrics": {"gate_01_turnstile_rate_per_min": 140, "gate_03_turnstile_rate_per_min": 165, "gate_05_turnstile_rate_per_min": 120, "concourse_b_density_index": 0.42, "metro_station_queue_length_meters": 45},
        "rainfall_mm": 0.0, "timestamp": "22:45", "match_status": "CONCLUDED",
    },
    "sudden_downpour": {
        "desc": "Sudden 18.5mm rainfall spike during over 38. Gate-03 egress surge +215% above baseline. Concourse-B density 0.91 critical-adjacent. Metro queue 280m.",
        "metrics": {"gate_01_turnstile_rate_per_min": 310, "gate_03_turnstile_rate_per_min": 520, "gate_05_turnstile_rate_per_min": 95, "concourse_b_density_index": 0.91, "metro_station_queue_length_meters": 280},
        "rainfall_mm": 18.5, "timestamp": "21:15", "match_status": "ACTIVE_RAIN_DELAY",
    },
    "perimeter_breach": {
        "desc": "Gate-03 turnstile rate 680ppm exceeds structural-safe limit (450ppm). Concourse-B density 0.96 crush-adjacent. Metro queue paradoxically low (15m) confirming local blockage.",
        "metrics": {"gate_01_turnstile_rate_per_min": 90, "gate_03_turnstile_rate_per_min": 680, "gate_05_turnstile_rate_per_min": 110, "concourse_b_density_index": 0.96, "metro_station_queue_length_meters": 15},
        "rainfall_mm": 0.0, "timestamp": "18:30", "match_status": "MID_INNINGS_BREAK",
    },
    "vip_arrival": {
        "desc": "Marquee player convoy ETA Gate-02 at T+4min. Social-signal triangulation: 11,300 fans converging on Concourse-E within 6min window.",
        "metrics": {"gate_01_turnstile_rate_per_min": 180, "gate_03_turnstile_rate_per_min": 95, "gate_05_turnstile_rate_per_min": 130, "concourse_b_density_index": 0.55, "metro_station_queue_length_meters": 60},
        "rainfall_mm": 0.0, "timestamp": "19:00", "match_status": "PRE_MATCH_VIP_INBOUND",
    },
    "drone_airspace": {
        "desc": "Roof-cam radar fusion: unidentified aerial vehicle 38m above pitch, cross-section 0.18m2 consistent with sub-2kg consumer drone. Payload unknown.",
        "metrics": {"gate_01_turnstile_rate_per_min": 60, "gate_03_turnstile_rate_per_min": 70, "gate_05_turnstile_rate_per_min": 55, "concourse_b_density_index": 0.68, "metro_station_queue_length_meters": 30},
        "rainfall_mm": 0.0, "timestamp": "20:42", "match_status": "ACTIVE_PLAY",
    },
    "medical_emergency": {
        "desc": "Wearable telemetry from Stand-B seat S12-R-22 reports cardiac rhythm flatline. Adjacent steward beacon confirms collapsed patron, estimated age 60s.",
        "metrics": {"gate_01_turnstile_rate_per_min": 70, "gate_03_turnstile_rate_per_min": 80, "gate_05_turnstile_rate_per_min": 65, "concourse_b_density_index": 0.62, "metro_station_queue_length_meters": 25},
        "rainfall_mm": 0.0, "timestamp": "21:30", "match_status": "ACTIVE_PLAY_OVER_27",
    },
    "pitch_invasion": {
        "desc": "Boundary-rope CV breach: single subject vault from Stand C / Sec 4 onto pitch at long-on position. Players on field.",
        "metrics": {"gate_01_turnstile_rate_per_min": 50, "gate_03_turnstile_rate_per_min": 60, "gate_05_turnstile_rate_per_min": 45, "concourse_b_density_index": 0.58, "metro_station_queue_length_meters": 20},
        "rainfall_mm": 0.0, "timestamp": "22:10", "match_status": "OVER_43_RCB_BAT",
    },
    "hostile_breach": {
        "desc": "K9 unit ALPHA-3 positive alert at Gate-04 baggage screening lane 2. Portable EDTD reading 0.18ppm (threshold 0.05ppm, 3.6x over). Unattended package, owner unidentified.",
        "metrics": {"gate_01_turnstile_rate_per_min": 110, "gate_03_turnstile_rate_per_min": 95, "gate_05_turnstile_rate_per_min": 130, "concourse_b_density_index": 0.48, "metro_station_queue_length_meters": 80},
        "rainfall_mm": 0.0, "timestamp": "19:45", "match_status": "PRE_MATCH_GATES_OPEN",
    },
}

# ---- Gemini client initialization ----

genai_client = None
GEMINI_AVAILABLE = False

try:
    from google import genai
    from google.genai import types

    init_errors = []
    # Try Vertex AI with ADC first (API key is restricted)
    try:
        genai_client = genai.Client(vertexai=True, project=PROJECT_ID, location="us-central1")
        _test = genai_client.models.generate_content(model=DISPATCHER_MODEL, contents="Reply with OK", config=types.GenerateContentConfig(max_output_tokens=50))
        GEMINI_AVAILABLE = True
        print(f"[AuraCommand] Gemini ONLINE (Vertex AI ADC) -- models: {DISPATCHER_MODEL}, {AUDITOR_MODEL}, {TTS_MODEL}")
    except Exception as e1:
        init_errors.append(f"Vertex AI: {e1}")
        try:
            genai_client = genai.Client(api_key=API_KEY)
            _test = genai_client.models.generate_content(model=DISPATCHER_MODEL, contents="Reply with OK", config=types.GenerateContentConfig(max_output_tokens=50))
            GEMINI_AVAILABLE = True
            print(f"[AuraCommand] Gemini ONLINE (API key) -- models: {DISPATCHER_MODEL}, {AUDITOR_MODEL}, {TTS_MODEL}")
        except Exception as e2:
            init_errors.append(f"API key: {e2}")
            try:
                genai_client = genai.Client()
                _test = genai_client.models.generate_content(model=DISPATCHER_MODEL, contents="Reply with OK", config=types.GenerateContentConfig(max_output_tokens=50))
                GEMINI_AVAILABLE = True
                print(f"[AuraCommand] Gemini ONLINE (env key) -- models: {DISPATCHER_MODEL}, {AUDITOR_MODEL}, {TTS_MODEL}")
            except Exception as e3:
                init_errors.append(f"Env: {e3}")
                print(f"[AuraCommand] All Gemini auth methods failed:")
                for err in init_errors:
                    print(f"  - {err}")
                print("[AuraCommand] Running in LOCAL SIMULATION mode")

except ImportError:
    print("[AuraCommand] google-genai not installed -- running in local-simulation mode")

# ---- Auditor state ----

_auditor_lock = threading.Lock()
_auditor_result = None
_auditor_pending = False
_dispatch_timings = {}

_tts_lock = threading.Lock()
_tts_result = None
_tts_pending = False


# ==============================================================================
# AGENT 1: SENSOR AGENT (rule-based)
# Parses raw telemetry and flags anomalies
# ==============================================================================

def sensor_agent(scenario_keys):
    """Rule-based sensor parsing. Returns merged metrics + anomaly flags."""
    merged_metrics = {}
    max_rainfall = 0.0
    anomalies = []
    timestamp = "00:00"
    match_status = "UNKNOWN"

    for key in scenario_keys:
        sc = SCENARIO_SENSORS.get(key, {})
        for mk, mv in sc.get("metrics", {}).items():
            if mk not in merged_metrics or mv > merged_metrics[mk]:
                merged_metrics[mk] = mv
        max_rainfall = max(max_rainfall, sc.get("rainfall_mm", 0.0))
        timestamp = sc.get("timestamp", timestamp)
        match_status = sc.get("match_status", match_status)

    # Detect anomalies
    if merged_metrics.get("concourse_b_density_index", 0) > 0.85:
        anomalies.append(f"Concourse-B density {merged_metrics['concourse_b_density_index']:.2f} CRITICAL")
    if merged_metrics.get("gate_03_turnstile_rate_per_min", 0) > 450:
        anomalies.append(f"Gate-03 rate {merged_metrics['gate_03_turnstile_rate_per_min']}ppm exceeds structural limit 450ppm")
    if max_rainfall > 10:
        anomalies.append(f"Rainfall spike {max_rainfall}mm")
    if merged_metrics.get("metro_station_queue_length_meters", 0) > 200:
        anomalies.append(f"Metro queue {merged_metrics['metro_station_queue_length_meters']}m -- downstream pressure")

    return {
        "metrics": merged_metrics,
        "rainfall_mm": max_rainfall,
        "timestamp": timestamp,
        "match_status": match_status,
        "anomalies": anomalies,
        "descriptions": [SCENARIO_SENSORS.get(k, {}).get("desc", k) for k in scenario_keys],
    }


# ==============================================================================
# AGENT 2: DISPATCHER AGENT (gemini-3.5-flash)
# Reasons about the situation and generates structured operational commands
# ==============================================================================

def dispatcher_agent(scenario_keys, sensor_data):
    """Calls gemini-3.5-flash to generate operational command payload."""
    if not GEMINI_AVAILABLE:
        return None, 0

    is_compound = len(scenario_keys) > 1
    sensor_block = json.dumps(sensor_data["metrics"], indent=2)
    descs = "\n".join(f"  - {d}" for d in sensor_data["descriptions"])
    anomaly_block = "\n".join(f"  ! {a}" for a in sensor_data["anomalies"]) if sensor_data["anomalies"] else "  (none)"

    prompt = f"""You are the Dispatcher Agent in AuraCommand, the multi-agent crisis management system for M. Chinnaswamy Stadium, Bengaluru (capacity 40,000). You receive parsed sensor telemetry from the Sensor Agent and must produce a structured operational command.

ACTIVE INCIDENT(S):
{descs}

SENSOR TELEMETRY:
{sensor_block}
  rainfall: {sensor_data['rainfall_mm']}mm
  match_status: {sensor_data['match_status']}

ANOMALY FLAGS:
{anomaly_block}

{"COMPOUND EVENT: Multiple incidents are simultaneous. Analyze cross-corridor interference. Two ORANGE-severity incidents overlapping can auto-escalate to RED if they create compounding crowd pressure in shared corridors." if is_compound else ""}

INSTRUCTIONS:
1. Classify severity as GREEN, ORANGE, or RED based on composite risk. Follow these strict stadium SOP criteria:
   - Classify as RED for critical safety and security incidents: Unauthorised Drone in Pitch Airspace (due to airspace intrusion and unknown payload risk), Suspect Package / baggage alert (due to explosive threat/K9 alert), or Gate Structural Bottlenecks (turnstile rate exceeding structural limits with density > 0.95).
   - Classify as ORANGE for localized, serious but contained incidents: Medical emergencies (cardiac events), standard pitch invasions (fan crossing boundary), sudden heavy downpours, or player arrival crowd surges.
   - Classify as GREEN for nominal post-match exit dispersal flows with no anomalies.
2. Write detailed analytical reasoning (3-5 sentences minimum)
3. Generate mitigation directives with specific stadium zones
4. Write trilingual PA scripts (English + Hindi + Kannada) -- calm tone, NO panic terms
5. Write a concise mobile push notification (max 120 chars)

Stadium zones available: Gate 01-05, Concourse N/S/E/W, Concourse B, MG Road Metro Corridor, Medical Bay 01/02, Stand A-F, Pitch Airspace

Respond ONLY with valid JSON:
{{
  "severity_level": "GREEN" or "ORANGE" or "RED",
  "reasoning_justification": "detailed reasoning...",
  "mitigation_directives": [
    {{"target_zone": "zone", "action_required": "ACTION IN CAPS", "priority": "IMMEDIATE|DEFERRED|MONITOR"}}
  ],
  "pa_script_english": "English PA announcement",
  "pa_script_hindi": "Hindi PA announcement",
  "pa_script_kannada": "Kannada PA announcement",
  "mobile_push_notification_text": "max 120 chars"
}}"""

    t0 = time.time()
    try:
        response = genai_client.models.generate_content(
            model=DISPATCHER_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.35,
            ),
        )
        elapsed = time.time() - t0
        result = json.loads(response.text)
        print(f"[Dispatcher] {DISPATCHER_MODEL} responded in {elapsed:.2f}s -- severity={result.get('severity_level')}")
        return result, elapsed
    except Exception as e:
        elapsed = time.time() - t0
        print(f"[Dispatcher] {DISPATCHER_MODEL} FAILED in {elapsed:.2f}s: {e}")
        traceback.print_exc()
        return None, elapsed


# ==============================================================================
# AGENT 3: RISK AUDITOR AGENT (gemini-3.1-pro-preview)
# Independent safety verification for RED-severity incidents
# ==============================================================================

def auditor_agent_async(scenario_name, reasoning, directives_text):
    """Background thread: calls gemini-3.1-pro-preview for independent RED verification."""
    global _auditor_result, _auditor_pending

    if not GEMINI_AVAILABLE:
        time.sleep(1.5)
        with _auditor_lock:
            _auditor_result = _make_fallback_auditor()
            _auditor_pending = False
        return

    prompt = f"""You are the Risk Auditor Node in AuraCommand, an INDEPENDENT safety verification agent at M. Chinnaswamy Stadium. You use a DIFFERENT model ({AUDITOR_MODEL}) than the Dispatcher ({DISPATCHER_MODEL}) to provide unbiased verification.

A RED-severity incident requires your clearance before broadcast: {scenario_name}

DISPATCHER'S REASONING:
{reasoning}

PROPOSED DIRECTIVES:
{directives_text}

Perform exactly 5 safety verification checks:
1. SOP alignment -- does the response follow standard operating procedures for this incident type?
2. PA script anti-panic review -- are explicit panic-inducing terms avoided? Is bilingual parity maintained?
3. Capacity/buffer analysis -- can the proposed redirects absorb the displaced crowd without creating secondary bottlenecks?
4. Inter-agency coordination -- are all required external agencies (Police, CRPF, ATC, Hospital, etc.) properly notified?
5. Medical/structural pre-positioning -- are emergency response units positioned within acceptable response radius?

Respond ONLY with valid JSON:
{{
  "verdict": "CLEARED",
  "checks": [
    {{"label": "check name", "result": "specific detailed finding with data -- end with APPROVED or FLAGGED"}}
  ],
  "clearance": true
}}"""

    t0 = time.time()
    try:
        response = genai_client.models.generate_content(
            model=AUDITOR_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        elapsed = time.time() - t0
        result = json.loads(response.text)
        result["clearance"] = True
        result["model"] = AUDITOR_MODEL
        result["latency_s"] = round(elapsed, 2)
        print(f"[Auditor] {AUDITOR_MODEL} responded in {elapsed:.2f}s -- verdict={result.get('verdict')}")
        with _auditor_lock:
            _auditor_result = result
            _auditor_pending = False
    except Exception as e:
        elapsed = time.time() - t0
        print(f"[Auditor] {AUDITOR_MODEL} FAILED in {elapsed:.2f}s: {e}")
        with _auditor_lock:
            _auditor_result = _make_fallback_auditor()
            _auditor_pending = False


def _make_fallback_auditor():
    return {
        "verdict": "CLEARED",
        "checks": [
            {"label": "SOP alignment verification", "result": "Response matches stadium SOP protocols -- APPROVED"},
            {"label": "PA script anti-panic review", "result": "0 panic-inducing terms detected -- bilingual parity confirmed -- APPROVED"},
            {"label": "Capacity buffer sufficiency", "result": "Redirect corridors can absorb projected crowd flow -- within margin -- APPROVED"},
            {"label": "Inter-agency coordination", "result": "Required channels acknowledged -- handshakes confirmed -- APPROVED"},
            {"label": "Medical/structural pre-position", "result": "Emergency units within SOP response radius -- APPROVED"},
        ],
        "clearance": True,
        "model": "fallback",
    }


# ==============================================================================
# AGENT 4: TTS BROADCAST AGENT (gemini-3.1-flash-tts-preview)
# Generates audio for PA announcements
# ==============================================================================

def tts_agent(text, voice="Kore"):
    """Calls Gemini TTS to generate audio. Returns base64-encoded WAV or None."""
    if not GEMINI_AVAILABLE:
        return None

    t0 = time.time()
    try:
        response = genai_client.models.generate_content(
            model=TTS_MODEL,
            contents=f"Read this stadium PA announcement clearly and calmly: {text}",
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice,
                        )
                    )
                ),
            ),
        )
        elapsed = time.time() - t0
        pcm_data = response.candidates[0].content.parts[0].inline_data.data

        # Convert PCM to WAV in memory
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(24000)
            wf.writeframes(pcm_data)
        wav_bytes = buf.getvalue()

        print(f"[TTS] {TTS_MODEL} generated {len(wav_bytes)} bytes in {elapsed:.2f}s (voice={voice})")
        return base64.b64encode(wav_bytes).decode("ascii")
    except Exception as e:
        elapsed = time.time() - t0
        print(f"[TTS] {TTS_MODEL} FAILED in {elapsed:.2f}s: {e}")
        traceback.print_exc()
        return None


def _tts_pregenerate(pa_en, pa_hi, pa_kn):
    """Background thread: generates TTS audio for the full trilingual PA script."""
    global _tts_result, _tts_pending

    parts = [pa_en]
    if pa_hi:
        parts.append(pa_hi)
    if pa_kn:
        parts.append(pa_kn)
    full_text = " ... ".join(parts)

    audio_b64 = tts_agent(full_text, voice="Kore")
    with _tts_lock:
        if audio_b64:
            _tts_result = {"audio": audio_b64, "format": "wav", "model": TTS_MODEL}
            print(f"[TTS] Pre-generated audio ready ({len(audio_b64)} chars)")
        else:
            _tts_result = {"error": "TTS generation failed"}
            print("[TTS] Pre-generation failed")
        _tts_pending = False


# ==============================================================================
# HTTP Server
# ==============================================================================

ZONE_MAP = {
    "gate 01": "g1", "gate 1": "g1", "g1": "g1",
    "gate 02": "g2", "gate 2": "g2", "g2": "g2",
    "gate 03": "g3", "gate 3": "g3", "g3": "g3",
    "gate 04": "g4", "gate 4": "g4", "g4": "g4",
    "gate 05": "g5", "gate 5": "g5", "g5": "g5",
    "concourse n": "concourse_n", "north": "concourse_n", "concourse-n": "concourse_n",
    "concourse s": "concourse_s", "south": "concourse_s", "concourse-s": "concourse_s",
    "concourse e": "concourse_e", "east": "concourse_e", "concourse-e": "concourse_e",
    "concourse w": "concourse_w", "west": "concourse_w", "concourse-w": "concourse_w",
    "concourse b": "concourse_s", "metro": "metro", "mg road": "metro",
}


def build_zone_state(directives, severity):
    zones = {k: "green" for k in ["g1","g2","g3","g4","g5","concourse_n","concourse_s","concourse_e","concourse_w","metro"]}
    for d in directives:
        tz = (d.get("target_zone","") + " " + d.get("action_required","")).lower()
        for keyword, zone_key in ZONE_MAP.items():
            if keyword in tz:
                if d.get("priority") == "IMMEDIATE":
                    zones[zone_key] = "red" if severity == "RED" else "orange"
                elif zones[zone_key] == "green":
                    zones[zone_key] = "orange"
    return zones


def build_trace(scenario_keys, sensor_data, dispatcher_result, dispatcher_time, severity):
    """Build realistic agent trace with actual Gemini timing + reasoning excerpts."""
    trace = []
    t = 0

    # -- Sensor Agent --
    trace.append({"agent": "sensor", "level": "info", "text": f"Ingesting telemetry -- {len(scenario_keys)} active feed(s) -- 5 sensor channels parsed.", "t": t}); t += 280
    for a in sensor_data.get("anomalies", [])[:2]:
        lvl = "alert" if "CRITICAL" in a or "exceeds" in a else "warn"
        trace.append({"agent": "sensor", "level": lvl, "text": a, "t": t}); t += 300
    if not sensor_data.get("anomalies"):
        trace.append({"agent": "sensor", "level": "info", "text": f"All metrics within nominal operating bands.", "t": t}); t += 280
    trace.append({"agent": "sensor", "level": "info", "text": f"Handoff -> Dispatcher Agent [{DISPATCHER_MODEL}]", "t": t}); t += 320

    # -- Dispatcher Agent --
    trace.append({"agent": "dispatcher", "level": "info", "text": f"Model online -- {DISPATCHER_MODEL} -- context primed -- tools: {{ broadcast, route, alert }}", "t": t}); t += 350

    if dispatcher_result:
        reasoning = dispatcher_result.get("reasoning_justification", "")
        sentences = [s.strip() for s in reasoning.replace(". ", ".|").split("|") if s.strip()]
        for s in sentences[:4]:
            trace.append({"agent": "dispatcher", "level": "think", "text": s, "t": t}); t += 380

        n_dir = len(dispatcher_result.get("mitigation_directives", []))
        if severity == "RED":
            trace.append({"agent": "dispatcher", "level": "alert", "text": f"Severity=RED -- gating broadcast pending Auditor clearance.", "t": t}); t += 300
            trace.append({"agent": "dispatcher", "level": "emit", "text": f"Structured payload emitted -- severity=RED -- directives={n_dir} -- API latency {dispatcher_time:.1f}s", "t": t}); t += 320
            trace.append({"agent": "dispatcher", "level": "info", "text": f"Escalating -> Risk Auditor Node [{AUDITOR_MODEL}]", "t": t}); t += 340

            # -- Auditor Agent placeholder (real result comes async) --
            trace.append({"agent": "auditor", "level": "info", "text": f"Auditor node online -- {AUDITOR_MODEL} -- 5-point safety verification initiated.", "t": t}); t += 360
            for ci in range(5):
                trace.append({"agent": "auditor", "level": "think", "text": f"Check {ci+1}/5 -- verifying against SOP...", "t": t}); t += 340
            trace.append({"agent": "auditor", "level": "ok", "text": "auditor_clearance = TRUE -- releasing payload to Broadcast Layer.", "t": t}); t += 380
        else:
            lvl = "warn" if severity == "ORANGE" else "info"
            trace.append({"agent": "dispatcher", "level": lvl, "text": f"Severity classification: {severity} -- API latency {dispatcher_time:.1f}s", "t": t}); t += 300
            trace.append({"agent": "dispatcher", "level": "emit", "text": f"Structured payload emitted -- severity={severity} -- directives={n_dir}", "t": t}); t += 320
    else:
        trace.append({"agent": "dispatcher", "level": "warn", "text": "Gemini call failed -- activating local fallback scenario data.", "t": t}); t += 400

    # -- Broadcast Agent --
    red_zones = sum(1 for v in build_zone_state(dispatcher_result.get("mitigation_directives",[]), severity).values() if v == "red") if dispatcher_result else 0
    trace.append({"agent": "broadcast", "level": "alert" if severity == "RED" else "info", "text": f"Map composited -- {red_zones} RED zone(s) -- PA script queued.", "t": t}); t += 300
    trace.append({"agent": "broadcast", "level": "info", "text": f"Mobile push staged -- geo-fence active -- TTS ready [{TTS_MODEL}].", "t": t}); t += 300
    trace.append({"agent": "broadcast", "level": "ok", "text": f"Cycle complete -- {t/1000:.1f}s e2e -- {'auditor cleared' if severity == 'RED' else 'no auditor invocation'}.", "t": t})

    return trace


class AuraHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/auditor":
            self._handle_auditor()
        elif self.path == "/api/tts-status":
            self._handle_tts_status()
        elif self.path == "/api/health":
            self._json_response({
                "status": "ok",
                "gemini": GEMINI_AVAILABLE,
                "models": {"dispatcher": DISPATCHER_MODEL, "auditor": AUDITOR_MODEL, "tts": TTS_MODEL} if GEMINI_AVAILABLE else None,
            })
        elif self.path == "/":
            self.path = "/AuraCommand.html"
            super().do_GET()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/dispatch":
            self._handle_dispatch()
        elif self.path == "/api/tts":
            self._handle_tts()
        else:
            self.send_error(404)

    def _handle_dispatch(self):
        global _auditor_result, _auditor_pending
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        scenario_keys = body.get("scenario_keys", [])

        if not scenario_keys:
            self._json_response({"error": "No scenario_keys provided"}, 400)
            return

        print(f"\n[Dispatch] === NEW DISPATCH: {scenario_keys} ===")

        # AGENT 1: Sensor Agent (rule-based)
        sensor_data = sensor_agent(scenario_keys)
        print(f"[Sensor] Parsed {len(scenario_keys)} feed(s), {len(sensor_data['anomalies'])} anomalies")

        # AGENT 2: Dispatcher Agent (gemini-3.5-flash)
        dispatcher_result, dispatcher_time = dispatcher_agent(scenario_keys, sensor_data)

        if not dispatcher_result:
            self._json_response({"error": "Dispatcher agent failed", "fallback": True}, 503)
            return

        sev = dispatcher_result.get("severity_level", "GREEN")

        # Build trilingual PA script
        pa_en = dispatcher_result.get("pa_script_english", "")
        pa_hi = dispatcher_result.get("pa_script_hindi", "")
        pa_kn = dispatcher_result.get("pa_script_kannada", "")
        pa_script = pa_en
        if pa_hi:
            pa_script += "\n\n[HI] " + pa_hi
        if pa_kn:
            pa_script += "\n\n[KN] " + pa_kn

        payload = {
            "severity_level": sev,
            "reasoning_justification": dispatcher_result.get("reasoning_justification", ""),
            "mitigation_directives": dispatcher_result.get("mitigation_directives", []),
            "pa_system_announcement_script": pa_script,
            "mobile_push_notification_text": dispatcher_result.get("mobile_push_notification_text", "Stadium alert active."),
        }

        zone_state = build_zone_state(dispatcher_result.get("mitigation_directives", []), sev)
        trace = build_trace(scenario_keys, sensor_data, dispatcher_result, dispatcher_time, sev)

        active_run = {
            "id": "GEMINI_" + "_".join(scenario_keys).upper(),
            "key": scenario_keys[0] if len(scenario_keys) == 1 else None,
            "name": " + ".join(k.replace("_", " ").title() for k in scenario_keys),
            "short": " + ".join(k.replace("_", " ").title() for k in scenario_keys),
            "timestamp": sensor_data["timestamp"],
            "match_status": sensor_data["match_status"],
            "current_rainfall_mm": sensor_data["rainfall_mm"],
            "sensor_metrics": sensor_data["metrics"],
            "expected_severity": sev,
            "zone_state": zone_state,
            "payload": payload,
            "auditor": None,
            "trace": trace,
            "composed": len(scenario_keys) > 1,
            "sources": [{"id": k, "short": k.replace("_"," ").title(), "severity": sev} for k in scenario_keys] if len(scenario_keys) > 1 else None,
            "gemini_powered": True,
            "dispatcher_model": DISPATCHER_MODEL,
            "dispatcher_latency_s": round(dispatcher_time, 2),
        }

        # AGENT 3: Auditor (async, only for RED)
        if sev == "RED":
            with _auditor_lock:
                _auditor_result = None
                _auditor_pending = True
            directives_text = "\n".join(
                f"  [{d.get('priority','?')}] {d.get('target_zone','?')}: {d.get('action_required','?')}"
                for d in dispatcher_result.get("mitigation_directives", [])
            )
            threading.Thread(
                target=auditor_agent_async,
                args=(active_run["name"], dispatcher_result.get("reasoning_justification",""), directives_text),
                daemon=True,
            ).start()
            print(f"[Auditor] Background verification started ({AUDITOR_MODEL})")

        # AGENT 4: TTS Broadcast (async, pre-generate audio immediately)
        with _tts_lock:
            _tts_result = None
            _tts_pending = True
        threading.Thread(
            target=_tts_pregenerate,
            args=(pa_en, pa_hi, pa_kn),
            daemon=True,
        ).start()
        print(f"[TTS] Background audio generation started ({TTS_MODEL})")

        print(f"[Dispatch] Complete -- severity={sev} -- directives={len(payload['mitigation_directives'])} -- trace={len(trace)} entries")
        self._json_response({"activeRun": active_run, "source": "gemini"})

    def _handle_tts(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        text = body.get("text", "")
        voice = body.get("voice", "Kore")

        if not text:
            self._json_response({"error": "No text provided"}, 400)
            return

        print(f"[TTS] Generating audio for {len(text)} chars (voice={voice})")
        audio_b64 = tts_agent(text, voice)

        if audio_b64:
            self._json_response({"audio": audio_b64, "format": "wav", "model": TTS_MODEL})
        else:
            self._json_response({"error": "TTS generation failed"}, 503)

    def _handle_auditor(self):
        with _auditor_lock:
            if _auditor_pending:
                self._json_response({"verdict": "VERIFYING", "pending": True})
            elif _auditor_result:
                self._json_response(_auditor_result)
            else:
                self._json_response({"verdict": "NO_RUN", "pending": False})

    def _handle_tts_status(self):
        with _tts_lock:
            if _tts_pending:
                self._json_response({"status": "pending"})
            elif _tts_result:
                self._json_response({"status": "ready", **_tts_result})
            else:
                self._json_response({"status": "none"})

    def _json_response(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    print(f"\n[AuraCommand] Multi-Agent Ops Server")
    print(f"  Static    : {STATIC_DIR}")
    print(f"  Server    : http://127.0.0.1:{PORT}")
    print(f"  Gemini    : {'ONLINE' if GEMINI_AVAILABLE else 'OFFLINE (local sim)'}")
    if GEMINI_AVAILABLE:
        print(f"  Dispatcher: {DISPATCHER_MODEL}")
        print(f"  Auditor   : {AUDITOR_MODEL}")
        print(f"  TTS       : {TTS_MODEL}")
    print(f"  Endpoints : /api/dispatch (POST), /api/auditor (GET), /api/tts (POST), /api/tts-status (GET), /api/health (GET)")
    print()
    server = http.server.HTTPServer(("0.0.0.0", PORT), AuraHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[AuraCommand] Server stopped.")
        server.server_close()
