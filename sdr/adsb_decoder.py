import time
import re
import logging
from typing import Optional, Dict, Any, Tuple
import pyModeS as pms
from tracker.aircraft import Aircraft

logger = logging.getLogger("ADSB_Decoder")

class ADSBDecoder:
    def __init__(self, station_lat: float = 51.6214, station_lon: float = -3.9436):
        self.station_lat = station_lat
        self.station_lon = station_lon
        self.pipe_decoder = pms.PipeDecoder()
        self.raw_hex_pattern = re.compile(r'^\*?([0-9A-Fa-f]{28}|[0-9A-Fa-f]{14});?')
        self.signal_pattern = re.compile(r'signal=([-\d\.]+)')
        self.source_pattern = re.compile(r'source=([A-Za-z0-9_\-\s]+)')
        
        # Local cache of CPR positions for ICAOs
        self.cpr_cache: Dict[str, Dict[str, Any]] = {}
        
    def set_station_coords(self, lat: float, lon: float):
        self.station_lat = lat
        self.station_lon = lon

    def process_raw_line(self, line: str, aircraft_dict: Dict[str, Aircraft], receiver_name: str = "HackRF One") -> Optional[Aircraft]:
        """
        Parses a raw Mode-S line like '*8D4840D6202CC371C32CE0576098; signal=18.4'
        and updates or creates an Aircraft in aircraft_dict.
        """
        line = line.strip()
        if not line:
            return None
            
        m = self.raw_hex_pattern.search(line)
        if not m:
            return None
            
        hex_msg = m.group(1).upper()
        now = time.time()
        
        signal_db = -18.0
        sig_match = self.signal_pattern.search(line)
        if sig_match:
            try:
                signal_db = float(sig_match.group(1))
            except ValueError:
                pass

        src_match = self.source_pattern.search(line)
        if src_match:
            receiver_name = src_match.group(1).strip()

        return self.decode_frame(hex_msg, signal_db, now, aircraft_dict, receiver_name=receiver_name)

    def decode_frame(self, hex_msg: str, signal_db: float, timestamp: float, aircraft_dict: Dict[str, Aircraft], receiver_name: str = "HackRF One") -> Optional[Aircraft]:
        try:
            # Use PipeDecoder for stateful tracking & CPR pair decoding
            res = self.pipe_decoder.decode(hex_msg, timestamp=timestamp)
            if not res or "icao" not in res:
                return None
                
            icao = str(res["icao"]).upper().strip()
            if not icao or len(icao) != 6:
                return None
                
            if icao not in aircraft_dict:
                aircraft_dict[icao] = Aircraft(icao)
                
            ac = aircraft_dict[icao]
            ac.signal_db = signal_db
            ac.last_seen = timestamp
            ac.msg_count += 1
            ac.receiver_source = receiver_name
            
            df = res.get("df")
            if df is not None:
                if df == 17:
                    ac.downlink_format = "DF17 (ADS-B 1090MHz Extended Squitter)"
                elif df == 18:
                    ac.downlink_format = "DF18 (ADS-B Non-Transponder / TIS-B)"
                elif df == 11:
                    ac.downlink_format = "DF11 (Mode-S All-Call Reply)"
                elif df in (20, 21):
                    ac.downlink_format = f"DF{df} (Mode-S Comm-B Surveillance)"
                elif df in (4, 5):
                    ac.downlink_format = f"DF{df} (Mode-S Altitude / Identity)"
                else:
                    ac.downlink_format = f"DF{df} (Mode-S Transponder)"

            # Callsign
            if "callsign" in res and res["callsign"]:
                cs = str(res["callsign"]).strip()
                if cs:
                    ac.callsign = cs
                
            # Altitude
            if "altitude" in res and res["altitude"] is not None:
                ac.altitude = float(res["altitude"])
            if "geom_altitude" in res and res["geom_altitude"] is not None:
                ac.geom_altitude = float(res["geom_altitude"])
                
            # Speed (groundspeed, airspeed, ias, tas)
            spd = res.get("groundspeed") or res.get("speed") or res.get("airspeed") or res.get("ias") or res.get("tas")
            if spd is not None:
                try:
                    ac.speed = float(spd)
                except (ValueError, TypeError):
                    pass

            # Heading / Track
            trk = res.get("track") if res.get("track") is not None else res.get("heading")
            if trk is not None:
                try:
                    ac.heading = float(trk)
                except (ValueError, TypeError):
                    pass

            # Vertical Rate
            if "vertical_rate" in res and res["vertical_rate"] is not None:
                try:
                    ac.vertical_rate = float(res["vertical_rate"])
                except (ValueError, TypeError):
                    pass
                
            # Squawk
            if "squawk" in res and res["squawk"]:
                ac.squawk = str(res["squawk"])
                
            # Category
            if "category" in res and res["category"]:
                ac.emitter_category = str(res["category"])

            # Position (Latitude / Longitude)
            lat = res.get("latitude")
            lon = res.get("longitude")
            
            if lat is not None and lon is not None:
                ac.update_position(float(lat), float(lon), ac.altitude, timestamp)
            elif "cpr_lat" in res and "cpr_lon" in res and "cpr_format" in res:
                cpr_fmt = res.get("cpr_format")
                cpr_lat = res.get("cpr_lat")
                cpr_lon = res.get("cpr_lon")
                
                try:
                    from pyModeS.position import airborne_position_pair, airborne_position_with_ref
                    
                    if icao not in self.cpr_cache:
                        self.cpr_cache[icao] = {}
                    
                    self.cpr_cache[icao][cpr_fmt] = {
                        "lat": cpr_lat,
                        "lon": cpr_lon,
                        "time": timestamp
                    }
                    
                    # Try pair decoding if both even (0) and odd (1) are present within 10 seconds
                    if 0 in self.cpr_cache[icao] and 1 in self.cpr_cache[icao]:
                        even = self.cpr_cache[icao][0]
                        odd = self.cpr_cache[icao][1]
                        if abs(even["time"] - odd["time"]) < 10.0:
                            even_is_newer = even["time"] >= odd["time"]
                            pos = airborne_position_pair(even["lat"], even["lon"], odd["lat"], odd["lon"], even_is_newer=even_is_newer)
                            if pos:
                                ac.update_position(float(pos[0]), float(pos[1]), ac.altitude, timestamp)
                    
                    # If not resolved by pair, try local reference decoding if we have station or known position
                    if ac.latitude is None:
                        ref_lat = self.station_lat
                        ref_lon = self.station_lon
                        pos_ref = airborne_position_with_ref(cpr_fmt, cpr_lat, cpr_lon, ref_lat, ref_lon)
                        if pos_ref and abs(pos_ref[0] - ref_lat) < 5.0 and abs(pos_ref[1] - ref_lon) < 5.0:
                            ac.update_position(float(pos_ref[0]), float(pos_ref[1]), ac.altitude, timestamp)
                except Exception as ex:
                    logger.debug(f"CPR position calculation error: {ex}")

            ac.update_radar_coords(self.station_lat, self.station_lon)
            return ac

        except Exception as e:
            logger.debug(f"Error decoding Mode-S frame {hex_msg}: {e}")
            return None

