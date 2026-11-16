"""
OmniVoice Local Studio - Desktop Application Launcher
Spawns the local FastAPI server and launches the desktop UI.
If the native window cannot open, automatically falls back to your default browser.
"""

import os
import sys
import threading
import time
import webbrowser
import requests
import uvicorn
from server import app

PORT = 8000
URL = f"http://127.0.0.1:{PORT}"

def run_api_server():
    """Runs FastAPI backend on local port 8000."""
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")

def wait_for_server(max_wait: float = 25.0) -> bool:
    """Waits for the backend server to be fully ready before opening the window."""
    start_t = time.time()
    print("[*] Waiting for local engine backend to initialize...", end="", flush=True)
    while time.time() - start_t < max_wait:
        try:
            r = requests.get(f"{URL}/api/presets", timeout=1.0)
            if r.status_code == 200:
                print(" Ready!")
                return True
        except Exception:
            pass
        print(".", end="", flush=True)
        time.sleep(0.3)
    print(" Timed out.")
    return False

def main():
    print("=" * 65)
    print("   🎙️  OMNIVOICE LOCAL STUDIO - FREE NEURAL TTS")
    print(f"   🖥️  Initializing Desktop Gateway on {URL}...")
    print("=" * 65)

    # Start API server in background daemon thread
    server_thread = threading.Thread(target=run_api_server, daemon=True)
    server_thread.start()

    # Wait until server is up and serving requests
    ready = wait_for_server()
    if not ready:
        print(f"⚠️ Notice: Server took longer than expected. Opening UI anyway at {URL}...")

    print(f"\n[*] OmniVoice Local Studio ready at: {URL}")
    print("[*] Launching application window...")

    # Try pywebview native desktop window first
    try:
        import webview
        window = webview.create_window(
            title="OmniVoice Local Studio - Free Neural TTS",
            url=URL,
            width=1380,
            height=900,
            min_size=(1000, 680),
            background_color="#0B0E13",
            text_select=True,
            zoomable=True
        )
        webview.start(gui="edgechromium")
        os._exit(0)
    except Exception as err:
        print(f"⚠️ Native desktop window notification: {err}")

    # Fallback: Open in default web browser
    print(f"[*] Opening OmniVoice Local Studio in your default browser: {URL}")
    webbrowser.open(URL)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nExiting OmniVoice Local Studio...")
        os._exit(0)

if __name__ == "__main__":
    main()
