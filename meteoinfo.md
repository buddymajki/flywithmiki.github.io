# FLYwithMIKI Flight Weather Dashboard . Teljes átadó dokumentum

Ez a dokumentum egy másik Claude session számára készült. Célja, hogy a projektet előzmények nélkül is pontosan megértse: mit csinál az oldal, hogyan számol, honnan jönnek az adatok, mik a gyenge pontok, és merre érdemes fejleszteni.

## 1. Mi ez a projekt

Egyoldalas, statikus HTML dashboard (`flightweather.html`, kb. 800 sor, vanilla JS, nincs build és nincs backend), amely a közép-svájci FLYwithMIKI siklóernyős iskola négy repülőhelyére számol napi "repülhetőségi esélyt" (0-100%) 6 napra előre. A tulajdonos (Miki) oktató; az eszköz döntéstámogatás neki és a tanulóknak, valamint iskolai csoportchat-briefing generálás ("Copy for school chat" gomb). A módszertan a svájci SHV/FSVL hivatalos "Entscheidungsstrategie Meteo V10" poszter 5 meteo-veszélykategóriáján alapul: Front, Föhn, Überregionaler Wind, Regiowind, Wärmegewitter. Kiegészítő kategória: köd/hochnebel.

Kapcsolódó fájlok:
- `meteo.html` . a fő dashboard
- `emagram.html` . különálló, trilingvális (HU/EN/DE) emagram-elemző webapp, Open-Meteo sounding adatból számol LCL/CAPE/CIN/trigger hőmérsékletet; a dashboard URL-paraméteres deep-linkekkel hívja (`?lat=&lon=&date=&hour=`)
- `meteoswiss-feed/` repo . GitHub Actions scraper (lásd 4. pont)

A négy repülőhely, preferencia-sorrendben (azonos %-nál az előrébb álló nyer, Zugerberg szándékosan utolsó, mert ritkán használt):

| Hely | Starthely | Koordináta | Landolás / Start (m AMSL) | Használható szélirányok |
|---|---|---|---|---|
| Engelberg | Brunni | 46.8100, 8.4250 | 1000 / 1800 | 120-300° (S-W lejtő) |
| Wolfenschiessen | Büelen | 46.9050, 8.4050 | 560 / 1100 | bármilyen (alacsony, szélvédett) |
| Emmetten | Niederbauen | 46.9468, 8.5365 | 790 / 1590 | 180-360°, 0-30°, 90-160° (sokoldalú) |
| Zug | Zugerberg | 47.1470, 8.5480 | 430 / 947 | 225-315° (csak nyugati) |

## 2. Adatforrások

1. **Open-Meteo API** (`api.open-meteo.com/v1/forecast`, ingyenes, kulcs nélkül). Négy párhuzamos hívás boot-kor:
   - MAIN: 1 pont (Engelberg, szinoptikus front-értékeléshez), órás + napi adatok, `best_match` modell
   - WIND: 6 fix pont (Lugano, Zürich, Altdorf, Sarnen, Engelberg, Wolfenschiessen), felszíni nyomás + szél 925/850/800/700 hPa szinteken (föhn és országos szél)
   - SITED: a 4 starthely, 10 m szélsebesség+irány, lökések, 120 m szél, RH 2 m + RH és geopotenciál-magasság 925/850/800/700 hPa (regionális szél + köd)
   - STORMD: a 4 starthely, `models=meteoswiss_icon_ch1,icon_d2,best_match` multi-model hívás (kulcsok `_modelname` szuffixszel jönnek). Fontos, mérésekkel igazolt tény: **ICON-CH1 csak kb. +1 napig, ICON-D2 kb. +2 napig ad valós adatot, utána null**; ezen túl a kód automatikusan `best_match`-re vált és "(extended)" jelöléssel mutatja.
2. **MeteoSwiss szöveges prognózis** . a hivatalos regionális szöveg ("Wetterprognose für die Deutschschweiz..."), amelyet egy GitHub Actions + Playwright scraper nyer ki és JSON-ként publikál `raw.githubusercontent.com`-on (ez CORS-engedélyezett, `Access-Control-Allow-Origin: *`). A dashboard a `TEXT_JSON_URL` konstansból tölti. Háttér: a meteoschweiz.admin.ch Angular SPA shadow DOM-mal, nincs publikus szöveg-API és nincs CORS, ezért böngészőből közvetlenül nem lekérhető (tesztelve).
3. **Beágyazott képek/iframe-ek** (csak vizuális, nem számítási input): meteonews izobár-térkép PNG, profiwetter.ch föhn-diagram és hochnebel-diagram PNG, xctherm.com ICON szél-térkép iframe.
4. **SHV Entscheidungsstrategie V10 poszter** . a kulcsszó-szótár forrása (kb. 60 német "Alarmzeichen" kifejezés: Kaltfront, Okklusion, Föhnmauer, Wärmegewitter, Talwind, Nordüberdruck stb.), kategóriára és súlyosságra (strong/normal) képezve.
5. Linkelt, de nem integrált: wetteronline.ch fronttérkép, winds.mobi élő állomások.

