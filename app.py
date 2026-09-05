import os
import sys
import json
import asyncio
import logging
from typing import Optional, Any, Dict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn

from tracker.radar_engine import RadarEngine
from sdr.hackrf_receiver import HackRFReceiver
from sdr.rtlsdr_receiver import RTLSDRReceiver
from sdr.bladerf_receiver import BladeRFReceiver
from sdr.airspy_receiver import AirspyReceiver

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("RadarApp")

app = FastAPI(title="Real-World Multi-SDR Aircraft Radar (Swansea SA1 8LY)", version="2.0")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

radar = RadarEngine()
radar.set_station("Swansea Base (SA1 8LY)", 51.6214, -3.9436, 50.0)

# Initialize SDR: check HackRF first; then RTL-SDR; if neither board connected, start Real-World Live Airspace Feed
hackrf_check = HackRFReceiver.is_hackrf_available()
rtlsdr_check = RTLSDRReceiver.is_rtlsdr_available()

if hackrf_check.get("device_found"):
    logger.info("HackRF One USB hardware detected — starting 8 MSPS SDR receiver")
    radar.start_hackrf(lna_gain=40, vga_gain=42, amp=1, sample_rate=8000000)
elif rtlsdr_check.get("device_found") and rtlsdr_check.get("available"):
    logger.info("RTL-SDR USB dongle detected — starting RTL-SDR receiver")
    radar.start_rtlsdr(gain=49.6, ppm=0, bias_tee=0, sample_rate=2000000)
else:
    logger.info("SDR hardware in standby. Starting Real-World Live Airspace Feed (100% Real Physical Flights)")
    radar.start_live_feed()

class StationRequest(BaseModel):
    name: str = "Swansea Base (SA1 8LY)"
    lat: float = 51.6214
    lon: float = -3.9436
    range_nm: Optional[float] = 50.0

class SDRStartRequest(BaseModel):
    source: str = "hackrf" # "hackrf", "rtlsdr", "bladerf", "airspy", "network", "live_feed"
    # HackRF params
    lna_gain: Optional[int] = 40
    vga_gain: Optional[int] = 42
    amp: Optional[int] = 1
    # RTL-SDR params
    gain: Optional[float] = 49.6
    ppm: Optional[int] = 0
    bias_tee: Optional[int] = 0
    # BladeRF / Airspy
    rx_gain: Optional[int] = 40
    # Generic
    sample_rate: Optional[int] = 8000000
    # Network params
    host: Optional[str] = "127.0.0.1"
    port: Optional[int] = 30002
    mode: Optional[str] = "raw"
    http_url: Optional[str] = None

class SweepRequest(BaseModel):
    rpm: float

@app.get("/")
async def get_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h1>Real-World SDR Radar Loading...</h1>")

@app.get("/api/state")
async def get_state():
    return radar.get_radar_snapshot()

@app.get("/api/sdr/devices")
async def get_sdr_devices():
    """Scans and returns all connected and supported SDR hardware."""
    return radar.sdr_manager.get_available_devices()

@app.post("/api/sdr/start")
async def post_sdr_start(req: SDRStartRequest):
    """Starts any supported SDR hardware device or network feed."""
    params = req.dict(exclude_unset=True)
    source = params.pop("source", "hackrf")
    res = radar.start_sdr(source, **params)
    return res

@app.post("/api/sdr/stop")
async def post_sdr_stop():
    """Stops the active SDR receiver."""
    radar.sdr_manager.stop_all()
    return {"status": "stopped", "message": "All SDR receivers stopped"}

@app.get("/api/aircraft/{icao}")
async def get_aircraft_details(icao: str):
    """Returns full detailed flight telemetry and SDR radio data for a single aircraft."""
    icao_upper = icao.upper().strip()
    if icao_upper in radar.aircraft:
        return {"found": True, "aircraft": radar.aircraft[icao_upper].to_dict()}
    return JSONResponse(status_code=404, content={"found": False, "error": f"Aircraft {icao_upper} not currently in radar scope"})

