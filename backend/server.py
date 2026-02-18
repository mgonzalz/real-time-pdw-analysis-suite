import json
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from pdw_sim import pdw_stream

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR  = BASE_DIR.parent / "web"

app = FastAPI()
app.mount("/web", StaticFiles(directory=str(WEB_DIR)), name="web")

@app.get("/")
def root():
    return FileResponse(str(WEB_DIR / "index.html"))

@app.websocket("/ws/pdw")
async def ws_pdw(ws: WebSocket):
    await ws.accept()
    gen = pdw_stream()
    try:
        while True:
            batch = next(gen)
            await ws.send_text(json.dumps({"type": "pdw_batch", "data": batch}))
    except WebSocketDisconnect:
        return

@app.post("/api/snapshot")
async def snapshot(payload: dict):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"ng_pdw_snapshot_{ts}.json"

    pdws = payload.get("pdws", [])
    clean = []
    for p in pdws:
        p2 = dict(p)
        p2.pop("Color", None)
        clean.append(p2)

    out = {
        "metadata": {
            "version": "NG-PDW-1.0",
            "timestamp": ts,
            "sensor_id": "ESM-SENTRY-01",
            "pulse_count": len(clean),
        },
        "pdws": clean,
    }

    (BASE_DIR / filename).write_text(json.dumps(out, indent=4), encoding="utf-8")
    return {"ok": True, "filename": filename}