## 3. A hat kategória pontos logikája

Minden nap 09-19h "repülési ablakra" értékelődik. Szintek: go (zöld), watch (sárga), stop (piros).

**Front** (szinoptikus, egyetlen ponton: Engelberg). Numerikus auto-hint pontozás: 850 hPa hőmérséklet-változás a tegnapi 12-15h átlaghoz képest (≤ −5°C: +2 pont, ≤ −3°C: +1), szélirány-fordulás 09h→19h 850 hPa-n (≥60°: +1), csapadékesély (≥70%: +1, ≥50% vagy ≥2 mm: +0.5), erős nyugati áramlás (+1). Összeg ≥4: stop, ≥2: watch. A csapadék szándékosan alulsúlyozott, mert azt a Storm kategória már lefedi (különben egy konvektív zivataros nap duplán büntetődne "frontként"). Kézi felülbírálat gombokkal (localStorage, naponként), plusz a MeteoSwiss szöveg kulcsszó-bump (lásd 5. pont).

**Föhn**. Lugano−Zürich tengerszinti nyomáskülönbség (08-16h csúcs) + déli szélkomponens (irány 120-240°) 925/850/800 hPa-n négy völgyben (Altdorf, Sarnen, Engelberg, Wolfenschiessen). Stop: (Δp ≥ 4 hPa ÉS völgyi déli max ≥ 18 km/h) VAGY völgyi déli ≥ 30 km/h. Watch: Δp ≥ 4, vagy déli ≥ 18, vagy (Δp ≥ 2 és déli ≥ 12). A "clear föhn" (stop-feltétel) egyben kemény NO-GO: az összes hely 0%-ra megy.

**Nationwide wind** (országos/überregionaler). Szélvédett völgy (Wolfenschiessen) vs általános áramlás (Zürich), 08/12/15h mintavétel, 10 m / 1500 m (850 hPa) / 3000 m (700 hPa). Talaj: stop ha lökés > 35 vagy alapszél ≥ 25 km/h; watch ha lökés > 25 vagy alap ≥ 15. Magasság: < 20 go, 20-25 watch, ≥ 25 stop; a döntő szint az 1500 m (a repülési magasság), a 3000 m-es erős szél önmagában csak watch ("alacsony startok mehetnek").

**Regional wind** (starthelyenkénti). 10 m max szél, lökés, 120 m szél, délutáni felerősödés-trend (PM átlag − AM átlag > 5 km/h → watch). Sebesség: ≥ 25 vagy lökés ≥ 30: stop; ≥ 15 vagy 120 m ≥ 25 vagy trend: watch. **Szélirány-illesztés**: a 10-17h legszelesebb órájának iránya; ha a szél ≥ 8 km/h és a starthely szektorán kívülről fúj (±15° tolerancia), a hely visszaminősül (≥ 15 km/h-nál stop, alatta watch). Gyenge szélnél (< 8) az irány nem számít (termikus start bármerre). Ez oldja meg, hogy Zugerberg csak nyugati szélben javasolt.

**Storms/precip** (starthelyenkénti, két valódi nagyfelbontású modell összevetése). Ha CH1 és D2 lefedettség ≥ 50% az adott napra: esős órák száma (> 0.1 mm, 09-19h) mindkét modellben, zivatarkód (weather_code ≥ 95), CAPE max. Sustained (stop): mindkét modellben ≥ 4 esős óra. Active (watch): bármelyik modellben ≥ 1 esős óra, zivatarkód, vagy CAPE > 700. Ezen a modellhatáron túl `best_match` fallback: stop ha esély ≥ 70% és ≥ 5 esős óra; watch ha esély ≥ 30% vagy CAPE > 600 vagy zivatar vagy ≥ 2 esős óra. **NO-GO eső**: highres módban ha mindkét modell ≥ 3 órában > 0.3 mm esőt ad 08-15h között az adott helyen; blend módban ha esély ≥ 80% és ≥ 2 esős óra. Ez az adott helyet viszi 0%-ra (nem az összeset). A kártya a legaktívabb hely CAPE+csapadék idősorát rajzolja canvas-ra (ICON-D2 vagy blend forrásból).

