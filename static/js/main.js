// ---------- Utilities ----------
const randBit = () => (Math.random() < 0.5 ? 0 : 1);
const randBasis = () => (Math.random() < 0.5 ? "+" : "×");
const randomBits = n => Array.from({ length: n }, randBit);
const randomBases = n => Array.from({ length: n }, randBasis);
const measure = (bit, prep, meas) => (prep === meas ? bit : randBit());
const sampleIndices = (n, f) => {
  const k = Math.max(1, Math.floor(n * f));
  const s = new Set(); while (s.size < k) s.add(Math.floor(Math.random() * n));
  return [...s].sort((a,b)=>a-b);
};

// ---------- DOM ----------
const scenario = document.getElementById("scenario");
const scenarioNote = document.getElementById("scenarioNote");

const nEl = document.getElementById("nQubits");
const eveEl = document.getElementById("eveRate");
const noiseEl = document.getElementById("noise");
const revealEl = document.getElementById("reveal");
const eveToggle = document.getElementById("eveToggle");
const qberThreshEl = document.getElementById("qberThresh");

const nLabel = document.getElementById("nLabel");
const eveLabel = document.getElementById("eveLabel");
const noiseLabel = document.getElementById("noiseLabel");
const revealLabel = document.getElementById("revealLabel");

[nEl, eveEl, noiseEl, revealEl].forEach(el => el.addEventListener("input", () => {
  nLabel.textContent = nEl.value;
  eveLabel.textContent = `${eveEl.value}%`;
  noiseLabel.textContent = `${noiseEl.value}%`;
  revealLabel.textContent = `${revealEl.value}%`;
}));

