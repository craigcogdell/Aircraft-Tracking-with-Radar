import logging
import time
from typing import Optional, Callable, Dict, Any, List

from sdr.hackrf_receiver import HackRFReceiver
from sdr.rtlsdr_receiver import RTLSDRReceiver
from sdr.bladerf_receiver import BladeRFReceiver
from sdr.airspy_receiver import AirspyReceiver
from sdr.network_receiver import NetworkReceiver
from sdr.live_feed_receiver import LiveFeedReceiver
from sdr.dummy_simulator import DummySimulator

logger = logging.getLogger("SDR_Manager")

class SDRManager:
    """
    Unified Software Defined Radio Hardware Manager.
    Coordinates physical SDR dongles (HackRF, RTL-SDR, BladeRF, Airspy),
    local network dump1090/readsb feeds, real-world live airspace streams,
    and tactical dummy airspace simulation traffic.
    """
    def __init__(self, on_raw_line_callback: Optional[Callable[[str], None]] = None,
                 on_aircraft_json_callback: Optional[Callable[[list], None]] = None):
        self.on_raw_line = on_raw_line_callback
        self.on_aircraft_json = on_aircraft_json_callback
        
        self.hackrf = HackRFReceiver(callback=self.on_raw_line)
        self.rtlsdr = RTLSDRReceiver(callback=self.on_raw_line)
        self.bladerf = BladeRFReceiver(callback=self.on_raw_line)
        self.airspy = AirspyReceiver(callback=self.on_raw_line)
        self.network = NetworkReceiver(callback_line=self.on_raw_line, callback_json=self.on_aircraft_json)
        self.live_feed = LiveFeedReceiver(callback_aircraft=self.on_aircraft_json)
        self.dummy_sim = DummySimulator(callback_aircraft=self.on_aircraft_json)

        self.active_source: str = "hackrf" # "hackrf", "rtlsdr", "bladerf", "airspy", "network", "live_feed", "dummy_sim"

    def get_available_devices(self) -> Dict[str, Any]:
        """Scans system for connected SDR hardware, feeds, and simulators."""
        return {
            "hackrf": HackRFReceiver.is_hackrf_available(),
            "rtlsdr": RTLSDRReceiver.is_rtlsdr_available(),
            "bladerf": BladeRFReceiver.is_bladerf_available(),
            "airspy": AirspyReceiver.is_airspy_available(),
            "network": {"available": True, "detail": "dump1090 / readsb / Beast / SBS TCP & HTTP JSON feeds supported"},
            "live_feed": {"available": True, "detail": "100% Real-World Live Airspace ADS-B stream (Worldwide coverage)"},
            "dummy_sim": {"available": True, "detail": "Tactical Airspace Simulator (Airliners, RAF Typhoons, SAR & Emergencies)"}
        }

    def stop_all(self):
        """Stops any currently running SDR receivers or simulators."""
        self.hackrf.stop()
        self.rtlsdr.stop()
        self.bladerf.stop()
        self.airspy.stop()
        self.network.stop()
        self.live_feed.stop()
        self.dummy_sim.stop()

    def start_source(self, source_type: str, **kwargs) -> Dict[str, Any]:
        """Starts a specific SDR hardware or simulation source with parameters."""
        self.stop_all()
        source_type = source_type.lower().strip()
        self.active_source = source_type

        success = False
        message = ""

        if source_type == "hackrf":
            lna = kwargs.get("lna_gain", 40)
            vga = kwargs.get("vga_gain", 42)
            amp = kwargs.get("amp", 1)
            rate = kwargs.get("sample_rate", 8000000)
            bias_tee = kwargs.get("bias_tee", 0)
            success = self.hackrf.start(lna_gain=lna, vga_gain=vga, amp_enable=amp, sample_rate=rate, bias_tee=bias_tee)
            message = self.hackrf.status_message

        elif source_type == "rtlsdr":
            gain = kwargs.get("gain", 49.6)
            ppm = kwargs.get("ppm", 0)
            bias_tee = kwargs.get("bias_tee", 0)
            rate = kwargs.get("sample_rate", 2000000)
            success = self.rtlsdr.start(gain=gain, ppm=ppm, bias_tee=bias_tee, sample_rate=rate)
            message = self.rtlsdr.status_message

        elif source_type == "bladerf":
            rx_gain = kwargs.get("rx_gain", 40)
            rate = kwargs.get("sample_rate", 8000000)
            success = self.bladerf.start(rx_gain=rx_gain, sample_rate=rate)
            message = self.bladerf.status_message

        elif source_type == "airspy":
            gain = kwargs.get("gain", 18)
            bias_tee = kwargs.get("bias_tee", 0)
            rate = kwargs.get("sample_rate", 6000000)
            success = self.airspy.start(gain=gain, bias_tee=bias_tee, sample_rate=rate)
            message = self.airspy.status_message

        elif source_type == "network":
            host = kwargs.get("host", "127.0.0.1")
            port = kwargs.get("port", 30002)
            mode = kwargs.get("mode", "raw")
            http_url = kwargs.get("http_url")
            success = self.network.start(host=host, port=port, mode=mode, http_url=http_url)
            message = self.network.status_message

        elif source_type == "live_feed":
            lat = kwargs.get("lat", 51.6214)
            lon = kwargs.get("lon", -3.9436)
            range_nm = kwargs.get("range_nm", 50.0)
            success = self.live_feed.start(lat=lat, lon=lon, range_nm=range_nm)
            message = self.live_feed.status_message

        elif source_type in ("dummy_sim", "sim", "simulation"):
            self.active_source = "dummy_sim"
            lat = kwargs.get("lat", 51.6214)
            lon = kwargs.get("lon", -3.9436)
            range_nm = kwargs.get("range_nm", 50.0)
            success = self.dummy_sim.start(lat=lat, lon=lon, range_nm=range_nm)
            message = self.dummy_sim.status_message

        else:
            message = f"Unknown SDR source: {source_type}"

        return {
            "source": self.active_source,
            "success": success,
            "message": message
        }

    def get_active_stats(self) -> Dict[str, Any]:
        """Returns stats of the active receiver."""
        if self.active_source == "hackrf":
            return self.hackrf.get_stats()
        elif self.active_source == "rtlsdr":
            return self.rtlsdr.get_stats()
        elif self.active_source == "bladerf":
            return self.bladerf.get_stats()
        elif self.active_source == "airspy":
            return self.airspy.get_stats()
        elif self.active_source == "network":
            return self.network.get_stats()
        elif self.active_source == "live_feed":
            return self.live_feed.get_stats()
        elif self.active_source in ("dummy_sim", "sim", "simulation"):
            return self.dummy_sim.get_stats()
        return {"device": "None", "status": "Idle", "is_running": False}