**Fog** (bónusz, starthelyenkénti, 4 magasság × 3 időpont). Magasságok: landolás, közép, start, start+400 m; időpontok 08/12/15h. RH lineárisan interpolálva a 925/850/800/700 hPa szintek geopotenciál-magasságai között; a landolási szint látótávolsággal (vis < 1000 m: stop, < 3000: watch) és alacsonyfelhő-borítással kombinálva. RH ≥ 95%: stop (felhőben), ≥ 88%: watch. Hely-szintű összegzés: a starthely szintje a döntő 12h-kor; reggeli köd ami délre feloszlik: watch.

## 4. A pontozási algoritmus (per starthely)

```
p = 100
minden kategória az 5-ből: zöld −0, sárga −10, piros −20
köd watch: további −10
sapkák: 1 piros → max 50%; 2+ piros → max 30%; köd stop → max 25%
kemény NO-GO (p = 0): clear föhn (globális) VAGY egyértelmű eső 08-15h (helyi)
```

A napi összesített % = a legjobb hely %-a. Azonos %-nál a preferencia-sorrend dönt (Engelberg először), és az összes holtversenyben álló top-hely kiírásra kerül. Küszöbök: ≥ 75% GO (zöld), 50-74% CAUTION (sárga), < 50% NO-FLY (piros). Az AI Assessment kártyán tételes breakdown látszik (melyik kategória hány pontot vont le és miért), plusz disclaimer, hogy gépi becslés, a pilóta maga dönt.

## 5. MeteoSwiss szöveg-integráció

A GitHub Actions workflow (`meteoswiss-feed` repo, cron `15 4,7,10,13,16 * * *` UTC) headless Chromiummal (Playwright) letölti a meteoschweiz.admin.ch oldalt, egy rekurzív shadow-DOM bejáróval kinyeri a látható szöveget, kivágja a három regionális bulletint, és `meteoswiss.json`-ba commitolja. A dashboard:

1. **Nap-párosítás pozíció szerint**: a szöveget sorrendben nap-blokkokra bontja ("Heute Montag", "Dienstag"...), megáll a "Mögliche Entwicklung"/"Aktualisiert am"/"Legende" soroknál, és a kiválasztott naptári napot a mai naptól számított eltolással indexeli. Ez azért kritikus, mert a bulletinben a hétnapos lista végén a jövő heti nap neve megismétlődik (két "Montag"); név-alapú kulcsolás felülírná az elsőt (ez volt egy korábbi verzió tényleges bugja).
2. **Kulcsszó-kiemelés**: a SHV Alarmzeichen szavak kategóriánként színezve jelennek meg a szövegben (mark elemek).
3. **Biztonsági bump**: ha a kiválasztott nap bekezdésében veszély-kulcsszó szerepel, az érintett kategória szintje csak szigorodhat (strong szó → stop, normal → watch), sosem enyhülhet. Front/föhn/országos szél globálisan, regionális szél/vihar helyenként bumpolódik.
4. A panel a kiválasztott nap bekezdését mutatja kiemelten (nap-váltásra frissül, régió-fülekkel), a teljes bulletin kinyitható alatta. Fallback: kézi beillesztés localStorage-ba, ha nincs feed URL beállítva.

## 6. Gyenge pontok (őszinte elemzés)

1. **Modellfelbontás vs alpesi terep.** Az Open-Meteo rácspont-interpolált; a völgyszél, lejtőszél, helyi termikus cirkuláció csak részben van a modellben. A "Büelen szélvédett" jelleg a valóságban erősebb, mint amit a 10 m-es modellszél mutat. A szélirány-szektor logika modell-irányra épül, ami gyenge szélnél zajos.
2. **Naiv kulcsszó-illesztés.** Substring-alapú, tagadást nem ért: a "keine Gewitter" is triggereli a Gewitter szót, a "Föhn lässt nach" is a Föhn-t. Mivel a bump csak szigorító irányú, ez fail-safe, de fals sárgákat okozhat szép napokon. Ez a legkönnyebben javítható pontatlanság (lásd fejlesztések).
3. **A scraper törékeny.** Ha a MeteoSwiss átalakítja az oldalt vagy a bulletin-címeket, a feed csendben elhal. A `fetchedAtUTC` látszik, de nincs explicit "STALE" figyelmeztetés, ha a feed pl. 24 óránál régebbi.
4. **Fix küszöbök, évszak-függetlenül.** A 15/25 km/h szélküszöbök, a CAPE 700-as határ, a −10/−20 pontlevonások kalibrálatlanok; nyáron és ősszel ugyanazok. Nincs visszamérés (verification) valós repült napokkal szemben.
5. **A százalék hamis precizitást sugall.** A "82%" tudományosnak tűnik, pedig heurisztikus pontozás. Kezdő tanuló túlbízhatja magát benne. A disclaimer megvan, de a szám vizuális ereje nagyobb.
6. **Best-site optimizmus.** A napi szám a legjobb hely esélye; egy figyelmetlen felhasználó nem veszi észre, hogy a többi hely piros. A breakdown csak a top helyre látszik részletesen.
7. **Csak veszélyt pontoz, minőséget nem.** Egy 100%-os nap lehet unalmas nullás nap termik nélkül. A termik-minőség (bázismagasság, emelés-erősség, triggerhőmérséklet) az emagram-eszközben megvan, de nincs beszámolva.
8. **Nincs élő (nowcast) adat.** Minden előrejelzés; a winds.mobi csak link. Az indulás előtti "most mit mutatnak az állomások" ellenőrzés kézi marad.
9. **A front kézi felülbírálat dátumhoz kötött localStorage.** Ha a prognózis változik, egy tegnapelőtt beállított felülbírálat csendben érvényben marad.
10. **Egynyelvű (angol) UI**, miközben a célközönség svájci/magyar tanulók; a szakszavak (Δp, 850 hPa, CAPE, geopotenciál) hétköznapi felhasználónak nehezek. A breakdown sokat segít, de a mátrix + kártyák + csempék együtt információ-túlterhelés lehet.

