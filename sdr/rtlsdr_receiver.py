import subprocess
import os
import shutil
import logging
import threading
import time
import signal
from typing import Optional, Callable, Dict, Any

logger = logging.getLogger("RTLSDR_Receiver")

class RTLSDRReceiver:
    """
    RTL-SDR (RTL2832U / R820T2 / v3 / v4 / FlightAware Pro Stick) Receiver Controller.
    Supports rtl_sdr piped to adsb_demod, rtl_adsb, pyrtlsdr, and dump1090.
    """
    def __init__(self, callback: Optional[Callable[[str], None]] = None):
        self.callback = callback
        self.process: Optional[subprocess.Popen] = None
        self.demod_process: Optional[subprocess.Popen] = None
        self.is_running = False
        self.frequency = 1090000000 # 1090 MHz
        self.sample_rate = 2000000 # 2 MSPS
        self.gain = 49.6 # Max gain dB (or 'auto')
        self.ppm = 0 # Frequency correction
        self.bias_tee = 0 # 1 to enable 4.5V bias tee on v3/v4
        
        self.frames_received = 0
        self.start_time = 0.0
        self.status_message = "Idle"
        self._reader_thread: Optional[threading.Thread] = None

    @staticmethod
    def is_rtlsdr_available() -> Dict[str, Any]:
        """Detects whether RTL-SDR hardware or binaries are present."""
        rtl_sdr_path = shutil.which("rtl_sdr")
        rtl_test_path = shutil.which("rtl_test")
        
        # Check lsusb for RTL2832U / Realtek RTL chips
        has_usb_device = False
        usb_details = ""
        lsusb_path = shutil.which("lsusb")
        if lsusb_path:
            try:
                res = subprocess.run([lsusb_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=2)
                for line in res.stdout.splitlines():
                    if any(k in line.lower() for k in ("rtl2832", "rtl2838", "realtek", "dvb-t", "flightaware")):
                        has_usb_device = True
                        usb_details = line.strip()
                        break
            except Exception:
                pass

        if rtl_test_path:
            try:
                res = subprocess.run([rtl_test_path, "-t"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=3)
                out = res.stdout + res.stderr
                if "Found " in out and ("RTL" in out or "device" in out):
                    return {"available": True, "device_found": True, "detail": "RTL-SDR dongle connected", "binary": rtl_sdr_path}
            except Exception:
                pass

        if has_usb_device:
            if rtl_sdr_path:
                return {"available": True, "device_found": True, "detail": f"RTL-SDR USB connected: {usb_details}", "binary": rtl_sdr_path}
            else:
                return {"available": False, "device_found": True, "detail": f"RTL-SDR USB plugged in ({usb_details}). Run 'sudo apt install rtl-sdr' to activate driver"}
            
        return {
            "available": bool(rtl_sdr_path),
            "device_found": False,
            "detail": "rtl_sdr tool ready (no RTL-SDR USB dongle detected)" if rtl_sdr_path else "RTL-SDR tool not installed (sudo apt install rtl-sdr)"
        }

    def start(self, gain: Optional[float] = 49.6, ppm: int = 0, bias_tee: int = 0, sample_rate: int = 2000000) -> bool:
        self.stop()
        time.sleep(0.3)

        if gain is not None:
            self.gain = gain
        self.ppm = ppm
        self.bias_tee = bias_tee
        self.sample_rate = sample_rate

        rtl_sdr = shutil.which("rtl_sdr")
        demod_bin = os.path.join(os.path.dirname(__file__), "adsb_demod")

        if not rtl_sdr:
            self.status_message = "Error: rtl_sdr tool not found (run: sudo apt install rtl-sdr)"
            logger.error(self.status_message)
            return False

        if not os.path.exists(demod_bin):
            self.status_message = "Error: sdr/adsb_demod binary missing"
            logger.error(self.status_message)
            return False

        subprocess.run(["pkill", "-f", "rtl_sdr"], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
        time.sleep(0.2)

        gain_arg = "auto" if self.gain == -1 or str(self.gain).lower() == "auto" else str(self.gain)

        rtl_cmd = [
            rtl_sdr,
            "-f", str(self.frequency),
            "-s", str(self.sample_rate),
            "-g", str(gain_arg),
            "-p", str(self.ppm),
            "-"
        ]

        if self.bias_tee:
            rtl_cmd.insert(1, "-b")
            rtl_cmd.insert(2, "1")

        demod_cmd = [
            demod_bin,
            "--unsigned",
            "--rate", str(self.sample_rate)
        ]

        try:
            logger.info(f"Starting RTL-SDR pipeline: {' '.join(rtl_cmd)} | {' '.join(demod_cmd)}")
            self.process = subprocess.Popen(
                rtl_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=131072,
                preexec_fn=os.setsid
            )

            self.demod_process = subprocess.Popen(
                demod_cmd,
                stdin=self.process.stdout,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                preexec_fn=os.setsid
            )

            self.is_running = True
            self.start_time = time.time()
            self.frames_received = 0
            self.status_message = f"Active: 1090 MHz (RTL-SDR, Gain: {gain_arg} dB, PPM: {self.ppm})"

            self._reader_thread = threading.Thread(target=self._read_demod_output, daemon=True)
            self._reader_thread.start()
            return True

        except Exception as e:
            self.status_message = f"Failed to start RTL-SDR: {e}"
            logger.error(self.status_message)
            self.is_running = False
            return False

    def _read_demod_output(self):
        logger.info("RTL-SDR demod reader thread active")
        if not self.demod_process or not self.demod_process.stdout:
            return

        try:
            for line in self.demod_process.stdout:
                if not self.is_running:
                    break
                line = line.strip()
                if line:
                    self.frames_received += 1
                    if self.callback:
                        if "source=" not in line:
                            line += " source=RTL-SDR"
                        self.callback(line)
        except Exception as e:
            logger.error(f"Error reading RTL-SDR demod output: {e}")
        finally:
            self.is_running = False

    def stop(self):
        self.is_running = False
        self.status_message = "Stopped"

        if self.demod_process:
            try:
                os.killpg(os.getpgid(self.demod_process.pid), signal.SIGTERM)
            except Exception:
                pass
            self.demod_process = None

        if self.process:
            try:
                os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
            except Exception:
                pass
            self.process = None

    def get_stats(self) -> Dict[str, Any]:
        fps = 0.0
        elapsed = time.time() - self.start_time
        if self.is_running and elapsed > 0:
            fps = round(self.frames_received / elapsed, 1)

        return {
            "device": "RTL-SDR",
            "is_running": self.is_running,
            "status": self.status_message,
            "frequency_mhz": self.frequency / 1e6,
            "sample_rate_msps": self.sample_rate / 1e6,
            "gain_db": self.gain,
            "ppm": self.ppm,
            "bias_tee": self.bias_tee,
            "frames_received": self.frames_received,
            "packet_rate_fps": fps
        }
