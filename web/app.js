const WS_PROTO = (location.protocol === "https:") ? "wss" : "ws";
const ws = new WebSocket(`${WS_PROTO}://${location.host}/ws/pdw`);
ws.onopen = () => console.log("[WS] connected", ws.url);
ws.onerror = (e) => console.error("[WS] error", e);
ws.onclose = (e) => console.warn("[WS] closed", e.code, e.reason);
const buffer = [];
const MAX_BUF = 1000;

const rowsEl = document.getElementById("pdw_rows");
const btn = document.getElementById("btn_snapshot");

const PLOT_CONFIG = { displayModeBar: true, responsive: true };

function baseLayout(title, ytitle) {
  return {
    title: { text: title, font: { family: "Courier New", color: "#00FF00" } },
    paper_bgcolor: "#0A0A0A",
    plot_bgcolor: "#121212",
    font: { family: "Courier New", color: "#00FF00" },
    xaxis: { title: "TOA (us)", gridcolor: "#333", zerolinecolor: "#333" },
    yaxis: { title: ytitle, gridcolor: "#333", zerolinecolor: "#333" },
    margin: { l: 55, r: 15, t: 35, b: 40 },
    showlegend: false,
    autosize: true,
    uirevision: "LOCK_UI"
  };
}

function initPlots() {
  Plotly.newPlot("plot_pri", [{ x: [], y: [], mode: "markers", marker: { size: 5 } }], baseLayout("PRI (us)", "PRI (us)"), PLOT_CONFIG);
  Plotly.newPlot("plot_am", [{ x: [], y: [], mode: "markers", marker: { size: 5 } }], baseLayout("AM (dBm)", "AM (dBm)"), PLOT_CONFIG);
  Plotly.newPlot("plot_fm", [{ x: [], y: [], mode: "markers", marker: { size: 5 } }], baseLayout("FM (MHz)", "FM (MHz)"), PLOT_CONFIG);
  Plotly.newPlot("plot_pw", [{ x: [], y: [], mode: "markers", marker: { size: 5 } }], baseLayout("PW (us)", "PW (us)"), PLOT_CONFIG);
  Plotly.newPlot("plot_aoa", [{ x: [], y: [], mode: "markers", marker: { size: 5 } }], baseLayout("AOA (deg)", "AOA (deg)"), PLOT_CONFIG);
  Plotly.newPlot("plot_fp", [{ x: [], y: [], mode: "lines" }], baseLayout("Fingerprint (Rising Edge)", "Power"), PLOT_CONFIG);
}
initPlots();

const btnPause = document.getElementById("btn_pause");
const btnTime = document.getElementById("view_time");
const btnSeq = document.getElementById("view_seq");

let isPaused = false;
let currentView = "time"; // "time" or "seq"
let globalSeqCounter = 0;

ws.onmessage = (ev) => {
  if (isPaused) return;

  const msg = JSON.parse(ev.data);
  if (msg.type !== "pdw_batch") return;

  for (const p of msg.data) {
    p.seq = globalSeqCounter++;
    buffer.push(p);
    if (buffer.length > MAX_BUF) buffer.shift();
  }
};

btnPause.onclick = () => {
  isPaused = !isPaused;
  btnPause.textContent = isPaused ? "▶ LIVE" : "穿 PAUSE";
  btnPause.style.borderColor = isPaused ? "#FF5555" : "#00FF00";
  btnPause.style.color = isPaused ? "#FF5555" : "#00FF00";
};

btnTime.onclick = () => {
  currentView = "time";
  btnTime.classList.add("active");
  btnSeq.classList.remove("active");
  updateLayouts();
};

btnSeq.onclick = () => {
  currentView = "seq";
  btnSeq.classList.add("active");
  btnTime.classList.remove("active");
  updateLayouts();
};

function updateLayouts() {
  const xtitle = currentView === "time" ? "TOA (us)" : "Order de Llegada (Seq Index)";
  ["plot_pri", "plot_am", "plot_fm", "plot_pw", "plot_aoa"].forEach(id => {
    Plotly.relayout(id, { "xaxis.title.text": xtitle });
  });
}

