/* Proof Sets Buy Sheet PWA
   Pricing model:
   - Your sheet provides buy prices at spot $78 (baselineSpot) and baseline discount 35% (baselineDiscount).
   - Convert each bucket's buy price into an implied "full value" at baseline spot:
       fullValue = buyPriceAtBaseline / (1 - baselineDiscount)
   - For current spot S and discount d:
       offerEach = fullValue * (S / baselineSpot) * (1 - d)
*/

const APP_VERSION = "0.1.0";

// From your uploaded rate sheet (spot $78, dated 2/8/2026) buckets + buy prices.
const baselineSpot = 78;
const baselineDiscount = 0.35;

const BUCKETS = [
  { id: "ps_1950_1964", label: "1950–1964 proof sets", buyAtBaseline: 31.00 },
  { id: "ms_1956_1964", label: "1956–1964 mint sets",  buyAtBaseline: 62.00 },
  { id: "sets_1965_1970", label: "1965–1970 sets",      buyAtBaseline: 6.00  },
  { id: "ike_1971_1974", label: "1971–1974 Ike sets",   buyAtBaseline: 12.00 },
  { id: "set_1976",      label: "1976 proof/mint set",  buyAtBaseline: 24.00 },
  { id: "ps_1992_1998",  label: "1992–1998 proof sets", buyAtBaseline: 28.00 },
  { id: "ps_1999_2008",  label: "1999–2008 proof sets", buyAtBaseline: 65.00 },
  { id: "ps_2009",       label: "2009 proof set",       buyAtBaseline: 76.00 },
  { id: "ps_2010_2020",  label: "2010–2020 proof sets", buyAtBaseline: 68.00 }
];

// Storage keys
const KEY_STATE = "proofSetsBuySheet_state_v1";
const KEY_SAVED = "proofSetsBuySheet_savedQuotes_v1";

function money(n){
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString(undefined, { style:"currency", currency:"USD" });
}

function clamp(n, min, max){
  return Math.min(max, Math.max(min, n));
}

function nowStamp(){
  const d = new Date();
  return d.toLocaleString();
}

function getState(){
  const raw = localStorage.getItem(KEY_STATE);
  if(raw){
    try { return JSON.parse(raw); } catch {}
  }
  // Defaults requested: spot=78, discount=35%
  const qty = {};
  BUCKETS.forEach(b => qty[b.id] = 0);

  return {
    spot: baselineSpot,
    discountPct: 35,
    note: "",
    qty
  };
}

function setState(state){
  localStorage.setItem(KEY_STATE, JSON.stringify(state));
}

function getSaved(){
  const raw = localStorage.getItem(KEY_SAVED);
  if(!raw) return [];
  try { return JSON.parse(raw) || []; } catch { return []; }
}

function setSaved(list){
  localStorage.setItem(KEY_SAVED, JSON.stringify(list));
}

function fullValueAtBaseline(buyAtBaseline){
  return buyAtBaseline / (1 - baselineDiscount);
}

function offerEach(bucket, spot, discountPct){
  const d = clamp(discountPct, 0, 50) / 100;
  const fv = fullValueAtBaseline(bucket.buyAtBaseline);
  return fv * (spot / baselineSpot) * (1 - d);
}

function buildBucketsUI(state){
  const root = document.getElementById("buckets");
  root.innerHTML = "";

  BUCKETS.forEach(bucket => {
    const wrap = document.createElement("div");
    wrap.className = "bucket";
    wrap.dataset.bucketId = bucket.id;

    const top = document.createElement("div");
    top.className = "bucket-top";

    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "bucket-name";
    name.textContent = bucket.label;

    const meta = document.createElement("div");
    meta.className = "bucket-meta";
    const fv = fullValueAtBaseline(bucket.buyAtBaseline);
    meta.textContent = `Baseline buy ${money(bucket.buyAtBaseline)} @ spot $${baselineSpot} (implied full value ${money(fv)})`;

    left.appendChild(name);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "bucket-right";

    const pline = document.createElement("div");
    pline.className = "price-line";
    pline.textContent = "Offer each";

    const pbig = document.createElement("div");
    pbig.className = "price-big";
    pbig.id = `offer_${bucket.id}`;
    pbig.textContent = money(offerEach(bucket, state.spot, state.discountPct));

    right.appendChild(pline);
    right.appendChild(pbig);

    top.appendChild(left);
    top.appendChild(right);

    const controls = document.createElement("div");
    controls.className = "bucket-controls";

    const qtyInput = document.createElement("input");
    qtyInput.className = "qty";
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.step = "1";
    qtyInput.inputMode = "numeric";
    qtyInput.value = String(state.qty[bucket.id] ?? 0);
    qtyInput.setAttribute("aria-label", `${bucket.label} quantity`);

    qtyInput.addEventListener("input", () => {
      const n = clamp(parseInt(qtyInput.value || "0", 10) || 0, 0, 999999);
      state.qty[bucket.id] = n;
      setState(state);
      recalc(state);
    });

    const subtotal = document.createElement("div");
    subtotal.className = "subtotal";
    subtotal.id = `sub_${bucket.id}`;
    subtotal.textContent = money((state.qty[bucket.id] || 0) * offerEach(bucket, state.spot, state.discountPct));

    controls.appendChild(qtyInput);
    controls.appendChild(subtotal);

    wrap.appendChild(top);
    wrap.appendChild(controls);

    root.appendChild(wrap);
  });
}

function recalc(state){
  // Update per-bucket offers + subtotals
  let total = 0;

  BUCKETS.forEach(bucket => {
    const each = offerEach(bucket, state.spot, state.discountPct);
    const qty = state.qty[bucket.id] || 0;
    const sub = each * qty;
    total += sub;

    const offerEl = document.getElementById(`offer_${bucket.id}`);
    const subEl = document.getElementById(`sub_${bucket.id}`);
    if(offerEl) offerEl.textContent = money(each);
    if(subEl) subEl.textContent = money(sub);
  });

  document.getElementById("grandTotal").textContent = money(total);
}

