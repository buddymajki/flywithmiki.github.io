// FLYwithMIKI meteo core: config, data pipeline, scoring. Shared by meteo.html (raw data) and meteoAI.html (AI prediction).
// Each page defines its own renderAll() and calls boot().

// ================== CONFIG YOU CAN EDIT ==================
// After setting up the meteoswiss-feed GitHub repo, paste your raw JSON URL here:
const TEXT_JSON_URL = "https://raw.githubusercontent.com/buddymajki/FLYwithMIKI_Meteo/main/meteoswiss.json"; // e.g. "https://raw.githubusercontent.com/USER/meteoswiss-feed/main/meteoswiss.json"
// =========================================================

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
// front is evaluated at one synoptic point (Engelberg); it is a large-scale phenomenon
const FRONT_PT={n:"Engelberg",lat:46.8207,lon:8.4040};
// the 4 launch sites (lat/lon = launch; landingEl/launchEl in m AMSL, used for fog layering)
const SITES=[
 {n:"Zug",launch:"Zugerberg",lat:47.1470,lon:8.5480,landingEl:430,launchEl:947,dirs:[[225,315]],dirNote:"W-facing, needs west wind"},
 {n:"Engelberg",launch:"Brunni",lat:46.8100,lon:8.4250,landingEl:1000,launchEl:1800,dirs:[[120,300]],dirNote:"S to W facing, sheltered from N/E"},
 {n:"Wolfenschiessen",launch:"Büelen",lat:46.9050,lon:8.4050,landingEl:560,launchEl:1100,dirs:[[0,360]],dirNote:"low & wind-sheltered, tolerant of direction"},
 {n:"Emmetten",launch:"Niederbauen",lat:46.9468,lon:8.5365,landingEl:790,launchEl:1590,dirs:[[180,360],[0,30],[90,160]],dirNote:"N/NW, SW and SE launches, very versatile (not in föhn)"}];
// fixed sampling points (foehn / nationwide).
// Föhn sentinels = the main Swiss föhn corridors (MeteoSwiss): Rhone/Visp, Haslital/Meiringen,
// Reusstal/Altdorf, Linthal/Glarus, Rheintal/Chur. Föhn shows up there first and hardest;
// Meiringen (over the Brünig) and Altdorf are the early-warning stations for our flying area.
// GOTTHARD = crest reference point for the southerly flow aloft.
const P={LUGANO:{n:"Lugano",lat:46.00,lon:8.95},ZURICH:{n:"Zürich",lat:47.46,lon:8.55},
 ALTDORF:{n:"Altdorf",lat:46.88,lon:8.64},SARNEN:{n:"Sarnen",lat:46.90,lon:8.25},
 ENGELBERG:{n:"Engelberg",lat:46.82,lon:8.40},WOLFEN:{n:"Wolfenschiessen",lat:46.91,lon:8.40},
 GOTTHARD:{n:"Gotthard",lat:46.56,lon:8.56},MEIRINGEN:{n:"Meiringen",lat:46.73,lon:8.19},
 GLARUS:{n:"Glarus",lat:47.04,lon:9.07},CHUR:{n:"Chur",lat:46.85,lon:9.53},
 VISP:{n:"Visp",lat:46.29,lon:7.88}};
const WIND_PTS=[P.LUGANO,P.ZURICH,P.ALTDORF,P.SARNEN,P.ENGELBERG,P.WOLFEN,P.GOTTHARD,P.MEIRINGEN,P.GLARUS,P.CHUR,P.VISP];
const WI={LUGANO:0,ZURICH:1,ALTDORF:2,SARNEN:3,ENGELBERG:4,WOLFEN:5,GOTTHARD:6,MEIRINGEN:7,GLARUS:8,CHUR:9,VISP:10};
// Part 1 raw-data locations (fixed order), 10 m AGL wind + fog layering.
// el = town elevation; upEl/upName = local flying reference used as the upper fog level.
const RAW_PTS=[
 {n:"Wolfenschiessen",lat:46.9150,lon:8.3980,el:560,upEl:1100,upName:"Büelen"},
 {n:"Engelberg",lat:46.8210,lon:8.4010,el:1000,upEl:1800,upName:"Brunni"},
 {n:"Luzern",lat:47.0502,lon:8.3093,el:436,upEl:1415,upName:"Fräkmüntegg"},
 {n:"Stans",lat:46.9580,lon:8.3660,el:452,upEl:1850,upName:"Stanserhorn"},
 {n:"Altdorf",lat:46.8800,lon:8.6440,el:458,upEl:1440,upName:"Eggberge"},
 {n:"Zug",lat:47.1662,lon:8.5155,el:430,upEl:947,upName:"Zugerberg"}];
// Thermal forecast point (meteoAI.html only; first site — more will follow).
// valleyEl = Engelberg valley floor, launchEl = Brunni launch.
const THERM_PT={n:"Engelberg",lat:46.8210,lon:8.4010,valleyEl:1000,launchEl:1800,launch:"Brunni"};
const THV=["temperature_2m","dew_point_2m","shortwave_radiation","cape","precipitation","precipitation_probability",
 "temperature_850hPa","temperature_800hPa","temperature_700hPa","relative_humidity_850hPa",
 "geopotential_height_850hPa","geopotential_height_800hPa","geopotential_height_700hPa",
 "wind_speed_800hPa","wind_speed_700hPa"];
const CATS=[
 {key:"front",ic:"🌧️",name:"Front",sub:"Cold/warm front, trough",group:"main"},
 {key:"foehn",ic:"🌀",name:"Föhn",sub:"Crest wind · Δp · shallow-föhn ΔT · breakthrough",group:"main"},
 {key:"natwind",ic:"💨",name:"Nationwide wind",sub:"Wolfenschiessen vs Zürich, 3 heights",group:"main",wide:true},
 {key:"regwind",ic:"🏔️",name:"Regional wind",sub:"4 launch sites",group:"main"},
 {key:"storm",ic:"⛈️",name:"Storms / precip",sub:"CH1 + ICON-D2, per site",group:"main"},
 {key:"fog",ic:"🌫️",name:"Fog / low stratus",sub:"Per site: landing to launch+400 m",group:"bonus"}];
const FIVE=["front","foehn","natwind","regwind","storm"];
const LV={go:{e:"🟢",t:"GO"},watch:{e:"🟡",t:"WATCH"},stop:{e:"🔴",t:"STOP"},na:{e:"⚪",t:"N/A"}};
const OVLABEL={go:"FLYABLE",watch:"WATCH OUT",stop:"NOT FLYABLE"};
const OVSHORT={go:"GO",watch:"CAUTION",stop:"NO-FLY"};
const ORD={go:0,watch:1,stop:2};
const worst=(a,b)=>ORD[a]>=ORD[b]?a:b;
const VAL={go:1,watch:0.5,stop:0};

// SHV "Alarmzeichen" keywords (from the Entscheidungsstrategie poster), mapped to category + severity
const KEYWORDS=[
 // front
 {w:"Kaltfront",cat:"front",sev:"strong"},{w:"Warmfront",cat:"front",sev:"strong"},
 {w:"Okklusion",cat:"front",sev:"strong"},{w:"Front",cat:"front",sev:"normal"},
 {w:"Frontdurchgang",cat:"front",sev:"strong"},{w:"Störung",cat:"front",sev:"normal"},
 {w:"Kaltluft",cat:"front",sev:"normal"},{w:"Westwindlage",cat:"front",sev:"normal"},
 {w:"Westlage",cat:"front",sev:"normal"},{w:"Konvergenz",cat:"front",sev:"normal"},
 {w:"Kurzwellentrog",cat:"front",sev:"normal"},{w:"Höhentrog",cat:"front",sev:"normal"},
 {w:"Trog",cat:"front",sev:"normal"},{w:"Wolkenband",cat:"front",sev:"normal"},
 {w:"Wolkenbänder",cat:"front",sev:"normal"},{w:"Squall",cat:"front",sev:"strong"},
 {w:"Böenfront",cat:"front",sev:"strong"},
 // föhn
 {w:"Südföhn",cat:"foehn",sev:"strong"},{w:"Nordföhn",cat:"foehn",sev:"strong"},
 {w:"Föhntendenz",cat:"foehn",sev:"normal"},{w:"Föhnmauer",cat:"foehn",sev:"strong"},
 {w:"Linsenwolken",cat:"foehn",sev:"normal"},{w:"Rotorwolken",cat:"foehn",sev:"strong"},
 {w:"Föhnkanäle",cat:"foehn",sev:"normal"},{w:"Föhnlage",cat:"foehn",sev:"strong"},
 {w:"Föhnbise",cat:"foehn",sev:"normal"},{w:"Föhn",cat:"foehn",sev:"normal"},
 // überregional wind
 {w:"Sturmtief",cat:"wind",sev:"strong"},{w:"Sturmböen",cat:"wind",sev:"strong"},
 {w:"Sturm",cat:"wind",sev:"strong"},{w:"stürmisch",cat:"wind",sev:"strong"},
 {w:"Bisenlage",cat:"wind",sev:"normal"},{w:"Bise",cat:"wind",sev:"normal"},
 {w:"Westwind",cat:"wind",sev:"normal"},{w:"Nordwestwind",cat:"wind",sev:"normal"},
 {w:"Nordwind",cat:"wind",sev:"normal"},{w:"Ostwind",cat:"wind",sev:"normal"},
 {w:"böig",cat:"wind",sev:"normal"},{w:"starke Böen",cat:"wind",sev:"normal"},
 {w:"kräftige Böen",cat:"wind",sev:"normal"},{w:"starker Wind",cat:"wind",sev:"normal"},
 // storms / Luftschichtung
 {w:"Wärmegewitter",cat:"storm",sev:"strong"},{w:"Hitzegewitter",cat:"storm",sev:"strong"},
 {w:"Gewitter",cat:"storm",sev:"normal"},{w:"Gewitterneigung",cat:"storm",sev:"normal"},
 {w:"Schauer",cat:"storm",sev:"normal"},{w:"Überentwicklung",cat:"storm",sev:"normal"},
 {w:"Quellwolken",cat:"storm",sev:"normal"},{w:"Quellbewölkung",cat:"storm",sev:"normal"},
 {w:"Castellanus",cat:"storm",sev:"normal"},{w:"Blitz",cat:"storm",sev:"normal"},
 {w:"schwülwarm",cat:"storm",sev:"normal"},{w:"schwül",cat:"storm",sev:"normal"},
 {w:"Niederschlagsmengen",cat:"storm",sev:"normal"},{w:"Tagesgangwetter",cat:"storm",sev:"normal"},
 // regiowind
 {w:"Alpines Pumpen",cat:"regwind",sev:"normal"},{w:"Talwind",cat:"regwind",sev:"normal"},
 {w:"Nordüberdruck",cat:"regwind",sev:"normal"},{w:"Südüberdruck",cat:"regwind",sev:"normal"},
 {w:"Joran",cat:"regwind",sev:"normal"},{w:"Venturi",cat:"regwind",sev:"normal"}];
