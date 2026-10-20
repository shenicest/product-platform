#!/usr/bin/env python3
"""Capture a full-page screenshot of an HTML file (or URL) with headless Chrome.

Used to visually verify a snapshot before handing it over. Verifying by eye is the
only way to catch what the structural checks cannot: a font that fell back to a
system face, a theme that did not apply, a cover image that silently failed.

Drives Chrome over the DevTools protocol with a hand-rolled WebSocket client, so no
puppeteer/playwright install is needed.

Usage:
    python scripts/snapshot-shot.py <url-or-file> <out.png> [width] [height] [port]

Prints a JSON report: document title, page height, image counts, stylesheet count,
any external script srcs, and any console errors.
"""
import base64
import json
import os
import pathlib
import socket
import struct
import subprocess
import sys
import time
import urllib.request

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
]


def find_chrome() -> str:
    for candidate in CHROME_CANDIDATES:
        if pathlib.Path(candidate).exists():
            return candidate
    raise RuntimeError("no Chrome or Edge executable found")


def wait_for_devtools(port: int, timeout: float = 30.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=1):
                return
        except Exception:
            time.sleep(0.3)
    raise RuntimeError("devtools endpoint never came up")


class WS:
    """Minimal WebSocket client: one text frame in, one text frame out."""

    def __init__(self, url: str, timeout: float = 60.0):
        _, rest = url.split("://", 1)
        hostport, path = rest.split("/", 1)
        host, port = hostport.split(":")
        self.sock = socket.create_connection((host, int(port)), timeout=timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall(
            (
                f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\n"
                f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
                f"Sec-WebSocket-Version: 13\r\n\r\n"
            ).encode()
        )
        buf = b""
        while b"\r\n\r\n" not in buf:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise RuntimeError("websocket handshake closed")
            buf += chunk
        self.counter = 0
        self.events = {}

    def _recv_exact(self, n: int) -> bytes:
        data = b""
        while len(data) < n:
            chunk = self.sock.recv(n - len(data))
            if not chunk:
                raise RuntimeError("socket closed")
            data += chunk
        return data

    def send(self, method: str, params: dict | None = None) -> int:
        self.counter += 1
        msg_id = self.counter
        payload = json.dumps({"id": msg_id, "method": method, "params": params or {}}).encode()
        header = bytearray([0x81])
        n = len(payload)
        if n < 126:
            header.append(0x80 | n)
        elif n < 65536:
            header.append(0x80 | 126)
            header += struct.pack(">H", n)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", n)
        mask = os.urandom(4)
        header += mask
        self.sock.sendall(bytes(header) + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))
        return msg_id

    def recv(self) -> dict:
        header = self._recv_exact(2)
        length = header[1] & 0x7F
        if length == 126:
            length = struct.unpack(">H", self._recv_exact(2))[0]
        elif length == 127:
            length = struct.unpack(">Q", self._recv_exact(8))[0]
        return json.loads(self._recv_exact(length).decode())

    def call(self, method: str, params: dict | None = None, timeout: float = 60.0):
        mid = self.send(method, params)
        deadline = time.time() + timeout
        while True:
            remaining = deadline - time.time()
            if remaining <= 0:
                raise RuntimeError(f"timeout waiting for {method}")
            self.sock.settimeout(min(remaining, 5))
            try:
                msg = self.recv()
            except socket.timeout:
                continue
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg
            if "method" in msg:
                self.events.setdefault(msg["method"], []).append(msg.get("params"))


def main() -> int:
    target = sys.argv[1]
    out = pathlib.Path(sys.argv[2])
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 1440
    height = int(sys.argv[4]) if len(sys.argv) > 4 else 1200
    port = int(sys.argv[5]) if len(sys.argv) > 5 else 9333

    out.parent.mkdir(parents=True, exist_ok=True)
    profile = pathlib.Path(out.parent, ".chrome-profile")

    proc = subprocess.Popen(
        [
            find_chrome(),
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            f"--remote-debugging-port={port}",
            f"--user-data-dir={profile.resolve()}",
            f"--window-size={width},{height}",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    ws = None
    try:
        wait_for_devtools(port)
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=5) as r:
            targets = json.load(r)
        page = next(t for t in targets if t["type"] == "page")
        ws = WS(page["webSocketDebuggerUrl"])

        for domain in ("Page", "Runtime", "Log", "Network"):
            ws.call(f"{domain}.enable")
        ws.call(
            "Emulation.setDeviceMetricsOverride",
            {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False},
        )

        ws.call("Page.navigate", {"url": target})
        time.sleep(3)

        # `loading="lazy"` images outside the viewport never decode, so a full-page
        # capture would show them blank even when the file is fine.
        ws.call(
            "Runtime.evaluate",
            {"expression": "document.querySelectorAll('img').forEach(i => { i.loading = 'eager'; }); true"},
            timeout=30,
        )
        time.sleep(1)

        # Walk the document so queued images fetch, then settle back on top. Kept
        # non-awaiting: a stalled request would otherwise hang the capture.
        ws.call(
            "Runtime.evaluate",
            {
                "expression": """
                    (() => {
                      const step = Math.max(400, window.innerHeight - 200);
                      for (let y = 0; y < document.body.scrollHeight; y += step) {
                        window.scrollTo(0, y);
                      }
                      window.scrollTo(0, 0);
                      return document.documentElement.scrollHeight;
                    })()
                """,
                "returnByValue": True,
            },
            timeout=60,
        )
        time.sleep(4)

        info = json.loads(
            ws.call(
                "Runtime.evaluate",
                {
                    "expression": "JSON.stringify({title: document.title,"
                    "h: document.documentElement.scrollHeight,"
                    "imgs: document.images.length,"
                    "broken: [...document.images].filter(i=>i.naturalWidth===0).length,"
                    "sheets: document.styleSheets.length,"
                    "scriptSrcs: [...document.scripts].filter(s=>s.src).map(s=>s.src)})",
                    "returnByValue": True,
                },
            )["result"]["result"]["value"]
        )

        shot = ws.call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True}, timeout=180)
        out.write_bytes(base64.b64decode(shot["result"]["data"]))

        print(
            json.dumps(
                {
                    "target": target,
                    "out": str(out),
                    "info": info,
                    "failedRequests": ws.events.get("Network.loadingFailed", [])[:10],
                    "consoleErrors": [
                        p
                        for p in ws.events.get("Log.entryAdded", [])
                        if p.get("entry", {}).get("level") in ("error", "warning")
                    ][:20],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    finally:
        if ws:
            try:
                ws.sock.close()
            except Exception:
                pass
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except Exception:
            proc.kill()
        subprocess.run(
            [
                "powershell", "-NoProfile", "-Command",
                "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | "
                f"Where-Object {{ $_.CommandLine -like '*{profile.as_posix()}*' }} | "
                "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


if __name__ == "__main__":
    raise SystemExit(main())