function renderSaved(){
  const list = getSaved();
  const root = document.getElementById("savedList");
  root.innerHTML = "";

  if(list.length === 0){
    const empty = document.createElement("div");
    empty.className = "smallprint";
    empty.textContent = "No saved quotes yet.";
    root.appendChild(empty);
    return;
  }

  list.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "saved";

    const head = document.createElement("div");
    head.className = "saved-head";

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "saved-title";
    title.textContent = `${money(q.grandTotal)} • Spot $${Number(q.spot).toFixed(2)} • Disc ${Number(q.discountPct).toFixed(1)}%`;

    const sub = document.createElement("div");
    sub.className = "saved-sub";
    sub.textContent = `${q.timestamp}${q.note ? " • " + q.note : ""}`;

    left.appendChild(title);
    left.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "saved-actions";

    const loadBtn = document.createElement("button");
    loadBtn.className = "iconbtn";
    loadBtn.type = "button";
    loadBtn.textContent = "Load";
    loadBtn.addEventListener("click", () => {
      // Restore quote state
      const state = getState();
      state.spot = q.spot;
      state.discountPct = q.discountPct;
      state.note = q.note || "";
      state.qty = { ...state.qty, ...(q.qty || {}) };
      setState(state);
      hydrateUI(state);
    });

    const copyBtn = document.createElement("button");
    copyBtn.className = "iconbtn";
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async () => {
      const lines = [];
      lines.push(`Proof Sets Quote (${q.timestamp})`);
      if(q.note) lines.push(`Note: ${q.note}`);
      lines.push(`Spot: $${Number(q.spot).toFixed(2)} | Discount: ${Number(q.discountPct).toFixed(1)}%`);
      lines.push("");
      BUCKETS.forEach(b => {
        const qty = (q.qty && q.qty[b.id]) ? q.qty[b.id] : 0;
        if(qty > 0){
          const each = offerEach(b, q.spot, q.discountPct);
          lines.push(`${b.label}: qty ${qty} × ${money(each)} = ${money(each*qty)}`);
        }
      });
      lines.push("");
      lines.push(`Grand Total: ${money(q.grandTotal)}`);

      const text = lines.join("\n");
      try{
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = "Copied";
        setTimeout(()=>copyBtn.textContent="Copy", 900);
      }catch{
        alert("Copy failed (clipboard blocked).");
      }
    });

    const delBtn = document.createElement("button");
    delBtn.className = "iconbtn";
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      const cur = getSaved();
      cur.splice(idx, 1);
      setSaved(cur);
      renderSaved();
    });

    actions.appendChild(loadBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(delBtn);

    head.appendChild(left);
    head.appendChild(actions);

    card.appendChild(head);
    root.appendChild(card);
  });
}

function hydrateUI(state){
  // Version label
  document.getElementById("versionLabel").textContent = `v${APP_VERSION}`;

  // Inputs
  const spotInput = document.getElementById("spotInput");
  const discountSlider = document.getElementById("discountSlider");
  const discountLabel = document.getElementById("discountLabel");
  const noteInput = document.getElementById("noteInput");

  spotInput.value = String(state.spot ?? baselineSpot);
  discountSlider.value = String(state.discountPct ?? 35);
  discountLabel.textContent = `${Number(state.discountPct ?? 35).toFixed(1)}%`;
  noteInput.value = state.note || "";

  // Build buckets if needed, then recalc
  buildBucketsUI(state);
  recalc(state);

  // Saved list
  renderSaved();

  // Wire events (idempotent-ish)
  spotInput.oninput = () => {
    const v = parseFloat(spotInput.value);
    state.spot = Number.isFinite(v) ? v : baselineSpot;
    setState(state);
    recalc(state);
  };

  discountSlider.oninput = () => {
    const v = parseFloat(discountSlider.value);
    state.discountPct = Number.isFinite(v) ? v : 35;
    discountLabel.textContent = `${Number(state.discountPct).toFixed(1)}%`;
    setState(state);
    recalc(state);
  };

  noteInput.oninput = () => {
    state.note = noteInput.value || "";
    setState(state);
  };

  document.getElementById("resetBtn").onclick = () => {
    const fresh = getState();
    // hard reset to defaults
    fresh.spot = baselineSpot;
    fresh.discountPct = 35;
    fresh.note = "";
    Object.keys(fresh.qty).forEach(k => fresh.qty[k] = 0);
    setState(fresh);
    hydrateUI(fresh);
  };

  document.getElementById("saveBtn").onclick = () => {
    const q = {
      timestamp: nowStamp(),
      spot: Number(state.spot ?? baselineSpot),
      discountPct: Number(state.discountPct ?? 35),
      note: (state.note || "").trim(),
      qty: { ...state.qty }
    };

    // compute grand total at save-time
    let total = 0;
    BUCKETS.forEach(b => {
      const each = offerEach(b, q.spot, q.discountPct);
      const qty = q.qty[b.id] || 0;
      total += each * qty;
    });
    q.grandTotal = total;

    const list = getSaved();
    list.unshift(q);
    setSaved(list);
    renderSaved();
  };

  document.getElementById("clearSavedBtn").onclick = () => {
    if(confirm("Clear ALL saved quotes on this device?")){
      setSaved([]);
      renderSaved();
    }
  };
}

function registerSW(){
  if("serviceWorker" in navigator){
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
    });
  }
}

(function init(){
  const state = getState();
  hydrateUI(state);
  registerSW();
})();