@app.get("/api/sdr/diagnostics")
async def get_sdr_diagnostics():
    """Runs a complete diagnostic check on SDR hardware, USB, drivers, and safety status."""
    hackrf_status = HackRFReceiver.is_hackrf_available()
    rtlsdr_status = RTLSDRReceiver.is_rtlsdr_available()
    
    # Check binary presence
    import shutil
    bins = {
        "hackrf_transfer": shutil.which("hackrf_transfer"),
        "hackrf_info": shutil.which("hackrf_info"),
        "rtl_sdr": RTLSDRReceiver.get_rtl_sdr_binary(),
        "adsb_demod": os.path.join(BASE_DIR, "sdr", "adsb_demod"),
        "adsb_demod_exists": os.path.exists(os.path.join(BASE_DIR, "sdr", "adsb_demod"))
    }
    
    # Protection checklist
    protection_guide = {
        "max_rf_power": "-5 dBm (0.3V RMS / 0.3mW). Exceeding this can damage the HackRF front-end amplifier (MGA-81563/MAX2837).",
        "bandpass_filter": "Recommended: Use a 1090 MHz SAW Bandpass Filter (e.g., FlightAware/Nooelec) to block out-of-band RF saturation (FM, GSM, LTE).",
        "bias_tee_safety": "CRITICAL: Keep Bias-Tee OFF (0V) unless an active powered LNA is connected. NEVER use Bias-Tee with DC-shorted antennas (folded dipoles, magnetic loops).",
        "gain_staging": "Optimal HackRF 1090MHz settings: LNA = 32-40 dB, VGA = 24-32 dB, Amp = OFF (or ON only with passive whip in low RF noise). Avoid maxing out all gains simultaneously to prevent 8-bit ADC clipping."
    }

    return {
        "active_source": radar.active_source,
        "hackrf": hackrf_status,
        "rtlsdr": rtlsdr_status,
        "binaries": bins,
        "protection": protection_guide,
        "tracked_aircraft_count": len(radar.aircraft)
    }

@app.post("/api/station")
async def post_station(req: StationRequest):
    radar.set_station(req.name, req.lat, req.lon, req.range_nm)
    return {
        "status": "ok",
        "station": radar.station_name,
        "lat": radar.station_lat,
        "lon": radar.station_lon,
        "range_nm": radar.max_range_nm
    }

# Backward compatible legacy endpoints
@app.post("/api/hackrf/start")
async def start_hackrf(req: SDRStartRequest):
    return radar.start_hackrf(
        lna_gain=req.lna_gain or 40,
        vga_gain=req.vga_gain or 42,
        amp=req.amp if req.amp is not None else 1,
        sample_rate=req.sample_rate or 8000000,
        bias_tee=req.bias_tee or 0
    )

@app.post("/api/hackrf/stop")
async def stop_hackrf():
    radar.sdr_manager.hackrf.stop()
    return {"status": "stopped", "message": radar.hackrf.status_message}

@app.get("/api/hackrf/detect")
async def get_hackrf_detect():
    return HackRFReceiver.is_hackrf_available()

@app.post("/api/network/connect")
async def connect_network(req: SDRStartRequest):
    return radar.start_network(
        host=req.host or "127.0.0.1",
        port=req.port or 30002,
        mode=req.mode or "raw",
        http_url=req.http_url
    )

@app.post("/api/sweep")
async def set_sweep(req: SweepRequest):
    radar.sweep_rpm = max(0.0, min(60.0, req.rpm))
    return {"status": "ok", "rpm": radar.sweep_rpm}

connected_clients: set[WebSocket] = set()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    try:
        snapshot = radar.get_radar_snapshot()
        await websocket.send_text(json.dumps(snapshot))
        
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=0.08)
                msg = json.loads(data)
                cmd = msg.get("command")
                if cmd == "set_range":
                    radar.max_range_nm = float(msg.get("range_nm", 50.0))
                elif cmd == "set_rpm":
                    radar.sweep_rpm = float(msg.get("rpm", 15.0))
            except asyncio.TimeoutError:
                pass
            except json.JSONDecodeError:
                pass

            snapshot = radar.get_radar_snapshot()
            await websocket.send_text(json.dumps(snapshot))
            await asyncio.sleep(0.05)

    except WebSocketDisconnect:
        connected_clients.discard(websocket)
    except Exception as e:
        logger.debug(f"WS client disconnected: {e}")
        connected_clients.discard(websocket)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"\n==================================================================")
    print(f"  REAL-WORLD MULTI-SDR AIRCRAFT RADAR — SWANSEA (SA1 8LY)")
    print(f"  Supporting HackRF, RTL-SDR, BladeRF, Airspy & Live Airspace")
    print(f"  Server running at: http://localhost:{port}")
    print(f"==================================================================\n")
    uvicorn.run(app, host=host, port=port, log_level="info")

