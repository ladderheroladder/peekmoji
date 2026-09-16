(() => {
'use strict';
const { $, dayIndex, dailyPick, storage, pref, share, startCountdown, siteUrl, secs } = PK;

// ---- Config ----
const EPOCH = [2026, 8, 15];        // Sept 15, 2026 = daily #1 (month is 0-based)
const ROUNDS = 5;
const YEAR_MIN = 1840, YEAR_MAX = 2020, YEAR_START = 1920;
const LOOK_PER_SEC = 100, LOOK_CAP = 3000;   // spyglass cost
const SITE_URL = siteUrl('https://ladderheroladder.github.io/peekmoji/timescope/');

const fmt = n => n.toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---- Daily state ----
const today = dayIndex(EPOCH);
const photos = dailyPick(window.TIMESCOPE_PHOTOS, 'timescope', today, ROUNDS);
const db = storage('timescope:v1', () => ({ days: {} }));
const store = db.load();
const day = store.days[today] || (store.days[today] = { r: photos.map(() => ({ ms: 0, pin: null, year: YEAR_START, pts: null })) });
const save = () => db.save(store);
let viewing = 0, lastSave = 0;
const cur = () => day.r[viewing];

// ---- Scoring ----
function km([lon1, lat1], [lon2, lat2]) {
  const rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
const lookCost = ms => Math.min(LOOK_CAP, Math.round(ms / 1000 * LOOK_PER_SEC));
function score(r, p) {
  const dist = Math.round(km(r.pin, [p.lng, p.lat])), yrs = Math.abs(r.year - p.year);
  const where = Math.round(5000 * Math.exp(-dist / 1500));
  const when = Math.round(5000 * Math.exp(-yrs / 12));
  const look = lookCost(r.ms);
  return { km: dist, yrs, where, when, look, total: Math.max(0, where + when - look) };
}
const dayTotal = d => d.r.reduce((a, r) => a + (r.pts ? r.pts.total : 0), 0);
const square = p => p >= 4000 ? '🟩' : p >= 2500 ? '🟨' : p >= 1000 ? '🟧' : '🟥';
const dotClass = t => t >= 8000 ? 'g' : t >= 5000 ? 'y' : t >= 2500 ? 'o' : 'r';
const rankOf = t => t >= 45000 ? '🧭 Time Lord' : t >= 38000 ? '🔥 Historian' : t >= 30000 ? '😎 Globetrotter' : t >= 20000 ? '👍 Explorer' : t >= 10000 ? '😅 Tourist' : '🐢 Lost in time';

// ---- Photo board ----
const imgs = {};
function img(i) {
  if (!imgs[i]) { imgs[i] = new Image(); imgs[i].src = photos[i].src; }
  return imgs[i];
}
const paintPhoto = im => (c, W, H) => {
  if (!im.naturalWidth) return;
  const s = Math.min(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
  c.imageSmoothingQuality = 'high';
  c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
};
const sg = new PK.Spyglass($('#board'), {
  lens: 0.15, zoom: 1.8,
  onStart() { $('#hint').hidden = true; },
  onTick(ms) {
    showLook(ms);
    if (performance.now() - lastSave > 300) { cur().ms = Math.round(ms); save(); lastSave = performance.now(); }
  },
  onRelease(ms) { cur().ms = Math.round(ms); save(); showLook(ms); }
});
function showLook(ms) {
  $('#looked').textContent = secs(ms);
  const c = lookCost(ms);
  $('#penalty').textContent = c ? `(−${fmt(c)})` : '';
}

// ---- Map & year ----
// Map tiles: Esri World Street Map (English labels down to street names, no API key).
// Before running ads at scale, move to a provider account with a commercial plan (Esri Location Platform,
// MapTiler, Stadia Maps, Mapbox...) by changing TILES and TILE_ATTRIBUTION.
const ESRI_STREETS = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const TILES = { light: ESRI_STREETS, dark: ESRI_STREETS };
const TILE_ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> &mdash; Esri, HERE, Garmin, USGS, OpenStreetMap';
const WORLD_VIEW = [[25, 10], 1];
const darkMode = matchMedia('(prefers-color-scheme: dark)');

const map = L.map('map', { worldCopyJump: true, minZoom: 1, maxZoom: 20, zoomSnap: 0.5, maxBounds: [[-85, -540], [85, 540]], maxBoundsViscosity: 1 })
  .setView(...WORLD_VIEW);
map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
const tiles = L.tileLayer(TILES[darkMode.matches ? 'dark' : 'light'], { maxNativeZoom: 19, maxZoom: 20, attribution: TILE_ATTRIBUTION }).addTo(map);
darkMode.addEventListener?.('change', e => { tiles.setUrl(TILES[e.matches ? 'dark' : 'light']); renderPins(); });
const wrapLon = lon => ((lon + 180) % 360 + 360) % 360 - 180;
map.on('click', e => {
  const r = cur();
  if (r.pts) return;
  r.pin = [+wrapLon(e.latlng.lng).toFixed(5), +e.latlng.lat.toFixed(5)];
  $('#mapHint').hidden = true;
  save(); renderPins(); updateLock();
});

const yearInput = $('#year');
function showYear(v) { yearInput.value = v; $('#yearOut').textContent = v; }
function setYear(v) {
  v = Math.max(YEAR_MIN, Math.min(YEAR_MAX, Math.round(v)));
  showYear(v);
  if (!cur().pts) { cur().year = v; save(); }
}
yearInput.addEventListener('input', () => setYear(+yearInput.value));
$('#yearDown').onclick = () => setYear(+yearInput.value - 1);
$('#yearUp').onclick = () => setYear(+yearInput.value + 1);

const pinIcon = kind => L.divIcon({ className: 'pin ' + kind, iconSize: [26, 30], iconAnchor: [13, 28] });
let mapMarks = [];
function renderPins() {
  const r = cur(), p = photos[viewing];
  mapMarks.forEach(m => m.remove());
  mapMarks = [];
  if (r.pin) mapMarks.push(L.marker([r.pin[1], r.pin[0]], { icon: pinIcon('guess'), interactive: false, keyboard: false }));
  if (r.pts) {
    mapMarks.push(L.marker([p.lat, p.lng], { icon: pinIcon('answer'), interactive: false, keyboard: false }));
    if (r.pin) mapMarks.push(L.polyline([[r.pin[1], r.pin[0]], [p.lat, p.lng]], { color: '#231d16', weight: 2.5, dashArray: '6 6', interactive: false }));
  }
  mapMarks.forEach(m => m.addTo(map));
}
function updateLock() {
  const b = $('#lockBtn'), has = !!cur().pin;
  b.disabled = !has;
  b.textContent = has ? 'Lock in guess 🔒' : 'Drop a pin first';
}

// ---- Rounds ----
function load(i) {
  viewing = i;
  const r = day.r[i], im = img(i);
  sg.load({ paint: paintPhoto(im), heldMs: r.ms, revealed: !!r.pts });
  if (!im.complete) im.onload = () => { if (viewing === i) sg.refresh(); };
  if (i + 1 < ROUNDS) img(i + 1);   // preload the next photo
  showYear(r.year); showLook(r.ms);
  $('#hint').hidden = r.ms > 0 || !!r.pts;
  $('#mapHint').hidden = !!r.pin;
  if (r.pts) showResult(false);
  else {
    $('#result').hidden = true; $('#guessArea').hidden = false;
    map.setView(...WORLD_VIEW); renderPins(); updateLock();
  }
  renderHeader();
}
$('#lockBtn').addEventListener('click', () => {
  const r = cur();
  if (!r.pin || r.pts) return;
  r.ms = Math.round(sg.held());
  r.year = +yearInput.value;
  r.pts = score(r, photos[viewing]);
  save();
  $('#hint').hidden = true;
  sg.reveal();
  showResult(true);
  renderHeader();
});
function showResult(fresh) {
  const r = cur(), p = photos[viewing], s = r.pts;
  $('#guessArea').hidden = true; $('#result').hidden = false;
  $('#rWhere').textContent = `📍 ${p.place} · ${fmt(s.km)} km away`;
  $('#rWhereP').textContent = '+' + fmt(s.where);
  $('#rWhen').textContent = `📅 ${p.year} · you said ${r.year}` + (s.yrs ? ` (${s.yrs} off)` : ' 🎯');
  $('#rWhenP').textContent = '+' + fmt(s.when);
  $('#rLook').textContent = `⏱ Looked ${secs(r.ms)}`;
  $('#rLookP').textContent = s.look ? '−' + fmt(s.look) : '0';
  $('#rTotal').textContent = fmt(s.total);
  $('#rFact').textContent = p.fact;
  $('#rCredit').innerHTML = `📷 ${esc(p.credit.artist)} · ${esc(p.credit.license)} · <a href="${esc(p.credit.page)}" target="_blank" rel="noopener">source</a>`;
  const allDone = day.r.every(x => x.pts);
  $('#nextBtn').textContent = allDone && viewing === ROUNDS - 1 ? 'See results 🏁' : 'Next photo →';
  renderPins();
  map.fitBounds([[r.pin[1], r.pin[0]], [p.lat, p.lng]], { padding: [40, 40], maxZoom: 13 });
  if (fresh) $('#result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
$('#nextBtn').addEventListener('click', () => {
  const open = day.r.findIndex(x => !x.pts);
  if (open !== -1) load(open);
  else if (viewing < ROUNDS - 1) load(viewing + 1);
  else return showDone();
  scrollTo({ top: 0, behavior: 'smooth' });
});

function renderHeader() {
  $('#sub').textContent = `Daily #${today + 1} · Photo ${viewing + 1} of ${ROUNDS}`;
  $('#dots').innerHTML = day.r.map((r, i) => `<i class="${r.pts ? dotClass(r.pts.total) : ''}${i === viewing ? ' on' : ''}"></i>`).join('');
  $('#total').textContent = fmt(dayTotal(day));
}

// ---- Summary & sharing ----
function shareText() {
  const row = key => day.r.map(r => r.pts ? square(r.pts[key]) : '⬜').join('');
  const looked = day.r.reduce((a, r) => a + r.ms, 0);
  return `Timescope #${today + 1} 🌍 ${fmt(dayTotal(day))}/50,000\n📍${row('where')}\n📅${row('when')}\n⏱ ${secs(looked)} looking\n${SITE_URL}`;
}
function showDone() {
  const done = day.r.filter(r => r.pts), total = dayTotal(day);
  const avgKm = Math.round(done.reduce((a, r) => a + r.pts.km, 0) / done.length);
  const avgYrs = Math.round(done.reduce((a, r) => a + r.pts.yrs, 0) / done.length);
  $('#doneRank').textContent = rankOf(total);
  $('#doneDetail').textContent = `${fmt(total)} points · on average ${fmt(avgKm)} km and ${avgYrs} years off`;
  $('#doneShare').textContent = shareText();
  if (!$('#doneDlg').open) $('#doneDlg').showModal();
}
$('#shareBtn').addEventListener('click', () => share(shareText()));
$('#reviewBtn').addEventListener('click', () => { $('#doneDlg').close(); load(0); scrollTo({ top: 0, behavior: 'smooth' }); });

// ---- Stats ----
$('#statsBtn').addEventListener('click', () => {
  const days = Object.entries(store.days).filter(([, d]) => d.r.every(r => r.pts)).map(([k, d]) => ({ k: +k, t: dayTotal(d) }));
  const set = new Set(days.map(d => d.k));
  let streak = 0, d = set.has(today) ? today : today - 1;
  while (set.has(d)) { streak++; d--; }
  const cells = [
    [days.length, 'Days'],
    [days.length ? fmt(Math.max(...days.map(x => x.t))) : '–', 'Best'],
    [days.length ? fmt(Math.round(days.reduce((a, x) => a + x.t, 0) / days.length)) : '–', 'Average'],
    [streak, 'Streak 🔥']
  ];
  $('#statsGrid').innerHTML = cells.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  $('#statsDlg').showModal();
});
$('#helpBtn').addEventListener('click', () => $('#helpDlg').showModal());

// ---- Boot ----
const open = day.r.findIndex(r => !r.pts);
load(open === -1 ? ROUNDS - 1 : open);
if (open === -1) showDone();
startCountdown(EPOCH);
if (!pref('tsHelp')) { pref('tsHelp', '1'); $('#helpDlg').showModal(); }
})();
