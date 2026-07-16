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
// fixed sampling points (foehn / nationwide)
const P={LUGANO:{n:"Lugano",lat:46.00,lon:8.95},ZURICH:{n:"Zürich",lat:47.46,lon:8.55},
 ALTDORF:{n:"Altdorf",lat:46.88,lon:8.64},SARNEN:{n:"Sarnen",lat:46.90,lon:8.25},
 ENGELBERG:{n:"Engelberg",lat:46.82,lon:8.40},WOLFEN:{n:"Wolfenschiessen",lat:46.91,lon:8.40}};
const WIND_PTS=[P.LUGANO,P.ZURICH,P.ALTDORF,P.SARNEN,P.ENGELBERG,P.WOLFEN];
const WI={LUGANO:0,ZURICH:1,ALTDORF:2,SARNEN:3,ENGELBERG:4,WOLFEN:5};
// Part 1 raw-data locations (fixed order), 10 m AGL wind + fog layering.
// el = town elevation; upEl/upName = local flying reference used as the upper fog level.
const RAW_PTS=[
 {n:"Wolfenschiessen",lat:46.9150,lon:8.3980,el:560,upEl:1100,upName:"Büelen"},
 {n:"Engelberg",lat:46.8210,lon:8.4010,el:1000,upEl:1800,upName:"Brunni"},
 {n:"Luzern",lat:47.0502,lon:8.3093,el:436,upEl:1415,upName:"Fräkmüntegg"},
 {n:"Stans",lat:46.9580,lon:8.3660,el:452,upEl:1850,upName:"Stanserhorn"},
 {n:"Altdorf",lat:46.8800,lon:8.6440,el:458,upEl:1440,upName:"Eggberge"},
 {n:"Zug",lat:47.1662,lon:8.5155,el:430,upEl:947,upName:"Zugerberg"}];
// approximate mid-level heights for the föhn pressure levels (standard atmosphere)
const LEVEL_M={p925:"≈750 m",p850:"≈1500 m",p800:"≈1950 m"};
const CATS=[
 {key:"front",ic:"🌧️",name:"Front",sub:"Cold/warm front, trough",group:"main"},
 {key:"foehn",ic:"🌀",name:"Föhn",sub:"S overpressure + valley wind",group:"main"},
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

let MAIN=null,WIND=null,SITED=null,STORMD=null,RAWD=null,DAYS=[],sel=0,TEXT=null,fcRegion=0,fcSel=0,fcSelTouched=false;

// ---- Open-Meteo ----
const HV=["temperature_2m","precipitation","precipitation_probability","weather_code","cape",
 "pressure_msl","temperature_850hPa","wind_speed_850hPa","wind_direction_850hPa",
 "temperature_700hPa","wind_speed_700hPa","wind_direction_700hPa"];
const DV=["temperature_2m_max","temperature_2m_min","precipitation_sum","precipitation_probability_max","weather_code"];
const WV=["pressure_msl","wind_speed_10m","wind_gusts_10m",
 "wind_speed_925hPa","wind_direction_925hPa","wind_speed_850hPa","wind_direction_850hPa",
 "wind_speed_800hPa","wind_direction_800hPa","wind_speed_700hPa","wind_direction_700hPa"];
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
const southComp=(spd,dir)=>(dir>=120&&dir<=240)?spd:0;
const escapeHtml=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

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

// ---- scoring ----
function scoreDay(di){
  const S0=MAIN[0],date=S0.daily.time[di];
  const fly=idxFor(S0.hourly.time,date,9,19);if(!fly.length)return null;
  const Tmax=S0.daily.temperature_2m_max[di],Tmin=S0.daily.temperature_2m_min[di];

  // FÖHN
  const lug=WIND[WI.LUGANO],zur=WIND[WI.ZURICH];
  const Lp=vals(lug,"pressure_msl",date,8,16),Zp=vals(zur,"pressure_msl",date,8,16);
  let dPmax=null,cross4=false;
  if(Lp.length&&Zp.length){const dpa=Lp.map((v,i)=>v-(Zp[i]??Zp[Zp.length-1]));dPmax=mx(dpa);cross4=dpa.some(x=>x>=4);}
  const valleys=[["Altdorf",WI.ALTDORF],["Sarnen",WI.SARNEN],["Engelberg",WI.ENGELBERG],["Wolfenschiessen",WI.WOLFEN]];
  const valData=valleys.map(([nm,ix])=>{const loc=WIND[ix];
    const s9=mx(vals(loc,"wind_speed_925hPa",date,8,16).map((s,i)=>southComp(s,vals(loc,"wind_direction_925hPa",date,8,16)[i]||0)))||0;
    const s8=mx(vals(loc,"wind_speed_850hPa",date,8,16).map((s,i)=>southComp(s,vals(loc,"wind_direction_850hPa",date,8,16)[i]||0)))||0;
    const s7=mx(vals(loc,"wind_speed_800hPa",date,8,16).map((s,i)=>southComp(s,vals(loc,"wind_direction_800hPa",date,8,16)[i]||0)))||0;
    return {nm,s925:s9,s850:s8,s800:s7,smax:Math.max(s9,s8,s7)};});
  const valMax=mx(valData.map(v=>v.smax))||0;
  // clear föhn needs BOTH the pressure gradient and a real valley southerly (or a very strong southerly alone);
  // a lone 18 km/h southerly no longer forces stop — that over-triggered on ordinary S-flow days
  const clearFoehn=(dPmax>=4&&valMax>=20)||valMax>=30;
  let foehn=(()=>{let lv="go",note="";
    if(clearFoehn)lv="stop";else if(dPmax>=3||valMax>=20||(dPmax>=2&&valMax>=15))lv="watch";
    note=lv==="stop"?"clear föhn":lv==="watch"?"foehn tendency":"";
    const why=`Lugano-Zürich Δp peak ${dPmax!=null?(dPmax>0?"+":"")+dPmax.toFixed(1):"?"} hPa in 08-16h `+(cross4?"(crosses +4 hPa) ":"")+`. Valley southerly max ${r0(valMax)} km/h.`;
    return {lv,note,why,valData,dPmax,cross4,clearFoehn};})();

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
    if(foehn.clearFoehn){final=0;nogo="Clear föhn (Δp≥4 hPa + strong southerly) → 0%";}
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
  if(di>=3){confScore-=10*(di-2);confWhy.push("longer lead time");}
  if(stormAll.some(s=>s.mode==="blend")){confScore-=15;confWhy.push("beyond high-res storm-model range");}
  if(stormAll.some(s=>s.mode==="highres"&&Math.abs((s.rainHoursCH||0)-(s.rainHoursDE||0))>=3)){confScore-=10;confWhy.push("CH1 and D2 disagree on rain");}
  if(gustSusp){confScore-=10;confWhy.push("model gusts implausible vs base wind (downweighted)");}
  const confidence={score:confScore,lv:confScore>=80?"hi":confScore>=55?"md":"lo",why:confWhy};

  return {date,di,cats,foehn,natwind,front,sitePct,best,bestIdx,overall,overallPct,metrics:{Tmax,Tmin},textBlock:tc,raw,confidence};
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
    const [main,wind,sited,stormd,rawd]=await Promise.all([
      omMulti([FRONT_PT],HV,DV),
      omMulti(WIND_PTS,WV),
      omMulti(SITES,SV),
      omMulti(SITES,STV,null,"meteoswiss_icon_ch1,icon_d2,best_match"),
      omMulti(RAW_PTS,RAWV)
    ]);
    MAIN=main;WIND=wind;SITED=sited;STORMD=stormd;RAWD=rawd;rescore();
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
