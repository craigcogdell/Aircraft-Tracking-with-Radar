<div align="center">

```
 █████╗ ███████╗██████╗  ██████╗       ███████╗██████╗ ██████╗     ██████╗  █████╗ ██████╗  █████╗ ██████╗ 
██╔══██╗██╔════╝██╔══██╗██╔═══██╗      ██╔════╝██╔══██╗██╔══██╗    ██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔══██╗
███████║█████╗  ██████╔╝██║   ██║█████╗███████╗██║  ██║██████╔╝    ██████╔╝███████║██║  ██║███████║██████╔╝
██╔══██║██╔══╝  ██╔══██╗██║   ██║╚════╝╚════██║██║  ██║██╔══██╗    ██╔══██╗██╔══██║██║  ██║██╔══██║██╔══██╗
██║  ██║███████╗██║  ██║╚██████╔╝      ███████║██████╔╝██║  ██║    ██║  ██║██║  ██║██████╔╝██║  ██║██║  ██║
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝       ╚══════╝╚═════╝ ╚═╝  ╚═╝    ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
```

### 🛰️ Tactical Airspace Surveillance & Software Defined Radio (SDR) Radar System
**1090 MHz Mode-S / ADS-B Aircraft Interceptor • Multi-SDR Hardware Support • 50-Mile PPI Tactical Scope**

---

