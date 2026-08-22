import math
import time
from typing import Dict, Any, List, Optional, Tuple

# Comprehensive ICAO 24-bit Hex Address Range to Country Allocation
ICAO_COUNTRY_RANGES = [
    (0x004000, 0x0043FF, "Zimbabwe", "🇿🇼", "Z-"),
    (0x006000, 0x006FFF, "Mozambique", "🇲🇿", "C9-"),
    (0x008000, 0x00FFFF, "South Africa", "🇿🇦", "ZS-"),
    (0x010000, 0x017FFF, "Egypt", "🇪🇬", "SU-"),
    (0x018000, 0x01FFFF, "Libya", "🇱🇾", "5A-"),
    (0x020000, 0x027FFF, "Morocco", "🇲🇦", "CN-"),
    (0x028000, 0x02FFFF, "Tunisia", "🇹🇳", "TS-"),
    (0x030000, 0x0303FF, "Botswana", "🇧🇼", "A2-"),
    (0x032000, 0x032FFF, "Burundi", "🇧🇮", "9U-"),
    (0x034000, 0x034FFF, "Cameroon", "🇨🇲", "TJ-"),
    (0x035000, 0x0353FF, "Cape Verde", "🇨🇻", "D4-"),
    (0x036000, 0x0363FF, "Central African Rep.", "🇨🇫", "TL-"),
    (0x038000, 0x0383FF, "Chad", "🇹🇩", "TT-"),
    (0x03E000, 0x03E3FF, "Equatorial Guinea", "🇬🇶", "3C-"),
    (0x040000, 0x040FFF, "Ethiopia", "🇪🇹", "ET-"),
    (0x042000, 0x042FFF, "Ghana", "🇬🇭", "9G-"),
    (0x044000, 0x0443FF, "Guinea", "🇬🇳", "3X-"),
    (0x046000, 0x0463FF, "Ivory Coast", "🇨🇮", "TU-"),
    (0x048000, 0x048FFF, "Kenya", "🇰🇪", "5Y-"),
    (0x050000, 0x050FFF, "Madagascar", "🇲🇬", "5R-"),
    (0x054000, 0x0543FF, "Mali", "🇲🇱", "TZ-"),
    (0x058000, 0x0583FF, "Mauritius", "🇲🇺", "3B-"),
    (0x05A000, 0x05A3FF, "Niger", "🇳🇪", "5U-"),
    (0x05C000, 0x05CFFF, "Nigeria", "🇳🇬", "5N-"),
    (0x060000, 0x0603FF, "Senegal", "🇸🇳", "6V-"),
    (0x064000, 0x064FFF, "Sudan", "🇸🇩", "ST-"),
    (0x068000, 0x068FFF, "Tanzania", "🇹🇿", "5H-"),
    (0x06A000, 0x06A3FF, "Uganda", "🇺🇬", "5X-"),
    (0x06C000, 0x06CFFF, "DR Congo", "🇨🇩", "9Q-"),
    (0x070000, 0x070FFF, "Zambia", "🇿🇲", "9J-"),
    (0x100000, 0x1FFFFF, "Russian Federation", "🇷🇺", "RA-"),
    (0x201000, 0x2013FF, "Monaco", "🇲🇨", "3A-"),
    (0x202000, 0x2023FF, "San Marino", "🇸🇲", "T7-"),
    (0x300000, 0x33FFFF, "Italy", "🇮🇹", "I-"),
    (0x340000, 0x37FFFF, "Spain", "🇪🇸", "EC-"),
    (0x380000, 0x3BFFFF, "France", "🇫🇷", "F-"),
    (0x3C0000, 0x3FFFFF, "Germany", "🇩🇪", "D-"),
    (0x400000, 0x43FFFF, "United Kingdom", "🇬🇧", "G-"),
    (0x440000, 0x447FFF, "Austria", "🇦🇹", "OE-"),
    (0x448000, 0x44FFFF, "Belgium", "🇧🇪", "OO-"),
    (0x450000, 0x457FFF, "Bulgaria", "🇧🇬", "LZ-"),
    (0x458000, 0x45FFFF, "Denmark", "🇩🇰", "OY-"),
    (0x460000, 0x467FFF, "Finland", "🇫🇮", "OH-"),
    (0x468000, 0x46FFFF, "Greece", "🇬🇷", "SX-"),
    (0x470000, 0x477FFF, "Hungary", "🇭🇺", "HA-"),
    (0x478000, 0x47FFFF, "Norway", "🇳🇴", "LN-"),
    (0x480000, 0x487FFF, "Netherlands", "🇳🇱", "PH-"),
    (0x488000, 0x48FFFF, "Poland", "🇵🇱", "SP-"),
    (0x490000, 0x497FFF, "Portugal", "🇵🇹", "CS-"),
    (0x498000, 0x49FFFF, "Czech Republic", "🇨🇿", "OK-"),
    (0x4A0000, 0x4A7FFF, "Romania", "🇷🇴", "YR-"),
    (0x4A8000, 0x4AFFFF, "Sweden", "🇸🇪", "SE-"),
    (0x4B0000, 0x4B7FFF, "Switzerland", "🇨🇭", "HB-"),
    (0x4B8000, 0x4BFFFF, "Turkey", "🇹🇷", "TC-"),
    (0x4C0000, 0x4C3FFF, "Serbia", "🇷🇸", "YU-"),
    (0x4C4000, 0x4C4FFF, "Cyprus", "🇨🇾", "5B-"),
    (0x4C5000, 0x4C5FFF, "Iceland", "🇮🇸", "TF-"),
    (0x4C6000, 0x4C6FFF, "Ireland", "🇮🇪", "EI-"),
    (0x4C8000, 0x4C8FFF, "Luxembourg", "🇱🇺", "LX-"),
    (0x4CA000, 0x4CAFFF, "Ireland", "🇮🇪", "EI-"),
    (0x4CC000, 0x4CCFFF, "Lithuania", "🇱🇹", "LY-"),
    (0x4D0000, 0x4D0FFF, "Ukraine", "🇺🇦", "UR-"),
    (0x4D2000, 0x4D2FFF, "Slovakia", "🇸🇰", "OM-"),
    (0x4D4000, 0x4D4FFF, "Slovenia", "🇸🇮", "S5-"),
    (0x500000, 0x5003FF, "San Marino", "🇸🇲", "T7-"),
    (0x501000, 0x5013FF, "Albania", "🇦🇱", "ZA-"),
    (0x502C00, 0x502FFF, "Latvia", "🇱🇻", "YL-"),
    (0x503C00, 0x503FFF, "Estonia", "🇪🇪", "ES-"),
    (0x506C00, 0x506FFF, "Malta", "🇲🇹", "9H-"),
    (0x510000, 0x517FFF, "Lithuania", "🇱🇹", "LY-"),
    (0x600000, 0x6003FF, "Armenia", "🇦🇲", "EK-"),
    (0x680000, 0x6803FF, "Azerbaijan", "🇦🇿", "4K-"),
    (0x700000, 0x700FFF, "Afghanistan", "🇦🇫", "YA-"),
    (0x706000, 0x706FFF, "Qatar", "🇶🇦", "A7-"),
    (0x708000, 0x70FFFF, "Syria", "🇸🇾", "YK-"),
    (0x710000, 0x717FFF, "Saudi Arabia", "🇸🇦", "HZ-"),
    (0x718000, 0x71FFFF, "South Korea", "🇰🇷", "HL-"),
    (0x720000, 0x727FFF, "North Korea", "🇰🇵", "P-"),
    (0x730000, 0x737FFF, "Iraq", "🇮🇶", "YI-"),
    (0x738000, 0x73FFFF, "Iran", "🇮🇷", "EP-"),
    (0x740000, 0x747FFF, "Israel", "🇮🇱", "4X-"),
    (0x748000, 0x74FFFF, "Jordan", "🇯🇴", "JY-"),
    (0x750000, 0x757FFF, "Lebanon", "🇱🇧", "OD-"),
    (0x758000, 0x75FFFF, "Malaysia", "🇲🇾", "9M-"),
    (0x760000, 0x767FFF, "Philippines", "🇵🇭", "RP-"),
    (0x768000, 0x76FFFF, "Pakistan", "🇵🇰", "AP-"),
    (0x770000, 0x777FFF, "Singapore", "🇸🇬", "9V-"),
    (0x778000, 0x77FFFF, "Sri Lanka", "🇱🇰", "4R-"),
    (0x780000, 0x7BFFFF, "China", "🇨🇳", "B-"),
    (0x7C0000, 0x7FFFFF, "Australia", "🇦🇺", "VH-"),
    (0x800000, 0x83FFFF, "India", "🇮🇳", "VT-"),
    (0x840000, 0x87FFFF, "Japan", "🇯🇵", "JA-"),
    (0x880000, 0x887FFF, "Thailand", "🇹🇭", "HS-"),
    (0x888000, 0x88FFFF, "Vietnam", "🇻🇳", "VN-"),
    (0x896000, 0x896FFF, "United Arab Emirates", "🇦🇪", "A6-"),
    (0x899000, 0x899FFF, "Kuwait", "🇰🇼", "9K-"),
    (0x8A0000, 0x8A7FFF, "Indonesia", "🇮🇩", "PK-"),
    (0x8A8000, 0x8AFFFF, "Hong Kong", "🇭🇰", "B-H"),
    (0x8B0000, 0x8B7FFF, "Taiwan", "🇹🇼", "B-"),
    (0x8C0000, 0x8C7FFF, "Bahrain", "🇧🇭", "A9C-"),
    (0x900000, 0x9003FF, "Georgia", "🇬🇪", "4L-"),
    (0xA00000, 0xAFFFFF, "United States", "🇺🇸", "N-"),
    (0xC00000, 0xC3FFFF, "Canada", "🇨🇦", "C-"),
    (0xC80000, 0xC87FFF, "New Zealand", "🇳🇿", "ZK-"),
    (0xD00000, 0xD00FFF, "Chile", "🇨🇱", "CC-"),
    (0xE00000, 0xE3FFFF, "Argentina", "🇦🇷", "LV-"),
    (0xE40000, 0xE7FFFF, "Brazil", "🇧🇷", "PP-"),
    (0xE80000, 0xE80FFF, "Colombia", "🇨🇴", "HK-"),
    (0xEC0000, 0xEC0FFF, "Mexico", "🇲🇽", "XA-"),
]

