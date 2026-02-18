const WS_PROTO = (location.protocol === "https:") ? "wss" : "ws";
const ws = new WebSocket(`${WS_PROTO}://${location.host}/ws/pdw`);
ws.onopen  = () => console.log("[WS] connected", ws.url);
ws.onerror = (e) => console.error("[WS] error", e);
ws.onclose = (e) => console.warn("[WS] closed", e.code, e.reason);
const buffer = [];
const MAX_BUF = 1000;

const rowsEl = document.getElementById("pdw_rows");
const btn = document.getElementById("btn_snapshot");

const PLOT_CONFIG = { displayModeBar: true, responsive: true };

function baseLayout(title, ytitle){
  return {
    title: {text: title, font:{family:"Courier New", color:"#00FF00"}},
    paper_bgcolor:"#0A0A0A",
    plot_bgcolor:"#121212",
    font:{family:"Courier New", color:"#00FF00"},
    xaxis:{title:"TOA (us)", gridcolor:"#333", zerolinecolor:"#333"},
    yaxis:{title:ytitle, gridcolor:"#333", zerolinecolor:"#333"},
    margin:{l:55,r:15,t:35,b:40},
    showlegend:false,
    autosize:true,
    uirevision:"LOCK_UI"
  };
}

function initPlots(){
  Plotly.newPlot("plot_pri", [{x:[], y:[], mode:"markers", marker:{size:5}}], baseLayout("PRI (us)","PRI (us)"), PLOT_CONFIG);
  Plotly.newPlot("plot_am",  [{x:[], y:[], mode:"markers", marker:{size:5}}], baseLayout("AM (dBm)","AM (dBm)"), PLOT_CONFIG);
  Plotly.newPlot("plot_fm",  [{x:[], y:[], mode:"markers", marker:{size:5}}], baseLayout("FM (MHz)","FM (MHz)"), PLOT_CONFIG);
  Plotly.newPlot("plot_pw",  [{x:[], y:[], mode:"markers", marker:{size:5}}], baseLayout("PW (us)","PW (us)"), PLOT_CONFIG);
  Plotly.newPlot("plot_aoa", [{x:[], y:[], mode:"markers", marker:{size:5}}], baseLayout("AOA (deg)","AOA (deg)"), PLOT_CONFIG);
  Plotly.newPlot("plot_fp",  [{x:[], y:[], mode:"lines"}],               baseLayout("Fingerprint (Rising Edge)","Power"), PLOT_CONFIG);
}
initPlots();

const btnPause = document.getElementById("btn_pause");
let isPaused = false;

ws.onmessage = (ev) => {
  if (isPaused) return;

  const msg = JSON.parse(ev.data);
  if(msg.type !== "pdw_batch") return;

  for(const p of msg.data){
    buffer.push(p);
    if(buffer.length > MAX_BUF) buffer.shift();
  }
};

btnPause.onclick = () => {
  isPaused = !isPaused;

  if (isPaused) {
    btnPause.textContent = "▶ LIVE";
    btnPause.style.borderColor = "#FF5555";
    btnPause.style.color = "#FF5555";
  } else {
    btnPause.textContent = "⏸ PAUSE";
    btnPause.style.borderColor = "#00FF00";
    btnPause.style.color = "#00FF00";
  }
};