const KW_BY_CAT={front:["front"],foehn:["foehn"],natwind:["wind"],regwind:["regwind"],storm:["storm"]};
const KW_SORTED=[...KEYWORDS].sort((a,b)=>b.w.length-a.w.length);
const KW_LOOKUP={};KEYWORDS.forEach(k=>{KW_LOOKUP[k.w.toLowerCase()]={cat:k.cat,sev:k.sev};});
const DOW_DE=["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
const REGION_KEYS=["Wetterprognose für die Deutschschweiz, Nord- und Mittelbünden",
 "Wetterprognose für die Westschweiz und das Wallis","Wetterprognose für die Alpensüdseite und das Engadin"];
const REGION_SHORT=["Deutschschweiz","Westschweiz / Wallis","Alpensüdseite / Engadin"];

let MAIN=null,WIND=null,SITED=null,STORMD=null,RAWD=null,THERM=null,DAYS=[],sel=0,TEXT=null,fcRegion=0,fcSel=0,fcSelTouched=false,FETCHED_AT=null;

// ---- Open-Meteo ----
const HV=["temperature_2m","precipitation","precipitation_probability","weather_code","cape",
 "pressure_msl","temperature_850hPa","wind_speed_850hPa","wind_direction_850hPa",
 "temperature_700hPa","wind_speed_700hPa","wind_direction_700hPa"];
const DV=["temperature_2m_max","temperature_2m_min","precipitation_sum","precipitation_probability_max","weather_code"];
// föhn/nationwide points: 10 m wind incl. direction (breakthrough), 925 hPa = föhn-jet level just
// above the corridor valley floors (all 450-650 m), ≈2000/3000 m winds (800/700 hPa), 850 hPa for
// nationwide wind, and pressure-level temperatures for the shallow-föhn N-S comparison
const WV=["pressure_msl","wind_speed_10m","wind_direction_10m","wind_gusts_10m",
 "wind_speed_925hPa","wind_direction_925hPa","wind_speed_850hPa","wind_direction_850hPa",
 "wind_speed_800hPa","wind_direction_800hPa","wind_speed_700hPa","wind_direction_700hPa",
 "temperature_850hPa","temperature_800hPa","temperature_700hPa"];
// per-site detail (regional wind + fog): ground/120m winds + pressure-level RH + geopotential
const SV=["wind_speed_10m","wind_direction_10m","wind_gusts_10m","wind_speed_120m","relative_humidity_2m","visibility","cloud_cover_low",
 "relative_humidity_925hPa","relative_humidity_850hPa","relative_humidity_800hPa","relative_humidity_700hPa",
 "geopotential_height_925hPa","geopotential_height_850hPa","geopotential_height_800hPa","geopotential_height_700hPa"];
const STV=["precipitation","weather_code","cape","precipitation_probability"];
// Part 1 raw locations: 10 m wind + precip + fog profile inputs
const RAWV=["wind_speed_10m","wind_direction_10m","wind_gusts_10m","precipitation","precipitation_probability",
 "relative_humidity_2m","visibility","cloud_cover_low",
 "relative_humidity_925hPa","relative_humidity_850hPa","relative_humidity_800hPa","relative_humidity_700hPa",
 "geopotential_height_925hPa","geopotential_height_850hPa","geopotential_height_800hPa","geopotential_height_700hPa"];
async function omMulti(pts,hourly,daily,models){
  let u=`https://api.open-meteo.com/v1/forecast?latitude=${pts.map(p=>p.lat).join(',')}&longitude=${pts.map(p=>p.lon).join(',')}&hourly=${hourly.join(',')}`;
  if(daily)u+=`&daily=${daily.join(',')}`;
  if(models)u+=`&models=${models}`;
  u+=`&timezone=auto&forecast_days=7`;
  const c=new AbortController(),to=setTimeout(()=>c.abort(),18000);let r;
  try{r=await fetch(u,{signal:c.signal});}finally{clearTimeout(to);}
  if(!r.ok)throw new Error("HTTP "+r.status);let j=await r.json();
  if(!Array.isArray(j))j=[j];
  if(j[0]&&j[0].error)throw new Error(j[0].reason);
  return j;
}

// ---- helpers ----
const dirTxt=d=>["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(((d%360)/22.5))%16];
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const mx=a=>a.length?Math.max(...a):null;
const r0=v=>v==null?"?":Math.round(v);
function idxFor(times,date,h0,h1){const o=[];for(let i=0;i<times.length;i++){const t=times[i];if(t.slice(0,10)===date){const h=+t.slice(11,13);if(h>=h0&&h<=h1)o.push(i);}}return o;}
function vals(loc,v,date,h0,h1){const a=loc.hourly[v];if(!a)return [];return idxFor(loc.hourly.time,date,h0,h1).map(i=>a[i]).filter(x=>x!=null&&!isNaN(x));}
function at(loc,v,date,h){const t=loc.hourly.time,a=loc.hourly[v];if(!a)return null;const key=date+"T"+String(h).padStart(2,"0")+":00";let i=t.indexOf(key);
  if(i<0){const ids=idxFor(t,date,0,23);if(!ids.length)return null;i=ids.reduce((b,j)=>Math.abs(+t[j].slice(11,13)-h)<Math.abs(+t[b].slice(11,13)-h)?j:b,ids[0]);}
  return a[i]!=null&&!isNaN(a[i])?a[i]:null;}
// southerly sector 100-250°: SE-flow föhn (Guggiföhn-type situations) and SSW cases are real föhn too
const southComp=(spd,dir)=>(dir>=100&&dir<=250)?spd:0;
const escapeHtml=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

// ---- v3 strings: the fixed phrases of the AI verdict + thermal forecast.
// A page may set window.FW_LANG="de" before boot(); default is English.
const I18N={de:{
 "Föhn breakthrough — no flying in our valleys":"Föhndurchbruch — kein Flugbetrieb in unseren Tälern",
 "Rain through most of the course day":"Regen während des Grossteils des Kurstages",
 "Föhn signals, possible shallow föhn":"Föhnsignale, möglicher seichter Föhn",
 "Föhn tendency":"Föhntendenz",
 ", strengthening":", zunehmend",
 "Rain likely":"Regen wahrscheinlich","Rain possible":"Regen möglich",
 "possible most of the day":"fast den ganzen Tag möglich",
 "mainly after {a}:00":"vor allem nach {a}:00",
 "mainly in the morning, drying later":"vor allem am Morgen, später trockener",
 "between {a}:00 and {b}:00":"zwischen {a}:00 und {b}:00",
 "≈{n} of 9 course hours at risk":"≈{n} von 9 Kursstunden betroffen",
 "Thunderstorms forecast by both high-res models":"Gewitter in beiden hochauflösenden Modellen",
 "Thunderstorm risk (one model)":"Gewitterrisiko (ein Modell)",
 "Thunderstorm risk":"Gewitterrisiko",
 "High storm energy — overdevelopment possible":"Hohe Gewitterenergie — Überentwicklung möglich",
 "Some storm energy in the afternoon":"Etwas Gewitterenergie am Nachmittag",
 "Strong wind at flying height":"Starker Wind auf Flughöhe",
 "Moderate wind aloft":"Mässiger Höhenwind",
 "Wind too strong at launch":"Wind am Startplatz zu stark",
 "Strong wind at launch":"Starker Wind am Startplatz",
 "Moderate wind at launch":"Mässiger Wind am Startplatz",
 "Gusty at launch":"Böig am Startplatz",
 "Wrong wind direction for this launch":"Falsche Windrichtung für diesen Startplatz",
 "Valley wind builds in the afternoon":"Talwind legt am Nachmittag zu",
 "Front passage expected":"Frontdurchgang erwartet",
 "Front influence possible":"Fronteinfluss möglich",
 "Launch likely in cloud (fog)":"Startplatz wahrscheinlich in Wolken (Nebel)",
 "Morning fog possible, usually clears":"Morgennebel möglich, löst sich meist auf",
 "Forecast text warns of storms/showers":"Prognosetext warnt vor Gewittern/Schauern",
 "Forecast text mentions valley wind":"Prognosetext erwähnt Talwind",
 "Low forecast confidence":"Geringes Vertrauen in die Prognose",
 "Reduced forecast confidence":"Reduziertes Vertrauen in die Prognose",
 "No flying today.":"Heute kein Flugbetrieb.",
 "Good chance of flying.":"Gute Flugchancen.",
 "Probably flyable — with limits.":"Wahrscheinlich fliegbar — mit Einschränkungen.",
 "Uncertain — decision on site.":"Unsicher — Entscheid vor Ort.",
 "Cancellation likely.":"Absage wahrscheinlich.",
 "Main concern: {c}":"Hauptproblem: {c}",
 "Light wind, dry, no föhn signals — a proper training day.":"Schwacher Wind, trocken, keine Föhnsignale — ein richtiger Schulungstag.",
 "wind ≈{w} km/h at 2000 m breaks up the thermals":"Wind ≈{w} km/h auf 2000 m zerreisst die Thermik",
 "overdevelopment / shower risk — land early if cumulus tower":"Überentwicklung/Schauerrisiko — früh landen, wenn Quellwolken türmen",
 "energetic air — watch for overdevelopment":"energiereiche Luft — auf Überentwicklung achten",
 "föhn influence — thermals gusty and broken":"Föhneinfluss — Thermik böig und zerrissen",
 "mostly blue thermals (little cumulus marking)":"meist Blauthermik (kaum Cumulus-Markierung)",
 "longer lead time":"längere Vorlaufzeit",
 "beyond high-res storm-model range":"ausserhalb der Reichweite der hochauflösenden Modelle",
 "CH1 and D2 disagree on rain":"CH1 und D2 uneinig beim Regen",
 "model gusts implausible vs base wind (downweighted)":"Modellböen unplausibel zum Grundwind (abgeschwächt gewertet)",
 "possible shallow föhn — hard for models, be extra conservative":"möglicher seichter Föhn — schwierig für Modelle, extra konservativ sein"
}};
const tr=s=>{const L=(typeof window!=="undefined"&&window.FW_LANG)||"en";return (I18N[L]&&I18N[L][s])||s;};
const trF=(key,vars)=>{let s=tr(key);Object.keys(vars||{}).forEach(k=>{s=s.split("{"+k+"}").join(vars[k]);});return s;};

// ---- text feed: parse the bulletin into ordered day blocks, map by day index ----
function regionText(){if(!TEXT||!TEXT.regions)return null;return TEXT.regions[REGION_KEYS[0]]||null;}
const DAY_HDR=/^(Heute\s+)?(Sonntag|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag)$/;
// Returns ordered blocks [{label, dow, body}] starting at the first "Heute ..." line,
// stopping at "Mögliche Entwicklung" (the long-range outlook). The trailing duplicate
// weekday (e.g. a second "Montag" for next week) is a real day block and is kept;
// because we index by position, duplicate names never collide.
function dayBlocks(text){
  if(!text)return [];
  const lines=text.split("\n");
  let startIdx=lines.findIndex(l=>/^Heute(\s|$)/.test(l.trim()));
  if(startIdx<0)startIdx=lines.findIndex(l=>DAY_HDR.test(l.trim()));
  if(startIdx<0)return [];
  const blocks=[];let cur=null;
  for(let i=startIdx;i<lines.length;i++){
    const t=lines[i].trim();
    if(/^Mögliche Entwicklung/i.test(t)||/^Aktualisiert am/i.test(t)||/^Legende/i.test(t))break;
    if(DAY_HDR.test(t)){if(cur)blocks.push(cur);const m=t.match(DAY_HDR);cur={label:t,dow:m[2],body:[]};}
    else if(cur)cur.body.push(lines[i]);
  }
  if(cur)blocks.push(cur);
  return blocks.map(b=>({label:b.label,dow:b.dow,body:b.body.join("\n").trim()}));
}
// Map a forecast day index (di, 0 = today) to its bulletin block, anchoring on today's weekday.
function blockForDay(di){
  const blocks=dayBlocks(regionText());if(!blocks.length)return null;
  const todayDow=DOW_DE[new Date().getDay()];
  let anchor=blocks.findIndex(b=>b.dow===todayDow); // first block matching today's weekday
  if(anchor<0)anchor=0;
  const idx=anchor+di;
  if(idx<0||idx>=blocks.length)return null;
  return blocks[idx];
}
function textCatsFor(di){
  const b=blockForDay(di);if(!b||!b.body)return null;
  const low=(b.label+"\n"+b.body).toLowerCase();const found={};
  KEYWORDS.forEach(k=>{if(low.includes(k.w.toLowerCase())){
    const cat=k.cat;if(!found[cat]||k.sev==="strong")found[cat]=k.sev;}});
  return {label:b.label,para:b.body,found};
}
function highlight(text){
  const esc=escapeHtml(text);
  const re=new RegExp("("+KW_SORTED.map(k=>escapeRegex(k.w)).join("|")+")","gi");
  return esc.replace(re,m=>{const info=KW_LOOKUP[m.toLowerCase()];const cat=info?info.cat:"storm";return `<mark class="kw-${cat}" title="${cat}">${m}</mark>`;});
}

// ---- Thermal forecast (Engelberg / Brunni only for now) ----
// Physics-lite parcel model on ICON pressure-level data; full spec in meteoAI.md.
// Returns null when the THERM feed was not requested (meteo.html) or failed.
function computeThermal(date,di,ctx){
  if(!THERM)return null;
  const loc=THERM,vEl=THERM_PT.valleyEl,lEl=THERM_PT.launchEl;
  const hrs=[];
  for(let h=8;h<=19;h++){
    const T=at(loc,"temperature_2m",date,h),Td=at(loc,"dew_point_2m",date,h);
    const sw=at(loc,"shortwave_radiation",date,h)??0;
    // ground heat storage: thermals lag radiation by ~1-2 h, so the sun drive is a
    // weighted mean of the last 3 model hours (centroid ≈ 1 h back) — peak shifts to mid-afternoon
    const swm1=at(loc,"shortwave_radiation",date,h-1)??0,swm2=at(loc,"shortwave_radiation",date,h-2)??0;
    const swEff=0.35*sw+0.40*swm1+0.25*swm2;
    const cape=at(loc,"cape",date,h)??0;
    const pr=at(loc,"precipitation",date,h)??0,pp=at(loc,"precipitation_probability",date,h)??0;
    const t85=at(loc,"temperature_850hPa",date,h),t80=at(loc,"temperature_800hPa",date,h),t70=at(loc,"temperature_700hPa",date,h);
    const z85=at(loc,"geopotential_height_850hPa",date,h),z80=at(loc,"geopotential_height_800hPa",date,h),z70=at(loc,"geopotential_height_700hPa",date,h);
    const w20=at(loc,"wind_speed_800hPa",date,h)??0;
    // mid-layer lapse rate ≈1500→3000 m: the engine of the thermal day
    let lapse=null;
    if(t85!=null&&t70!=null&&z85!=null&&z70!=null&&z70>z85)lapse=(t85-t70)/(z70-z85)*1000;
    // thermal top: valley parcel (+2 °C trigger excess) along the dry adiabat vs the model profile
    let top=null;
    if(T!=null&&lapse!=null){
      const env=[[z85,t85],[z80,t80],[z70,t70]].filter(p=>p[0]!=null&&p[1]!=null).sort((a,b)=>a[0]-b[0]);
      const eT=z=>{
        if(z<=env[0][0])return env[0][1]+(env[0][0]-z)*0.0065;
        for(let k=0;k<env.length-1;k++)if(z>=env[k][0]&&z<=env[k+1][0]){
          const f=(z-env[k][0])/(env[k+1][0]-env[k][0]);return env[k][1]+f*(env[k+1][1]-env[k][1]);}
        const a=env[env.length-2],b=env[env.length-1];
        return b[1]-(z-b[0])*((a[1]-b[1])/(b[0]-a[0]));
      };
      const pT=z=>T+2-0.0098*(z-vEl);
      top=vEl;
      for(let z=vEl;z<=5200;z+=50){if(pT(z)>=eT(z))top=z;else break;}
    }
    // cloudbase: Espy from the surface UNDERESTIMATES after rain (wet valley floor), so blend
    // with an 850 hPa (≈1500 m, in-BL) moisture estimate — the mixed layer carries that air up
    const rh85=at(loc,"relative_humidity_850hPa",date,h);
    const baseSurf=(T!=null&&Td!=null)?vEl+125*Math.max(0,T-Td):null;
    let base=baseSurf;
    if(rh85!=null&&t85!=null&&z85!=null&&T!=null){
      const g=Math.log(Math.max(1,rh85)/100)+17.62*t85/(243.12+t85); // Magnus dewpoint at 850
      const td85=243.12*g/(17.62-g);
      const tp85=T+2-0.0098*(z85-vEl);                               // parcel T at 850 level
      const b850=z85+125*Math.max(0,tp85-td85);
      base=baseSurf!=null?0.3*baseSurf+0.7*b850:b850; // mixed-layer moisture dominates
    }
    base=base!=null?Math.round(base/50)*50:null;
    // climb heuristic (peak of the vertical profile): sun drive × lapse steepness × usable depth.
    // Calibrated against XCTherm/ICON-D2 vario values: realistic ceiling ≈2.5 m/s.
    let climb=0;
    if(lapse!=null&&top!=null){
      const sun=Math.min(1,swEff/620);                   // shortwave already includes cloud shading
      const lf=Math.max(0,Math.min(1.2,(lapse-4)/3.2));  // 4 °C/km → dead, ≥7.8 → strong
      const df=Math.max(0.15,Math.min(1.1,(top-lEl)/1800+0.3));
      climb=1.9*sun*lf*df;
    }
    if(w20>=35)climb*=0.35;else if(w20>=25)climb*=0.65;  // wind shear breaks the columns
    if(pr>0.2||pp>=60)climb=Math.min(climb,0.3);
    climb=Math.round(climb*10)/10;
    hrs.push({h,climb,top:top!=null?Math.round(top/50)*50:null,base,cape,pr,pp,w20,lapse});
  }
  const maxC=mx(hrs.map(x=>x.climb))||0;
  const act=hrs.filter(x=>x.climb>=0.4);
  const start=act.length?act[0].h:null,end=act.length?act[act.length-1].h:null;
  // best window: longest contiguous run near the day's peak strength
  const thr=Math.max(0.6,maxC*0.7);
  let bw=null,cur=null;
  hrs.forEach(x=>{if(x.climb>=thr){if(!cur)cur={a:x.h,b:x.h};else cur.b=x.h;}
    else{if(cur&&(!bw||cur.b-cur.a>bw.b-bw.a))bw=cur;cur=null;}});
  if(cur&&(!bw||cur.b-cur.a>bw.b-bw.a))bw=cur;
  const bwHrs=bw?hrs.filter(x=>x.h>=bw.a&&x.h<=bw.b):[];
  const avgBw=bwHrs.length?Math.round(mean(bwHrs.map(x=>x.climb))*10)/10:null;
  const midH=bw?Math.round((bw.a+bw.b)/2):13;
  const mid=hrs.find(x=>x.h===midH)||hrs[Math.floor(hrs.length/2)];
  const base=mid?mid.base:null,top=mid?mid.top:null;
  const blue=base!=null&&top!=null&&base>top+150;       // thermals stop below condensation → no cumulus
  const usableTop=(base!=null&&top!=null)?Math.min(base,top):(top||base||null);
  const wMax=mx(hrs.filter(x=>x.h>=10&&x.h<=17).map(x=>x.w20))||0;
  const capeMax=mx(hrs.map(x=>x.cape))||0;
  const notes=[];
  let ql=maxC>=2&&act.length>=5?3:maxC>=1.3&&act.length>=3?2:maxC>=0.6?1:0;
  if(wMax>=25){ql=Math.max(0,ql-1);notes.push(trF("wind ≈{w} km/h at 2000 m breaks up the thermals",{w:Math.round(wMax)}));}
  if(ctx&&ctx.storm&&ctx.storm.lv!=="go"){ql=Math.max(0,ql-1);notes.push(tr("overdevelopment / shower risk — land early if cumulus tower"));}
  else if(capeMax>=800)notes.push(tr("energetic air — watch for overdevelopment"));
  if(ctx&&ctx.foehnLv&&ctx.foehnLv!=="go"){ql=Math.min(ql,1);notes.push(tr("föhn influence — thermals gusty and broken"));}
  if(blue&&ql>=1)notes.push(tr("mostly blue thermals (little cumulus marking)"));
  const conf=di>=3?"lo":di===2?"md":(ctx&&ctx.conf&&ctx.conf.lv==="lo"?"md":"hi");
  return {hrs,maxC,avgBw,start,end,bw,base,top,usableTop,blue,q:["poor","fair","good","excellent"][ql],notes,conf,wMax,capeMax};
}

// Vertical climb profile for the time×altitude matrix: 0 at the ground, peak at ≈40 % of the
// thermal depth, 0 at the top — g(x)=x^(1/3)·(1−x²), normalised so the peak equals hr.climb.
function thermalClimbAt(hr,z){
  if(!hr||hr.top==null||!(hr.climb>0))return 0;
  const x=(z-THERM_PT.valleyEl)/Math.max(1,hr.top-THERM_PT.valleyEl);
  if(x<=0.02||x>=1)return 0;
  return Math.round(hr.climb*(Math.cbrt(x)*(1-x*x)/0.62)*10)/10;
}

// ---- scoring ----
function scoreDay(di){
  const S0=MAIN[0],date=S0.daily.time[di];
  const fly=idxFor(S0.hourly.time,date,9,19);if(!fly.length)return null;
  const Tmax=S0.daily.temperature_2m_max[di],Tmin=S0.daily.temperature_2m_min[di];

  // FÖHN — four-signal diagnosis: crest flow, pressure gradient, shallow-föhn ΔT, valley breakthrough.
  // Principles: RED always needs wind evidence (never Δp alone); GREEN needs every signal clean —
  // a small Δp proves nothing, shallow föhn happens at Δp ≈ 0 (lu-glidz "Der wohltemperierte Föhn").
  const lug=WIND[WI.LUGANO],zur=WIND[WI.ZURICH],got=WIND[WI.GOTTHARD];
  const FH=[8,9,10,11,12,13,14,15,16,17,18]; // strip shows 08-18h; the 08-16h slice drives the day level
  const sAt=(loc,lvl,h)=>{const s=at(loc,"wind_speed_"+lvl,date,h),d=at(loc,"wind_direction_"+lvl,date,h);return (s!=null&&d!=null)?southComp(s,d):null;};
  const crestH=FH.map(h=>sAt(got,"700hPa",h));   // S1: southerly at the crest (≈3000 m over the Gotthard)
  const passH=FH.map(h=>sAt(got,"800hPa",h));    //     pass level ≈2000 m (Gotthard pass 2106 m)
  const dpH=FH.map(h=>{const a=at(lug,"pressure_msl",date,h),b=at(zur,"pressure_msl",date,h);return (a!=null&&b!=null)?a-b:null;}); // S2
  const dTat=(lvl,h)=>{const a=at(lug,"temperature_"+lvl,date,h),b=at(zur,"temperature_"+lvl,date,h);return (a!=null&&b!=null)?a-b:null;};
  const winIdx=(h0,h1)=>FH.map((h,i)=>i).filter(i=>FH[i]>=h0&&FH[i]<=h1);
  const wvals=(arr,h0,h1)=>winIdx(h0,h1).map(i=>arr[i]).filter(v=>v!=null);
  const crestMax=mx(wvals(crestH,8,16))||0;
  let crestDir=null;winIdx(8,16).forEach(i=>{if(crestH[i]!=null&&crestH[i]===crestMax&&crestDir==null)crestDir=at(got,"wind_direction_700hPa",date,FH[i]);});
  const passMax=mx(wvals(passH,8,16))||0;
  const dpW=wvals(dpH,8,16);
  const dPmax=dpW.length?mx(dpW):null;
  const cross4=dpW.some(x=>x>=4);
  // S3 shallow föhn: south side colder than north at ≈2000 m (cold pool below crest height, not a
  // deep cold airmass) while air already moves over the passes. In this regime Δp is misleading and
  // models systematically underestimate the valley wind — it can only raise caution, never lower it.
  let dT2000=null,dT1500=null,dT3000=null;
  winIdx(8,16).forEach(i=>{const v=dTat("800hPa",FH[i]);
    if(v!=null&&(dT2000==null||v<dT2000)){dT2000=v;dT1500=dTat("850hPa",FH[i]);dT3000=dTat("700hPa",FH[i]);}});
  const coldPool=dT2000!=null&&(dT3000==null||dT3000>=dT2000+1);
  const shallowFlag=!!(dT2000!=null&&dT2000<=-2&&coldPool&&passMax>=10);
  // S4 breakthrough: modelled 10 m wind at the sentinel corridors, counted only when it blows from
  // that valley's own föhn sector (each corridor has its own axis). Thresholds deliberately low —
  // grid models smooth föhn gusts; a modelled 20 km/h southerly at Altdorf is usually much more in reality.
  const inSec=(d,sec)=>d!=null&&d>=sec[0]&&d<=sec[1];
  const floorAt=(loc,h,sec)=>{const s=at(loc,"wind_speed_10m",date,h),d=at(loc,"wind_direction_10m",date,h);
    if(s==null||d==null)return null;const w=inSec(d,sec)?s:0;
    // gusts only count with a real föhn-direction base wind — an isolated convective gust over a 2 km/h drift is not föhn
    return {w,g:w>=8?(at(loc,"wind_gusts_10m",date,h)||0):0};};
  const btkOf=(w,g)=>w>=20?"sustained":(w>=10||g>=25)?"gusty":"none";
  // name, point, föhn sector of the valley (direction the föhn arrives FROM at the station)
  const senDef=[["Visp",WI.VISP,[120,220]],["Meiringen",WI.MEIRINGEN,[100,200]],["Altdorf",WI.ALTDORF,[100,200]],
    ["Glarus",WI.GLARUS,[120,220]],["Chur",WI.CHUR,[140,230]]];
  const HOME_SEC=[100,250];
  const sentinels=senDef.map(([nm,ix,sec])=>{const loc=WIND[ix];
    // "above": max wind at the föhn-jet level just above the valley floor (925 hPa ≈ 750 m; floors 450-650 m)
    let aW=0,aD=null;winIdx(8,16).forEach(i=>{const s=at(loc,"wind_speed_925hPa",date,FH[i]);
      if(s!=null&&s>aW){aW=s;aD=at(loc,"wind_direction_925hPa",date,FH[i]);}});
    const aS=inSec(aD,sec)?aW:0; // föhn-direction part of the "above" wind
    // floor: max 10 m wind (any direction, for display) + föhn-direction wind/gust (for the breakthrough level)
    let fAll=0,fAllD=null,fW=0,fG=0;winIdx(8,16).forEach(i=>{const s=at(loc,"wind_speed_10m",date,FH[i]),d=at(loc,"wind_direction_10m",date,FH[i]);
      if(s!=null&&s>fAll){fAll=s;fAllD=d;}
      const f=floorAt(loc,FH[i],sec);if(f){if(f.w>fW)fW=f.w;if(f.g>fG)fG=f.g;}});
    return {nm,sec,aW,aD,aS,fAll,fAllD,fW,fG,btk:btkOf(fW,fG)};});
  // home valleys: how much southerly sits over the flying area (crest/launch level) + valley floor
  const homeDef=[["Engelberg",WI.ENGELBERG],["Wolfenschiessen",WI.WOLFEN],["Sarnen",WI.SARNEN]];
  const home=homeDef.map(([nm,ix])=>{let fW=0,fG=0;winIdx(8,16).forEach(i=>{const f=floorAt(WIND[ix],FH[i],HOME_SEC);if(f){if(f.w>fW)fW=f.w;if(f.g>fG)fG=f.g;}});
    return {nm,s3000:mx(wvals(FH.map(h=>sAt(WIND[ix],"700hPa",h)),8,16))||0,
      s2000:mx(wvals(FH.map(h=>sAt(WIND[ix],"800hPa",h)),8,16))||0,fW,fG};});
  const homeMax2000=mx(home.map(v=>v.s2000))||0;
  // hourly combined signal 08-18h (same rules as the day verdict, per hour)
  const strip=FH.map((h,i)=>{
    const c=crestH[i],dp=dpH[i];
    let b="none";senDef.forEach(([,ix,sec])=>{const f=floorAt(WIND[ix],h,sec);
      if(f){const lv=btkOf(f.w,f.g);if(lv==="sustained")b=lv;else if(lv==="gusty"&&b==="none")b=lv;}});
    const hm=mx(homeDef.map(([,ix])=>sAt(WIND[ix],"800hPa",h)).filter(v=>v!=null))||0;
    if(c==null&&dp==null)return {h,lv:"na"};
    const stop=b==="sustained"||((c||0)>=30&&((dp!=null&&dp>=2)||shallowFlag))||hm>30;
    const watch=b==="gusty"||(c||0)>=15||(dp!=null&&dp>=2)||shallowFlag||hm>=20;
    return {h,lv:stop?"stop":watch?"watch":"go"};});
  // trend: afternoon vs morning gradient / crest wind
  const segMean=(arr,h0,h1)=>{const a=wvals(arr,h0,h1);return a.length?mean(a):null;};
  const dpE=segMean(dpH,8,11),dpL=segMean(dpH,14,18),crE=segMean(crestH,8,11),crL=segMean(crestH,14,18);
  const upT=(dpE!=null&&dpL!=null&&dpL-dpE>=1.5)||(crE!=null&&crL!=null&&crL-crE>=10);
  const dnT=(dpE!=null&&dpL!=null&&dpE-dpL>=1.5)||(crE!=null&&crL!=null&&crE-crL>=10);
  const fTrend=upT&&!dnT?"up":dnT&&!upT?"down":"flat";
  // day verdict: RED needs wind evidence, GREEN needs all signals clean
  const anySust=sentinels.some(s=>s.btk==="sustained"),anyBtk=sentinels.some(s=>s.btk!=="none");
  const clearFoehn=anySust||(crestMax>=30&&((dPmax!=null&&dPmax>=2)||shallowFlag))||homeMax2000>30;
  const watchFoehn=anyBtk||crestMax>=15||(dPmax!=null&&dPmax>=2)||shallowFlag||homeMax2000>=20;
  // föhn-diagnosis confidence (3 = signals agree, 1 = conflicting/borderline)
  let confN=3;const confWhyF=[];
  if(shallowFlag){confN--;confWhyF.push("shallow-föhn regime: models often underestimate valley wind");}
  if(dPmax!=null&&dPmax>=4&&crestMax<15){confN--;confWhyF.push("big Δp but weak southerly aloft — conflicting signals");}
  if(crestMax>=25&&(dPmax==null||dPmax<1)&&!shallowFlag){confN--;confWhyF.push("southerly aloft without pressure support");}
  if(!clearFoehn&&((dPmax!=null&&Math.abs(dPmax-2)<=0.5)||Math.abs(crestMax-15)<=5)){confN--;confWhyF.push("values close to the warning thresholds");}
  confN=Math.max(1,confN);
  let foehn=(()=>{
    const lv=clearFoehn?"stop":watchFoehn?"watch":"go";
    const note=lv==="stop"?(anySust?"föhn breakthrough":"clear föhn"):
      lv==="watch"?((shallowFlag&&(dPmax==null||dPmax<2))?"possible shallow föhn":"foehn tendency"):"";
    const btkTxt=sentinels.filter(s=>s.btk!=="none").map(s=>`${s.nm} ${r0(s.fW)}${s.fG>s.fW?` (G${r0(s.fG)})`:""} km/h`).join(", ")||"none";
    const why=`Crest southerly (Gotthard ≈3000 m) max ${r0(crestMax)} km/h${crestDir!=null?" from "+dirTxt(crestDir):""}. Δp Lugano-Zürich peak ${dPmax!=null?(dPmax>0?"+":"")+dPmax.toFixed(1):"?"} hPa${cross4?" (crosses +4)":""}. ΔT south-north ≈2000 m ${dT2000!=null?dT2000.toFixed(1):"?"} °C${shallowFlag?" → shallow-föhn signature":""}. Valley breakthrough: ${btkTxt}. 08-16h.`;
    return {lv,note,why,dPmax,cross4,trend:fTrend,crestMax,crestDir,passMax,
      dpE,dpL,crE,crL,
      shallow:{flag:shallowFlag,dT2000,dT1500,dT3000},
      sentinels,home,strip,conf:{n:confN,lv:confN>=3?"hi":confN===2?"md":"lo",why:confWhyF},clearFoehn};})();

  // NATIONWIDE
  const wol=WIND[WI.WOLFEN],zh=WIND[WI.ZURICH],TT=[8,12,15];
  const coll=(loc,v)=>mx(TT.map(h=>at(loc,v,date,h)).filter(x=>x!=null))||0;
  const gBase=coll(wol,"wind_speed_10m"),gGust=coll(wol,"wind_gusts_10m");
  const wV15=coll(wol,"wind_speed_850hPa"),wV30=coll(wol,"wind_speed_700hPa");
  const zG15=coll(zh,"wind_speed_850hPa"),zG30=coll(zh,"wind_speed_700hPa");
  const aDir=mean(TT.map(h=>at(wol,"wind_direction_850hPa",date,h)).filter(x=>x!=null))||0;
  let natwind=(()=>{
    // gust plausibility: trust model gusts only when the base wind supports them.
    // A 50+ km/h gust over a 5 km/h mean is a model artefact / isolated downdraft, not a windy day;
    // it may warn (watch) but never single-handedly force stop.
    const gustSuspect=gGust>=30&&gBase<10;
    const gustEff=gustSuspect?Math.min(gGust,gBase*3+12):gGust;
    const groundLv=(gBase>=25||(gustEff>=40&&gBase>=12))?"stop":(gBase>=15||gustEff>=30)?"watch":"go";
    const alv=v=>v<20?"go":v<25?"watch":"stop";
    const v15=alv(wV15),v30=alv(wV30);
    const valAloft=v15==="stop"?"stop":(v30==="stop"||v15==="watch"||v30==="watch")?"watch":"go";
    const genAloft=worst(alv(zG15),alv(zG30));
    const high30Only=v15!=="stop"&&v30==="stop";
    let aloftLv,aloftNote="";
    if(valAloft==="stop"){aloftLv="stop";aloftNote="strong wind at flying height (1500 m)";}
    else if(genAloft==="stop"){aloftLv="watch";aloftNote="sheltered valleys probably flyable, but strong wind aloft";}
    else if(high30Only){aloftLv="watch";aloftNote="strong only at 3000 m; low launches fine";}
    else if(valAloft==="watch"||genAloft==="watch"){aloftLv="watch";aloftNote="moderate aloft";}
    else aloftLv="go";
    const lv=worst(groundLv,aloftLv);
    let note;
    if(groundLv==="stop")note=`${dirTxt(aDir)} strong to the ground`;
    else if(lv==="stop")note="strong wind at flying height";
    else if(lv==="watch")note=(groundLv==="watch"&&aloftLv==="go")?`${dirTxt(aDir)} moderate to the ground`:aloftNote;
    else note=(Math.max(wV15,wV30,gBase)<14?"weak":"");
    const why=`Wolfenschiessen 10 m ${r0(gBase)} (gust ${r0(gGust)}${gustSuspect?", implausible vs base wind — downweighted":""}), 1500 m ${r0(wV15)}, 3000 m ${r0(wV30)} km/h. Zürich 1500 m ${r0(zG15)}, 3000 m ${r0(zG30)} km/h. Times 08/12/15, ${dirTxt(aDir)}.`;
    return {lv,note,why,gBase,gGust,gustSuspect,wV15,wV30,zG15,zG30,aDir};
  })();

  // REGIONAL WIND per site (uses SITED launch points), now direction-aware
  function inSector(d,sectors){return sectors.some(([a,b])=>{
    if(b-a>=360)return true; // full-circle sector (e.g. [0,360] widened) accepts everything
    a=((a%360)+360)%360;b=((b%360)+360)%360;d=((d%360)+360)%360;
    return a<=b?(d>=a&&d<=b):(d>=a||d<=b);});}
  function siteWind(loc,site){
    // evaluate the same window that is shown to the student (08-16h) —
    // the old 06-21h window caught evening fronts/downdrafts and made gusts look absurd next to daytime means
    const w10=mx(vals(loc,"wind_speed_10m",date,8,16))||0;
    const w120=mx(vals(loc,"wind_speed_120m",date,8,16))||0;
    const gu=mx(vals(loc,"wind_gusts_10m",date,8,16))||0;
    const am=mean(vals(loc,"wind_speed_10m",date,8,12))||0;
    const pm=mean(vals(loc,"wind_speed_10m",date,13,17))||0;
    const trend=(pm-am)>5;
    // dominant launch wind direction/speed in the soarable window
    const wsp=vals(loc,"wind_speed_10m",date,10,17),wdr=vals(loc,"wind_direction_10m",date,10,17);
    const dDir=wdr.length?wdr[wsp.indexOf(Math.max(...wsp))]??mean(wdr):null; // dir at the windiest hour
    const dSpd=mean(wsp)||0;
    // same gust-plausibility rule as nationwide wind
    const gustSuspect=gu>=30&&w10<10;
    const guEff=gustSuspect?Math.min(gu,w10*3+12):gu;
    let lv="go";if(w10>=25||(guEff>=35&&w10>=12))lv="stop";else if(w10>=15||w120>=25||guEff>=30||trend)lv="watch";
    // direction mismatch: only matters once there is some wind (light wind = thermic launch, any direction)
    let dirBad=false,dirNote="";
    const tol=15; // widen each good sector by 15 deg
    if(dDir!=null&&dSpd>=8){
      const widened=site.dirs.map(([a,b])=>[a-tol,b+tol]);
      if(!inSector(dDir,widened)){dirBad=true;
        const wrong=dSpd>=15?"stop":"watch";lv=worst(lv,wrong);
        dirNote=`${dirTxt(dDir)} wind ${r0(dSpd)} km/h is wrong for this launch (${site.dirNote})`;}
    }
    return {w10,w120,gu,gustSuspect,am,pm,trend,lv,dDir,dSpd,dirBad,dirNote};
  }
  const regAll=SITES.map((s,i)=>({name:s.n,launch:s.launch,...siteWind(SITED[i],s)}));

  // STORM per site (CH1+D2, blended fallback) + per-site rain 08-15h NOGO flag
  function siteStorm(loc){
    const winLen=idxFor(loc.hourly.time,date,9,19).length;
    const chRain=vals(loc,"precipitation_meteoswiss_icon_ch1",date,9,19);
    const deRain=vals(loc,"precipitation_icon_d2",date,9,19);
    const chCov=winLen?chRain.length/winLen:0,deCov=winLen?deRain.length/winLen:0;
    const rain815=(suf)=>{const a=vals(loc,"precipitation_"+suf,date,8,15);return a.filter(v=>v>0.3).length;};
    if(chCov>=0.5&&deCov>=0.5){
      const chWC=vals(loc,"weather_code_meteoswiss_icon_ch1",date,9,19),deWC=vals(loc,"weather_code_icon_d2",date,9,19);
      const chCape=vals(loc,"cape_meteoswiss_icon_ch1",date,9,19),deCape=vals(loc,"cape_icon_d2",date,9,19);
      const rainHoursCH=chRain.filter(v=>v>0.1).length,rainHoursDE=deRain.filter(v=>v>0.1).length;
      const thunderCH=chWC.some(c=>c>=95),thunderDE=deWC.some(c=>c>=95);
      const capeMax=Math.max(mx(chCape)||0,mx(deCape)||0);
      const sustained=rainHoursCH>=4&&rainHoursDE>=4;
      const active=rainHoursCH>=1||rainHoursDE>=1||thunderCH||thunderDE||capeMax>700;
      const nogoRain=Math.min(rain815("meteoswiss_icon_ch1"),rain815("icon_d2"))>=3;
      return {mode:"highres",lv:sustained?"stop":active?"watch":"go",rainHoursCH,rainHoursDE,thunderCH,thunderDE,capeMax,sustained,active,nogoRain};
    }else{
      const bmPP=vals(loc,"precipitation_probability_best_match",date,9,19);
      const bmWC=vals(loc,"weather_code_best_match",date,9,19),bmCape=vals(loc,"cape_best_match",date,9,19);
      const bmRain=vals(loc,"precipitation_best_match",date,9,19);
      const ppMax=mx(bmPP)||0,capeMax=mx(bmCape)||0,thunder=bmWC.some(c=>c>=95),rainH=bmRain.filter(v=>v>0.1).length;
      const pp815=mx(vals(loc,"precipitation_probability_best_match",date,8,15))||0;
      const sustained=ppMax>=70&&rainH>=5,active=ppMax>=30||capeMax>600||thunder||rainH>=2;
      const nogoRain=pp815>=80&&rain815("best_match")>=2;
      return {mode:"blend",lv:sustained?"stop":active?"watch":"go",ppMax,capeMax,thunder,thunderCH:thunder,thunderDE:thunder,rainHoursCH:null,rainHoursDE:null,sustained,active,nogoRain};
    }
  }
  const stormAll=SITES.map((s,i)=>({name:s.n,idx:i,...siteStorm(STORMD[i])}));

  // FOG per site: landing / mid / launch / launch+400 (RH interpolated from pressure levels)
  function fogProfile(loc,site){
    const HRS=[8,12,15];
    const lbl0=site.lbl0||"Landing",lbl2=site.lbl2||"Launch";
    const levels=[[lbl0,site.landingEl],["Mid",Math.round((site.landingEl+site.launchEl)/2)],
      [lbl2,site.launchEl],[lbl2+" +400 m",site.launchEl+400]];
    const hours=HRS.map(h=>{
      const pts=[[at(loc,"geopotential_height_925hPa",date,h),at(loc,"relative_humidity_925hPa",date,h)],
        [at(loc,"geopotential_height_850hPa",date,h),at(loc,"relative_humidity_850hPa",date,h)],
        [at(loc,"geopotential_height_800hPa",date,h),at(loc,"relative_humidity_800hPa",date,h)],
        [at(loc,"geopotential_height_700hPa",date,h),at(loc,"relative_humidity_700hPa",date,h)]
      ].filter(p=>p[0]!=null&&p[1]!=null).sort((a,b)=>a[0]-b[0]);
      const rh2=at(loc,"relative_humidity_2m",date,h);
      if(rh2!=null)pts.unshift([site.landingEl,rh2]);
      const vis=at(loc,"visibility",date,h),low=at(loc,"cloud_cover_low",date,h);
      function interp(target){if(!pts.length)return null;if(target<=pts[0][0])return pts[0][1];
        for(let i=0;i<pts.length-1;i++){if(target>=pts[i][0]&&target<=pts[i+1][0]){const f=(target-pts[i][0])/(pts[i+1][0]-pts[i][0]);return pts[i][1]+f*(pts[i+1][1]-pts[i][1]);}}
        return pts[pts.length-1][1];}
      const cls=r=>r==null?"na":r>=95?"stop":r>=88?"watch":"go";
      const out={h};
      levels.forEach((lv,li)=>{
        if(li===0){ // landing: combine RH with visibility / low cloud
          let c=cls(interp(lv[1]));
          if((vis!=null&&vis<1000)||(low!=null&&low>=90))c="stop";
          else if(c==="go"&&((vis!=null&&vis<3000)||(low!=null&&low>=60)))c="watch";
          out["l"+li]=c;
        }else out["l"+li]=cls(interp(lv[1]));
      });
      return out;
    });
    return {levels,hours};
  }
  function fogLevel(prof){
    const launchIdx=2; // "Launch" column
    const midday=prof.hours[1];
    const launchCls=midday["l"+launchIdx],landCls=midday["l0"];
    if(launchCls==="stop")return "stop";
    if(launchCls==="watch")return "watch";
    if(landCls!=="go")return "watch";
    // also check morning launch
    if(prof.hours[0]["l"+launchIdx]!=="go")return "watch";
    return "go";
  }
  const fogAll=SITES.map((s,i)=>{const prof=fogProfile(SITED[i],s);return {name:s.n,launch:s.launch,prof,lv:fogLevel(prof)};});

  // FRONT (synoptic, Engelberg)
  const ppF=S0.daily.precipitation_probability_max[di]||0,psum=S0.daily.precipitation_sum[di]||0;
  const t850=mean(vals(S0,"temperature_850hPa",date,12,15));
  let prev=di>0?mean(vals(S0,"temperature_850hPa",S0.daily.time[di-1],12,15)):null;
  const d850T=(prev!=null&&t850!=null)?t850-prev:0;
  const w850dir=mean(vals(S0,"wind_direction_850hPa",date,9,19))||0,w850spd=mx(vals(S0,"wind_speed_850hPa",date,9,19))||0;
  const westy=(w850dir>=240&&w850dir<=330)&&w850spd>40;
  const dir9=at(S0,"wind_direction_850hPa",date,9),dir19=at(S0,"wind_direction_850hPa",date,19);
  let dirShift=0;if(dir9!=null&&dir19!=null){const dd=Math.abs(dir19-dir9);dirShift=Math.min(dd,360-dd);}
  let autoF=(()=>{let s=0;if(d850T<=-5)s+=2;else if(d850T<=-3)s+=1;if(dirShift>=60)s+=1;if(ppF>=70)s+=1;else if(ppF>=50||psum>=2)s+=0.5;if(westy)s+=1;return s>=4?"stop":s>=2?"watch":"go";})();
  const ovr=localStorage.getItem(`fw_front_${date}`)||"";
  const coldSig=d850T<=-3,wetSig=ppF>=50,shiftSig=dirShift>=60;
  let diag=coldSig&&(wetSig||shiftSig)?"Looks like a real airmass change: 850hPa cooling plus rain/wind-shift signal."
    :coldSig?"850hPa cooling without much else — airmass change or a dry/weak front."
    :wetSig?"High rain chance without strong cooling/wind-shift — likely convective storms, not a sharp front (see Storms)."
    :"No strong front signal in the numbers.";
  let front={lv:ovr||autoF,auto:autoF,override:ovr,
    why:`${diag} (precip ${r0(ppF)}%, 850hPa ${d850T>0?"+":""}${d850T.toFixed(1)}°C vs yesterday, wind shift ${r0(dirShift)}°${westy?", strong W aloft":""}). Numeric hint — check the chart and the text above.`};

  // shared category lights
  const cats={front,foehn,natwind,regwind:null,storm:null,fog:null};

  // ---- apply MeteoSwiss text keyword bump (safety-biased: only increases caution) ----
  const tc=textCatsFor(di);
  if(tc&&tc.found){
    const bump=(cur,sev)=>sev==="strong"?worst(cur,"stop"):worst(cur,"watch");
    if(tc.found.front)front.lv=bump(front.lv,tc.found.front);
    if(tc.found.foehn)foehn.lv=bump(foehn.lv,tc.found.foehn);
    if(tc.found.wind)natwind.lv=bump(natwind.lv,tc.found.wind);
    // regwind/storm are per-site; bump applied per site below
  }
  const textBumpReg=tc&&tc.found&&tc.found.regwind?tc.found.regwind:null;
  const textBumpStorm=tc&&tc.found&&tc.found.storm?tc.found.storm:null;

  // ---- per-site percentage with a transparent breakdown ----
  const CATNAME={front:"Front",foehn:"Föhn",natwind:"Nationwide wind",regwind:"Regional wind",storm:"Storms/precip"};
  function pct(i){
    const reg0=regAll[i].lv, st0=stormAll[i].lv, fg=fogAll[i].lv;
    let reg2=reg0, st2=st0, regTxt=null, stTxt=null;
    if(textBumpReg&&worst(reg2,"watch")!==reg2){reg2="watch";regTxt="MeteoSwiss text mentions regional wind";}
    if(textBumpStorm){const nw=textBumpStorm==="strong"?"stop":"watch";if(ORD[nw]>ORD[st2]){st2=nw;stTxt="MeteoSwiss text mentions storms";}}
    const five={front:front.lv,foehn:foehn.lv,natwind:natwind.lv,regwind:reg2,storm:st2};
    // each of the 5 categories contributes up to 20 points; yellow -10, red -20
    const items=FIVE.map(k=>{const lv=five[k];const ded=lv==="go"?0:lv==="watch"?10:20;
      let why="";
      if(k==="regwind"){if(regAll[i].dirBad)why=regAll[i].dirNote;else if(regTxt)why=regTxt;else if(lv!=="go")why="wind speed/gust or afternoon build-up";}
      else if(k==="storm"){if(stormAll[i].nogoRain)why="clear rain 08-15h";else if(stTxt&&lv===st2&&st0!==st2)why=stTxt;else if(lv!=="go")why=(stormAll[i].mode==="highres"?"rain hours in CH1/D2":"rain probability");}
      else if(k==="front"){if(lv!=="go")why=(tc&&tc.found&&tc.found.front)?"front signal + MeteoSwiss text":"front signal";}
      else if(k==="foehn"){if(lv!=="go")why="föhn pressure/valley wind";}
      else if(k==="natwind"){if(lv!=="go")why="nationwide wind aloft/ground";}
      return {k,name:CATNAME[k],lv,ded,why};});
    let p=100-items.reduce((a,b)=>a+b.ded,0);
    const reds=FIVE.filter(k=>five[k]==="stop").length;
    const mods=[];
    if(fg==="watch"){p-=10;mods.push({txt:"Fog possible",ded:10});}
    let cap=100,capTxt=null;
    if(reds>=2){cap=30;capTxt="2+ red factors → capped at 30%";}
    else if(reds>=1){cap=50;capTxt="1 red factor → capped at 50%";}
    if(fg==="stop"){cap=Math.min(cap,25);capTxt=(capTxt?capTxt+"; ":"")+"thick fog at launch → capped at 25%";}
    let sub=Math.max(0,p);
    let final=Math.max(0,Math.min(sub,cap));
    let nogo=null;
    if(foehn.clearFoehn){final=0;nogo="Clear föhn (breakthrough in a föhn valley, or strong crest southerly with pressure/ΔT support) → 0%";}
    else if(stormAll[i].nogoRain){final=0;nogo="Clear rain 08-15h at this site → 0%";}
    return {p:Math.round(final),sub:Math.round(sub),items,mods,cap,capTxt,nogo,reds,fg,five,dirBad:regAll[i].dirBad};
  }
  const sitePct=SITES.map((s,i)=>({name:s.n,launch:s.launch,...pct(i)}));
  const best=sitePct.reduce((b,c)=>c.p>b.p?c:b,sitePct[0]);
  const overallPct=best.p;
  const overall=overallPct>=75?"go":overallPct>=50?"watch":"stop";

  // category lights for matrix/cards: regwind/storm/fog = best site's light (matches "best site")
  const bestIdx=sitePct.indexOf(best);
  cats.regwind=Object.assign({},regAll[bestIdx],{lv:best.five.regwind,regAll,bestIdx});
  cats.storm=Object.assign({},stormAll[bestIdx],{lv:best.five.storm,stormAll,worstSite:stormAll.reduce((b,s)=>ORD[s.lv]>=ORD[b.lv]?s:b,stormAll[0])});
  cats.fog=Object.assign({},fogAll[bestIdx],{lv:fogAll.reduce((w,f)=>worst(w,f.lv),"go"),fogAll});

  // ---- Part 1 raw data for this day (objective values only, no judgement) ----
  const raw=(()=>{
    if(!RAWD)return null;
    const towns=RAW_PTS.map((p,i)=>{
      const loc=RAWD[i];
      const ws=vals(loc,"wind_speed_10m",date,8,16);
      const gs=vals(loc,"wind_gusts_10m",date,8,16);
      const wdr=vals(loc,"wind_direction_10m",date,8,16);
      const dDir=(wdr.length&&ws.length)?wdr[ws.indexOf(Math.max(...ws))]:null;
      // per-town precipitation 08-16h: it often rains in one valley while another is flyable
      const hrs=[];
      for(let h=8;h<=16;h++){hrs.push({h,pp:at(loc,"precipitation_probability",date,h)??0,pr:at(loc,"precipitation",date,h)??0});}
      const ppMax=mx(hrs.map(x=>x.pp))||0;
      const wetHours=hrs.filter(x=>x.pp>=30||x.pr>0.1).length;
      return {n:p.n,wMin:ws.length?Math.min(...ws):null,wMax:mx(ws),gMax:mx(gs),dDir,hrs,ppMax,wetHours};
    });
    const fog=RAW_PTS.map((p,i)=>({n:p.n,up:p.upName,
      prof:fogProfile(RAWD[i],{landingEl:p.el,launchEl:p.upEl,lbl0:"Ground",lbl2:p.upName})}));
    return {towns,fog};
  })();

  // ---- AI confidence: how much the algorithm trusts its own verdict today ----
  const gustSusp=natwind.gustSuspect||regAll.some(r=>r.gustSuspect);
  let confScore=100;const confWhy=[];
  if(di>=3){confScore-=10*(di-2);confWhy.push(tr("longer lead time"));}
  if(stormAll.some(s=>s.mode==="blend")){confScore-=15;confWhy.push(tr("beyond high-res storm-model range"));}
  if(stormAll.some(s=>s.mode==="highres"&&Math.abs((s.rainHoursCH||0)-(s.rainHoursDE||0))>=3)){confScore-=10;confWhy.push(tr("CH1 and D2 disagree on rain"));}
  if(gustSusp){confScore-=10;confWhy.push(tr("model gusts implausible vs base wind (downweighted)"));}
  if(foehn.shallow.flag){confScore-=10;confWhy.push(tr("possible shallow föhn — hard for models, be extra conservative"));}
  const confidence={score:confScore,lv:confScore>=80?"hi":confScore>=55?"md":"lo",why:confWhy};

  // ================== v3 "instructor score" (meteoAI.html) ==================
  // Penalty-based: start at 100%, deduct only for things that actually threaten
  // the beginner course, show ONLY the deductions. Full spec: meteoAI.md.
  // Course window = 09-17 h local (the 9 possible flying hours of a school day).
  function rainProfile(loc){
    const hours=[];
    for(let h=9;h<=17;h++){
      const pp=at(loc,"precipitation_probability_best_match",date,h);
      const ch=at(loc,"precipitation_meteoswiss_icon_ch1",date,h);
      const de=at(loc,"precipitation_icon_d2",date,h);
      const bm=at(loc,"precipitation_best_match",date,h);
      const haveHR=ch!=null&&de!=null;
      const wetCH=haveHR&&ch>0.1,wetDE=haveHR&&de>0.1;
      // p = chance this hour is unusable because of rain
      let p=pp!=null?pp/100:0;
      if(haveHR){
        if(wetCH&&wetDE)p=Math.max(p,0.85);      // both 1-2 km models paint rain → near-certain
        else if(wetCH||wetDE)p=Math.max(p,0.4);  // one of them does → genuine risk
        else p=Math.min(p,0.35);                 // both dry → cap the coarse-model probability
      }
      if(p<0.15)p=0;                             // background drizzle-probability noise is not a risk
      const heavy=(haveHR&&Math.min(ch,de)>=1.2)||(bm!=null&&bm>=2);
      hours.push({h,p,heavy});
    }
    const E=hours.reduce((a,x)=>a+x.p,0);        // expected lost hours out of 9
    const heavyH=hours.filter(x=>x.heavy).length;
    const risk=hours.filter(x=>x.p>=0.4).map(x=>x.h);
    let dry=null,c=null;
    hours.forEach(x=>{if(x.p<0.3){if(!c)c={a:x.h,b:x.h};else c.b=x.h;}
      else{if(c&&(!dry||c.b-c.a>dry.b-dry.a))dry=c;c=null;}});
    if(c&&(!dry||c.b-c.a>dry.b-dry.a))dry=c;
    return {hours,E,heavyH,risk,dry};
  }
  const rainTiming=rp=>{
    if(!rp.risk.length)return "";
    const a=rp.risk[0],b=rp.risk[rp.risk.length-1];
    if(rp.risk.length>=7)return tr("possible most of the day");
    if(a>=14)return trF("mainly after {a}:00",{a});
    if(b<=12)return tr("mainly in the morning, drying later");
    return trF("between {a}:00 and {b}:00",{a,b:b+1});
  };
  function assessSite(i){
    const reg=regAll[i],st=stormAll[i],fg=fogAll[i].lv;
    const rp=rainProfile(STORMD[i]);
    const D=[];let nogo=null;
    const add=(amt,ic,txt,dt)=>{amt=Math.round(amt);if(amt>0)D.push({amt,ic,txt,dt:dt||""});};

    // Föhn — the most dangerous trap for a school: hard NO-GO on breakthrough, heavy otherwise
    if(foehn.clearFoehn)nogo={ic:"🌀",txt:tr("Föhn breakthrough — no flying in our valleys")};
    else if(foehn.lv!=="go"){
      // show the signals that actually fired, not a fixed pair of numbers
      const fWhy=[];
      if(foehn.crestMax>=15)fWhy.push(`crest ${r0(foehn.crestMax)} km/h`);
      if(foehn.dPmax!=null&&foehn.dPmax>=2)fWhy.push(`Δp +${foehn.dPmax.toFixed(1)} hPa`);
      if(foehn.shallow.flag&&foehn.shallow.dT2000!=null)fWhy.push(`ΔT ${foehn.shallow.dT2000.toFixed(1)} °C`);
      const fBtk=foehn.sentinels.filter(s=>s.btk!=="none").map(s=>s.nm);
      if(fBtk.length)fWhy.push(fBtk.join(", ")+" ⬆");
      const fHome=mx(foehn.home.map(x=>x.s2000))||0;
      if(fHome>=20)fWhy.push(`S ${r0(fHome)} km/h @2000 m`);
      add(foehn.shallow.flag?35:28,"🌀",
        tr(foehn.shallow.flag?"Föhn signals, possible shallow föhn":"Föhn tendency")+(foehn.trend==="up"?tr(", strengthening"):""),
        fWhy.join(" · "));
    }

    // Rain — weighted by how much of the course window it eats, core hours (10-15) weigh extra
    if(!nogo&&(st.nogoRain||rp.E>=6))nogo={ic:"🌧️",txt:tr("Rain through most of the course day")};
    else if(rp.E>=0.35){
      const core=rp.hours.filter(x=>x.h>=10&&x.h<=15).reduce((a,x)=>a+x.p,0);
      add(Math.min(55,rp.E*9+core*3+rp.heavyH*4),"🌧️",
        tr(rp.E>=3?"Rain likely":"Rain possible")+(rainTiming(rp)?" — "+rainTiming(rp):""),
        trF("≈{n} of 9 course hours at risk",{n:Math.max(1,Math.round(rp.E))}));
    }

    // Thunderstorms — model agreement decides the size of the hit
    if(st.mode==="highres"){
      if(st.thunderCH&&st.thunderDE)add(45,"⛈️",tr("Thunderstorms forecast by both high-res models"));
      else if(st.thunderCH||st.thunderDE)add(28,"⛈️",tr("Thunderstorm risk (one model)"));
      else if(st.capeMax>=1200)add(18,"⛈️",tr("High storm energy — overdevelopment possible"),`CAPE ${r0(st.capeMax)}`);
      else if(st.capeMax>=700)add(8,"⛈️",tr("Some storm energy in the afternoon"),`CAPE ${r0(st.capeMax)}`);
    }else{
      if(st.thunder)add(30,"⛈️",tr("Thunderstorm risk"));
      else if(st.capeMax>=1000)add(14,"⛈️",tr("High storm energy — overdevelopment possible"),`CAPE ${r0(st.capeMax)}`);
    }

    // Nationwide wind (site-independent)
    if(natwind.lv==="stop")add(40,"💨",tr("Strong wind at flying height"),`10 m ${r0(natwind.gBase)} (G${r0(natwind.gGust)}) / 1500 m ${r0(natwind.wV15)} / 3000 m ${r0(natwind.wV30)} km/h ${dirTxt(natwind.aDir)}`);
    else if(natwind.lv==="watch")add(12,"💨",tr("Moderate wind aloft"),`1500 m ${r0(natwind.wV15)} / 3000 m ${r0(natwind.wV30)} km/h ${dirTxt(natwind.aDir)}`);

    // Regional wind at this launch (gusts only when the base wind supports them)
    const guEff=reg.gustSuspect?Math.min(reg.gu,reg.w10*3+12):reg.gu;
    if(reg.w10>=25)add(50,"🏔️",tr("Wind too strong at launch"),`${r0(reg.w10)} km/h (gust ${r0(reg.gu)})`);
    else if(reg.w10>=20)add(26,"🏔️",tr("Strong wind at launch"),`${r0(reg.w10)} km/h`);
    else if(reg.w10>=15)add(13,"🏔️",tr("Moderate wind at launch"),`${r0(reg.w10)} km/h`);
    if(guEff>=35&&reg.w10>=12)add(20,"🏔️",tr("Gusty at launch"),`gust ${r0(guEff)} km/h`);
    else if(guEff>=30&&reg.w10<25)add(10,"🏔️",tr("Gusty at launch"),`gust ${r0(guEff)} km/h`);
    if(reg.dirBad)add(reg.dSpd>=15?35:15,"🧭",tr("Wrong wind direction for this launch"),`${dirTxt(reg.dDir)} ${r0(reg.dSpd)} km/h — ${SITES[i].dirNote}`);
    if(reg.trend&&reg.w10<15)add(6,"🏔️",tr("Valley wind builds in the afternoon"));

    // Front (front.lv already includes the MeteoSwiss text bump)
    if(front.lv==="stop")add(35,"🌦️",tr("Front passage expected"));
    else if(front.lv==="watch")add(12,"🌦️",tr("Front influence possible"));

    // Fog: a morning-only problem is small, launch in cloud is not
    if(fg==="stop")add(28,"🌫️",tr("Launch likely in cloud (fog)"));
    else if(fg==="watch")add(6,"🌫️",tr("Morning fog possible, usually clears"));

    // MeteoSwiss text as a guard: if the official text warns and the numbers found nothing, deduct anyway
    if(textBumpStorm&&!D.some(d=>d.ic==="⛈️"||d.ic==="🌧️"))add(textBumpStorm==="strong"?20:12,"📰",tr("Forecast text warns of storms/showers"));
    if(textBumpReg&&!D.some(d=>d.ic==="🏔️"))add(8,"📰",tr("Forecast text mentions valley wind"));

    D.sort((a,b)=>b.amt-a.amt);
    const sc=nogo?0:Math.max(0,100-D.reduce((a,d)=>a+d.amt,0));
    return {i,name:SITES[i].n,launch:SITES[i].launch,sc,D,nogo,rp};
  }
  const v3sites=SITES.map((s,i)=>assessSite(i));
  const v3best=v3sites.reduce((b,c)=>c.sc>b.sc?c:b,v3sites[0]);
  const v3ded=[...v3best.D];
  // uncertainty itself costs points: disagreeing models on a marginal day = plan for the worse case
  const confDed=confidence.lv==="lo"?10:confidence.lv==="md"?4:0;
  if(confDed&&!v3best.nogo)v3ded.push({amt:confDed,ic:"🎯",
    txt:tr(confidence.lv==="lo"?"Low forecast confidence":"Reduced forecast confidence"),
    dt:confidence.why.join(", ")});
  const v3pct=v3best.nogo?0:Math.max(0,v3best.sc-confDed);
  const v3label=v3best.nogo?tr("No flying today."):
    v3pct>=75?tr("Good chance of flying."):
    v3pct>=60?tr("Probably flyable — with limits."):
    v3pct>=40?tr("Uncertain — decision on site."):
    v3pct>=15?tr("Cancellation likely."):tr("No flying today.");
  const v3head=v3best.nogo?v3best.nogo.txt:
    v3ded.length?trF("Main concern: {c}",{c:v3ded[0].txt}):tr("Light wind, dry, no föhn signals — a proper training day.");
  let v3win=null;
  const rd=v3best.rp&&v3best.rp.dry;
  if(rd&&rd.b-rd.a>=1&&v3best.rp.risk.length&&!v3best.nogo)v3win=`${String(rd.a).padStart(2,"0")}:00–${String(rd.b+1).padStart(2,"0")}:00`;
  const v3={pct:v3pct,lv:v3pct>=75?"go":v3pct>=50?"watch":"stop",label:v3label,head:v3head,
    nogo:v3best.nogo,deds:v3ded,conf:confidence,window:v3win,
    best:{name:v3best.name,launch:v3best.launch,idx:v3best.i},
    sites:v3sites.map(s=>({name:s.name,launch:s.launch,pct:s.nogo?0:s.sc}))};

  // thermal forecast (only when the page requested the THERM feed); Engelberg = SITES[1]
  const thermal=computeThermal(date,di,{storm:stormAll[1],foehnLv:foehn.lv,conf:confidence,dayPct:v3pct});

  return {date,di,cats,foehn,natwind,front,sitePct,best,bestIdx,overall,overallPct,metrics:{Tmax,Tmin},textBlock:tc,raw,confidence,v3,thermal};
}

// ---- chat text ----
function chatText(S){
  const d=new Date(S.date+"T12:00"),dow=d.toLocaleDateString("en-GB",{weekday:"long"});
  const dt=S.date.slice(8,10)+"."+S.date.slice(5,7),c=S.cats,m=S.metrics,e=k=>LV[c[k].lv].e,nz=s=>s?(" "+s):"";
  let L=[`${dow} (${dt}) . ${S.overallPct}% . best: ${S.best.name}/${S.best.launch}`,
    `Front: ${e("front")}${nz(c.front.override?"(set manually)":"")}`,
    `Föhn: ${e("foehn")}${nz(S.foehn.note)}`,`Nationwide wind: ${e("natwind")}${nz(S.natwind.note)}`,
    `Regional wind: ${e("regwind")}`,`Precipitation: ${e("storm")}`,`Fog: ${e("fog")}`];
  const head=S.overall==="stop"?"🔴 Overall:":S.overall==="watch"?"⚠️ Overall:":"✅ Overall:";
  const temp=`${r0(m.Tmin)}–${r0(m.Tmax)}°C`;let body;
  if(S.overall==="stop"){const r=S.best.nogo?S.best.nogo:(c.natwind.lv==="stop"||c.regwind.lv==="stop"?"wind too strong":c.storm.lv==="stop"?"widespread storms":"too many cautions");
    body=`most probably NOT flyable (${r}). ${temp}. 👉 Stand down, or dawn patrol only if calmer at sunrise.`;}
  else if(S.overall==="watch"){let b=[];
    if(c.storm.lv!=="go")b.push("convection builds, watch the cumulus");
    if(c.regwind.lv!=="go")b.push("valley wind/thermals get punchy");
    if(S.foehn.lv!=="go")b.push("foehn tendency");
    if(S.natwind.lv!=="go")b.push("upper wind on the strong side");
    if(c.fog.lv!=="go")b.push("morning fog possible");
    body=`flyable but watch out: ${b.join(", ")}. ${temp}. Best at ${S.best.name}/${S.best.launch}. 👉 Morning to early afternoon is your window.`;}
  else body=`flyable. ${temp}, light wind and low storm risk. Best at ${S.best.name}/${S.best.launch}. 👉 Enjoy, standard alpine caution in the afternoon.`;
  L.push(`${head} ${body}`);return L.join("\n");
}

// ---- render ----

function pctColor(p){return p>=75?"var(--go)":p>=50?"var(--watch)":"var(--stop)";}

function ymd(date){return date.replace(/-/g,"");}

function tileClass(lv,isBest){if(isBest)return "best";return lv==="stop"?"bad":lv==="watch"?"warn":"";}

function drawStormSite(cv,t,cape,precip){const ctx=cv.getContext("2d"),dpr=Math.min(devicePixelRatio||1,2),W=cv.clientWidth||300,H=96;
  cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
  const x=i=>8+i/(Math.max(1,t.length-1))*(W-16);
  const pmax=Math.max(2,...precip.map(v=>v||0));
  ctx.fillStyle="rgba(52,140,200,.22)";precip.forEach((v,i)=>{const h=(v||0)/pmax*(H-26);ctx.fillRect(x(i)-3,H-14-h,6,h);});
  const cmax=Math.max(1000,...cape.map(v=>v||0)),y=v=>H-14-(v/cmax)*(H-26);
  ctx.fillStyle="#9aa6b1";ctx.font="9px Inter";t.forEach((tt,i)=>{if(+tt.slice(11,13)%3===0)ctx.fillText(tt.slice(11,13),x(i)-6,H-2);});
  ctx.beginPath();cape.forEach((v,i)=>{i?ctx.lineTo(x(i),y(v||0)):ctx.moveTo(x(i),y(v||0));});ctx.strokeStyle="#e5484d";ctx.lineWidth=2;ctx.stroke();
  ctx.strokeStyle="rgba(229,72,77,.3)";ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(8,y(1000));ctx.lineTo(W-8,y(1000));ctx.stroke();ctx.setLineDash([]);}

function initLazies(card){card.querySelectorAll(".embed[data-src]").forEach(e=>{if(e.dataset.loaded)return;e.dataset.loaded=1;
    const f=document.createElement("iframe");f.loading="lazy";f.src=e.dataset.src;f.referrerPolicy="no-referrer";e.appendChild(f);
    const n=document.createElement("div");n.style.cssText="font-size:11px;padding:6px 8px;color:#9aa6b1";n.textContent="If the map stays blank, the provider blocks embedding. Use the link below.";e.appendChild(n);});
  card.querySelectorAll("canvas.spark").forEach(cv=>{if(cv.dataset.done)return;cv.dataset.done=1;
    const date=cv.dataset.date;
    if(cv.dataset.kind==="storm"){const si=+cv.dataset.site||0,mode=cv.dataset.mode,loc=STORMD[si];
      const idx=idxFor(loc.hourly.time,date,6,21),t=idx.map(i=>loc.hourly.time[i]);
      const suf=mode==="highres"?"icon_d2":"best_match";
      const cape=idx.map(i=>loc.hourly["cape_"+suf]?loc.hourly["cape_"+suf][i]:0),precip=idx.map(i=>loc.hourly["precipitation_"+suf]?loc.hourly["precipitation_"+suf][i]:0);
      drawStormSite(cv,t,cape,precip);}
  });}

// today + 4 days: most sources (DWD front charts, high-res storm models) only reach that far
function rescore(){DAYS=[];for(let di=0;di<MAIN[0].daily.time.length&&di<5;di++){const s=scoreDay(di);if(s)DAYS.push(s);}if(sel>=DAYS.length)sel=0;renderAll();}

// boot


async function loadText(){
  try{const stored=localStorage.getItem("fw_text");if(stored){TEXT=JSON.parse(stored);}}catch(e){}
  if(TEXT_JSON_URL){
    // self-heal: a github.com/.../blob/... URL serves an HTML page, not JSON. Rewrite to raw.
    const url=TEXT_JSON_URL.replace(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\//,"https://raw.githubusercontent.com/$1/$2/");
    try{const r=await fetch(url,{cache:"no-store"});
      if(r.ok){const j=await r.json();if(j&&j.regions){TEXT=j;}else console.warn("[fw] feed loaded but no .regions field");}
      else console.warn("[fw] feed HTTP",r.status,url);
    }catch(e){console.warn("[fw] feed fetch/parse failed:",e.message,url);}
  }
}

async function boot(){$("#status").innerHTML='<span class="loader"></span>Loading forecast.';
  try{
    await loadText();
    const wantTherm=(typeof window!=="undefined")&&window.FW_THERMAL;
    const [main,wind,sited,stormd,rawd,therm]=await Promise.all([
      omMulti([FRONT_PT],HV,DV),
      omMulti(WIND_PTS,WV),
      omMulti(SITES,SV),
      omMulti(SITES,STV,null,"meteoswiss_icon_ch1,icon_d2,best_match"),
      omMulti(RAW_PTS,RAWV),
      wantTherm?omMulti([THERM_PT],THV).catch(()=>null):Promise.resolve(null)
    ]);
    MAIN=main;WIND=wind;SITED=sited;STORMD=stormd;RAWD=rawd;THERM=therm?therm[0]:null;FETCHED_AT=new Date();rescore();
    $("#status").innerHTML="Updated "+new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})+" . Open-Meteo (best match + ICON-CH1/D2 for storms)"+(TEXT&&TEXT.regions?" + MeteoSwiss text":"")+" . all wind km/h";
  }catch(e){const net=(e&&e.name==="TypeError")||/failed to fetch|aborted|networkerror/i.test(e.message||"");
    $("#status").innerHTML='<span style="color:var(--stop)">Could not load: '+(net?"network blocked. Open this on flywithmiki.com (not a sandboxed preview) and allow api.open-meteo.com.":e.message)+'</span>';}}

function toast(msg){const t=$("#toast");if(!t)return;t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800);}

// <img> fallback chain: data-srcs holds a JSON array of candidate URLs; onerror advances to the next
function nextSrc(img){
  try{
    const list=JSON.parse(img.dataset.srcs||"[]");
    const i=(+img.dataset.i||0)+1;
    if(i<list.length){img.dataset.i=i;img.src=list[i];}
    else{img.style.display="none";if(img.nextElementSibling)img.nextElementSibling.style.display="block";}
  }catch(e){img.style.display="none";}
}

window.addEventListener("resize",()=>{$$("canvas.spark").forEach(c=>c.dataset.done="");$$(".card").forEach(initLazies);});
