/* Proof Sets Buy Sheet PWA - v3 (major only)
   Adds:
   - Melt each + melt subtotal per bucket
   - Grand total melt
   - Per-bucket "Silver oz per set" input (in Behind scenes) so you can enter content
   - Silver oz values persist + are saved/loaded with quotes
*/

const APP_VERSION = "3";

// Baseline assumptions (internal only)
const baselineSpot = 78;
const baselineDiscount = 0.35;

const BUYERS = [
  { id: "lcs",       label: "LCS",        defaultPremiumPct: 10 },
  { id: "wholesale", label: "Wholesaler", defaultPremiumPct: 6  },
  { id: "refiner",   label: "Refiner",    defaultPremiumPct: 3  },
  { id: "ebay",      label: "eBay",       defaultPremiumPct: 18 }
];

const premiumMin = -10;
const premiumMax = 30;
const premiumStep = 0.5;

// IMPORTANT: silverOzPerSet defaults are UNKNOWN until you fill them.
// Once you give me the oz, I can hardcode them here.
const BUCKETS = [
  { id: "ps_1950_1964", label: "1950–1964 proof sets", buyAtBaseline: 31.00, silverOzPerSet: null },
  { id: "ms_1956_1964", label: "1956–1964 mint sets",  buyAtBaseline: 62.00, silverOzPerSet: null },
  { id: "sets_1965_1970", label: "1965–1970 sets",      buyAtBaseline: 6.00,  silverOzPerSet: null },
  { id: "ike_1971_1974", label: "1971–1974 Ike sets",   buyAtBaseline: 12.00, silverOzPerSet: null },
  { id: "set_1976",      label: "1976 proof/mint set",  buyAtBaseline: 24.00, silverOzPerSet: null },
  { id: "ps_1992_1998",  label: "1992–1998 proof sets", buyAtBaseline: 28.00, silverOzPerSet: null },
  { id: "ps_1999_2008",  label: "1999–2008 proof sets", buyAtBaseline: 65.00, silverOzPerSet: null },
  { id: "ps_2009",       label: "2009 proof set",       buyAtBaseline: 76.00, silverOzPerSet: null },
  { id: "ps_2010_2020",  label: "2010–2020 proof sets", buyAtBaseline: 68.00, silverOzPerSet: null }
];

const KEY_STATE = "proofSetsBuySheet_state_v3_melt";
const KEY_SAVED = "proofSetsBuySheet_savedQuotes_v1";

function money(n){
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString(undefined, { style:"currency", currency:"USD" });
}
function clamp(n, min, max){ return Math.min(max, Math.max(min, n)); }
function nowStamp(){ return new Date().toLocaleString(); }

function getSaved(){
  const raw = localStorage.getItem(KEY_SAVED);
  if(!raw) return [];
  try { return JSON.parse(raw) || []; } catch { return []; }
}
function setSaved(list){
  localStorage.setItem(KEY_SAVED, JSON.stringify(list));
}

function getState(){
  const raw = localStorage.getItem(KEY_STATE);
  if(raw){
    try { return JSON.parse(raw); } catch {}
  }

  const qty = {};
  const resale = {};
  const silverOz = {};

  BUCKETS.forEach(b => {
    qty[b.id] = 0;
    resale[b.id] = { show:false, buyerId:"lcs", premiumPct: 10 };
    silverOz[b.id] = b.silverOzPerSet; // null until you fill it
  });

  return {
    spot: baselineSpot,
    discountPct: 35,
    note: "",
    qty,
    resale,
    silverOz,
    grandResaleShow: false
  };
}

function setState(state){
  localStorage.setItem(KEY_STATE, JSON.stringify(state));
}

function fullValueAtBaseline(buyAtBaseline){
  return buyAtBaseline / (1 - baselineDiscount);
}

function offerEach(bucket, spot, discountPct){
  const d = clamp(discountPct, 0, 50) / 100;
  const fv = fullValueAtBaseline(bucket.buyAtBaseline);
  return fv * (spot / baselineSpot) * (1 - d);
}

function meltEach(bucketId, spot, state){
  const oz = state.silverOz[bucketId];
  if(!Number.isFinite(oz) || oz <= 0) return null;
  return oz * spot;
}

