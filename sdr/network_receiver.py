import asyncio
import socket
import threading
import time
import json
import logging
import requests
from typing import Optional, Callable, Dict, Any

logger = logging.getLogger("Network_Receiver")

class NetworkReceiver:
    def __init__(self, callback_line: Optional[Callable[[str], None]] = None, callback_json: Optional[Callable[[list], None]] = None):
        self.callback_line = callback_line
        self.callback_json = callback_json
        self.is_running = False
        self.host = "127.0.0.1"
        self.port = 30002
        self.mode = "raw" # "raw" (30002), "sbs" (30003), "json" (http)
        self.http_url = "http://127.0.0.1:8080/data/aircraft.json"
        self.status_message = "Idle"
        self._thread: Optional[threading.Thread] = None
        self.frames_received = 0
        self.start_time = 0.0

    def start(self, host: str = "127.0.0.1", port: int = 30002, mode: str = "raw", http_url: Optional[str] = None):
        if self.is_running:
            self.stop()
            
        self.host = host
        self.port = port
        self.mode = mode
        if http_url:
            self.http_url = http_url
            
        self.is_running = True
        self.start_time = time.time()
        self.frames_received = 0
        self.status_message = f"Connecting to {self.host}:{self.port} ({self.mode})"
        
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        return True

    def _run_loop(self):
        if self.mode == "json":
            self._run_json_poll()
        elif self.mode in ("raw", "sbs"):
            self._run_tcp_stream()

    def _run_json_poll(self):
        self.status_message = f"Polling JSON feed: {self.http_url}"
        while self.is_running:
            try:
                resp = requests.get(self.http_url, timeout=3)
                if resp.status_code == 200:
                    data = resp.json()
                    aircraft_list = data.get("aircraft", [])
                    self.frames_received += len(aircraft_list)
                    if self.callback_json:
                        self.callback_json(aircraft_list)
                    self.status_message = f"Receiving JSON: {len(aircraft_list)} aircraft"
                else:
                    self.status_message = f"HTTP {resp.status_code} from {self.http_url}"
            except Exception as e:
                self.status_message = f"JSON Poll Error: {e}"
            time.sleep(1.0)

    def _run_tcp_stream(self):
        while self.is_running:
            try:
                self.status_message = f"Connecting to {self.host}:{self.port}..."
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(5.0)
                s.connect((self.host, self.port))
                s.settimeout(1.0)
                self.status_message = f"Connected to {self.host}:{self.port}"
                
                buf = ""
                while self.is_running:
                    try:
                        chunk = s.recv(4096).decode("utf-8", errors="ignore")
                        if not chunk:
                            break
                        buf += chunk
                        while "\n" in buf:
                            line, buf = buf.split("\n", 1)
                            line = line.strip()
                            if line:
                                self.frames_received += 1
                                if self.callback_line:
                                    self.callback_line(line)
                    except socket.timeout:
                        continue
                    except Exception as e:
                        logger.error(f"TCP Stream socket error: {e}")
                        break
                s.close()
            except Exception as e:
                self.status_message = f"Connection failed ({self.host}:{self.port}): {e}"
                time.sleep(3.0)

    def stop(self):
        self.is_running = False
        self.status_message = "Stopped"

    def get_stats(self) -> Dict[str, Any]:
        fps = 0.0
        elapsed = time.time() - self.start_time
        if self.is_running and elapsed > 0:
            fps = round(self.frames_received / elapsed, 1)
        return {
            "is_running": self.is_running,
            "status": self.status_message,
            "host": self.host,
            "port": self.port,
            "mode": self.mode,
            "frames_received": self.frames_received,
            "packet_rate_fps": fps
        }
