import asyncio
import subprocess
import os
import shutil
import logging
import threading
import time
import signal
from typing import Optional, Callable, Dict, Any

logger = logging.getLogger("HackRF_Receiver")

class HackRFReceiver:
    def __init__(self, callback: Optional[Callable[[str], None]] = None):
        self.callback = callback
        self.process: Optional[subprocess.Popen] = None
        self.demod_process: Optional[subprocess.Popen] = None
        self.is_running = False
        self.frequency = 1090000000 # 1090 MHz (ADS-B)
        self.sample_rate = 8000000 # 8 MSPS for high-precision HackRF pulse slicing
        self.lna_gain = 40 # 40 dB
        self.vga_gain = 42 # 42 dB
        self.amp_enable = 1 # 14 dB pre-amp ON
        
        self.frames_received = 0
        self.start_time = 0.0
        self.status_message = "Idle"
        self._reader_thread: Optional[threading.Thread] = None

    @staticmethod
    def is_hackrf_available() -> Dict[str, Any]:
        hackrf_info_path = shutil.which("hackrf_info")
        lsusb_path = shutil.which("lsusb")
        
        has_dfu = False
        has_hackrf_usb = False
        usb_info = ""

        if lsusb_path:
            try:
                res = subprocess.run([lsusb_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=2)
                for line in res.stdout.splitlines():
                    if "1d50:6089" in line.lower() or "hackrf" in line.lower():
                        has_hackrf_usb = True
                        usb_info = line.strip()
                    elif "1fc9:000c" in line.lower() or "lpc43xx" in line.lower():
                        has_dfu = True
                        usb_info = line.strip()
            except Exception:
                pass

        if not hackrf_info_path:
            return {
                "available": False,
                "device_found": has_hackrf_usb,
                "detail": "hackrf_info binary not installed (run: sudo apt install hackrf)"
            }
            
        try:
            res = subprocess.run([hackrf_info_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=3)
            out = res.stdout + res.stderr
            if "Found HackRF" in out:
                lines = [l.strip() for l in out.split("\n") if l.strip()]
                return {
                    "available": True,
                    "device_found": True,
                    "detail": "HackRF One connected & operational",
                    "info": lines
                }
            elif has_dfu:
                return {
                    "available": True,
                    "device_found": True,
                    "detail": f"HackRF in DFU Recovery Mode ({usb_info}). Firmware reflash needed.",
                    "is_dfu": True
                }
            elif has_hackrf_usb:
                return {
                    "available": True,
                    "device_found": True,
                    "detail": f"HackRF USB enumerated ({usb_info}) but hackrf_info failed. Check udev permissions.",
                    "need_udev": True
                }
            else:
                return {
                    "available": True,
                    "device_found": False,
                    "detail": "No HackRF detected on USB (Check Micro-USB data cable & port connection)"
                }
        except Exception as e:
            return {"available": False, "device_found": False, "detail": str(e)}

    def start(self, lna_gain: Optional[int] = None, vga_gain: Optional[int] = None, amp_enable: Optional[int] = None, sample_rate: Optional[int] = None, bias_tee: int = 0):
        self.stop()
        time.sleep(0.3)
            
        if lna_gain is not None:
            self.lna_gain = lna_gain
        if vga_gain is not None:
            self.vga_gain = vga_gain
        if amp_enable is not None:
            self.amp_enable = amp_enable
        if sample_rate is not None:
            self.sample_rate = sample_rate
        self.bias_tee = bias_tee

        hackrf_transfer = shutil.which("hackrf_transfer")
        if not hackrf_transfer:
            self.status_message = "Error: hackrf_transfer tool not found"
            logger.error(self.status_message)
            return False

        demod_bin = os.path.join(os.path.dirname(__file__), "adsb_demod")
        if not os.path.exists(demod_bin):
            self.status_message = "Error: sdr/adsb_demod binary missing"
            logger.error(self.status_message)
            return False

        subprocess.run(["pkill", "-f", "hackrf_transfer"], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
        time.sleep(0.2)

        hackrf_cmd = [
            hackrf_transfer,
            "-r", "-",
            "-f", str(self.frequency),
            "-s", str(self.sample_rate),
            "-a", str(self.amp_enable),
            "-l", str(self.lna_gain),
            "-g", str(self.vga_gain)
        ]
        if self.bias_tee:
            hackrf_cmd.extend(["-p", "1"])

        demod_cmd = [
            demod_bin,
            "--signed",
            "--rate", str(self.sample_rate)
        ]

        try:
            logger.info(f"Starting HackRF SDR pipeline ({self.sample_rate/1e6} MSPS): {' '.join(hackrf_cmd)} | {' '.join(demod_cmd)}")
            self.process = subprocess.Popen(
                hackrf_cmd,
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
            self.status_message = f"Active: 1090 MHz ({self.sample_rate/1e6:.0f} MSPS, LNA:{self.lna_gain}dB, VGA:{self.vga_gain}dB, Amp:{'ON' if self.amp_enable else 'OFF'})"

            self._reader_thread = threading.Thread(target=self._read_demod_output, daemon=True)
            self._reader_thread.start()
            return True

        except Exception as e:
            self.status_message = f"Failed to start HackRF: {e}"
            logger.error(self.status_message)
            self.is_running = False
            return False

    def _read_demod_output(self):
        logger.info("HackRF demod output reader thread active")
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
                            line += " source=HackRF One"
                        self.callback(line)
        except Exception as e:
            logger.error(f"Error reading demod output: {e}")
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
            "device": "HackRF One",
            "is_running": self.is_running,
            "status": self.status_message,
            "frequency_mhz": self.frequency / 1e6,
            "sample_rate_msps": self.sample_rate / 1e6,
            "lna_gain_db": self.lna_gain,
            "vga_gain_db": self.vga_gain,
            "amp": bool(self.amp_enable),
            "bias_tee": getattr(self, "bias_tee", 0),
            "frames_received": self.frames_received,
            "packet_rate_fps": fps
        }