function render(){
  if(buffer.length === 0) return;

  const toas = buffer.map(p=>p.TOA);
  const pris = buffer.map(p=>p.PRI);
  const ams  = buffer.map(p=>p.AM);
  const fms  = buffer.map(p=>p.FM);
  const pws  = buffer.map(p=>p.PW);
  const aoas = buffer.map(p=>p.AOA);
  const cols = buffer.map(p=>p.Color);

  Plotly.update("plot_pri", { x:[toas], y:[pris], "marker.color":[cols] });
  Plotly.update("plot_am",  { x:[toas], y:[ams],  "marker.color":[cols] });
  Plotly.update("plot_fm",  { x:[toas], y:[fms],  "marker.color":[cols] });
  Plotly.update("plot_pw",  { x:[toas], y:[pws],  "marker.color":[cols] });
  Plotly.update("plot_aoa", { x:[toas], y:[aoas], "marker.color":[cols] });

  const last = buffer.slice(-20).reverse();
  rowsEl.innerHTML = "";
  for(const p of last){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.TOA.toFixed(1)}</td>
      <td>${p.Freq.toFixed(1)}</td>
      <td style="color:${p.Color}">T-${p.TrackID}</td>
    `;
    rowsEl.appendChild(tr);
  }

  const lastp = buffer[buffer.length-1];
  const t = Array.from({length:100}, (_,i)=> (i/99)*0.5);
  const amp = Math.pow(10, lastp.AM/20);
  const y = t.map(tt => (1/(1+Math.exp(-20*(tt-0.2)))) * amp);

  Plotly.update("plot_fp", { x:[t], y:[y] });
}

setInterval(render, 50);

btn.onclick = async () => {
  btn.textContent = "✓ EXPORTING...";

  // timestamp
  const ts = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestamp =
    ts.getFullYear() + pad(ts.getMonth()+1) + pad(ts.getDate()) + "_" +
    pad(ts.getHours()) + pad(ts.getMinutes()) + pad(ts.getSeconds());

  // clean pdws (remove Color)
  const clean = buffer.map(p => {
    const c = {...p};
    delete c.Color;
    return c;
  });

  // -------- summary metrics (simple but useful)
  const byTrack = {};
  for (const p of buffer) {
    const id = p.TrackID;
    if (!byTrack[id]) byTrack[id] = [];
    byTrack[id].push(p);
  }

  function stats(arr, key){
    const v = arr.map(x => x[key]).filter(x => Number.isFinite(x));
    if (!v.length) return null;
    const min = Math.min(...v);
    const max = Math.max(...v);
    const mean = v.reduce((a,b)=>a+b,0)/v.length;
    const std = Math.sqrt(v.reduce((a,b)=>a+(b-mean)*(b-mean),0)/v.length);
    return {count:v.length, min, max, mean, std};
  }

  // PRI jitter per track: std of PRI
  const trackSummary = {};
  for (const [id, arr] of Object.entries(byTrack)) {
    trackSummary[id] = {
      pulses: arr.length,
      PRI: stats(arr, "PRI"),
      Freq: stats(arr, "Freq"),
      AM: stats(arr, "AM"),
      FM: stats(arr, "FM"),
      PW: stats(arr, "PW"),
      AOA: stats(arr, "AOA"),
    };
  }

  const summary = {
    version: "NG-PDW-1.0",
    timestamp,
    sensor_id: "ESM-SENTRY-01",
    pulse_count: clean.length,
    tracks: trackSummary
  };

  // -------- export plot images (Plotly -> PNG)
  async function grabPlotPng(divId){
    const node = document.getElementById(divId);
    // scale 2 for sharpness
    return await Plotly.toImage(node, {format:"png", scale:2});
  }

  const plotIds = [
    ["plot_pri","pri.png"],
    ["plot_am","am.png"],
    ["plot_fm","fm.png"],
    ["plot_pw","pw.png"],
    ["plot_aoa","aoa.png"],
    ["plot_fp","fingerprint.png"],
  ];

  // Collect images (base64 data URLs)
  const images = {};
  for (const [id, fname] of plotIds) {
    images[fname] = await grabPlotPng(id);
  }

  // -------- Build report.html (simple, readable)
  const trackRows = Object.entries(trackSummary).map(([id, t]) => {
    const priJ = t.PRI ? t.PRI.std : null;
    const aoaM = t.AOA ? t.AOA.mean : null;
    const fM   = t.Freq ? t.Freq.mean : null;
    return `
      <tr>
        <td>T-${id}</td>
        <td>${t.pulses}</td>
        <td>${fM?.toFixed(2) ?? "-"}</td>
        <td>${aoaM?.toFixed(2) ?? "-"}</td>
        <td>${priJ?.toFixed(3) ?? "-"}</td>
      </tr>`;
  }).join("");

  const reportHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>NG-PDW Snapshot Report ${timestamp}</title>
  <style>
    body{background:#0A0A0A;color:#00FF00;font-family:Courier New, monospace;margin:20px;}
    h1,h2{margin:0 0 10px 0;}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px;}
    .card{border:1px solid #00FF00;background:#121212;padding:10px;}
    img{width:100%;height:auto;border:1px solid #333;}
    table{width:100%;border-collapse:collapse;margin-top:10px;}
    th,td{border:1px solid #333;padding:8px;text-align:left;}
    th{background:#1A1A1A;}
    .muted{color:#00AA00;font-size:12px;}
  </style>
</head>
<body>
  <h1>NG-PDW Snapshot Report</h1>
  <div class="muted">Timestamp: ${timestamp} | Sensor: ESM-SENTRY-01 | Pulses: ${clean.length}</div>

  <h2 style="margin-top:16px;">Track Summary</h2>
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Track</th><th>Pulses</th><th>Freq mean (MHz)</th><th>AOA mean (deg)</th><th>PRI jitter (std, us)</th>
        </tr>
      </thead>
      <tbody>${trackRows}</tbody>
    </table>
    <div class="muted" style="margin-top:8px;">
      PRI jitter (std) te indica estabilidad: bajo = emisor estable; alto = jitter/agilidad.
    </div>
  </div>

  <h2 style="margin-top:16px;">Plots</h2>
  <div class="grid">
    ${plotIds.map(([,fname]) => `
      <div class="card">
        <div class="muted">${fname.replace(".png","").toUpperCase()}</div>
        <img src="plots/${fname}" />
      </div>
    `).join("")}
  </div>
</body>
</html>`;

  // -------- Zip everything
  const zip = new JSZip();

  // JSONs
  zip.file(`ng_pdw_snapshot_${timestamp}.json`, JSON.stringify({
    metadata: {
      version: "NG-PDW-1.0",
      timestamp,
      sensor_id: "ESM-SENTRY-01",
      pulse_count: clean.length
    },
    pdws: clean
  }, null, 4));

  zip.file(`summary_${timestamp}.json`, JSON.stringify(summary, null, 4));
  zip.file(`report_${timestamp}.html`, reportHtml);

  // images folder
  const imgFolder = zip.folder("plots");
  for (const [fname, dataUrl] of Object.entries(images)) {
    // data:image/png;base64,....
    const base64 = dataUrl.split(",")[1];
    imgFolder.file(fname, base64, {base64:true});
  }

  const blob = await zip.generateAsync({type:"blob"});
  saveAs(blob, `ng_pdw_snapshot_${timestamp}.zip`);

  btn.textContent = `✓ SAVED: ng_pdw_snapshot_${timestamp}.zip`;
  setTimeout(() => btn.textContent = "📷 GENERATE NG-PDW SNAPSHOT", 2000);
};


function resizeAll(){
  ["plot_pri","plot_am","plot_fm","plot_pw","plot_aoa","plot_fp"].forEach(id=>{
    const el = document.getElementById(id);
    if (el) Plotly.Plots.resize(el);
  });
}
window.addEventListener("resize", resizeAll);
setTimeout(resizeAll, 250);
function sizedLayout(elId, title, ytitle){
  const el = document.getElementById(elId);
  const r = el.getBoundingClientRect();
  const layout = baseLayout(title, ytitle);
  layout.width  = Math.max(10, Math.floor(r.width));
  layout.height = Math.max(10, Math.floor(r.height));
  return layout;
}
