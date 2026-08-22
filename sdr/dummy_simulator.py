import logging
import math
import threading
import time
from typing import Optional, Callable, Dict, Any, List

logger = logging.getLogger("Dummy_Simulator")

class DummySimulator:
    """
    Realistic Airspace Flight Simulator for SDR Radar.
    Generates dynamic, realistic dummy aircraft over the station airspace,
    including commercial airliners, military interceptors, search & rescue helicopters,
    light GA trainers, and emergency transponder scenarios.
    """
    def __init__(self, callback_aircraft: Optional[Callable[[list], None]] = None):
        self.callback_aircraft = callback_aircraft
        self.is_running = False
        self._thread: Optional[threading.Thread] = None
        self.status_message = "Simulation in standby"
        
        # Station center (default Swansea SA1 8LY)
        self.station_lat = 51.6214
        self.station_lon = -3.9436
        self.max_range_nm = 50.0

        # Initial dummy fleet
        self.fleet: List[Dict[str, Any]] = []
        self._init_fleet()

    def _init_fleet(self):
        """Initializes realistic dummy aircraft scenarios in South Wales / Severn airspace."""
        self.fleet = [
            {
                "icao": "400A2C",
                "callsign": "BAW183",
                "airline": "British Airways",
                "country": "United Kingdom",
                "country_flag": "🇬🇧",
                "type": "Commercial Jet / A350",
                "lat": self.station_lat + 0.22,
                "lon": self.station_lon - 0.45,
                "alt": 34000.0,
                "target_alt": 36000.0,
                "speed": 485.0,
                "heading": 268.0,
                "vrate": 450.0,
                "squawk": "4215",
                "turn_rate": 0.2
            },
            {
                "icao": "4CA12F",
                "callsign": "RYR405",
                "airline": "Ryanair",
                "country": "Ireland",
                "country_flag": "🇮🇪",
                "type": "Commercial Jet / B738",
                "lat": self.station_lat - 0.18,
                "lon": self.station_lon + 0.35,
                "alt": 14500.0,
                "target_alt": 28000.0,
                "speed": 340.0,
                "heading": 305.0,
                "vrate": 1800.0,
                "squawk": "6102",
                "turn_rate": -0.3
            },
            {
                "icao": "4010FB",
                "callsign": "EZY612",
                "airline": "easyJet",
                "country": "United Kingdom",
                "country_flag": "🇬🇧",
                "type": "Commercial Jet / A320",
                "lat": self.station_lat - 0.28,
                "lon": self.station_lon + 0.58,
                "alt": 8200.0,
                "target_alt": 3000.0,
                "speed": 240.0,
                "heading": 112.0,
                "vrate": -1200.0,
                "squawk": "3741",
                "turn_rate": 0.4
            },
            {
                "icao": "43C1B2",
                "callsign": "RRR992",
                "airline": "Royal Air Force",
                "country": "United Kingdom",
                "country_flag": "🇬🇧",
                "type": "Military Fighter / Typhoon",
                "lat": self.station_lat + 0.35,
                "lon": self.station_lon - 0.15,
                "alt": 22000.0,
                "target_alt": 22000.0,
                "speed": 590.0,
                "heading": 195.0,
                "vrate": 0.0,
                "squawk": "7001",
                "turn_rate": 1.2
            },
            {
                "icao": "AE012D",
                "callsign": "RCH414",
                "airline": "United States Air Force",
                "country": "United States",
                "country_flag": "🇺🇸",
                "type": "Heavy Military / C-17",
                "lat": self.station_lat + 0.42,
                "lon": self.station_lon - 0.62,
                "alt": 28000.0,
                "target_alt": 28000.0,
                "speed": 435.0,
                "heading": 85.0,
                "vrate": 0.0,
                "squawk": "1420",
                "turn_rate": 0.1
            },
            {
                "icao": "407B12",
                "callsign": "RESCUE187",
                "airline": "HM Coastguard / Bristow SAR",
                "country": "United Kingdom",
                "country_flag": "🇬🇧",
                "type": "Helicopter / S-92 SAR",
                "lat": self.station_lat - 0.08,
                "lon": self.station_lon - 0.12,
                "alt": 1200.0,
                "target_alt": 1500.0,
                "speed": 115.0,
                "heading": 140.0,
                "vrate": 150.0,
                "squawk": "0024",
                "turn_rate": 0.8
            },
            {
                "icao": "406E98",
                "callsign": "GBBGA",
                "airline": "General Aviation / Flight School",
                "country": "United Kingdom",
                "country_flag": "🇬🇧",
                "type": "Light GA / Cessna 172",
                "lat": self.station_lat + 0.04,
                "lon": self.station_lon - 0.22,
                "alt": 2400.0,
                "target_alt": 2400.0,
                "speed": 105.0,
                "heading": 45.0,
                "vrate": 0.0,
                "squawk": "7000",
                "turn_rate": 1.5
            },
            {
                "icao": "48419A",
                "callsign": "KLM1060",
                "airline": "KLM Royal Dutch Airlines",
                "country": "Netherlands",
                "country_flag": "🇳🇱",
                "type": "Commercial Jet / E195",
                "lat": self.station_lat + 0.12,
                "lon": self.station_lon + 0.42,
                "alt": 31000.0,
                "target_alt": 31000.0,
                "speed": 450.0,
                "heading": 78.0,
                "vrate": 0.0,
                "squawk": "2245",
                "turn_rate": -0.2
            },
            {
                "icao": "407700",
                "callsign": "MAYDAY77",
                "airline": "Simulated Emergency Test",
                "country": "United Kingdom",
                "country_flag": "🚨",
                "type": "Commercial Jet / B772",
                "lat": self.station_lat - 0.22,
                "lon": self.station_lon - 0.38,
                "alt": 16000.0,
                "target_alt": 5000.0,
                "speed": 310.0,
                "heading": 55.0,
                "vrate": -2500.0,
                "squawk": "7700",
                "turn_rate": 0.5
            }
        ]

    def start(self, lat: float = 51.6214, lon: float = -3.9436, range_nm: float = 50.0) -> bool:
        """Starts the dummy simulation loop."""
        self.stop()
        self.station_lat = lat
        self.station_lon = lon
        self.max_range_nm = range_nm

        # Re-center fleet around station
        self._init_fleet()

        self.is_running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        self.status_message = "🎮 Tactical SDR Radar Simulator Active (9 Dynamic Dummy Targets)"
        logger.info(self.status_message)
        return True

    def stop(self):
        """Stops the dummy simulation loop."""
        self.is_running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.5)
        self._thread = None
        self.status_message = "Simulation stopped"

    def _run_loop(self):
        last_time = time.time()
        msg_counts = {ac["icao"]: 10 for ac in self.fleet}

        while self.is_running:
            now = time.time()
            dt = now - last_time
            last_time = now

            snapshot_list = []
            for ac in self.fleet:
                # Update heading smoothly
                ac["heading"] = (ac["heading"] + ac["turn_rate"] * dt * 5.0) % 360.0

                # Kinematics: 1 knot = 1 NM/hr = 1/3600 NM/sec. 1 deg lat ≈ 60 NM
                spd_nm_s = ac["speed"] / 3600.0
                dist_traveled_nm = spd_nm_s * dt

                rad = math.radians(ac["heading"])
                dlat = (dist_traveled_nm * math.cos(rad)) / 60.0
                dlon = (dist_traveled_nm * math.sin(rad)) / (60.0 * math.cos(math.radians(ac["lat"])))

                ac["lat"] += dlat
                ac["lon"] += dlon

                # Smooth altitude convergence
                if abs(ac["alt"] - ac["target_alt"]) > 50:
                    ac["alt"] += (ac["vrate"] / 60.0) * dt
                else:
                    ac["vrate"] = 0.0

                # Boundary bounce check: if aircraft flies beyond 42 NM, turn back toward center
                d_lat_nm = (ac["lat"] - self.station_lat) * 60.0
                d_lon_nm = (ac["lon"] - self.station_lon) * (60.0 * math.cos(math.radians(self.station_lat)))
                dist_from_station = math.hypot(d_lat_nm, d_lon_nm)

                if dist_from_station > 42.0:
                    # Point back towards station center
                    bearing_to_center = (math.degrees(math.atan2(-d_lon_nm, -d_lat_nm)) + 360.0) % 360.0
                    ac["heading"] = bearing_to_center
                    ac["turn_rate"] = (ac["turn_rate"] * -1.0) # Flip turn direction

                # Compute simulated RF RSSI (dB) based on distance
                rssi = max(-26.0, min(-4.0, -8.0 - (dist_from_station * 0.35)))

                msg_counts[ac["icao"]] += int(1 + dt * 2)

                snapshot_list.append({
                    "icao": ac["icao"],
                    "callsign": ac["callsign"],
                    "lat": round(ac["lat"], 5),
                    "lon": round(ac["lon"], 5),
                    "alt": round(ac["alt"]),
                    "speed": round(ac["speed"]),
                    "heading": round(ac["heading"]),
                    "vrate": round(ac["vrate"]),
                    "squawk": ac["squawk"],
                    "signal_db": round(rssi, 1),
                    "msg_count": msg_counts[ac["icao"]],
                    "downlink_format": "DF17 (ADS-B Simulated)",
                    "receiver_source": "SDR Tactical Simulator",
                    "type": ac["type"],
                    "last_seen": now
                })

            if self.callback_aircraft:
                self.callback_aircraft(snapshot_list)

            time.sleep(0.5)

    def get_stats(self) -> Dict[str, Any]:
        return {
            "device": "🎮 Tactical SDR Radar Simulator",
            "status": self.status_message,
            "is_running": self.is_running,
            "simulated_contacts": len(self.fleet),
            "packet_rate_fps": 18 if self.is_running else 0
        }
