import time, random
from dataclasses import dataclass, asdict

RADAR_CONFIGS = [
    {"TrackID": 1, "PRI": 1000, "Freq": 9400,  "BW": 50, "AOA": 45,  "Color": "#FF5555", "ScanPeriod": 3.0,  "BeamWidth": 2.5, "BaseAM": -30},
    {"TrackID": 2, "PRI": 450,  "Freq": 3100,  "BW": 20, "AOA": 120, "Color": "#55FF55", "ScanPeriod": 5.2,  "BeamWidth": 3.0, "BaseAM": -42},
    {"TrackID": 3, "PRI": 1200, "Freq": 5600,  "BW": 30, "AOA": 280, "Color": "#5555FF", "ScanPeriod": 8.0,  "BeamWidth": 2.0, "BaseAM": -35},
    {"TrackID": 4, "PRI": 800,  "Freq": 10200, "BW": 100,"AOA": 15,  "Color": "#FFFF55", "ScanPeriod": 4.5,  "BeamWidth": 2.8, "BaseAM": -50},
    {"TrackID": 5, "PRI": 600,  "Freq": 8800,  "BW": 40, "AOA": 190, "Color": "#FF55FF", "ScanPeriod": 10.0, "BeamWidth": 2.2, "BaseAM": -38},
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

import math

def pdw_stream():
    start_time = time.time()
    next_toas = [0.0] * len(RADAR_CONFIGS)

    while True:
        # We use a real-time clock for the simulation but TOAs are absolute us from start
        real_elapsed_s = time.time() - start_time
        current_sim_time_us = real_elapsed_s * 1e6
        batch = []

        for i, cfg in enumerate(RADAR_CONFIGS):
            # Check if it's time for the next pulse from this radar
            while current_sim_time_us >= next_toas[i]:
                # 1. Pulse loss (2%)
                if random.random() < 0.02:
                    next_toas[i] += cfg["PRI"]
                    continue

                # 2. Calculate current antenna angle
                # Rotation: angle = (time * 360 / Period) % 360
                # We assume the ESM is at angle 0 for simplicity, or rather, 
                # the radar "scans" and faces the ESM when its relative angle is 0.
                rotation_angle = (real_elapsed_s * 360.0 / cfg["ScanPeriod"]) % 360.0
                
                # Normalize angle to [-180, 180] relative to the ESM (0 deg)
                relative_angle = rotation_angle
                if relative_angle > 180: relative_angle -= 360
                
                # 3. Calculate illumination (Main Lobe)
                # We use a simple Gaussian beam pattern: exp(-k * (angle/BW)^2)
                # where k = 4*ln(2) ensures AM drops 3dB at BW/2
                bw = cfg["BeamWidth"]
                if abs(relative_angle) < bw * 2: # Only simulate pulses near the main beam for efficiency
                    k = 2.7725887 # 4 * ln(2)
                    beam_gain_db = -k * (relative_angle / bw)**2
                    
                    # Threshold for signal detection (e.g., -20dB from peak)
                    if beam_gain_db > -40:
                        am_val = cfg["BaseAM"] + beam_gain_db + random.uniform(-1, 1)
                        
                        pdw = PDW(
                            TOA=next_toas[i],
                            TrackID=cfg["TrackID"],
                            Freq=cfg["Freq"] + random.uniform(-2, 2), # SNR improved
                            AM=am_val,
                            FM=random.uniform(0, 2),
                            PW=10 + random.uniform(-0.1, 0.1),
                            AOA=(cfg["AOA"] + random.uniform(-0.5, 0.5)) % 360,
                            PRI=cfg["PRI"] + random.uniform(-0.5, 0.5),
                            Color=cfg["Color"],
                        )
                        batch.append(asdict(pdw))

                next_toas[i] += cfg["PRI"]

        yield batch
        time.sleep(0.01) # Small sleep to prevent CPU hogging
