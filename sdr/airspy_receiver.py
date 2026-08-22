import subprocess
import os
import shutil
import logging
import threading
import time
import signal
from typing import Optional, Callable, Dict, Any

logger = logging.getLogger("Airspy_Receiver")

class AirspyReceiver:
    """
    Airspy (R2 / Mini) SDR Receiver Controller.
    """
    def __init__(self, callback: Optional[Callable[[str], None]] = None):
        self.callback = callback
        self.process: Optional[subprocess.Popen] = None
        self.demod_process: Optional[subprocess.Popen] = None
        self.is_running = False
        self.frequency = 1090000000 # 1090 MHz
        self.sample_rate = 6000000 # 6 MSPS / 3 MSPS
        self.gain = 18 # 0-21
        self.bias_tee = 0
        
        self.frames_received = 0
        self.start_time = 0.0
        self.status_message = "Idle"
        self._reader_thread: Optional[threading.Thread] = None

    @staticmethod
    def is_airspy_available() -> Dict[str, Any]:
        airspy_rx = shutil.which("airspy_rx") or shutil.which("airspy_adsb")
        airspy_info = shutil.which("airspy_info")

        if not airspy_rx:
            return {"available": False, "device_found": False, "detail": "airspy tools not installed (sudo apt install airspy)"}

        if airspy_info:
            try:
                res = subprocess.run([airspy_info], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=3)
                if "Found Airspy" in (res.stdout + res.stderr):
                    return {"available": True, "device_found": True, "detail": "Airspy SDR connected"}
            except Exception:
                pass

        return {"available": True, "device_found": False, "detail": "Airspy tool ready (no Airspy device detected)"}

    def start(self, gain: int = 18, bias_tee: int = 0, sample_rate: int = 6000000) -> bool:
        self.stop()
        time.sleep(0.3)

        self.gain = gain
        self.bias_tee = bias_tee
        self.sample_rate = sample_rate

        airspy_rx = shutil.which("airspy_rx")
        demod_bin = os.path.join(os.path.dirname(__file__), "adsb_demod")

        if not airspy_rx:
            self.status_message = "Error: airspy_rx binary not found"
            return False

        if not os.path.exists(demod_bin):
            self.status_message = "Error: sdr/adsb_demod missing"
            return False

        airspy_cmd = [
            airspy_rx,
            "-f", str(self.frequency / 1e6),
            "-a", str(self.sample_rate / 1e6),
            "-g", str(self.gain),
            "-b", str(self.bias_tee),
            "-r", "-"
        ]

        try:
            logger.info(f"Starting Airspy SDR Receiver: {' '.join(airspy_cmd)}")
            self.process = subprocess.Popen(
                airspy_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=131072,
                preexec_fn=os.setsid
            )

            demod_cmd = [demod_bin, "--signed", "--rate", str(self.sample_rate)]
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
            self.status_message = f"Active: 1090 MHz (Airspy, Gain: {self.gain}, BiasT: {self.bias_tee})"

            self._reader_thread = threading.Thread(target=self._read_demod_output, daemon=True)
            self._reader_thread.start()
            return True

        except Exception as e:
            self.status_message = f"Failed to start Airspy: {e}"
            logger.error(self.status_message)
            self.is_running = False
            return False

    def _read_demod_output(self):
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
                            line += " source=Airspy"
                        self.callback(line)
        except Exception:
            pass
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
            "device": "Airspy",
            "is_running": self.is_running,
            "status": self.status_message,
            "frequency_mhz": self.frequency / 1e6,
            "sample_rate_msps": self.sample_rate / 1e6,
            "gain": self.gain,
            "bias_tee": self.bias_tee,
            "frames_received": self.frames_received,
            "packet_rate_fps": fps
        }