# Airline / Operator database by 3-letter ICAO prefix
AIRLINE_DATABASE = {
    "BAW": ("British Airways", "United Kingdom", "Commercial Jet"),
    "RYR": ("Ryanair", "Ireland", "Commercial Jet"),
    "EZY": ("easyJet", "United Kingdom", "Commercial Jet"),
    "EXS": ("Jet2.com", "United Kingdom", "Commercial Jet"),
    "VIR": ("Virgin Atlantic", "United Kingdom", "Heavy Commercial Jet"),
    "TOM": ("TUI Airways", "United Kingdom", "Commercial Jet"),
    "LOG": ("Loganair", "United Kingdom", "Turboprop / Regional"),
    "BEE": ("Flybe", "United Kingdom", "Turboprop / Regional"),
    "WZZ": ("Wizz Air", "Hungary", "Commercial Jet"),
    "DLH": ("Lufthansa", "Germany", "Commercial Jet"),
    "AFR": ("Air France", "France", "Commercial Jet"),
    "KLM": ("KLM Royal Dutch Airlines", "Netherlands", "Commercial Jet"),
    "EIN": ("Aer Lingus", "Ireland", "Commercial Jet"),
    "IBE": ("Iberia", "Spain", "Commercial Jet"),
    "TAP": ("TAP Air Portugal", "Portugal", "Commercial Jet"),
    "SAS": ("Scandinavian Airlines", "Sweden", "Commercial Jet"),
    "FIN": ("Finnair", "Finland", "Commercial Jet"),
    "THY": ("Turkish Airlines", "Turkey", "Commercial Jet"),
    "SWR": ("Swiss International", "Switzerland", "Commercial Jet"),
    "AUA": ("Austrian Airlines", "Austria", "Commercial Jet"),
    "BEL": ("Brussels Airlines", "Belgium", "Commercial Jet"),
    "ROT": ("TAROM", "Romania", "Commercial Jet"),
    "LOT": ("LOT Polish Airlines", "Poland", "Commercial Jet"),
    "AEE": ("Aegean Airlines", "Greece", "Commercial Jet"),
    "ICE": ("Icelandair", "Iceland", "Commercial Jet"),
    "AAL": ("American Airlines", "United States", "Heavy Commercial Jet"),
    "DAL": ("Delta Air Lines", "United States", "Heavy Commercial Jet"),
    "UAL": ("United Airlines", "United States", "Heavy Commercial Jet"),
    "SWA": ("Southwest Airlines", "United States", "Commercial Jet"),
    "FDX": ("FedEx Express", "United States", "Heavy Cargo"),
    "UPS": ("UPS Airlines", "United States", "Heavy Cargo"),
    "GTI": ("Atlas Air Cargo", "United States", "Heavy Cargo"),
    "UAE": ("Emirates", "United Arab Emirates", "Heavy Commercial Jet"),
    "QTR": ("Qatar Airways", "Qatar", "Heavy Commercial Jet"),
    "ETD": ("Etihad Airways", "United Arab Emirates", "Heavy Commercial Jet"),
    "SIA": ("Singapore Airlines", "Singapore", "Heavy Commercial Jet"),
    "QFA": ("Qantas", "Australia", "Heavy Commercial Jet"),
    "ANZ": ("Air New Zealand", "New Zealand", "Heavy Commercial Jet"),
    "ANA": ("All Nippon Airways", "Japan", "Heavy Commercial Jet"),
    "JAL": ("Japan Airlines", "Japan", "Heavy Commercial Jet"),
    "CPA": ("Cathay Pacific", "Hong Kong", "Heavy Commercial Jet"),
    "CCA": ("Air China", "China", "Heavy Commercial Jet"),
    "CES": ("China Eastern", "China", "Commercial Jet"),
    "CSN": ("China Southern", "China", "Commercial Jet"),
    "RCH": ("USAF Mobility Command (Reach)", "United States", "Military Heavy"),
    "PAT": ("US Army Priority Transport", "United States", "Military VIP"),
    "RRR": ("RAF Ascot Transport", "United Kingdom", "Military Heavy"),
    "RFR": ("Royal Air Force", "United Kingdom", "Military Combat / Multi-Role"),
    "CWL": ("RAF Cranwell Training", "United Kingdom", "Military Trainer"),
    "SYS": ("RAF Shawbury Training", "United Kingdom", "Military Helicopter"),
    "VLL": ("RAF Valley Fighter Training", "United Kingdom", "Military Fighter"),
    "NVY": ("Royal Navy Fleet Air Arm", "United Kingdom", "Military Naval"),
    "AAC": ("Army Air Corps", "United Kingdom", "Military Helicopter"),
    "CGH": ("HM Coastguard Search & Rescue", "United Kingdom", "Helicopter / SAR"),
    "POL": ("UK National Police Air Service", "United Kingdom", "Police Helicopter"),
    "HEMS": ("UK Air Ambulance Service", "United Kingdom", "EMS Helicopter"),
    "GAF": ("German Air Force (Luftwaffe)", "Germany", "Military Combat"),
    "FAF": ("French Air and Space Force", "France", "Military Combat"),
    "IAM": ("Italian Air Force", "Italy", "Military Combat"),
    "AME": ("Spanish Air Force", "Spain", "Military Combat"),
    "NATO": ("NATO Strategic Airlift / E-3 AWACS", "NATO", "Military AWACS / Recon"),
}

