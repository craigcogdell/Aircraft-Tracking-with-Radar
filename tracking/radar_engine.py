import time
import math
import logging
from typing import Dict, Any, List, Optional
from tracker.aircraft import Aircraft, calculate_distance_bearing
from sdr.adsb_decoder import ADSBDecoder
from sdr.sdr_manager import SDRManager

logger = logging.getLogger("Radar_Engine")

class RadarEngine:
    """
    Central Radar Engine for Real-World SDR Aircraft Tracking.
    Tracks 100% real physical aircraft over the air via HackRF, RTL-SDR, BladeRF, Airspy,
    dump1090 networks, and live real-world airspace data streams.
    """
    def __init__(self):
        # Default Station GPS: Swansea, South Wales (SA1 8LY)
        self.station_name = "Swansea Base (SA1 8LY)"
        self.station_lat = 51.6214
        self.station_lon = -3.9436
        self.max_range_nm = 50.0 # 50 Miles Scope
        self.sweep_rpm = 15.0 # Radar sweep rotation speed
        
        # Real-World Aircraft Store: icao -> Aircraft
        self.aircraft: Dict[str, Aircraft] = {}
        
        # Mode-S ADS-B Decoder
        self.decoder = ADSBDecoder(self.station_lat, self.station_lon)
        
        # Unified Multi-SDR Hardware Manager
        self.sdr_manager = SDRManager(
            on_raw_line_callback=self.on_raw_modes_line,
            on_aircraft_json_callback=self.on_json_aircraft_list
        )
        
        self.stale_timeout_sec = 60.0 # Purge aircraft not heard from in 60s
        self.active_emergencies: List[Dict[str, Any]] = []

    @property
    def hackrf(self):
        """Convenience property for HackRF receiver."""
        return self.sdr_manager.hackrf

    @property
    def active_source(self):
        return self.sdr_manager.active_source

    def set_station(self, name: str, lat: float, lon: float, range_nm: Optional[float] = None):
        self.station_name = name
        self.station_lat = lat
        self.station_lon = lon
        if range_nm:
            self.max_range_nm = range_nm
            
        self.decoder.set_station_coords(lat, lon)
        self.sdr_manager.live_feed.set_station(lat, lon, self.max_range_nm)
        
        # Recalculate distance & bearing for all tracked aircraft
        for ac in self.aircraft.values():
            ac.update_radar_coords(lat, lon)
            
        logger.info(f"Station coordinates calibrated: {name} ({lat:.4f}, {lon:.4f}), Scope: {self.max_range_nm} miles")

    def start_sdr(self, source_type: str, **kwargs) -> Dict[str, Any]:
        """Starts any supported SDR hardware or feed."""
        if source_type == "live_feed":
            kwargs["lat"] = self.station_lat
            kwargs["lon"] = self.station_lon
            kwargs["range_nm"] = self.max_range_nm
            
        return self.sdr_manager.start_source(source_type, **kwargs)

    def start_hackrf(self, lna_gain: int = 40, vga_gain: int = 42, amp: int = 1, sample_rate: int = 8000000, bias_tee: int = 0) -> Dict[str, Any]:
        return self.start_sdr("hackrf", lna_gain=lna_gain, vga_gain=vga_gain, amp=amp, sample_rate=sample_rate, bias_tee=bias_tee)

    def start_rtlsdr(self, gain: float = 49.6, ppm: int = 0, bias_tee: int = 0, sample_rate: int = 2000000) -> Dict[str, Any]:
        return self.start_sdr("rtlsdr", gain=gain, ppm=ppm, bias_tee=bias_tee, sample_rate=sample_rate)

    def start_network(self, host: str = "127.0.0.1", port: int = 30002, mode: str = "raw", http_url: Optional[str] = None) -> Dict[str, Any]:
        return self.start_sdr("network", host=host, port=port, mode=mode, http_url=http_url)

    def start_live_feed(self) -> Dict[str, Any]:
        return self.start_sdr("live_feed", lat=self.station_lat, lon=self.station_lon, range_nm=self.max_range_nm)

    def on_raw_modes_line(self, line: str):
        """Called when raw Mode-S line is received from SDR hardware."""
        receiver_name = "HackRF One"
        if self.active_source == "rtlsdr":
            receiver_name = "RTL-SDR"
        elif self.active_source == "bladerf":
            receiver_name = "BladeRF"
        elif self.active_source == "airspy":
            receiver_name = "Airspy"
            
        self.decoder.process_raw_line(line, self.aircraft, receiver_name=receiver_name)

    def on_json_aircraft_list(self, ac_list: list):
        """Called when network dump1090 feed or Live Airspace stream provides aircraft states."""
        now = time.time()
        for item in ac_list:
            icao = item.get("hex", "").upper().strip()
            if not icao or len(icao) != 6:
                continue
                
            if icao not in self.aircraft:
                self.aircraft[icao] = Aircraft(icao)
                
            ac = self.aircraft[icao]
            ac.receiver_source = item.get("source", "Network Receiver" if self.active_source == "network" else "Live Airspace Feed")
            
            if "flight" in item and item["flight"]:
                ac.callsign = item["flight"].strip()
            if "alt_baro" in item and item["alt_baro"] is not None:
                ac.altitude = float(item["alt_baro"])
            elif "altitude" in item and item["altitude"] is not None:
                ac.altitude = float(item["altitude"])
            if "geom_altitude" in item and item["geom_altitude"] is not None:
                ac.geom_altitude = float(item["geom_altitude"])
            if "gs" in item and item["gs"] is not None:
                ac.speed = float(item["gs"])
            elif "speed" in item and item["speed"] is not None:
                ac.speed = float(item["speed"])
            if "track" in item and item["track"] is not None:
                ac.heading = float(item["track"])
            if "vertical_rate" in item and item["vertical_rate"] is not None:
                ac.vertical_rate = float(item["vertical_rate"])
            if "squawk" in item and item["squawk"]:
                ac.squawk = str(item["squawk"])
            if "rssi" in item and item["rssi"] is not None:
                ac.signal_db = float(item["rssi"])
            if "category" in item and item["category"]:
                ac.emitter_category = str(item["category"])
                
            if "lat" in item and "lon" in item and item["lat"] is not None and item["lon"] is not None:
                ac.update_position(float(item["lat"]), float(item["lon"]), ac.altitude, now)
                ac.update_radar_coords(self.station_lat, self.station_lon)

    def tick_cleanup(self):
        """Purges stale aircraft and extrapolates live trajectory vectors."""
        now = time.time()
        stale_keys = []
        emergencies = []

        for icao, ac in self.aircraft.items():
            age = now - ac.last_seen
            if age > self.stale_timeout_sec:
                stale_keys.append(icao)
            else:
                ac.extrapolate_position(now)
                ac.update_radar_coords(self.station_lat, self.station_lon)
                
                # Check for emergency squawks
                if ac.squawk in ("7700", "7600", "7500") or ac.classify_aircraft() in ("EMERGENCY", "RADIO_FAIL", "HIJACK"):
                    emergencies.append({
                        "icao": ac.icao,
                        "callsign": ac.callsign or "---",
                        "squawk": ac.squawk,
                        "alt": ac.altitude,
                        "dist_nm": ac.distance_nm,
                        "bearing_deg": ac.bearing_deg,
                        "time": now
                    })
                    
        for k in stale_keys:
            del self.aircraft[k]
            
        self.active_emergencies = emergencies

    def get_radar_snapshot(self) -> Dict[str, Any]:
        """Returns the real-world radar state for the PPI display."""
        self.tick_cleanup()
        
        source_stats = self.sdr_manager.get_active_stats()

        ac_list = []
        for ac in self.aircraft.values():
            if ac.is_valid_aircraft():
                ac_list.append(ac.to_dict())

        # Sort closest to station first, followed by unpositioned contacts
        ac_list.sort(key=lambda x: (0 if x["distance_nm"] is not None else 1, x["distance_nm"] if x["distance_nm"] is not None else 9999))

        return {
            "station": {
                "name": self.station_name,
                "lat": self.station_lat,
                "lon": self.station_lon,
                "max_range_nm": self.max_range_nm,
                "sweep_rpm": self.sweep_rpm
            },
            "source": {
                "active": self.active_source,
                "stats": source_stats
            },
            "devices": self.sdr_manager.get_available_devices(),
            "stats": {
                "total_contacts": len(ac_list),
                "in_range_contacts": sum(1 for a in ac_list if a["distance_nm"] and a["distance_nm"] <= self.max_range_nm),
                "emergencies_count": len(self.active_emergencies)
            },
            "emergencies": self.active_emergencies,
            "aircraft": ac_list,
            "timestamp": time.time()
        }

