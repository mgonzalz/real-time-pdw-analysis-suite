import time, random
from dataclasses import dataclass, asdict

RADAR_CONFIGS = [
    {
        "TrackID": 1, "Type": "Diversity", "Color": "#FF5555",
        "BaseFreq": 9400, "FreqDiv": 15, 
        "PriMin": 1000, "PriMax": 2000, 
        "PwMin": 1, "PwMax": 20,
        "ScanPeriod": 3.0, "BeamWidth": 2.5, "BaseAM": -30, "AOA": 45
    },
    {
        "TrackID": 2, "Type": "Hopping", "Color": "#55FF55",
        "Channels": [3000, 3060, 3120, 3180, 3240, 3300], 
        "DwellLen": 25, 
        "PRI": 800,
        "PwOptions": [2.0, 7.0, 12.0],
        "ScanPeriod": 5.2, "BeamWidth": 3.0, "BaseAM": -42, "AOA": 120
    },
    {
        "TrackID": 3, "Type": "Stagger", "Color": "#5555FF",
        "FreqSeq": [5400, 5500, 5600],
        "PriStagger": [150, 200, 300, 400, 500],
        "FixedPW": 5.0,
        "ScanPeriod": 8.0, "BeamWidth": 2.0, "BaseAM": -35, "AOA": 280
    },
    {
        "TrackID": 4, "Type": "Fixed", "Color": "#FFFF55",
        "PRI": 1200, "Freq": 10200, "PW": 10, "IsArray": True,
        "ScanPeriod": 1.5, "BeamWidth": 4.0, "BaseAM": -45, "AOA": 15
    },
    {
        "TrackID": 5, "Type": "Fixed", "Color": "#FF55FF",
        "PRI": 650, "Freq": 8800, "PW": 8, 
        "ScanPeriod": 10.0, "BeamWidth": 2.2, "BaseAM": -38, "AOA": 190
    },
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
    
    # State tracking for complex radars
    states = []
    for cfg in RADAR_CONFIGS:
        states.append({
            "pulse_idx": 0,
            "dwell_idx": 0,
            "stagger_idx": 0,
            "current_pw": cfg.get("PW", 0) if cfg["Type"] == "Fixed" else 0,
            "current_freq": cfg.get("Freq", 0) if cfg["Type"] == "Fixed" else 0
        })
        # Init for Hopping
        if cfg["Type"] == "Hopping":
            states[-1]["current_pw"] = random.choice(cfg["PwOptions"])
            states[-1]["current_freq"] = random.choice(cfg["Channels"])

    while True:
        real_elapsed_s = time.time() - start_time
        current_sim_time_us = real_elapsed_s * 1e6
        batch = []

        for i, cfg in enumerate(RADAR_CONFIGS):
            st = states[i]
            
            while current_sim_time_us >= next_toas[i]:
                # 1. Pulse loss (2%)
                if random.random() < 0.02:
                    # Even if lost, we must update internal state (counters/indices)
                    st["pulse_idx"] += 1
                    # (Simplified: we skip the state update for lost pulses to avoid missing dwell transitions 
                    # but here we update it for consistency)
                    if cfg["Type"] == "Hopping" and st["pulse_idx"] % cfg["DwellLen"] == 0:
                        st["current_pw"] = random.choice(cfg["PwOptions"])
                        st["current_freq"] = random.choice(cfg["Channels"])
                    if cfg["Type"] == "Stagger":
                        st["stagger_idx"] = (st["stagger_idx"] + 1) % len(cfg["PriStagger"])
                        if st["stagger_idx"] == 0:
                            st["dwell_idx"] = (st["dwell_idx"] + 1) % len(cfg["FreqSeq"])

                    # Update next TOA based on type
                    step_pri = cfg.get("PRI", 1000)
                    if cfg["Type"] == "Stagger":
                        step_pri = cfg["PriStagger"][st["stagger_idx"]]
                    elif cfg["Type"] == "Diversity":
                        step_pri = random.uniform(cfg["PriMin"], cfg["PriMax"])
                    
                    next_toas[i] += step_pri
                    continue

                # 2. Rotation & Illumination
                rotation_angle = (real_elapsed_s * 360.0 / cfg["ScanPeriod"]) % 360.0
                relative_angle = rotation_angle
                if relative_angle > 180: relative_angle -= 360
                
                bw = cfg["BeamWidth"]
                if abs(relative_angle) < bw * 2:
                    k = 2.7725887 # 4 * ln(2)
                    beam_gain_db = -k * (relative_angle / bw)**2
                    
                    if beam_gain_db > -40:
                        # 3. Calculate Parameters based on Radar Type
                        curr_freq = 0
                        curr_pri = 0
                        curr_pw = 0
                        
                        if cfg["Type"] == "Diversity":
                            curr_pri = random.uniform(cfg["PriMin"], cfg["PriMax"])
                            # Interpolate Freq and PW based on PRI
                            ratio = (curr_pri - cfg["PriMin"]) / (cfg["PriMax"] - cfg["PriMin"])
                            curr_freq = cfg["BaseFreq"] + ratio * cfg["FreqDiv"]
                            curr_pw = cfg["PwMin"] + ratio * (cfg["PwMax"] - cfg["PwMin"])
                            
                        elif cfg["Type"] == "Hopping":
                            curr_freq = st["current_freq"]
                            curr_pri = cfg["PRI"]
                            curr_pw = st["current_pw"]
                            
                        elif cfg["Type"] == "Stagger":
                            curr_freq = cfg["FreqSeq"][st["dwell_idx"]]
                            curr_pri = cfg["PriStagger"][st["stagger_idx"]]
                            curr_pw = cfg["FixedPW"]
                            
                        else: # Fixed
                            curr_freq = cfg["Freq"]
                            curr_pri = cfg["PRI"]
                            curr_pw = cfg["PW"]

                        am_val = cfg["BaseAM"] + beam_gain_db + random.uniform(-1, 1)
                        
                        pdw = PDW(
                            TOA=next_toas[i],
                            TrackID=cfg["TrackID"],
                            Freq=curr_freq + random.uniform(-0.5, 0.5), # Agile jitter
                            AM=am_val,
                            FM=random.uniform(0, 1),
                            PW=curr_pw,
                            AOA=(cfg["AOA"] + random.uniform(-0.5, 0.5)) % 360,
                            PRI=curr_pri,
                            Color=cfg["Color"],
                        )
                        batch.append(asdict(pdw))

                # 4. Advance states
                st["pulse_idx"] += 1
                last_pri = 0
                
                if cfg["Type"] == "Diversity":
                    # We already calculated a prospective PRI for this specific pulse if it was generated
                    # or we need one to step to the next pulse.
                    # For diversity, we'll just use the random one generated or a new one.
                    last_pri = random.uniform(cfg["PriMin"], cfg["PriMax"])
                elif cfg["Type"] == "Hopping":
                    last_pri = cfg["PRI"]
                    if st["pulse_idx"] % cfg["DwellLen"] == 0:
                        st["current_pw"] = random.choice(cfg["PwOptions"])
                        st["current_freq"] = random.choice(cfg["Channels"])
                elif cfg["Type"] == "Stagger":
                    last_pri = cfg["PriStagger"][st["stagger_idx"]]
                    st["stagger_idx"] = (st["stagger_idx"] + 1) % len(cfg["PriStagger"])
                    if st["stagger_idx"] == 0:
                        st["dwell_idx"] = (st["dwell_idx"] + 1) % len(cfg["FreqSeq"])
                else: # Fixed
                    last_pri = cfg["PRI"]

                next_toas[i] += last_pri

        yield batch
        time.sleep(0.01)