# Transponder Squawk Special & Standard Codes
SQUAWK_CODES = {
    "7700": ("🚨 GENERAL EMERGENCY", "High Priority Emergency declared by flight crew"),
    "7600": ("📻 RADIO FAILURE", "Total loss of two-way radio communications"),
    "7500": ("🛑 HIJACK / UNLAWFUL INTERFERENCE", "Aircraft subject to unlawful interference"),
    "7000": ("VFR Standard (UK/Europe)", "Standard conspicuity code for Visual Flight Rules"),
    "1200": ("VFR Standard (USA/Canada)", "Standard visual flight rules code in North America"),
    "2000": ("IFR / Oceanic Default", "Instrument flight rules code without specific assignment"),
    "7777": ("Military Intercept / Test", "Ground transponder test or military intercept"),
    "0033": ("Parachute Operations (UK)", "Aircraft engaged in skydiving / parachute drops"),
    "0024": ("Police / Air Ambulance (UK)", "Air ambulance or police air support mission"),
    "7004": ("Aerobatic Flight (UK)", "Aircraft performing aerobatic maneuvers"),
    "7010": ("VFR Aerodrome Circuit (UK)", "Aircraft flying in airport traffic pattern / circuit"),
    "0020": ("Low-Level Helicopter (UK)", "Rotary wing aircraft operating at low altitude"),
    "0023": ("Search and Rescue (UK)", "SAR helicopter / maritime patrol operation"),
}