function expectedSellEachFromOffer(offer, premiumPct){
  const p = clamp(premiumPct, premiumMin, premiumMax) / 100;
  return offer * (1 + p);
}

function buyerDefaultPremium(buyerId){
  const b = BUYERS.find(x => x.id === buyerId);
  return b ? b.defaultPremiumPct : 10;
}

function buildBucketsUI(state){
  const root = document.getElementById("buckets");
  root.innerHTML = "";

  BUCKETS.forEach(bucket => {
    const wrap = document.createElement("div");
    wrap.className = "bucket";

    // Top row
    const top = document.createElement("div");
    top.className = "bucket-top";

    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "bucket-name";
    name.textContent = bucket.label;
    left.appendChild(name);

    const right = document.createElement("div");
    right.className = "bucket-right";

    // Offer display
    const pline = document.createElement("div");
    pline.className = "price-line";
    pline.textContent = "Offer each";

    const pbig = document.createElement("div");
    pbig.className = "price-big";
    pbig.id = `offer_${bucket.id}`;

    // Melt display
    const mwrap = document.createElement("div");
    mwrap.className = "melt-line";

    const mline = document.createElement("div");
    mline.className = "price-line";
    mline.textContent = "Melt each";

    const mval = document.createElement("div");
    mval.className = "melt-value";
    mval.id = `meltEach_${bucket.id}`;
    mval.textContent = "—";

    const mbadge = document.createElement("div");
    mbadge.className = "badge warn";
    mbadge.id = `meltBadge_${bucket.id}`;
    mbadge.textContent = "Melt: N/A (set oz)";

    mwrap.appendChild(mline);
    mwrap.appendChild(mval);
    mwrap.appendChild(mbadge);

    right.appendChild(pline);
    right.appendChild(pbig);
    right.appendChild(mwrap);

    top.appendChild(left);
    top.appendChild(right);

    // Controls row
    const controls = document.createElement("div");
    controls.className = "bucket-controls";

    const qtyInput = document.createElement("input");
    qtyInput.className = "qty";
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.step = "1";
    qtyInput.inputMode = "numeric";
    qtyInput.value = String(state.qty[bucket.id] ?? 0);

    qtyInput.addEventListener("input", () => {
      const n = clamp(parseInt(qtyInput.value || "0", 10) || 0, 0, 999999);
      state.qty[bucket.id] = n;
      setState(state);
      recalc(state);
    });

    const subtotal = document.createElement("div");
    subtotal.className = "subtotal";
    subtotal.id = `sub_${bucket.id}`;

    controls.appendChild(qtyInput);
    controls.appendChild(subtotal);

    // Behind scenes
    const behindWrap = document.createElement("div");
    behindWrap.className = "behind-wrap";

    const toggle = document.createElement("button");
    toggle.className = "behind-toggle";
    toggle.type = "button";
    toggle.id = `bt_${bucket.id}`;
    toggle.textContent = "Behind scenes ▸";

    const panel = document.createElement("div");
    panel.className = "behind-panel hidden";
    panel.id = `bp_${bucket.id}`;

    const grid = document.createElement("div");
    grid.className = "behind-grid";

    // NEW: Silver oz per set input
    const ozField = document.createElement("label");
    ozField.className = "field";
    const ozSpan = document.createElement("span");
    ozSpan.textContent = "Silver oz per set (troy)";
    const ozInput = document.createElement("input");
    ozInput.type = "number";
    ozInput.step = "0.0001";
    ozInput.min = "0";
    ozInput.inputMode = "decimal";
    ozInput.id = `oz_${bucket.id}`;
    ozInput.value = (Number.isFinite(state.silverOz[bucket.id]) ? String(state.silverOz[bucket.id]) : "");

    ozInput.addEventListener("input", () => {
      const v = parseFloat(ozInput.value);
      state.silverOz[bucket.id] = Number.isFinite(v) ? v : null;
      setState(state);
      recalc(state);
    });

    ozField.appendChild(ozSpan);
    ozField.appendChild(ozInput);

    // Buyer + premium
    const buyerField = document.createElement("label");
    buyerField.className = "field";
    const buyerSpan = document.createElement("span");
    buyerSpan.textContent = "Buyer";
    const buyerSelect = document.createElement("select");
    buyerSelect.id = `buyer_${bucket.id}`;
    BUYERS.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.label;
      buyerSelect.appendChild(opt);
    });
    buyerField.appendChild(buyerSpan);
    buyerField.appendChild(buyerSelect);

    const premField = document.createElement("label");
    premField.className = "field";
    const premSpan = document.createElement("span");
    premSpan.textContent = "Premium over your offer";
    const premRow = document.createElement("div");
    premRow.className = "slider-row";

    const premSlider = document.createElement("input");
    premSlider.className = "range";
    premSlider.type = "range";
    premSlider.min = String(premiumMin);
    premSlider.max = String(premiumMax);
    premSlider.step = String(premiumStep);
    premSlider.id = `prem_${bucket.id}`;

    const premPill = document.createElement("div");
    premPill.className = "pill";
    const premPillText = document.createElement("span");
    premPillText.id = `premLabel_${bucket.id}`;
    premPill.appendChild(premPillText);

    premRow.appendChild(premSlider);
    premRow.appendChild(premPill);

    premField.appendChild(premSpan);
    premField.appendChild(premRow);

    // KPI boxes
    const kvSellEach = document.createElement("div");
    kvSellEach.className = "kv";
    kvSellEach.innerHTML = `<div class="k">Expected sell each</div><div class="v" id="sellEach_${bucket.id}">$0.00</div>`;

    const kvProfitEach = document.createElement("div");
    kvProfitEach.className = "kv";
    kvProfitEach.innerHTML = `<div class="k">Profit each</div><div class="v" id="profitEach_${bucket.id}">$0.00</div>`;

    const kvSellSub = document.createElement("div");
    kvSellSub.className = "kv";
    kvSellSub.innerHTML = `<div class="k">Expected sell subtotal (qty)</div><div class="v" id="sellSub_${bucket.id}">$0.00</div>`;

    const kvProfitSub = document.createElement("div");
    kvProfitSub.className = "kv";
    kvProfitSub.innerHTML = `<div class="k">Profit subtotal (qty)</div><div class="v" id="profitSub_${bucket.id}">$0.00</div>`;

    // NEW: Melt subtotal KPI
    const kvMeltSub = document.createElement("div");
    kvMeltSub.className = "kv";
    kvMeltSub.innerHTML = `<div class="k">Melt subtotal (qty)</div><div class="v" id="meltSub_${bucket.id}">$0.00</div>`;

    grid.appendChild(ozField);
    grid.appendChild(buyerField);
    grid.appendChild(premField);
    grid.appendChild(kvSellEach);
    grid.appendChild(kvProfitEach);
    grid.appendChild(kvSellSub);
    grid.appendChild(kvProfitSub);
    grid.appendChild(kvMeltSub);

    panel.appendChild(grid);

    // restore resale state
    const rs = state.resale[bucket.id] || { show:false, buyerId:"lcs", premiumPct:10 };
    buyerSelect.value = rs.buyerId ?? "lcs";
    premSlider.value = String(Number.isFinite(rs.premiumPct) ? rs.premiumPct : buyerDefaultPremium(buyerSelect.value));
    premPillText.textContent = `${Number(premSlider.value).toFixed(1)}%`;

    if(rs.show){
      panel.classList.remove("hidden");
      toggle.classList.add("on");
      toggle.textContent = "Behind scenes ▾";
    }

    toggle.addEventListener("click", () => {
      const open = panel.classList.contains("hidden");
      if(open){
        panel.classList.remove("hidden");
        toggle.classList.add("on");
        toggle.textContent = "Behind scenes ▾";
        state.resale[bucket.id].show = true;
      }else{
        panel.classList.add("hidden");
        toggle.classList.remove("on");
        toggle.textContent = "Behind scenes ▸";
        state.resale[bucket.id].show = false;
      }
      setState(state);
    });

    buyerSelect.addEventListener("change", () => {
      const id = buyerSelect.value;
      state.resale[bucket.id].buyerId = id;

      const def = buyerDefaultPremium(id);
      premSlider.value = String(def);
      premPillText.textContent = `${def.toFixed(1)}%`;
      state.resale[bucket.id].premiumPct = def;

      setState(state);
      recalc(state);
    });

    premSlider.addEventListener("input", () => {
      const v = parseFloat(premSlider.value);
      const pct = Number.isFinite(v) ? v : 0;
      premPillText.textContent = `${pct.toFixed(1)}%`;
      state.resale[bucket.id].premiumPct = pct;
      setState(state);
      recalc(state);
    });

    behindWrap.appendChild(toggle);
    behindWrap.appendChild(panel);

    wrap.appendChild(top);
    wrap.appendChild(controls);
    wrap.appendChild(behindWrap);

    root.appendChild(wrap);
  });
}