const runBtn = document.getElementById("runBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

const decisionBanner = document.getElementById("decisionBanner");
const keptOut = document.getElementById("kept");
const revealedOut = document.getElementById("revealed");
const qberOut = document.getElementById("qber");
const finalKeyOut = document.getElementById("finalKey");
const yieldOut = document.getElementById("yield");
const explain = document.getElementById("explain");

const area = document.getElementById("animationArea");
const caption = document.getElementById("animCaption");

const msg = document.getElementById("msg");
const encBtn = document.getElementById("encBtn");
const decBtn = document.getElementById("decBtn");
const ctEl = document.getElementById("ct");
const ptEl = document.getElementById("pt");

// ---------- Scenarios ----------
const SCENARIOS = {
  bank: {
    note: "Metro fiber: low noise, no attacker expected.",
    params: { eve: false, eveRate: 0, noise: 0.02, reveal: 0.25 }
  },
  smartgrid: {
    note: "Access network: medium noise; small chance of interception.",
    params: { eve: true, eveRate: 0.10, noise: 0.08, reveal: 0.25 }
  },
  hospital: {
    note: "Privacy-sensitive link: low–medium noise; strict abort policy.",
    params: { eve: false, eveRate: 0, noise: 0.04, reveal: 0.25 }
  },
  satellite: {
    note: "Free-space downlink: intermittent, higher noise; harvest during good windows.",
    params: { eve: false, eveRate: 0, noise: 0.12, reveal: 0.30 }
  },
  adversarial: {
    note: "Hostile environment: active attacker likely.",
    params: { eve: true, eveRate: 0.40, noise: 0.03, reveal: 0.25 }
  }
};

function applyScenario(key) {
  const s = SCENARIOS[key];
  scenarioNote.textContent = s.note;
  eveToggle.checked = s.params.eve;
  eveEl.value = Math.round(s.params.eveRate * 100);
  noiseEl.value = Math.round(s.params.noise * 100);
  revealEl.value = Math.round(s.params.reveal * 100);
  eveLabel.textContent = `${eveEl.value}%`;
  noiseLabel.textContent = `${noiseEl.value}%`;
  revealLabel.textContent = `${revealEl.value}%`;
}
scenario.addEventListener("change", e => applyScenario(e.target.value));
applyScenario("bank"); // default

// ---------- Simulation ----------
let last = null;

runBtn.addEventListener("click", () => {
  const N = parseInt(nEl.value, 10);
  const p = {
    N,
    eveEnabled: eveToggle.checked,
    eveRate: parseInt(eveEl.value, 10) / 100,
    noise: parseInt(noiseEl.value, 10) / 100,
    reveal: parseInt(revealEl.value, 10) / 100,
    qberThresh: parseFloat(qberThreshEl.value)
  };

  const aliceBits = randomBits(N);
  const aliceBases = randomBases(N);

  const transmitted = [];
  for (let i=0;i<N;i++){
    let cur = aliceBits[i];
    if (p.eveEnabled && Math.random() < p.eveRate) {
      const eB = randBasis();
      const eRes = measure(cur, aliceBases[i], eB);
      cur = eRes; // Eve resends
    }
    if (Math.random() < p.noise) cur = cur ? 0 : 1; // flip with prob
    transmitted.push(cur);
  }

  const bobBases = randomBases(N);
  const bobResults = transmitted.map((bit, i) => measure(bit, aliceBases[i], bobBases[i]));
  const matches = bobBases.map((b, i) => b === aliceBases[i]);
  const siftA = [], siftB = [];
  matches.forEach((m,i)=>{ if(m){ siftA.push(aliceBits[i]); siftB.push(bobResults[i]); } });

  const revealIdx = sampleIndices(siftA.length, p.reveal);
  const errors = revealIdx.filter(i => siftA[i] !== siftB[i]).length;
  const qber = revealIdx.length ? errors / revealIdx.length : 0;

  const revealedSet = new Set(revealIdx);
  const finalKey = siftA.filter((_,i)=>!revealedSet.has(i));

  last = { aliceBits, aliceBases, bobBases, bobResults, matches, revealIdx, finalKey, qber, params: p };
  renderAnimation(last);
  renderDecisionAndResults(last);
  downloadBtn.disabled = false;
});

clearBtn.addEventListener("click", () => {
  last = null;
  area.innerHTML = "";
  caption.textContent = "Run the simulation to see photons flow.";
  ["kept","revealed","qber","finalKey","yield"].forEach(id => document.getElementById(id).textContent = "—");
  decisionBanner.className = "decision neutral";
  decisionBanner.textContent = "Run the simulation to make a decision.";
  explain.textContent = "";
  downloadBtn.disabled = true;
});

// ---------- Animation ----------
function renderAnimation(res){
  area.innerHTML = "";
  res.aliceBits.forEach((bit,i)=>{
    const el = document.createElement("div");
    el.className = `photon bit${bit} ${res.aliceBases[i] === "+" ? "plus":"cross"}`;
    el.title = `Photon ${i}: bit=${bit}, basis=${res.aliceBases[i]}`;
    el.textContent = bit;
    area.appendChild(el);
    setTimeout(()=>{ el.style.transform = "translateY(40px)"; }, 60 + i*25);
    setTimeout(()=>{
      const m = res.bobBases[i] === res.aliceBases[i];
      el.classList.add(m ? "match" : "mismatch");
      el.title += m ? " — MATCH (Bob recovers bit)" : " — MISMATCH (random result)";
    }, 400 + i*25);
  });
  caption.textContent = "Green glow = matched bases → reliable bits. Red glow = mismatched bases → random.";
}

// ---------- Decision & explanation ----------
function renderDecisionAndResults(r){
  const kept = r.matches.filter(Boolean).length;
  const qberPct = (r.qber * 100);
  const finalLen = r.finalKey.length;
  const yld = kept ? (finalLen / kept) : 0;

  keptOut.textContent = kept;
  revealedOut.textContent = `[${r.revealIdx.join(", ")}]`;
  qberOut.textContent = qberPct.toFixed(1) + "%";
  finalKeyOut.textContent = r.finalKey.join("");
  yieldOut.textContent = kept ? `${(yld*100).toFixed(1)}%` : "—";

  const threshold = r.params.qberThresh;
  if (qberPct <= threshold) {
    decisionBanner.className = "decision ok";
    decisionBanner.textContent = `✅ Link ACCEPTED — QBER ${qberPct.toFixed(1)}% ≤ threshold ${threshold}%`;
  } else {
    decisionBanner.className = "decision bad";
    decisionBanner.textContent = `⛔ Link ABORTED — QBER ${qberPct.toFixed(1)}% > threshold ${threshold}%`;
  }

  explain.innerHTML = `
    <p><b>Step 1:</b> Alice sent ${r.params.N} photons with random bits and random bases.</p>
    <p><b>Step 2:</b> Bob measured with his own random bases. Matched bases become reliable; mismatches are random.</p>
    <p><b>Step 3:</b> They kept ${kept} positions where bases matched (the sifted set).</p>
    <p><b>Step 4:</b> They revealed ${r.revealIdx.length} positions to estimate errors → QBER = ${qberPct.toFixed(1)}%.</p>
    <p><b>Step 5:</b> Applying the decision rule (threshold ${threshold}%), the link was <b>${qberPct <= threshold ? "ACCEPTED" : "ABORTED"}</b>.</p>
    <p><b>Step 6:</b> Remaining bits (${finalLen}) form the derived key. Key yield = ${(yld*100).toFixed(1)}% of matched bases.</p>
  `;
}

// ---------- Download JSON ----------
downloadBtn.addEventListener("click", () => {
  if (!last) return;
  const blob = new Blob([JSON.stringify(last, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "bb84_run.json";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

// ---------- OTP (toy) ----------
function xor(plain, keyBits){
  const t = new TextEncoder().encode(plain);
  const out = new Uint8Array(t.length);
  for (let i=0;i<t.length;i++){ const k = keyBits[i % keyBits.length] ? 0xff : 0x00; out[i] = t[i] ^ k; }
  return out;
}
encBtn.addEventListener("click", ()=>{
  if (!last || last.finalKey.length === 0) { alert("Run the simulation first."); return; }
  const c = xor(msg.value, last.finalKey);
  ctEl.textContent = Array.from(c).map(b=>b.toString(16).padStart(2,"0")).join(" ");
});
decBtn.addEventListener("click", ()=>{
  if (!last || last.finalKey.length === 0) { alert("Run the simulation first."); return; }
  const hex = ctEl.textContent.trim(); if (!hex || hex === "—") return;
  const bytes = new Uint8Array(hex.split(/\s+/).map(h=>parseInt(h,16)));
  const out = new Uint8Array(bytes.length);
  for (let i=0;i<bytes.length;i++){ const k = last.finalKey[i % last.finalKey.length] ? 0xff : 0x00; out[i] = bytes[i] ^ k; }
  ptEl.textContent = new TextDecoder().decode(out);
});