def lookup_icao_country(icao_hex: str) -> Tuple[str, str, str]:
    """Returns (Country Name, Flag Emoji, Registration Prefix) for an ICAO 24-bit address."""
    try:
        val = int(icao_hex, 16)
        for start, end, country, flag, prefix in ICAO_COUNTRY_RANGES:
            if start <= val <= end:
                return country, flag, prefix
    except Exception:
        pass
    return "International / Other", "🌐", ""

def calculate_distance_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> Tuple[float, float]:
    """
    Calculates distance in Nautical Miles and true bearing in degrees (0-359)
    from (lat1, lon1) to (lat2, lon2) using Great Circle / Haversine.
    """
    R_NM = 3440.065 # Earth radius in Nautical Miles
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(max(0.0, a)), math.sqrt(max(0.0, 1.0 - a)))
    dist_nm = R_NM * c
    
    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    bearing_rad = math.atan2(y, x)
    bearing_deg = (math.degrees(bearing_rad) + 360.0) % 360.0
    
    return dist_nm, bearing_deg

def format_dms(lat: float, lon: float) -> str:
    """Formats decimal latitude & longitude into standard Degrees Minutes Seconds (DMS)."""
    lat_dir = "N" if lat >= 0 else "S"
    lon_dir = "E" if lon >= 0 else "W"
    
    abs_lat = abs(lat)
    lat_deg = int(abs_lat)
    lat_min = int((abs_lat - lat_deg) * 60)
    lat_sec = int(((abs_lat - lat_deg) * 60 - lat_min) * 60)
    
    abs_lon = abs(lon)
    lon_deg = int(abs_lon)
    lon_min = int((abs_lon - lon_deg) * 60)
    lon_sec = int(((abs_lon - lon_deg) * 60 - lon_min) * 60)
    
    return f"{lat_deg}°{lat_min:02d}'{lat_sec:02d}\"{lat_dir}, {lon_deg}°{lon_min:02d}'{lon_sec:02d}\"{lon_dir}"

