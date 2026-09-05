#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================================="
echo "    TACTICAL SDR AIRCRAFT RADAR SYSTEM"
echo "=========================================================="

# Build C ADS-B demodulator if needed
if [ ! -f "sdr/adsb_demod" ]; then
    echo "[*] Building high-performance Mode-S demodulator..."
    gcc -O3 sdr/adsb_demod.c -o sdr/adsb_demod -lm
fi

# Build RTL-SDR streaming utility if needed
if [ ! -f "sdr/rtl_sdr" ]; then
    echo "[*] Building RTL-SDR Mode-S streaming utility..."
    gcc -O3 sdr/rtl_sdr.c -o sdr/rtl_sdr -ldl
fi

# Ensure Python venv exists
if [ ! -d "venv" ]; then
    echo "[*] Initializing virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r requirements.txt
fi

# Detect HackRF
echo "[*] Checking for HackRF device..."
if which hackrf_info >/dev/null 2>&1; then
    hackrf_info 2>&1 | head -n 4 || true
fi

echo ""
echo "[*] Launching Radar Station server on http://localhost:8000"
echo "[*] Open http://localhost:8000 in your browser or application window"
echo ""

# Launch application
exec ./venv/bin/python3 app.py