function recalc(state){
  let offerTotal = 0;
  let meltTotal = 0;
  let expectedSellTotal = 0;
  let profitTotal = 0;

  BUCKETS.forEach(bucket => {
    const eachOffer = offerEach(bucket, state.spot, state.discountPct);
    const qty = state.qty[bucket.id] || 0;
    const subOffer = eachOffer * qty;
    offerTotal += subOffer;

    // Offer UI
    const offerEl = document.getElementById(`offer_${bucket.id}`);
    const subEl = document.getElementById(`sub_${bucket.id}`);
    if(offerEl) offerEl.textContent = money(eachOffer);
    if(subEl) subEl.textContent = money(subOffer);

    // Melt UI
    const me = meltEach(bucket.id, state.spot, state);
    const meltEl = document.getElementById(`meltEach_${bucket.id}`);
    const badgeEl = document.getElementById(`meltBadge_${bucket.id}`);
    const meltSubEl = document.getElementById(`meltSub_${bucket.id}`);

    if(me === null){
      if(meltEl) meltEl.textContent = "—";
      if(badgeEl){
        badgeEl.style.display = "inline-block";
        badgeEl.textContent = "Melt: N/A (set oz)";
      }
      if(meltSubEl) meltSubEl.textContent = money(0);
    }else{
      if(meltEl) meltEl.textContent = money(me);
      if(badgeEl){
        badgeEl.style.display = "inline-block";
        badgeEl.classList.remove("warn");
        badgeEl.textContent = `${Number(state.silverOz[bucket.id]).toFixed(4)} oz/set`;
      }
      const subMelt = me * qty;
      meltTotal += subMelt;
      if(meltSubEl) meltSubEl.textContent = money(subMelt);
    }

    // Behind scenes sell/profit
    const rs = state.resale[bucket.id] || { buyerId:"lcs", premiumPct:10 };
    const prem = Number.isFinite(rs.premiumPct) ? rs.premiumPct : buyerDefaultPremium(rs.buyerId || "lcs");
    const eachSell = expectedSellEachFromOffer(eachOffer, prem);
    const eachProfit = eachSell - eachOffer;

    const sellSub = eachSell * qty;
    const profitSub = eachProfit * qty;

    expectedSellTotal += sellSub;
    profitTotal += profitSub;

    const sellEachEl = document.getElementById(`sellEach_${bucket.id}`);
    const profitEachEl = document.getElementById(`profitEach_${bucket.id}`);
    const sellSubEl = document.getElementById(`sellSub_${bucket.id}`);
    const profitSubEl = document.getElementById(`profitSub_${bucket.id}`);

    if(sellEachEl) sellEachEl.textContent = money(eachSell);
    if(profitEachEl) profitEachEl.textContent = money(eachProfit);
    if(sellSubEl) sellSubEl.textContent = money(sellSub);
    if(profitSubEl) profitSubEl.textContent = money(profitSub);

    const premLabel = document.getElementById(`premLabel_${bucket.id}`);
    if(premLabel) premLabel.textContent = `${Number(prem).toFixed(1)}%`;
  });

  document.getElementById("grandTotal").textContent = money(offerTotal);
  document.getElementById("grandMelt").textContent = money(meltTotal);
  document.getElementById("grandExpectedSell").textContent = money(expectedSellTotal);
  document.getElementById("grandProfit").textContent = money(profitTotal);
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
      const state = getState();
      state.spot = q.spot;
      state.discountPct = q.discountPct;
      state.note = q.note || "";
      state.qty = { ...state.qty, ...(q.qty || {}) };
      if(q.resale) state.resale = { ...state.resale, ...q.resale };
      if(q.silverOz) state.silverOz = { ...state.silverOz, ...q.silverOz };
      if(typeof q.grandResaleShow === "boolean") state.grandResaleShow = q.grandResaleShow;

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

      let offerTotal = 0;
      let meltTotal = 0;

      BUCKETS.forEach(b => {
        const qty = (q.qty && q.qty[b.id]) ? q.qty[b.id] : 0;
        if(qty > 0){
          const eachOffer = offerEach(b, q.spot, q.discountPct);
          const subOffer = eachOffer * qty;
          offerTotal += subOffer;

          const oz = (q.silverOz && Number.isFinite(q.silverOz[b.id])) ? q.silverOz[b.id] : null;
          const eachMelt = (oz && oz > 0) ? (oz * q.spot) : null;
          const subMelt = (eachMelt !== null) ? (eachMelt * qty) : 0;
          meltTotal += subMelt;

          const meltStr = (eachMelt !== null) ? `${money(eachMelt)} (melt)` : "— (melt N/A)";
          lines.push(`${b.label}: qty ${qty} × ${money(eachOffer)} = ${money(subOffer)} | ${meltStr}`);
        }
      });

      lines.push("");
      lines.push(`Grand Offer: ${money(offerTotal)}`);
      lines.push(`Grand Melt: ${money(meltTotal)}`);

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

function hydrateGrandBehindUI(state){
  const t = document.getElementById("grandBehindToggle");
  const p = document.getElementById("grandBehindPanel");
  if(!t || !p) return;

  const apply = () => {
    if(state.grandResaleShow){
      p.classList.remove("hidden");
      t.classList.add("on");
      t.textContent = "Behind scenes ▾";
    }else{
      p.classList.add("hidden");
      t.classList.remove("on");
      t.textContent = "Behind scenes ▸";
    }
  };

  apply();

  t.onclick = () => {
    state.grandResaleShow = !state.grandResaleShow;
    setState(state);
    apply();
  };
}

function hydrateUI(state){
  document.getElementById("versionLabel").textContent = `v${APP_VERSION}`;

  const spotInput = document.getElementById("spotInput");
  const discountSlider = document.getElementById("discountSlider");
  const discountLabel = document.getElementById("discountLabel");
  const noteInput = document.getElementById("noteInput");

  spotInput.value = String(state.spot ?? baselineSpot);
  discountSlider.value = String(state.discountPct ?? 35);
  discountLabel.textContent = `${Number(state.discountPct ?? 35).toFixed(1)}%`;
  noteInput.value = state.note || "";

  buildBucketsUI(state);
  hydrateGrandBehindUI(state);
  recalc(state);
  renderSaved();

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
    fresh.spot = baselineSpot;
    fresh.discountPct = 35;
    fresh.note = "";
    Object.keys(fresh.qty).forEach(k => fresh.qty[k] = 0);

    // keep your silver oz values (optional)
    // If you want reset to blank, uncomment next line:
    // Object.keys(fresh.silverOz).forEach(k => fresh.silverOz[k] = null);

    BUCKETS.forEach(b => {
      fresh.resale[b.id] = { show:false, buyerId:"lcs", premiumPct: buyerDefaultPremium("lcs") };
    });
    fresh.grandResaleShow = false;

    setState(fresh);
    hydrateUI(fresh);
  };

  document.getElementById("saveBtn").onclick = () => {
    const q = {
      timestamp: nowStamp(),
      spot: Number(state.spot ?? baselineSpot),
      discountPct: Number(state.discountPct ?? 35),
      note: (state.note || "").trim(),
      qty: { ...state.qty },
      resale: { ...state.resale },
      silverOz: { ...state.silverOz },
      grandResaleShow: !!state.grandResaleShow
    };

    let offerTotal = 0;
    BUCKETS.forEach(b => {
      const each = offerEach(b, q.spot, q.discountPct);
      const qty = q.qty[b.id] || 0;
      offerTotal += each * qty;
    });
    q.grandTotal = offerTotal;

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