function render() {
  if (buffer.length === 0) return;

  const xvals = currentView === "time" ? buffer.map(p => p.TOA) : buffer.map(p => p.seq);
  const pris = buffer.map(p => p.PRI);
  const ams = buffer.map(p => p.AM);
  const fms = buffer.map(p => p.Freq); // Usamos Freq real para mas utilidad
  const pws = buffer.map(p => p.PW);
  const aoas = buffer.map(p => p.AOA);
  const cols = buffer.map(p => p.Color);

  Plotly.update("plot_pri", { x: [xvals], y: [pris], "marker.color": [cols] });
  Plotly.update("plot_am", { x: [xvals], y: [ams], "marker.color": [cols] });
  Plotly.update("plot_fm", { x: [xvals], y: [fms], "marker.color": [cols] });
  Plotly.update("plot_pw", { x: [xvals], y: [pws], "marker.color": [cols] });
  Plotly.update("plot_aoa", { x: [xvals], y: [aoas], "marker.color": [cols] });

  const last = buffer.slice(-20).reverse();
  rowsEl.innerHTML = "";
  for (const p of last) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.TOA.toFixed(1)}</td>
      <td>${p.Freq.toFixed(1)}</td>
      <td style="color:${p.Color}">T-${p.TrackID}</td>
    `;
    rowsEl.appendChild(tr);
  }

  const lastp = buffer[buffer.length - 1];
  const t = Array.from({ length: 100 }, (_, i) => (i / 99) * 0.5);
  const amp = Math.pow(10, lastp.AM / 20);
  const y = t.map(tt => (1 / (1 + Math.exp(-20 * (tt - 0.2)))) * amp);

  Plotly.update("plot_fp", { x: [t], y: [y] });
}

setInterval(render, 50);

btn.onclick = async () => {
  btn.textContent = "✓ EXPORTANDO...";

  if (buffer.length === 0) {
    btn.textContent = "✗ SIN DATOS";
    setTimeout(() => btn.textContent = "📷 GENERAR SNAPSHOT NG-PDW", 1500);
    return;
  }

  // Timestamp
  const ts = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestamp =
    ts.getFullYear() + pad(ts.getMonth() + 1) + pad(ts.getDate()) + "_" +
    pad(ts.getHours()) + pad(ts.getMinutes()) + pad(ts.getSeconds());

  const clean = buffer.map(p => {
    const c = { ...p };
    delete c.Color;
    return c;
  });

  const snapshot = {
    metadata: {
      version: "NG-PDW-1.0",
      timestamp,
      sensor_id: "ESM-SENTRY-01",
      pulse_count: clean.length
    },
    pdws: clean
  };

  const jsonBlob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const jsonLink = document.createElement("a");
  jsonLink.href = URL.createObjectURL(jsonBlob);
  jsonLink.download = `ng_pdw_snapshot_${timestamp}.json`;
  document.body.appendChild(jsonLink);
  jsonLink.click();
  jsonLink.remove();
  URL.revokeObjectURL(jsonLink.href);

  const byTrack = {};
  for (const p of buffer) {
    const id = p.TrackID;
    if (!byTrack[id]) byTrack[id] = [];
    byTrack[id].push(p);
  }

  function stats(arr, key) {
    const v = arr.map(x => x[key]).filter(x => Number.isFinite(x));
    if (!v.length) return null;
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const std = Math.sqrt(v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / v.length);
    return { mean, std, count: v.length };
  }

  const resumen = Object.entries(byTrack)
    .map(([id, arr]) => {
      const pri = stats(arr, "PRI");
      const fq = stats(arr, "Freq");
      const aoa = stats(arr, "AOA");
      return {
        pista: `T-${id}`,
        pulsos: arr.length,
        freq_media: fq ? fq.mean : null,
        aoa_media: aoa ? aoa.mean : null,
        jitter_pri: pri ? pri.std : null
      };
    })
    .sort((a, b) => a.pista.localeCompare(b.pista));

  async function grabPlot(divId) {
    const node = document.getElementById(divId);
    return await Plotly.toImage(node, { format: "jpeg", scale: 1, quality: 0.8 });
  }

  const plotIds = ["plot_pri", "plot_am", "plot_fm", "plot_pw", "plot_aoa", "plot_fp"];
  const images = [];
  for (const id of plotIds) images.push(await grabPlot(id));

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  pdf.setTextColor(0, 0, 0);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("INFORME SNAPSHOT NG-PDW", 10, 10);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Fecha/Hora: ${timestamp}`, 10, 16);
  pdf.text(`Sensor: ESM-SENTRY-01`, 10, 21);
  pdf.text(`Total de pulsos: ${buffer.length}`, 10, 26);

  pdf.setFont("helvetica", "bold");
  pdf.text("Resumen por pista (TrackID)", 10, 33);

  let y = 38;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);

  pdf.text("Pista", 10, y);
  pdf.text("Pulsos", 30, y);
  pdf.text("Frec. media (MHz)", 55, y);
  pdf.text("AOA media (°)", 105, y);
  pdf.text("Jitter PRI (σ, µs)", 140, y);

  y += 3;
  pdf.setDrawColor(0, 0, 0);
  pdf.line(10, y, 285, y);
  y += 5;

  for (const r of resumen) {
    if (y > 70) break;
    pdf.text(r.pista, 10, y);
    pdf.text(String(r.pulsos), 30, y);
    pdf.text(r.freq_media != null ? r.freq_media.toFixed(2) : "-", 55, y);
    pdf.text(r.aoa_media != null ? r.aoa_media.toFixed(2) : "-", 105, y);
    pdf.text(r.jitter_pri != null ? r.jitter_pri.toFixed(3) : "-", 140, y);
    y += 5;
  }

  const x0 = 10;
  const y0 = 75;
  const w = 90;
  const h = 50;
  const gap = 7;

  let idx = 0;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      if (idx >= images.length) break;
      const x = x0 + col * (w + gap);
      const yy = y0 + row * (h + gap);
      pdf.addImage(images[idx], "JPEG", x, yy, w, h);
      idx++;
    }
  }

  pdf.save(`ng_pdw_snapshot_${timestamp}.pdf`);

  btn.textContent = "✓ EXPORTADO";
  setTimeout(() => btn.textContent = "📷 GENERAR SNAPSHOT NG-PDW", 2000);
};


function resizeAll() {
  ["plot_pri", "plot_am", "plot_fm", "plot_pw", "plot_aoa", "plot_fp"].forEach(id => {
    const el = document.getElementById(id);
    if (el) Plotly.Plots.resize(el);
  });
}
window.addEventListener("resize", resizeAll);
setTimeout(resizeAll, 250);
function sizedLayout(elId, title, ytitle) {
  const el = document.getElementById(elId);
  const r = el.getBoundingClientRect();
  const layout = baseLayout(title, ytitle);
  layout.width = Math.max(10, Math.floor(r.width));
  layout.height = Math.max(10, Math.floor(r.height));
  return layout;
}