## 7. Fejlesztési irányok (javasolt prioritási sorrendben)

1. **Élő állomás-integráció (nowcast).** winds.mobi vagy Holfuy API a starthelyek közeli állomásaira; "forecast vs most mért" összevetés, riasztás ha a valóság rosszabb. Ez adná a legnagyobb biztonsági értéket.
2. **Verifikációs napló.** Napi predikció automatikus mentése (akár a meglévő GitHub repóba), plusz egyszeri kattintásos visszajelzés ("repültünk / nem"). Fél szezon adatából a küszöbök és súlyok adatvezérelten kalibrálhatók, és a % valódi találati aránnyá válik.
3. **Okosabb szövegértelmezés.** A kulcsszó-szótár cseréje LLM-hívásra (pl. Claude API a scraper workflow-ban, naponta párszor): a bulletin nap-bekezdéseiből strukturált JSON (kategória → szint + indoklás), tagadás- és kontextus-értéssel. A scraper repo már megvan, csak egy lépés bővítés.
4. **Termik-minőség pont.** Az emagram-elemző logikájának (bázis, termik-tető, CAPE-profil) beszámolása egy "milyen JÓ nap" mutatóba a "mennyire veszélyes" mellé; a kettő együtt adja ki, érdemes-e menni.
5. **Staleness-őr és hibatűrés.** Feed-kor jelzés (> 12 h: sárga, > 24 h: piros a panelen), scraper-hiba esetén GitHub Actions e-mail értesítés.
6. **Nyelvi váltó (DE/HU/EN)** és "tanuló mód": egyszerűsített nézet csak a százalékkal, a top hellyel és a school-chat szöveggel, a technikai kártyák elrejtve.
7. **Automatikus briefing-küldés.** A "Copy for school chat" kiváltása: a GitHub Actions reggel generálja és küldi a szöveget (pl. Telegram/WhatsApp bot), a dashboard marad a mélyelemzés.
8. **Szintfüggő küszöbök.** Tanuló vs önálló pilóta profil: ugyanaz a nap egy tanulónak NO-FLY, egy tapasztalt pilótának CAUTION lehet; egy kapcsolóval két küszöbkészlet.

## 8. Kód-tájékozódás (fontos pontok a fájlban)

- `TEXT_JSON_URL` . a feed URL, a script tetején (üres string = kézi beillesztés mód)
- `SITES` tömb . helyek, koordináták, magasságok, szélszektorok, preferencia-sorrend
- `KEYWORDS` . SHV kulcsszó-szótár kategória+súlyosság párokkal
- `omMulti()` . Open-Meteo hívás (multi-pont, multi-modell)
- `dayBlocks()` / `blockForDay(di, regionIdx)` . bulletin nap-blokk parser (pozíció-alapú)
- `scoreDay(di)` . a teljes napi értékelés; benne `siteWind`, `siteStorm`, `fogProfile`, `pct(i)` (breakdown-nal)
- `chatText(S)` . a school-chat szöveg generátor
- `renderForecastPanel()` . MeteoSwiss szöveg panel; `breakdownHtml()` . a levonás-lista
- A scraper repo: `meteoswiss-feed/scrape.js` (Playwright shadow-DOM walker), `.github/workflows/meteoswiss.yml` (cron)

Stílus-megkötések a projektben: Inter font, brand-színek (zöld #1dae80, slate #586573), minden szél km/h-ban, gondolatjel (em-dash) használata kerülendő a szövegekben.