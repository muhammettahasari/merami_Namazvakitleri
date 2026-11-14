// Çekirdek: depolama, senkronizasyon, vakit hesapları (app ve widget sayfası ortak kullanır)
(function (g) {
  'use strict';

  const KEY = 'nv:v1';
  const LKEY = (id) => 'nv:loc:' + id;
  const DEFAULTS = {
    appTop: 'diyanet',      // Ana ekranda üstte görünen kaynak
    widgetTop: 'fazilet',   // Widget'larda üstte görünen kaynak (Verâ yeşil üstte; iç anahtar 'fazilet')
    widgetStyle: 'tablo',
    estimate: true,         // Verâ verisi olmayan günler için tahmin
    theme: 'auto',
  };

  // ---------- yardımcılar ----------
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const toMin = (hm) => { if (!hm) return null; const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const fromMin = (m) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  const at = (dayIso, hm) => (hm ? new Date(`${dayIso}T${hm}:00`) : null);
  const titleTr = (s) => (s || '').toLocaleLowerCase('tr-TR').replace(/(^|[\s\-\/(])(\S)/g, (m, a, b) => a + b.toLocaleUpperCase('tr-TR'));
  const norm = (s) => (s || '').toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/i̇/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[âà]/g, 'a').replace(/[îì]/g, 'i').replace(/[ûù]/g, 'u').replace(/[^a-z0-9]/g, '');

  const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const GUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const fmtDate = (s, withDay = true) => { const d = new Date(s + 'T12:00:00'); return `${d.getDate()} ${AY[d.getMonth()]} ${d.getFullYear()}` + (withDay ? ' ' + GUN[d.getDay()] : ''); };
  const GUN_K = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const fmtShort = (s) => { const d = new Date(s + 'T12:00:00'); return `${d.getDate()} ${AY[d.getMonth()].slice(0, 3)} ${GUN_K[d.getDay()]}`; };

  // ---------- depolama ----------
  function load() {
    let s;
    try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { s = {}; }
    s.locations ||= [];
    s.settings = Object.assign({}, DEFAULTS, s.settings || {});
    return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { console.warn(e); } }
  function loadLoc(id) {
    try { return JSON.parse(localStorage.getItem(LKEY(id))) || { d: {}, f: {} }; } catch { return { d: {}, f: {} }; }
  }
  function saveLoc(id, data) {
    // Çok eski günleri temizle (7 gün öncesinden eski)
    const min = addDays(iso(new Date()), -7);
    for (const k of ['d', 'f']) for (const day of Object.keys(data[k] || {})) if (day < min) delete data[k][day];
    try { localStorage.setItem(LKEY(id), JSON.stringify(data)); } catch (e) { console.warn(e); }
  }
  function removeLoc(id) {
    const s = load();
    s.locations = s.locations.filter((l) => l.id !== id);
    if (s.active === id) s.active = s.locations[0]?.id || null;
    save(s);
    localStorage.removeItem(LKEY(id));
  }
  const activeLoc = (s = load()) => s.locations.find((l) => l.id === s.active) || s.locations[0] || null;

  // ---------- ağ ----------
  async function api(src, params) {
    const u = `/api/${src}?` + new URLSearchParams(params);
    const r = await fetch(u, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  }

  // İlçe koordinatı (Asr-ı Sânî hesabı için) — Open-Meteo konum servisi, il adıyla eşleştirilir
  async function geocode(ilName, ilceName) {
    const want = norm(ilName);
    const find = async (q, codes) => {
      const u = 'https://geocoding-api.open-meteo.com/v1/search?' + new URLSearchParams({ name: q, count: 20, language: 'tr', countryCode: 'TR', format: 'json' });
      const r = await fetch(u); if (!r.ok) return null;
      const j = await r.json();
      const list = (j.results || []).filter((x) => norm(x.admin1) === want || norm(x.admin1).startsWith(want) || want.startsWith(norm(x.admin1)));
      const best = list.find((x) => codes.includes(x.feature_code)) || list.find((x) => norm(x.name) === norm(q)) || list[0];
      return best ? { lat: +best.latitude.toFixed(4), lon: +best.longitude.toFixed(4) } : null;
    };
    try {
      if (ilceName && norm(ilceName) !== want) { const c = await find(ilceName, ['PPLA2', 'PPLA3', 'PPL']); if (c) return c; }
      return await find(ilName, ['PPLA', 'PPLA2']);
    } catch (e) { return null; }
  }

  // Bir konumun verisini iki kaynaktan çeker ve biriktirir
  async function syncLoc(loc, { force = false } = {}) {
    const data = loadLoc(loc.id);
    const today = iso(new Date());
    const res = { d: null, f: null, errors: [] };
    const dKeys = Object.keys(data.d || {}).sort();
    const needD = force || !dKeys.length || dKeys[dKeys.length - 1] < addDays(today, 20) || (loc.updated?.d || '') < addDays(today, -6);
    const needF = force || !data.f?.[addDays(today, 1)] || (loc.updatedAt?.f || 0) < Date.now() - 3 * 3600e3;
    const jobs = [];
    if (needD && loc.diyanet?.id) jobs.push(api('diyanet', { action: 'times', id: loc.diyanet.id })
      .then((j) => { Object.assign(data.d ||= {}, j.days); res.d = Object.keys(j.days).length; })
      .catch((e) => res.errors.push('Diyanet: ' + e.message)));
    if (needF && loc.fazilet?.path) jobs.push(api('fazilet', { action: 'times', path: loc.fazilet.path })
      .then((j) => { Object.assign(data.f ||= {}, j.days); res.f = Object.keys(j.days).length; })
      .catch((e) => res.errors.push('Verâ: ' + e.message)));
    const ilName = loc.il || (loc.label || '').split(',').pop().trim();
    if (!loc.coord && ilName) jobs.push(geocode(ilName, loc.diyanet?.name).then((c) => { if (c) res.coord = c; }));
    await Promise.all(jobs);
    saveLoc(loc.id, data);
    if (res.coord) loc.coord = res.coord;
    const s = load();
    const l = s.locations.find((x) => x.id === loc.id);
    if (l) {
      l.updated ||= {}; l.updatedAt ||= {};
      if (res.d) { l.updated.d = today; l.updatedAt.d = Date.now(); }
      if (res.f) { l.updated.f = today; l.updatedAt.f = Date.now(); }
      if (res.coord) l.coord = res.coord;
      save(s);
    }
    return res;
  }

  // ---------- vakit hesapları ----------
  const D_KEYS = ['imsak', 'gunes', 'ogle', 'ikindi', 'aksam', 'yatsi'];
  const F_KEYS = ['imsak', 'sabah', 'gunes', 'ogle', 'ikindi', 'aksam', 'yatsi'];

  // Verâ verisi yoksa: en yakın gerçek günün Diyanet'e göre farkını uygula (≈ tahmini)
  function estimateF(data, day) {
    const d = data.d?.[day];
    if (!d) return null;
    const known = Object.keys(data.f || {}).filter((k) => data.d?.[k]).sort((a, b) =>
      Math.abs(new Date(a) - new Date(day)) - Math.abs(new Date(b) - new Date(day)));
    if (!known.length) return null;
    const rf = data.f[known[0]], rd = data.d[known[0]];
    const o = { est: true, estFrom: known[0] };
    for (const k of F_KEYS) {
      const base = k === 'sabah' ? 'imsak' : k;
      const delta = toMin(rf[k]) - toMin(rd[base]);
      if (Number.isFinite(delta)) o[k] = fromMin(toMin(d[base]) + delta);
    }
    return o;
  }

  function dayData(data, day, estimate = true) {
    const d = data.d?.[day] || null;
    let f = data.f?.[day] || null;
    if (!f && estimate) f = estimateF(data, day);
    return { d, f };
  }

  // ---------- Asr-ı Sânî (gölge boyu 2 katı + öğle gölgesi) ----------
  // Asr-ı evvel (Diyanet'in ikindisi): gölge = 1 × boy + fey-i zeval (İmameyn ve diğer mezhepler).
  // Asr-ı sânî: gölge = 2 × boy + fey-i zeval (İmam-ı Âzam Ebû Hanîfe).
  // Diyanet ikindisine, gölgenin 1 kattan 2 kata uzaması için geçen süre eklenir; böylece
  // Diyanet'in temkini korunur ve boylam hatası etkilemez. Yalnızca enlem ve güneşin sapması gerekir.
  const RAD = Math.PI / 180;
  function sunDecl(dayIso) {
    const d = new Date(dayIso + 'T12:00:00Z');
    const n = (d - Date.UTC(2000, 0, 1, 12)) / 864e5;
    const L = (280.46 + 0.9856474 * n) % 360, g = (357.528 + 0.9856003 * n) % 360;
    const lam = L + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD);
    const eps = 23.439 - 0.0000004 * n;
    return Math.asin(Math.sin(eps * RAD) * Math.sin(lam * RAD)) / RAD;
  }
  // Gölge = n×boy + öğle gölgesi olduğu andaki saat açısı (derece)
  function asrHourAngle(lat, decl, n) {
    const A = Math.atan(1 / (n + Math.tan(Math.abs(lat - decl) * RAD)));
    const c = (Math.sin(A) - Math.sin(lat * RAD) * Math.sin(decl * RAD)) / (Math.cos(lat * RAD) * Math.cos(decl * RAD));
    if (c < -1 || c > 1) return null;
    return Math.acos(c) / RAD;
  }
  function asrSani(dayIso, ikindiHm, lat) {
    if (!ikindiHm || lat == null || !Number.isFinite(+lat)) return null;
    const decl = sunDecl(dayIso);
    const h1 = asrHourAngle(+lat, decl, 1), h2 = asrHourAngle(+lat, decl, 2);
    if (h1 == null || h2 == null) return null;
    return fromMin(toMin(ikindiHm) + (h2 - h1) * 4); // 1° saat açısı = 4 dakika
  }

  // Teheccüd: gecenin son üçte biri (akşam → ertesi imsak)
  function teheccud(aksamDay, aksamHm, imsakDay, imsakHm) {
    const a = at(aksamDay, aksamHm), i = at(imsakDay, imsakHm);
    if (!a || !i) return null;
    const night = i - a;
    if (night <= 0) return null;
    const start = new Date(i - night / 3);
    return { start, end: i, text: `${pad(start.getHours())}:${pad(start.getMinutes())}–${imsakHm}` };
  }

  // Ekranda gösterilecek "şu anki gün" modeli
  function model(loc, now = new Date(), opt = {}) {
    const s = load();
    const est = opt.estimate ?? s.settings.estimate;
    const data = loadLoc(loc.id);
    const today = iso(now), yest = addDays(today, -1), tom = addDays(today, 1);
    const T = dayData(data, today, est), Y = dayData(data, yest, est), N = dayData(data, tom, est);

    // Teheccüd: imsak'tan önceysek dün akşam→bugün imsak, değilse bu akşam→yarın imsak
    const teh = (src) => {
      const t = T[src], y = Y[src], n = N[src];
      if (!t) return null;
      const before = at(today, t.imsak) > now;
      return before ? (y ? teheccud(yest, y.aksam, today, t.imsak) : null)
                    : (n ? teheccud(today, t.aksam, tom, n.imsak) : null);
    };

    // Sıradaki vakit
    const events = (src, keys, map) => {
      const out = [];
      for (const [day, X] of [[today, T], [tom, N]]) {
        const v = X[src]; if (!v) continue;
        for (const k of keys) if (v[k]) out.push({ key: map?.[k] || k, raw: k, day, hm: v[k], time: at(day, v[k]) });
      }
      return out;
    };
    const nextOf = (list) => list.find((e) => e.time > now) || null;
    const curOf = (list, srcData) => {
      const past = list.filter((e) => e.time <= now);
      if (past.length) return past[past.length - 1];
      // Gece yarısı ile imsak arası: dünkü yatsı
      return srcData ? { key: 'yatsi', raw: 'yatsi', day: yest, hm: srcData.yatsi } : null;
    };
    const dEv = events('d', D_KEYS);
    const fEv = events('f', F_KEYS);
    // 5 vakit sütunları için "aktif sütun"
    const fiveOf = (e) => (!e ? null : ({ imsak: 'sabah', sabah: 'sabah', gunes: null, ogle: 'ogle', ikindi: 'ikindi', aksam: 'aksam', yatsi: 'yatsi' })[e.raw]);

    const dCur = curOf(dEv, Y.d), fCur = curOf(fEv, Y.f);
    const colSrc = s.settings.appTop === 'fazilet' ? (fCur || dCur) : (dCur || fCur);
    return {
      loc, today, now,
      hicri: T.d?.hicri || T.f?.hicri || '',
      asrSani: asrSani(today, T.d?.ikindi, loc.coord?.lat),
      d: T.d, f: T.f, tomorrow: N,
      teh: { d: teh('d'), f: teh('f') },
      next: { d: nextOf(dEv), f: nextOf(fEv) },
      cur: { d: dCur, f: fCur, col: fiveOf(colSrc) },
      hasData: !!(T.d || T.f),
      updated: loc.updatedAt || {},
    };
  }

  const LABEL = { imsak: 'İmsak', sabah: 'Sabah', gunes: 'Güneş', ogle: 'Öğle', ikindi: 'İkindi', aksam: 'Akşam', yatsi: 'Yatsı' };
  const countdown = (to, now = new Date()) => {
    if (!to) return '';
    let s = Math.max(0, Math.floor((to - now) / 1000));
    const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60;
    return (h ? h + ':' : '') + pad(m) + ':' + pad(s);
  };

  // Android uygulaması (widget + kilit ekranı bildirimi) için: dünden itibaren 62 günlük hazır veri
  function nativeData(loc, s = load()) {
    const data = loadLoc(loc.id), est = s.settings.estimate;
    const start = addDays(iso(new Date()), -1), days = {};
    for (let i = 0; i < 62; i++) {
      const day = addDays(start, i), next = addDays(day, 1);
      const T = dayData(data, day, est), N = dayData(data, next, est);
      if (!T.d && !T.f) continue;
      const o = {};
      if (T.d) o.d = { imsak: T.d.imsak, gunes: T.d.gunes, ogle: T.d.ogle, ikindi: T.d.ikindi, aksam: T.d.aksam, yatsi: T.d.yatsi };
      if (T.f) { o.f = { imsak: T.f.imsak, sabah: T.f.sabah, gunes: T.f.gunes, ogle: T.f.ogle, ikindi: T.f.ikindi, aksam: T.f.aksam, yatsi: T.f.yatsi }; o.fe = !!T.f.est; }
      const as = asrSani(day, T.d?.ikindi, loc.coord?.lat); if (as) o.as = as;
      const hc = T.d?.hicri || T.f?.hicri; if (hc) o.h = hc;
      if (T.d && N.d) o.td = teheccud(day, T.d.aksam, next, N.d.imsak)?.text || '';
      if (T.f && N.f) o.tf = teheccud(day, T.f.aksam, next, N.f.imsak)?.text || '';
      days[day] = o;
    }
    return { loc: loc.short || loc.label, top: s.settings.widgetTop, appTop: s.settings.appTop, days };
  }

  g.NV = {
    geocode, asrSani, sunDecl, nativeData, load, save, loadLoc, saveLoc, removeLoc, activeLoc, api, syncLoc, model, dayData,
    iso, addDays, toMin, fromMin, titleTr, norm, fmtDate, fmtShort, countdown, teheccud, LABEL, D_KEYS, F_KEYS, pad,
  };
})(window);