[![Platform: Linux](https://img.shields.io/badge/Platform-Linux-orange.svg?style=flat-square&logo=linux)](https://github.com)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg?style=flat-square&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![SDR: HackRF One](https://img.shields.io/badge/SDR-HackRF%20One%20(8MSPS)-green.svg?style=flat-square)](https://greatscottgadgets.com/hackrf/one/)
[![SDR: RTL--SDR](https://img.shields.io/badge/SDR-RTL--SDR%20(v3%2Fv4)-blueviolet.svg?style=flat-square)](https://www.rtl-sdr.com)
[![SDR: BladeRF / Airspy](https://img.shields.io/badge/SDR-BladeRF%20%7C%20Airspy-cyan.svg?style=flat-square)](https://nuand.com)
[![ADS-B: 1090 MHz](https://img.shields.io/badge/Frequency-1090.0%20MHz-red.svg?style=flat-square)](https://en.wikipedia.org/wiki/Automatic_Dependent_Surveillance%E2%80%93Broadcast)
[![Audio: Web Audio API](https://img.shields.io/badge/Audio-Acoustic%20Synthesizer-yellow.svg?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey.svg?style=flat-square)](LICENSE)

</div>

---

## 🎯 Tactical Radar Scope Visualizer

```
                    330°           000° (N)          030°
                      \               │               /
                       \              │  BAW183      /
                        \    ·  ·  ·  │  ▲ FL340    /
                         \ ·          │          · /
                          \     RYR405│           /
               300° ·  ·   \    ▲ FL145           /   ·  · 060°
                   ·        \         │          /        ·
                  ·          \        │         /          ·
                 ·            \       │        /            ·
           (W)  ·              \      │       /              ·  (E)
          270° ─────────────────┼─────┼───────┼─────────────── 090°
                 ·             /│     │ ⊙ BASE│               ·
                  ·           / │     │(SA1 8LY)             ·
                   ·         /  │     │       │\   RRR992   ·
               240° ·  ·    /   │15MI │ 25MI  │ \  ▲ 590KT ·  · 120°
                          /     │     │       │  \ (TYPHOON)
                         / ·    │50MI │       │   \      ·
                        /    ·  ·  ·  │  ·  · ·    \
                       /              │             \
                      /               │  MAYDAY77    \
                    210°           180° (S)   🚨 7700 150°

 ┌─────────────────────────┐ ┌────────────────────────────────────────────────────────┐
 │   TACTICAL CONTROL      │ │               TARGET DATA INSPECTOR (RIGHT)            │
 ├─────────────────────────┤ ├────────────────────────────────────────────────────────┤
 │ 📻 Radio: HACKRF ONE    │ │ 🎯 LOCKED: BAW183 (0x400A2C)  [🇬🇧 British Airways]    │
 │ ⚡ Rate:  8.0 MSPS      │ │ ✈️ Type:   Commercial Jet / Airbus A350-1000           │
 │ 🔊 Audio: SYNTHESIZER ON│ │ 📈 Alt:    34,000 FT (FL340) • 10,363 m [▲ +450 FPM]   │
 │ 🛰️ Mode:  REAL-WORLD RF │ │ 🚀 Speed:  485 KTS (558 MPH / 898 KM/H) [Mach 0.78]   │
 │ 📍 Base:  Swansea Base  │ │ 🧭 Track:  268° W • Range: 14.2 NM • Azimuth: 288° NW │
 │           (51.62,-3.94) │ │ 📡 Squawk: 4215 (Civil Conspicuity) • RSSI: -12.4 dB   │
 └─────────────────────────┘ └────────────────────────────────────────────────────────┘
```

---

## 📻 Supported Radio Hardware & Operating Modes

**AERO-SDR RADAR™** allows instantaneous, seamless switching between physical SDR hardware receivers, network streams, and a realistic flight simulator:

| Device / Source | Operating Mode | Sample Rate | Tuner & RF Gain Control | Protocol / Drivers |
| :--- | :--- | :--- | :--- | :--- |
| **HackRF One** | Physical RF Hardware | **8.0 MSPS / 2.0 MSPS** | LNA (0–40 dB), VGA (0–62 dB), 14 dB Pre-Amp, 3.3V Bias-T | Native `libhackrf` / `hackrf_transfer` |
| **RTL-SDR** (v3 / v4 / Pro Stick) | Physical RF Hardware | **2.0 MSPS** | Tuner (0–49.6 dB / Auto), PPM correction, 4.5V Bias-Tee | `rtl_sdr` / `pyrtlsdr` (RTL2832U) |
| **BladeRF** (x40 / x115 / Micro) | Physical RF Hardware | **8.0 MSPS** | RX Gain (0–60 dB) | `bladeRF-cli` Mode-S capture |
| **Airspy** (R2 / Mini) | Physical RF Hardware | **6.0 MSPS** | Airspy Gain (0–21), Bias-Tee | `airspy_rx` / `airspy_adsb` |
| **Network Receiver** | TCP / HTTP Network Stream | Network Packets | N/A (Remote Radio Server) | Raw Mode-S (30002), Beast (30005), SBS-1 (30003), JSON |
| **100% Real-World Live Airspace** | Global Transponder Feed | 1.0 Hz Push | Automatic Station Coordinates (Swansea SA1 8LY) | Real physical Mode-S aircraft transponders |
| **🎮 Tactical Flight Simulator** | Kinematic Flight Simulator | 20 Hz Physics | Dynamic Simulated Airspace Traffic | Airliners, RAF Eurofighters, SAR Helicopters, Emergencies |

---

## 🔊 Authentic Real-World Radar Acoustic Synthesizer

Engineered with the **Web Audio API** to deliver authentic primary/secondary air surveillance acoustic signatures:

* **Resonant Dual-Harmonic Contact Ping**:
  - Dual-oscillator acoustic hit (primary resonance $1000\text{--}1450\text{ Hz}$ + subharmonic body overtone at $500\text{--}725\text{ Hz}$) with an exponential cavity decay envelope simulating cathode speaker hits when the rotating radar sweep beam illuminates an aircraft.
* **Sweep Revolution Cathode Pulse**:
  - Subtle low-frequency cathode sweep hum ($60\text{--}110\text{ Hz}$) as the rotating sweep beam completes each $360^\circ$ revolution past North.
* **AWACS Tactical Target Lock Chirp**:
  - Ascending double-chirp confirmation tone ($1760\text{ Hz} \rightarrow 2640\text{ Hz}$) when locking onto any aircraft target.
* **Squawk 7700 Emergency Alert Warble**:
  - Pulsating dual-frequency ATC emergency alarm ($880\text{ Hz} / 1320\text{ Hz}$ warble).

---

## 🎯 Interactive Aircraft Data Inspector (Right Panel)

Clicking any aircraft contact on the radar scope or in the contacts table immediately locks tactical crosshairs and displays all telemetry pulled from the SDR radio and Mode-S transponder:

```
┌─────────────────────────────────────────────────────────────┐
│ 🎯 TARGET LOCKED                     🚨 ACTIVE SQUAWK 7700  │
│                                                             │
│  🇬🇧  BAW183                                                │
│  British Airways                                            │
│  ICAO: 0x400A2C • United Kingdom (Commercial Jet / A350)   │
├──────────────────────────────┬──────────────────────────────┤
│ ALTITUDE (BAROMETRIC)        │ VERTICAL CLIMB/DESCENT TREND │
│ 34,000 FT (FL340)            │ ▲ CLIMBING +450 FPM          │
│ 10,363 meters                │                              │
├──────────────────────────────┼──────────────────────────────┤
│ GROUND SPEED & MACH          │ TRUE TRACK / HEADING         │
│ 485 KTS                      │ 268° W                       │
│ 558 MPH • Mach 0.78          │ Heading Vector Projection    │
├──────────────────────────────┴──────────────────────────────┤
│ DISTANCE & BEARING TO RADAR                                 │
│ 14.2 NM (16.3 mi / 26.3 km) • Azimuth: 288° NW (10 o'clock) │
├─────────────────────────────────────────────────────────────┤
│ TRANSPONDER SQUAWK CODE                                     │
│ 4215 — Standard ATC Civil Conspicuity Assigned              │
├─────────────────────────────────────────────────────────────┤
│ SDR RADIO SIGNAL QUALITY                                    │
│ -12.4 dB  ████████████████████░░░░░ 78% (HackRF 8 MSPS)     │
├─────────────────────────────────────────────────────────────┤
│ EXACT GEOLOCATION                                           │
│ 51.64210°, -4.01250° • 51°38'31" N, 4°00'45" W             │
├─────────────────────────────────────────────────────────────┤
│ MODE-S PROTOCOL FRAME                                       │
│ DF17 (ADS-B 1090MHz Extended Squitter) • 1,420 Packets      │
├─────────────────────────────────────────────────────────────┤
│ EXTERNAL LIVE FLIGHT LOOKUP                                 │
│ [🌐 FlightRadar24] [📡 ADS-B Exchange] [✈️ RadarBox] [🗺️ FlightAware]│
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ System Architecture

```
                               ┌────────────────────────────────────────────────┐
                               │             SDR HARDWARE / FEEDS               │
                               │  • HackRF One (8 MSPS / 2 MSPS Signed IQ)      │
                               │  • RTL-SDR (2 MSPS Unsigned IQ)                │
                               │  • BladeRF / Airspy / Network dump1090         │
                               │  • 100% Real-World Live Airspace Stream        │
                               │  • 🎮 Tactical Airspace Flight Simulator       │
                               └──────────────────────┬─────────────────────────┘
                                                      │ (IQ Data / Mode-S Stream)
                                                      ▼
                               ┌────────────────────────────────────────────────┐
                               │           sdr/adsb_demod (Native C)            │
                               │  • 4-Sample Pulse Slicing & Peak Correlation   │
                               │  • Dynamic DC Baseline Subtraction             │
                               │  • Manchester Bit Decoding (112-bit & 56-bit)  │
                               │  • 1-Bit Parity Error Correction (Syndrome)    │
                               └──────────────────────┬─────────────────────────┘
                                                      │ (Hex Mode-S Frames)
                                                      ▼
                               ┌────────────────────────────────────────────────┐
                               │           sdr/adsb_decoder.py (pyModeS)        │
                               │  • Downlink Format Parsing (DF17, 18, 20, 21)  │
                               │  • CPR Airborne Position Decoding              │
                               │  • Emitter Category & Surface Vehicle Filter   │
                               └──────────────────────┬─────────────────────────┘
                                                      │ (Enriched Aircraft State)
                                                      ▼
                               ┌────────────────────────────────────────────────┐
                               │            tracker/radar_engine.py             │
                               │  • Great Circle Distance (NM) & Azimuth (0-359)│
                               │  • Dead-Reckoning Extrapolation                │
                               │  • Emergency Squawk Detection (7700/7600/7500) │
                               │  • Strict Aircraft-Only Filtering              │
                               └──────────────────────┬─────────────────────────┘
                                                      │ (WebSocket 20 FPS)
                                                      ▼
                               ┌────────────────────────────────────────────────┐
                               │          TACTICAL RADAR PPI INTERFACE          │
                               │  • Rotating Phosphor Sweep Beam (0–60 RPM)     │
                               │  • 50-Mile Scope with Concentric Range Rings   │
                               │  • Interactive Aircraft Target Locking Reticle │
                               │  • Right-Side Rich Aircraft Data Inspector     │
                               │  • Web Audio Authentic Radar Ping Synthesizer  │
                               └────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Launch the Radar Station
Run the automated startup script (automatically compiles the native C demodulator, verifies dependencies, and launches the station):

```bash
cd /home/craig/Desktop/aircraf-tracker
./start_radar.sh
```

Or start manually with Python:
```bash
make all
./venv/bin/python3 app.py
```

Open your browser at: **`http://localhost:8000`**

### 2. Station GPS Calibration
* Defaults to **Swansea Base (`SA1 8LY`)** at `51.6214° N, -3.9436° W`.
* To calibrate to your exact location, click **"🎯 Set to My Exact GPS Location"** in the left sidebar to calibrate via browser GPS or enter custom Lat/Lon coordinates.

---

## 📂 Project Structure

```
aircraf-tracker/
├── app.py                      # FastAPI + WebSocket radar backend server
├── start_radar.sh              # One-click build & startup launcher
├── Makefile                    # High-performance C demodulator compiler
├── requirements.txt            # Python dependencies (pyModeS, fastapi, uvicorn, numpy, pyrtlsdr)
├── README.md                   # System documentation
├── sdr/
│   ├── adsb_demod.c            # Multi-rate 8MSPS/2MSPS C demodulator + 1-bit CRC fix
│   ├── adsb_decoder.py         # Mode-S parser (pyModeS, DF formats + CPR tracking)
│   ├── sdr_manager.py          # Unified Multi-SDR coordinator & USB auto-scanner
│   ├── hackrf_receiver.py      # HackRF SDR manager & subprocess pipeline
│   ├── rtlsdr_receiver.py      # RTL-SDR (RTL2832U/v3/v4) receiver controller
│   ├── bladerf_receiver.py     # BladeRF (x40/x115/Micro) receiver controller
│   ├── airspy_receiver.py      # Airspy (R2/Mini) receiver controller
│   ├── live_feed_receiver.py   # 100% Real-World Live Airspace feed receiver
│   ├── dummy_simulator.py      # Tactical Dummy Airspace Flight Simulator
│   └── network_receiver.py     # dump1090 / readsb / Beast / SBS network connector
├── tracker/
│   ├── aircraft.py             # Aircraft state, ICAO country/flag lookup, airline database & unit conversions
│   └── radar_engine.py         # Central radar tracking coordinator & strict aircraft filter
└── static/
    ├── index.html              # Tactical Radar GUI with Multi-SDR selector & Target Inspector
    ├── css/
    │   └── radar.css           # CRT styling, phosphor bloom, signal meters & bezel layout
    └── js/
        ├── radar_canvas.js     # Canvas PPI radar renderer, chevron glyphs & airspace overlays
        ├── radar_audio.js      # Web Audio authentic radar ping synthesizer
        └── app.js              # WebSocket client, Multi-SDR manager & rich target inspector
```

---

## 📡 REST & WebSocket API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| **`/api/state`** | `GET` | Returns full radar snapshot, station coordinates, active SDR statistics, emergencies, and tracked aircraft. |
| **`/api/sdr/devices`** | `GET` | Scans USB bus and returns available SDR hardware (HackRF, RTL-SDR, BladeRF, Airspy, Network, Live Feed, Dummy Sim). |
| **`/api/sdr/start`** | `POST` | Starts any selected SDR device, live feed, or dummy simulator with custom parameters. |
| **`/api/sdr/stop`** | `POST` | Stops the active SDR hardware receiver. |
| **`/api/aircraft/{icao}`** | `GET` | Returns full detailed telemetry and radio metrics for a single aircraft by ICAO hex. |
| **`/api/station`** | `POST` | Updates radar station name, latitude, longitude, and scope radius. |
| **`/api/sweep`** | `POST` | Sets radar sweep speed in RPM (0 to 60). |
| **`/ws`** | `WebSocket` | Real-time bi-directional telemetry stream (20 FPS). |

---

<div align="center">
<b>AERO-SDR RADAR™ • Tactical Airspace Surveillance System</b><br>
Crafted for HackRF One, RTL-SDR, and 1090 MHz Mode-S / ADS-B Aviation Tracking.
</div>



