const APP_VERSION="3";

const baselineSpot=78;
const baselineDiscount=0.35;

const BUYERS=[
{ id:"lcs", label:"LCS", premium:10 },
{ id:"wholesale", label:"Wholesaler", premium:6 },
{ id:"refiner", label:"Refiner", premium:3 },
{ id:"ebay", label:"eBay", premium:18 }
];

const BUCKETS=[
{ id:"ps_1950_1964", label:"1950–1964 proof sets", buyAtBaseline:31 },
{ id:"ms_1956_1964", label:"1956–1964 mint sets", buyAtBaseline:62 },
{ id:"sets_1965_1970", label:"1965–1970 sets", buyAtBaseline:6 },
{ id:"ike_1971_1974", label:"1971–1974 Ike sets", buyAtBaseline:12 },
{ id:"set_1976", label:"1976 proof/mint set", buyAtBaseline:24 },
{ id:"ps_1992_1998", label:"1992–1998 proof sets", buyAtBaseline:28 },
{ id:"ps_1999_2008", label:"1999–2008 proof sets", buyAtBaseline:65 },
{ id:"ps_2009", label:"2009 proof set", buyAtBaseline:76 },
{ id:"ps_2010_2020", label:"2010–2020 proof sets", buyAtBaseline:68 }
];

const KEY="proofSetsState_v3";

function money(n){return "$"+(n||0).toFixed(2);}

function fullValue(b){return b/(1-baselineDiscount);}

function offerEach(bucket,spot,disc){
return fullValue(bucket.buyAtBaseline)*(spot/baselineSpot)*(1-disc/100);
}

function build(){

const root=document.getElementById("buckets");
root.innerHTML="";

BUCKETS.forEach(b=>{

const div=document.createElement("div");
div.className="bucket";

const offer=offerEach(b,state.spot,state.discount);

div.innerHTML=`

<div class="bucket-top">

<div>${b.label}</div>

<div class="price-big" id="offer_${b.id}">
${money(offer)}
</div>

</div>

<input type="number" id="qty_${b.id}" value="${state.qty[b.id]||0}">

<button class="behind-toggle" id="toggle_${b.id}">
Behind scenes ▸
</button>

<div class="behind-panel hidden" id="panel_${b.id}">

<select id="buyer_${b.id}">
${BUYERS.map(x=>`<option value="${x.id}">${x.label}</option>`).join("")}
</select>

<input type="range" min="-10" max="30" step="0.5" id="prem_${b.id}">

<div>Expected sell each: <span id="sell_${b.id}"></span></div>
<div>Profit each: <span id="profit_${b.id}"></span></div>

</div>

`;

root.appendChild(div);

document.getElementById(`toggle_${b.id}`).onclick=()=>{
document.getElementById(`panel_${b.id}`).classList.toggle("hidden");
};

});

recalc();
}

function recalc(){

let totalOffer=0;
let totalSell=0;

BUCKETS.forEach(b=>{

const qty=parseFloat(document.getElementById(`qty_${b.id}`)?.value)||0;

const offer=offerEach(b,state.spot,state.discount);

const prem=document.getElementById(`prem_${b.id}`)?.value||10;

const sell=offer*(1+prem/100);

totalOffer+=offer*qty;
totalSell+=sell*qty;

const sellEl=document.getElementById(`sell_${b.id}`);
if(sellEl) sellEl.innerText=money(sell);

const profEl=document.getElementById(`profit_${b.id}`);
if(profEl) profEl.innerText=money(sell-offer);

});

document.getElementById("grandTotal").innerText=money(totalOffer);
document.getElementById("grandExpectedSell").innerText=money(totalSell);
document.getElementById("grandProfit").innerText=money(totalSell-totalOffer);

}

const state=JSON.parse(localStorage.getItem(KEY))||{
spot:78,
discount:35,
qty:{}
};

document.getElementById("spotInput").value=state.spot;
document.getElementById("discountSlider").value=state.discount;

document.getElementById("discountLabel").innerText=state.discount+"%";

document.getElementById("spotInput").oninput=e=>{
state.spot=parseFloat(e.target.value);
save();
};

document.getElementById("discountSlider").oninput=e=>{
state.discount=parseFloat(e.target.value);
document.getElementById("discountLabel").innerText=state.discount+"%";
save();
};

document.getElementById("grandBehindToggle").onclick=()=>{
document.getElementById("grandBehindPanel").classList.toggle("hidden");
};

function save(){
localStorage.setItem(KEY,JSON.stringify(state));
build();
}

build();
