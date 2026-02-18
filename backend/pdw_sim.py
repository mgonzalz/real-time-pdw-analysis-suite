import time, random
from dataclasses import dataclass, asdict

RADAR_CONFIGS = [
    {"TrackID": 1, "PRI": 1000, "Freq": 9400, "BW": 50, "AOA": 45,  "Color": "#FF5555"},
    {"TrackID": 2, "PRI": 450,  "Freq": 3100, "BW": 20, "AOA": 120, "Color": "#55FF55"},
    {"TrackID": 3, "PRI": 1200, "Freq": 5600, "BW": 30, "AOA": 280, "Color": "#5555FF"},
    {"TrackID": 4, "PRI": 800,  "Freq": 10200,"BW": 100,"AOA": 15,  "Color": "#FFFF55"},
    {"TrackID": 5, "PRI": 600,  "Freq": 8800, "BW": 40, "AOA": 190, "Color": "#FF55FF"},
]

@dataclass
class PDW:
    TOA: float
    TrackID: int
    Freq: float
    AM: float
    FM: float
    PW: float
    AOA: float
    PRI: float
    Color: str

def pdw_stream():
    start_time = time.time()
    next_toas = [0.0] * len(RADAR_CONFIGS)

    while True:
        current_sim_time = (time.time() - start_time) * 1e6  # us
        batch = []

        for i, cfg in enumerate(RADAR_CONFIGS):
            if current_sim_time >= next_toas[i]:
                pdw = PDW(
                    TOA=next_toas[i],
                    TrackID=cfg["TrackID"],
                    Freq=cfg["Freq"] + random.uniform(-5, 5),
                    AM=-40 + random.uniform(-10, 10),
                    FM=random.uniform(0, 5),
                    PW=10 + random.uniform(-1, 1),
                    AOA=(cfg["AOA"] + random.uniform(-2, 2)) % 360,
                    PRI=cfg["PRI"] + random.uniform(-1, 1),
                    Color=cfg["Color"],
                )
                batch.append(asdict(pdw))
                next_toas[i] += cfg["PRI"]

        if batch:
            yield batch

        time.sleep(0.0001)
