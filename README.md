# **Multi-Emitter SIGINT Lab**

![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688.svg)
![WebSockets](https://img.shields.io/badge/streaming-WebSockets-orange.svg)
![Plotly](https://img.shields.io/badge/visualization-Plotly-darkblue.svg)
![jsPDF](https://img.shields.io/badge/reporting-jsPDF-lightgrey.svg)

## **Overview**

**Multi-Emitter SIGINT Lab** is a real-time Electronic Support Measures (ESM) simulation and visualization platform designed for Next-Generation Pulse Descriptor Word (NG-PDW) research and strategic signal intelligence analysis.

The system emulates multiple radar emitters concurrently and streams PDW data through a WebSocket architecture into a browser-based tactical console. The interface provides synchronized visualization, track-based separation, signal fingerprint modeling, and structured snapshot export capabilities.

This platform serves as:

* A research environment for NG-PDW metadata modeling
* A prototype web-based ESM strategic console
* A multi-emitter SIGINT visualization laboratory
* A foundation for scalable high-rate streaming architectures

## **System Capabilities**

### **Real-Time Multi-Emitter Simulation**

The backend simulates concurrent radar emitters with configurable parameters:

* Pulse Repetition Interval (PRI)
* Carrier frequency
* Bandwidth
* Angle of Arrival (AOA)
* Pulse Width (PW)
* Amplitude (AM)
* Chirp modulation (FM)

The simulation incorporates realistic jitter components and microsecond-level timing logic to approximate operational emitter variability.

### **Tactical Web Console**

The browser interface provides:

* Dark operator-oriented UI layout
* Six synchronized plots arranged in a 3×2 grid:

  * PRI
  * Amplitude (AM)
  * Frequency modulation (FM)
  * Pulse width (PW)
  * Angle of arrival (AOA)
  * Signal fingerprint (rising edge model)
* Real-time update locking with preserved zoom state
* Track-color differentiation
* Pause / Live control

The layout is optimized to remain within a single viewport without vertical scrolling, ensuring operator-style situational clarity.

### **Snapshot Export System**

The snapshot mechanism produces two synchronized artifacts:

#### 1. Full JSON Dataset

Includes:

* Complete PDW sequence
* Metadata block
* Sensor identifier
* Timestamp
* Total pulse count

This file preserves the raw data for downstream processing or archival.

#### 2. Structured PDF Report

Includes:

* Executive header (timestamp, sensor ID, pulse count)
* Summary table by TrackID (in Spanish):

  * Pista
  * Pulsos
  * Frecuencia media (MHz)
  * AOA media (°)
  * Jitter PRI (desviación típica)
* All six graphical plots embedded
* Black professional typography for print clarity

The PDF is designed to be presentation-ready and suitable for technical documentation or briefing contexts.

## **Architecture**

The system follows a clear separation between simulation, transport, and visualization:

**PDW Simulation Engine → FastAPI Backend → WebSocket Streaming → Browser Console (Plotly)**

### **Backend Layer**

* FastAPI application server
* Persistent WebSocket endpoint for streaming PDWs
* Deterministic multi-emitter timing logic
* Static frontend serving

### **Frontend Layer**

* Plotly for interactive synchronized plotting
* jsPDF for client-side report generation
* Responsive grid layout
* Zoom state preservation via UI revision locking

## **Repository Structure**

```bash
multi-emitter-sigint-lab/
│
├── backend/
│   ├── __init__.py
│   ├── server.py
│   ├── pdw_sim.py
│   └── requirements.txt
│
└── web/
    ├── index.html
    ├── styles.css
    └── app.js
```

* `pdw_sim.py` implements the multi-emitter generation engine.
* `server.py` exposes the WebSocket streaming endpoint.
* `app.js` handles real-time ingestion, plotting logic, and report generation.
* `styles.css` defines the tactical dark UI theme.

## **Signal Intelligence Metrics**

The report summary includes several core analytical indicators:

| Metric           | Interpretation             |
| ---------------- | -------------------------- |
| Pulsos           | Activity level per emitter |
| Frecuencia media | Mean operating frequency   |
| AOA media        | Mean direction of arrival  |
| Jitter PRI (σ)   | Timing stability indicator |

A low PRI jitter suggests emitter temporal stability.
Higher PRI deviation may indicate agility, modulation complexity, or scan behavior.

## **Deployment Model**
The system is designed for environments that support persistent WebSocket connections. The frontend automatically adapts between secure (`wss`) and non-secure (`ws`) transport protocols depending on deployment context.

This ensures compatibility across:

* Local development environments
* HTTPS production infrastructure

## **Design Philosophy**

This project emphasizes:

* Real-time clarity over visual clutter
* Tactical operator usability
* Structured and interpretable exports
* Separation between raw signal data and presentation layer
* Extensibility toward NG-PDW streaming frameworks

The console design avoids scroll-based navigation and maintains a fixed strategic layout to emulate operational signal analysis systems.

## **Domain Context**

This project operates within the Electronic Support Measures (ESM) and Signals Intelligence (SIGINT) domain, with particular focus on:

* Pulse Descriptor Word (PDW) architectures
* Real-time emitter separation
* Metadata enrichment
* Strategic visualization systems

It is structured as a research-oriented simulation and prototyping environment rather than a production operational tool.

