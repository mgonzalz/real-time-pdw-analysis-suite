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
  btn.textContent = "✓ EXPORTING PDF...";

  const EXPORT_MAX = 500;
  const exportBuf = buffer.slice(-EXPORT_MAX);

  if (exportBuf.length === 0) {
    btn.textContent = "✗ NO DATA";
    setTimeout(() => btn.textContent = "📷 GENERATE NG-PDW SNAPSHOT", 1500);
    return;
  }

  const ts = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestamp =
    ts.getFullYear() + pad(ts.getMonth()+1) + pad(ts.getDate()) + "_" +
    pad(ts.getHours()) + pad(ts.getMinutes()) + pad(ts.getSeconds());

  const byTrack = {};
  for (const p of exportBuf) {
    const id = p.TrackID;
    if (!byTrack[id]) byTrack[id] = [];
    byTrack[id].push(p);
  }

  function stats(arr, key){
    const v = arr.map(x => x[key]).filter(x => Number.isFinite(x));
    if (!v.length) return null;
    const mean = v.reduce((a,b)=>a+b,0)/v.length;
    const std = Math.sqrt(v.reduce((a,b)=>a+(b-mean)*(b-mean),0)/v.length);
    return {count:v.length, mean, std};
  }

  const trackRows = Object.entries(byTrack).map(([id, arr]) => {
    const pri = stats(arr, "PRI");
    const fq  = stats(arr, "Freq");
    const aoa = stats(arr, "AOA");
    return {
      id: `T-${id}`,
      pulses: arr.length,
      freqMean: fq ? fq.mean : null,
      aoaMean: aoa ? aoa.mean : null,
      priJitter: pri ? pri.std : null,
    };
  }).sort((a,b)=>a.id.localeCompare(b.id));

  async function grabPlot(divId){
    const node = document.getElementById(divId);
    return await Plotly.toImage(node, { format:"jpeg", scale: 1, quality: 0.7 });
  }

  const imgPRI  = await grabPlot("plot_pri");
  const imgFREQ = await grabPlot("plot_fm");
  const imgAOA  = await grabPlot("plot_aoa");

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  pdf.setTextColor(0, 255, 0);
  pdf.setFont("courier", "bold");
  pdf.setFontSize(14);
  pdf.text("NG-PDW SNAPSHOT REPORT", 12, 10);
  pdf.setFontSize(10);
  pdf.setFont("courier", "normal");
  pdf.text(`Timestamp: ${timestamp} | Sensor: ESM-SENTRY-01 | Pulses: ${exportBuf.length}`, 12, 16);

  const x0 = 10, y0 = 22;
  const w = 90, h = 55;

  pdf.addImage(imgPRI,  "JPEG", x0,            y0, w, h);
  pdf.addImage(imgFREQ, "JPEG", x0 + w + gap,  y0, w, h);
  pdf.addImage(imgAOA,  "JPEG", x0 + 2*(w+gap),y0, w, h);

  const tableY = y0 + h + 10;
  pdf.setFont("courier", "bold");
  pdf.text("TRACK SUMMARY", 12, tableY);
  pdf.setFont("courier", "normal");

  let y = tableY + 6;
  pdf.setFontSize(9);
  pdf.text("Track", 12, y);
  pdf.text("Pulses", 35, y);
  pdf.text("Freq mean (MHz)", 60, y);
  pdf.text("AOA mean (deg)", 110, y);
  pdf.text("PRI jitter (std, us)", 160, y);

  y += 5;
  pdf.setDrawColor(0,255,0);
  pdf.line(12, y, 285, y);
  y += 5;

  for (const r of trackRows) {
    if (y > 200) break;
    pdf.text(r.id, 12, y);
    pdf.text(String(r.pulses), 35, y);
    pdf.text(r.freqMean != null ? r.freqMean.toFixed(2) : "-", 60, y);
    pdf.text(r.aoaMean  != null ? r.aoaMean.toFixed(2)  : "-", 110, y);
    pdf.text(r.priJitter!= null ? r.priJitter.toFixed(3): "-", 160, y);
    y += 5;
  }

  pdf.setFontSize(9);
  pdf.setTextColor(0,170,0);
  pdf.text("SYSTEM STATUS: NOMINAL", 12, 206);
  pdf.save(`ng_pdw_snapshot_${timestamp}.pdf`);

  btn.textContent = `✓ SAVED: ng_pdw_snapshot_${timestamp}.pdf`;
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
