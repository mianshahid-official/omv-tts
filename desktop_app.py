import os
import sys
import threading
import time
import webbrowser
import requests
import uvicorn
from server import app

def run_api_server():
    """Runs FastAPI backend on local port 8000."""
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")

def wait_for_server():
    """Waits for the server to be ready."""
    for _ in range(40):
        try:
            r = requests.get("http://127.0.0.1:8000/api/voices", timeout=1)
            if r.status_code == 200:
                return True
        except Exception:
            time.sleep(0.15)
    return False

if __name__ == "__main__":
    print("=" * 65)
    print("   🎙️  OMNI VOICE LOCAL STUDIO - DESKTOP APPLICATION")
    print("   🖥️  Initializing Desktop Gateway on http://127.0.0.1:8000...")
    print("=" * 65)

    # Start API server in background daemon thread
    server_thread = threading.Thread(target=run_api_server, daemon=True)
    server_thread.start()

    # Wait until server is up
    if not wait_for_server():
        print("⚠️ Warning: Server slow to respond, launching window anyway...")

    url = "http://127.0.0.1:8000"
    try:
        import webview
        # Create native standalone desktop application window
        window = webview.create_window(
            title="Omni Voice Studio - AI Voice Generator & Local TTS",
            url=url,
            width=1360,
            height=880,
            min_size=(1000, 680),
            background_color="#0B0E13",
            text_select=True,
            zoomable=True
        )
        # Start native desktop window loop
        webview.start(gui="edgechromium", debug=False)
        os._exit(0)
    except Exception as err:
        print(f"[Omni Voice] Native window unavailable ({err}). Opening default web browser...")
        webbrowser.open(url)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("Exiting...")
            os._exit(0)
