import subprocess
import os
import shutil
import logging
import threading
import time
import signal
from typing import Optional, Callable, Dict, Any

logger = logging.getLogger("BladeRF_Receiver")

class BladeRFReceiver:
    """
    BladeRF (x40 / x115 / Micro A4 / Micro A9) SDR Receiver Controller.
    """
    def __init__(self, callback: Optional[Callable[[str], None]] = None):
        self.callback = callback
        self.process: Optional[subprocess.Popen] = None
        self.demod_process: Optional[subprocess.Popen] = None
        self.is_running = False
        self.frequency = 1090000000 # 1090 MHz
        self.sample_rate = 8000000 # 8 MSPS or 2 MSPS
        self.rx_gain = 40 # dB
        
        self.frames_received = 0
        self.start_time = 0.0
        self.status_message = "Idle"
        self._reader_thread: Optional[threading.Thread] = None

    @staticmethod
    def is_bladerf_available() -> Dict[str, Any]:
        bladerf_cli = shutil.which("bladeRF-cli")
        if not bladerf_cli:
            return {"available": False, "device_found": False, "detail": "bladeRF-cli not installed"}

        try:
            res = subprocess.run([bladerf_cli, "-p"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=3)
            out = res.stdout + res.stderr
            if "Backend" in out or "Serial" in out or "bladeRF" in out:
                return {"available": True, "device_found": True, "detail": "BladeRF device connected"}
            return {"available": True, "device_found": False, "detail": "bladeRF-cli ready (no BladeRF board detected)"}
        except Exception as e:
            return {"available": True, "device_found": False, "detail": str(e)}

    def start(self, rx_gain: int = 40, sample_rate: int = 8000000) -> bool:
        self.stop()
        time.sleep(0.3)

        self.rx_gain = rx_gain
        self.sample_rate = sample_rate

        bladerf_cli = shutil.which("bladeRF-cli")
        demod_bin = os.path.join(os.path.dirname(__file__), "adsb_demod")

        if not bladerf_cli:
            self.status_message = "Error: bladeRF-cli not installed"
            return False

        if not os.path.exists(demod_bin):
            self.status_message = "Error: sdr/adsb_demod missing"
            return False

        # BladeRF interactive script for rx streaming to stdout
        script_cmd = f"set frequency rx {self.frequency}; set samplerate rx {self.sample_rate}; set bandwidth rx {self.sample_rate}; set gain rx {self.rx_gain}; rx start; rx config file=- format=bin; rx;"

        try:
            logger.info(f"Starting BladeRF SDR Receiver ({self.sample_rate/1e6} MSPS)")
            self.process = subprocess.Popen(
                [bladerf_cli, "-e", script_cmd],
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
            self.status_message = f"Active: 1090 MHz (BladeRF, Gain: {self.rx_gain}dB, {self.sample_rate/1e6:.0f} MSPS)"

            self._reader_thread = threading.Thread(target=self._read_demod_output, daemon=True)
            self._reader_thread.start()
            return True

        except Exception as e:
            self.status_message = f"Failed to start BladeRF: {e}"
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
                            line += " source=BladeRF"
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
            "device": "BladeRF",
            "is_running": self.is_running,
            "status": self.status_message,
            "frequency_mhz": self.frequency / 1e6,
            "sample_rate_msps": self.sample_rate / 1e6,
            "gain_db": self.rx_gain,
            "frames_received": self.frames_received,
            "packet_rate_fps": fps
        }