class Aircraft:
    """
    Represents a real-world airborne aircraft decoded via Mode-S ADS-B 1090 MHz SDR radio.
    Enforces strict validation to ensure ONLY genuine aircraft are represented.
    """
    def __init__(self, icao: str):
        self.icao: str = icao.upper().strip()
        self.callsign: Optional[str] = None
        self.latitude: Optional[float] = None
        self.longitude: Optional[float] = None
        self.altitude: Optional[float] = None # Barometric altitude in feet
        self.geom_altitude: Optional[float] = None # GNSS geometric altitude in feet
        self.speed: Optional[float] = None # Ground speed in knots
        self.heading: Optional[float] = None # True track in degrees (0-359)
        self.vertical_rate: Optional[float] = None # Vertical climb/descent in ft/min
        self.squawk: Optional[str] = None # 4-digit octal transponder code
        self.emitter_category: Optional[str] = None # Wake / Emitter category
        self.downlink_format: str = "DF17 (ADS-B)"
        self.receiver_source: str = "HackRF One" # SDR device name
        
        # Geolocation relative to station
        self.distance_nm: Optional[float] = None
        self.bearing_deg: Optional[float] = None
        
        # RF Telemetry
        self.signal_db: float = -18.0
        self.msg_count: int = 0
        self.first_seen: float = time.time()
        self.last_seen: float = time.time()
        
        # Lookups
        country, flag, prefix = lookup_icao_country(self.icao)
        self.country: str = country
        self.country_flag: str = flag
        self.reg_prefix: str = prefix
        self.airline_name: Optional[str] = None
        self.aircraft_type: str = "Civilian"
        
        # Trail history (last 25 points)
        self.history: List[Dict[str, Any]] = []
        self.max_history: int = 25

    def update_position(self, lat: float, lon: float, alt: Optional[float] = None, timestamp: Optional[float] = None):
        """Updates aircraft physical GPS coordinate and records trajectory."""
        if timestamp is None:
            timestamp = time.time()
            
        # Basic sanity check: eliminate corrupt 0.0, 0.0 or out-of-world values
        if abs(lat) > 90.0 or abs(lon) > 180.0 or (abs(lat) < 0.001 and abs(lon) < 0.001):
            return
            
        self.latitude = lat
        self.longitude = lon
        if alt is not None:
            self.altitude = alt
        self.last_seen = timestamp
        self.msg_count += 1
        
        self.history.append({
            "lat": lat,
            "lon": lon,
            "alt": self.altitude or 0,
            "time": timestamp
        })
        if len(self.history) > self.max_history:
            self.history.pop(0)

    def update_radar_coords(self, station_lat: float, station_lon: float):
        """Calculates distance and bearing relative to the station."""
        if self.latitude is not None and self.longitude is not None:
            dist, bearing = calculate_distance_bearing(
                station_lat, station_lon, self.latitude, self.longitude
            )
            self.distance_nm = round(dist, 2)
            self.bearing_deg = round(bearing, 1)

    def extrapolate_position(self, current_time: float):
        """Dead reckoning extrapolation for smooth radar updates."""
        if self.latitude is None or self.longitude is None or self.speed is None or self.heading is None:
            return
            
        dt = current_time - self.last_seen
        if 0.5 < dt < 60.0:
            speed_deg_per_sec = (self.speed / 3600.0) / 60.0
            hdg_rad = math.radians(self.heading)
            cos_lat = max(0.01, math.cos(math.radians(self.latitude)))
            dlat = speed_deg_per_sec * math.cos(hdg_rad) * dt
            dlon = speed_deg_per_sec * math.sin(hdg_rad) / cos_lat * dt
            
            self.latitude += dlat
            self.longitude += dlon
            
            if self.vertical_rate:
                self.altitude = max(0.0, (self.altitude or 0.0) + (self.vertical_rate / 60.0) * dt)
                
            self.last_seen = current_time

    def classify_aircraft(self) -> str:
        """Determines aircraft type and operator by analyzing callsign, squawk, speed, and altitude."""
        cs = (self.callsign or "").upper().strip()
        sq = self.squawk or ""
        spd = self.speed or 0
        alt = self.altitude or 0
        
        # Check emergencies
        if sq == "7700":
            return "EMERGENCY"
        elif sq == "7600":
            return "RADIO_FAIL"
        elif sq == "7500":
            return "HIJACK"
            
        # Check airline database by prefix (3-letter ICAO)
        if len(cs) >= 3:
            prefix = cs[:3]
            if prefix in AIRLINE_DATABASE:
                airline, _, default_type = AIRLINE_DATABASE[prefix]
                self.airline_name = airline
                return default_type
                
        # Military callsign signatures or high supersonic speeds
        military_callsigns = (
            "VIPER", "REACH", "RAID", "HAWK", "TOPGUN", "GHOST", "BLADE", "TYPHOON",
            "NATO", "USAF", "RAF", "NAVY", "JAG", "BOMBER", "WARTHOG", "COBRA",
            "VALKYRIE", "ASCOT", "DRAGON", "POACHER", "SNOOPY", "REDARROW", "KNIGHT"
        )
        if any(cs.startswith(p) for p in military_callsigns) or (spd > 550 and alt > 25000):
            return "Military Combat / Fighter"
            
        # Helicopter indicators
        if any(cs.startswith(p) for p in ("HEMS", "POL", "CGH", "SAR", "MEDEVAC", "RESCUE")):
            return "Helicopter / SAR"
            
        # Speed & Altitude heuristics
        if alt > 20000 or spd > 350:
            return "Commercial Airliner"
        elif spd > 220:
            return "Regional Jet / Turboprop"
        elif spd < 140 and alt < 12000:
            return "Light GA / Cessna"
            
        return "Civilian Aircraft"

    def is_valid_aircraft(self) -> bool:
        """
        Validates that this entity is STRICTLY a real airborne aircraft,
        filtering out ground service vehicles, surface emergency trucks, and corrupted test packets.
        """
        # ICAO must be 6 hex characters
        if not self.icao or len(self.icao) != 6:
            return False
            
        # Filter surface vehicle emitter categories if present
        if self.emitter_category in ("Surface Vehicle", "Ground Vehicle", "Point Obstacle", "Cluster Obstacle"):
            return False
            
        # Coordinates must be valid
        if self.latitude is not None and self.longitude is not None:
            if abs(self.latitude) > 90.0 or abs(self.longitude) > 180.0:
                return False
            if abs(self.latitude) < 0.001 and abs(self.longitude) < 0.001:
                return False
                
        return True

    def to_dict(self) -> Dict[str, Any]:
        """Serializes full telemetry & SDR radio data for the frontend."""
        flight_type = self.classify_aircraft()
        is_emergency = self.squawk in ("7700", "7600", "7500") or flight_type in ("EMERGENCY", "RADIO_FAIL", "HIJACK")
        
        # Squawk description
        squawk_desc = "Standard Mode-A/C Transponder"
        if self.squawk in SQUAWK_CODES:
            squawk_desc = f"{SQUAWK_CODES[self.squawk][0]} — {SQUAWK_CODES[self.squawk][1]}"
            
        # Vertical Rate Trend
        vtrend = "LEVEL ━"
        if self.vertical_rate is not None:
            if self.vertical_rate > 200:
                vtrend = f"CLIMBING ▲ +{int(self.vertical_rate)} FPM"
            elif self.vertical_rate < -200:
                vtrend = f"DESCENDING ▼ {int(self.vertical_rate)} FPM"
                
        # Flight Level calculation
        flight_level = None
        if self.altitude is not None:
            if self.altitude >= 10000:
                flight_level = f"FL{int(round(self.altitude / 100))}"
            else:
                flight_level = f"A{int(round(self.altitude / 100)):03d}"
                
        # Metric & Imperial Conversions
        alt_m = round(self.altitude * 0.3048) if self.altitude is not None else None
        spd_mph = round(self.speed * 1.15078) if self.speed is not None else None
        spd_kmh = round(self.speed * 1.852) if self.speed is not None else None
        mach_estimate = round(self.speed / 661.47, 2) if self.speed is not None else None
        dist_km = round(self.distance_nm * 1.852, 1) if self.distance_nm is not None else None
        dist_mi = round(self.distance_nm * 1.15078, 1) if self.distance_nm is not None else None
        
        # Formatted GPS
        gps_dms = format_dms(self.latitude, self.longitude) if self.latitude is not None and self.longitude is not None else "---"
        
        # Signal Quality (0-100%)
        sig_quality = max(5, min(100, int(((self.signal_db + 40.0) / 45.0) * 100)))

        return {
            "icao": self.icao,
            "callsign": (self.callsign or "---").strip(),
            "country": self.country,
            "country_flag": self.country_flag,
            "airline": self.airline_name or "General Aviation / Independent",
            "type": flight_type,
            "lat": round(self.latitude, 5) if self.latitude is not None else None,
            "lon": round(self.longitude, 5) if self.longitude is not None else None,
            "dms": gps_dms,
            "alt": round(self.altitude) if self.altitude is not None else None,
            "alt_m": alt_m,
            "flight_level": flight_level,
            "speed": round(self.speed) if self.speed is not None else None,
            "speed_mph": spd_mph,
            "speed_kmh": spd_kmh,
            "mach": mach_estimate,
            "heading": round(self.heading) if self.heading is not None else None,
            "vrate": round(self.vertical_rate) if self.vertical_rate is not None else None,
            "vtrend": vtrend,
            "squawk": self.squawk or "----",
            "squawk_desc": squawk_desc,
            "distance_nm": self.distance_nm,
            "distance_km": dist_km,
            "distance_mi": dist_mi,
            "bearing_deg": self.bearing_deg,
            "signal_db": round(self.signal_db, 1),
            "signal_quality": sig_quality,
            "msg_count": self.msg_count,
            "downlink_format": self.downlink_format,
            "receiver_source": self.receiver_source,
            "last_seen": round(self.last_seen, 1),
            "age_sec": round(time.time() - self.last_seen, 1),
            "is_emergency": is_emergency,
            "history": self.history[-15:]
        }

