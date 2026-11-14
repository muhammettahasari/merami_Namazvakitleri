// Kıble bulucu
// - Kıble açısı: büyük daire (ortodrom) formülü, Kâbe: 21.422487 K, 39.826206 D
// - Manyetik sapma: WMM-2025 (wmm.js) ile konuma ve tarihe göre hesaplanır
// - Pusula: iOS webkitCompassHeading / Android deviceorientationabsolute
// - Eğim, kalibrasyon ve sinyal oynaklığı uyarıları
// - Sensörsüz doğrulama: güneş azimutu, "kıble saati" ve gölge ile kalibrasyon
(function (g) {
  'use strict';
  const NV = g.NV;
  const $ = (s, r = document) => r.querySelector(s);
  const KAABA = { lat: 21.422487, lon: 39.826206 };
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const norm360 = (a) => ((a % 360) + 360) % 360;
  const diff180 = (a) => { a = norm360(a); return a > 180 ? a - 360 : a; };

  // ---------- hesaplar ----------
  function qiblaBearing(lat, lon) {
    const p1 = lat * rad, p2 = KAABA.lat * rad, dl = (KAABA.lon - lon) * rad;
    return norm360(Math.atan2(Math.sin(dl), Math.cos(p1) * Math.tan(p2) - Math.sin(p1) * Math.cos(dl)) * deg);
  }
  function distanceKm(lat, lon) {
    const p1 = lat * rad, p2 = KAABA.lat * rad, dp = p2 - p1, dl = (KAABA.lon - lon) * rad;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  const decYear = (d) => { const y = d.getUTCFullYear(); const s = Date.UTC(y, 0, 1), e = Date.UTC(y + 1, 0, 1); return y + (d - s) / (e - s); };

  // NOAA güneş konumu algoritması (azimut kuzeyden saat yönünde)
  function sunPos(date, lat, lon) {
    const jd = date.getTime() / 86400000 + 2440587.5, T = (jd - 2451545) / 36525;
    const L0 = norm360(280.46646 + T * (36000.76983 + T * 0.0003032));
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const C = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * rad) * 0.000289;
    const omega = 125.04 - 1934.136 * T;
    const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * rad);
    const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const eps = eps0 + 0.00256 * Math.cos(omega * rad);
    const dec = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad));
    const y = Math.tan(eps * rad / 2) ** 2;
    const eqt = 4 * deg * (y * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(M * rad) + 4 * e * y * Math.sin(M * rad) * Math.cos(2 * L0 * rad)
      - 0.5 * y * y * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * M * rad));
    const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    const H = (utcMin + eqt + 4 * lon) / 4 - 180;
    const la = lat * rad, h = H * rad;
    const cz = Math.min(1, Math.max(-1, Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(h)));
    let alt = 90 - Math.acos(cz) * deg;
    // atmosferik kırılma (yaklaşık)
    if (alt > -0.575) alt += 1.02 / Math.tan((alt + 10.3 / (alt + 5.11)) * rad) / 60;
    const az = norm360(Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(la) - Math.tan(dec) * Math.cos(la)) * deg + 180);
    return { az, alt };
  }

  // Güneşin verilen azimuttan geçtiği an (bugün, güneş ufkun üstündeyken)
  function sunAtAzimuth(lat, lon, target, day = new Date()) {
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    let prev = null;
    for (let m = 0; m <= 1440; m += 2) {
      const t = new Date(start.getTime() + m * 60000);
      const s = sunPos(t, lat, lon);
      const d = diff180(s.az - target);
      if (prev && prev.s.alt > 3 && s.alt > 3 && Math.sign(prev.d) !== Math.sign(d) && Math.abs(prev.d - d) < 90) {
        // doğrusal ara değer
        const f = prev.d / (prev.d - d);
        const tt = new Date(prev.t.getTime() + f * 120000);
        return { time: tt, alt: sunPos(tt, lat, lon).alt };
      }
      prev = { t, s, d };
    }
    return null;
  }

  // ---------- durum ----------
  const st = {
    on: false, kind: null, raw: null, vx: 0, vy: 0, heading: null, acc: null,
    beta: 0, gamma: 0, samples: [], lastEvent: 0, aligned: false, timer: null,
  };
  const S = () => NV.load();
  // Konum: GPS ile bulunan; yoksa kayıtlı ilçenin konumu
  const geo = () => {
    const gd = S().settings.geo;
    if (gd) return gd;
    const lc = NV.activeLoc()?.coord;
    return lc ? { lat: lc.lat, lon: lc.lon, acc: null, alt: 0, ts: 0, src: 'ilce' } : null;
  };
  const qset = () => Object.assign({ northRef: 'mag', offset: 0 }, S().settings.qibla || {});
  function saveQ(patch) { const s = NV.load(); s.settings.qibla = Object.assign(qset(), patch); NV.save(s); }
  function saveGeo(gd) { const s = NV.load(); s.settings.geo = gd; NV.save(s); }

  function calc() {
    const gd = geo(); if (!gd) return null;
    const now = new Date();
    const q = qiblaBearing(gd.lat, gd.lon);
    const decl = g.wmmDeclination(gd.lat, gd.lon, (gd.alt || 0) / 1000, decYear(now));
    return { q, decl, dist: distanceKm(gd.lat, gd.lon), gd };
  }

  // Ham pusula değeri -> gerçek kuzeye göre yön
  function trueHeading(raw) {
    const c = calc(), qs = qset();
    let h = raw;
    if (qs.northRef === 'mag' && c) h += c.decl;
    return norm360(h + (qs.offset || 0));
  }

  function onOrient(e) {
    let raw = null, kind = st.kind;
    if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
      raw = e.webkitCompassHeading; kind = 'ios'; st.acc = e.webkitCompassAccuracy;
    } else if ((e.type === 'deviceorientationabsolute' || e.absolute) && e.alpha != null) {
      const sa = (screen.orientation && screen.orientation.angle) || g.orientation || 0;
      raw = norm360(360 - e.alpha + sa); kind = 'android'; st.acc = null;
    }
    st.beta = e.beta || 0; st.gamma = e.gamma || 0;
    if (raw == null) return;
    st.kind = kind; st.raw = raw; st.lastEvent = Date.now();
    // Dairesel yumuşatma
    const k = 0.25, rx = Math.cos(raw * rad), ry = Math.sin(raw * rad);
    if (st.heading == null) { st.vx = rx; st.vy = ry; } else { st.vx += k * (rx - st.vx); st.vy += k * (ry - st.vy); }
    st.heading = norm360(Math.atan2(st.vy, st.vx) * deg);
    st.samples.push(raw); if (st.samples.length > 30) st.samples.shift();
    track8(raw);
  }

  function jitter() {
    if (st.samples.length < 10) return 0;
    let x = 0, y = 0; for (const a of st.samples) { x += Math.cos(a * rad); y += Math.sin(a * rad); }
    const R = Math.sqrt(x * x + y * y) / st.samples.length;
    return Math.sqrt(-2 * Math.log(Math.max(R, 1e-9))) * deg; // dairesel std. sapma
  }

  async function start() {
    if (st.on) return;
    let denied = false;
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') denied = true;
      }
    } catch (e) { denied = true; }
    // İzin reddedilse de dinlemeyi dene (bazı tarayıcılar yine de veri gönderir)
    st.on = true; st.heading = null; st.samples = []; st.lastEvent = 0;
    if (denied) setTimeout(() => { if (st.on && !st.lastEvent) msg('Yön sensörü izni verilmedi. Tarayıcı/site ayarlarından “Hareket sensörleri” iznini açın (iPhone: Ayarlar → Safari → Hareket ve Yönelim Erişimi) ve tekrar başlatın.'); }, 1500);
    // Android Chrome: deviceorientationabsolute (manyetik kuzeye göre); iOS: deviceorientation + webkitCompassHeading
    g.addEventListener('deviceorientationabsolute', onOrient);
    g.addEventListener('deviceorientation', onOrient);
    st.timer = setInterval(draw, 60);
    setTimeout(() => { if (st.on && !st.lastEvent) msg('Bu cihazda pusula sensörü verisi alınamadı. “Yönergeler” bölümündeki <b>güneş yöntemini</b> kullanın.'); }, 3500);
    draw();
  }
  function stop() {
    st.on = false;
    g.removeEventListener('deviceorientationabsolute', onOrient);
    g.removeEventListener('deviceorientation', onOrient);
    clearInterval(st.timer);
  }

  function msg(t) { const m = $('#qMsg'); if (m) { m.innerHTML = t; m.hidden = !t; } }

  function getGPS() {
    return new Promise((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition((p) => res(p), () => res(null), { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 });
    });
  }

  // Tek düğme: önce konumu bulur, sonra pusulayı başlatır
  let finding = false;
  async function findQibla(onlyLocation = false) {
    if (finding) return;
    finding = true;
    const startP = onlyLocation ? Promise.resolve() : start(); // iPhone: pusula izni dokunuş anında istenmeli
    render();
    msg('📍 Konumunuz bulunuyor… Açık havada ya da pencere kenarında daha hızlı bulunur.');
    const p = await getGPS();
    await startP;
    if (p) {
      saveGeo({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, alt: p.coords.altitude || 0, ts: Date.now(), src: 'gps' });
      msg('');
      gstat.loc = ['good', `✓ Konum güncellendi (±${Math.round(p.coords.accuracy)} m).`];
    } else if (NV.activeLoc()?.coord) {
      gstat.loc = ['bad', 'GPS konumu alınamadı. Telefonun <b>Konum</b> ayarını açın ve uygulamaya konum izni verin; şimdilik ilçenizin konumu kullanılıyor.'];
      msg('GPS konumu alınamadı; kayıtlı ilçenizin konumu kullanılıyor. Daha doğru sonuç için telefonun <b>Konum</b> ayarını açıp uygulamaya konum izni verin.');
    } else {
      msg('Konum alınamadı. Telefonun <b>Konum (GPS)</b> ayarını açın, uygulama izin isterse <b>İzin ver</b> deyin ve tekrar deneyin.');
      gstat.loc = ['bad', 'Konum alınamadı. Telefonun <b>Konum (GPS)</b> ayarını açın ve tekrar deneyin.'];
    }
    finding = false;
    render();
  }

  // ---------- çizim ----------
  const fmtDeg = (a, d = 1) => (a == null ? '—' : a.toFixed(d).replace('.', ',') + '°');
  const fmtX = (x) => x.toFixed(1).replace('.', ',');
  const hm = (t) => (t ? NV.pad(t.getHours()) + ':' + NV.pad(t.getMinutes()) : '—');

  function dialSvg() {
    let ticks = '';
    for (let a = 0; a < 360; a += 5) {
      const big = a % 30 === 0, r1 = big ? 128 : 134, r2 = 142;
      const x1 = 150 + r1 * Math.sin(a * rad), y1 = 150 - r1 * Math.cos(a * rad), x2 = 150 + r2 * Math.sin(a * rad), y2 = 150 - r2 * Math.cos(a * rad);
      ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${big ? 'tb' : 'ts'}"/>`;
    }
    const lab = [['K', 0], ['D', 90], ['G', 180], ['B', 270]].map(([t, a]) =>
      `<text x="${150 + 112 * Math.sin(a * rad)}" y="${150 - 112 * Math.cos(a * rad) + 6}" class="${t === 'K' ? 'ln n' : 'ln'}">${t}</text>`).join('');
    return `<svg viewBox="0 0 300 300" class="qdial">
      <g id="qRose">
        <circle cx="150" cy="150" r="146" class="rim"/>${ticks}${lab}
        <g id="qMark"><line x1="150" y1="150" x2="150" y2="34" class="qline"/>
          <g transform="translate(150 30)"><rect x="-13" y="-13" width="26" height="26" rx="3" class="kaaba"/><rect x="-13" y="-6" width="26" height="4" class="kband"/></g></g>
      </g>
      <polygon points="150,2 141,22 159,22" class="ptr"/>
      <circle cx="150" cy="150" r="5" class="hub"/>
    </svg>`;
  }

  // ---------- çizimler (yönergeler) ----------
  const SVG_FLAT = `<svg viewBox="0 0 320 150" class="qill" role="img" aria-label="Telefon masaya koyar gibi düz tutulur">
    <g transform="translate(46 50)" class="nok"><rect x="-13" y="-24" width="26" height="48" rx="5" transform="rotate(-30)" class="phone"/></g>
    <text x="46" y="96" class="lbl sm">✗ eğik</text>
    <rect x="96" y="80" width="150" height="14" rx="5" class="phone"/><rect x="102" y="83" width="138" height="4" rx="2" class="screen"/>
    <rect x="80" y="96" width="182" height="8" rx="3" class="ground"/>
    <text x="171" y="70" class="lbl sm">✓ düz, ekran yukarı</text>
    <text x="160" y="140" class="lbl">Telefonu masaya koyar gibi tutun</text>
  </svg>`;
  const SVG_EIGHT = `<svg viewBox="0 0 320 130" class="qill" role="img" aria-label="Telefonu havada sekiz çizer gibi döndürün">
    <path d="M60 65 C 60 20, 150 20, 160 65 C 170 110, 260 110, 260 65 C 260 20, 170 20, 160 65 C 150 110, 60 110, 60 65 Z" class="eight"/>
    <polygon points="206,28 222,22 214,38" class="arrow"/><polygon points="114,102 98,108 106,92" class="arrow"/>
    <g transform="translate(160 65) rotate(-20)"><rect x="-12" y="-22" width="24" height="44" rx="5" class="phone"/><rect x="-9" y="-18" width="18" height="34" rx="2" class="screen"/></g>
    <text x="160" y="126" class="lbl">Havada 2–3 kez yavaşça “8” çizin</text>
  </svg>`;
  const SVG_SHADOW = `<svg viewBox="0 0 340 334" class="qill" role="img" aria-label="Kalem dik sabitlenir, telefonun şarj girişi kalemin dibine, üst kenarı gölgenin ucuna gelir">
    <text x="10" y="16" class="ttl">1) Yandan görünüm</text>
    <circle cx="36" cy="44" r="14" class="sun"/>
    <g class="ray"><line x1="50" y1="52" x2="124" y2="106"/><line x1="52" y1="40" x2="148" y2="106"/></g>
    <rect x="10" y="118" width="320" height="6" rx="2" class="ground"/>
    <rect x="124" y="58" width="8" height="60" rx="2" class="pen"/><polygon points="124,58 132,58 128,48" class="pen"/>
    <text x="140" y="70" class="lbl sm start">kalem (dik)</text>
    <polygon points="132,118 132,113 262,118" class="shade"/>
    <line x1="132" y1="134" x2="262" y2="134" class="dim"/><line x1="132" y1="129" x2="132" y2="139" class="dim"/><line x1="262" y1="129" x2="262" y2="139" class="dim"/>
    <text x="197" y="152" class="lbl sm">gölge boyu</text>
    <text x="10" y="186" class="ttl">2) Üstten görünüm</text>
    <polygon points="54,240 330,236 330,248 54,252" class="shade"/>
    <circle cx="50" cy="246" r="8" class="pen"/>
    <text x="50" y="274" class="lbl sm">kalem</text>
    <g transform="translate(60 228)"><rect x="0" y="0" width="190" height="36" rx="8" class="phone"/><rect x="12" y="4" width="166" height="28" rx="3" class="screen"/>
      <rect x="-1" y="14" width="6" height="8" rx="1.5" class="port"/></g>
    <path d="M254 242 L292 242" class="arrowline"/><polygon points="292,236 304,242 292,248" class="arrow"/>
    <text x="40" y="218" class="lbl sm start">↓ şarj girişi (alt kenar) kalemin dibinde</text>
    <text x="330" y="282" class="lbl sm end">üst kenar gölgenin ucuna bakar →</text>
    <text x="170" y="310" class="lbl">Telefon gölgenin üstünde, gölgeyle paralel</text>
    <text x="170" y="326" class="lbl sm">gölge telefonun ortasından boydan boya geçer</text>
  </svg>`;

  // Güneşin 10°–65° arasında olduğu saatler (gölge, kalemin ~yarısı ile ~5,5 katı arası)
  function sunWindows(lat, lon) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const out = []; let cur = null;
    for (let m = 0; m <= 1440; m += 3) {
      const t = new Date(start.getTime() + m * 60000);
      const a = sunPos(t, lat, lon).alt;
      const ok = a >= 10 && a <= 65;
      if (ok && !cur) cur = { from: t };
      if (!ok && cur) { cur.to = t; out.push(cur); cur = null; }
    }
    return out;
  }

  function render() {
    const root = $('#v-qibla'); if (!root) return;
    const c = calc();
    if (!root.dataset.built) {
      root.dataset.built = '2';
      root.innerHTML = `
        <div id="qMain">
          <div class="qtop">
            <div class="qwrap"><div class="qdial-box">${dialSvg()}</div>
              <div class="qcenter"><b id="qTurn">—</b><small id="qSub"></small></div>
              <div class="level" title="Eğim göstergesi: kabarcık ortada olmalı"><i id="qBubble"></i></div>
            </div>
            <div id="qWarn" class="qwarn" hidden></div>
            <p id="qMsg" class="qmsg" hidden></p>
            <button id="qGo" class="btn primary qgo">🧭 Kıbleyi bul</button>
            <p class="qhint">Telefonu masaya koyar gibi <b>düz</b> tutun ve kendi etrafınızda yavaşça dönün. Kâbe simgesi üstteki sarı okun hizasına gelince telefon titrer ve halka yeşil olur.</p>
          </div>
          <div class="qgrid" id="qInfo"></div>
          <div class="qsun" id="qSunMini"></div>
          <button id="qGuideBtn" class="guide-card"><span class="gc-ic">📘</span><span class="gc-tx"><b>Doğru sonuç için yönergeler ve ayarlar</b><small>Konum, telefonu tutma, pusula ayarı, güneş ve gölge ile kontrol</small></span><span class="gc-go">›</span></button>
        </div>
        <div id="qGuide" hidden></div>`;
      root.addEventListener('click', (e) => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.id === 'qGo') { if (st.on) { stop(); render(); } else findQibla(); }
        else if (t.id === 'qGuideBtn') { page = 'guide'; render(); window.scrollTo(0, 0); g.NVNav?.sync(); }
        else if (t.id === 'qBack') { page = 'main'; render(); window.scrollTo(0, 0); g.NVNav?.sync(); }
        else if (t.id === 'qRelocate') findQibla(true);
        else if (t.id === 'qCal') calibrateSun(t);
        else if (t.id === 'qMih') { const c = calc(); measureOffset('mihrab', c ? c.q : 0, t, 'Telefonun üst kenarının mihraba baktığını'); }
        else if (t.id === 'qOffReset') { saveQ({ offset: 0 }); gstat.shadow = gstat.mihrab = null; render(); }
        else if (t.dataset.ref) { saveQ({ northRef: t.dataset.ref }); gstat.adv = ['good', '✓ Kaydedildi.']; render(); }
        else if (t.dataset.acc) {
          const id = t.dataset.acc; acc = acc === id ? null : id;
          if (acc && acc !== 'sun' && acc !== 'adv' && !st.on) start(); // dokunuş anında sensörü aç (iPhone izni)
          render();
          requestAnimationFrame(() => t.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
        else if (t.dataset.act === 'sensor') { start().then(() => render()); }
        else if (t.dataset.act === 'e8start') start8();
        else if (t.dataset.act === 'e8stop') { cal8.phase = 'idle'; render(); }
      });
    }
    $('#qMain').hidden = page !== 'main';
    $('#qGuide').hidden = page !== 'guide';
    const go = $('#qGo');
    go.textContent = finding ? '📍 Konum bulunuyor…' : (st.on ? '⏹ Pusulayı durdur' : '🧭 Kıbleyi bul');
    go.disabled = finding;
    go.classList.toggle('primary', !st.on);

    const src = !c ? '' : c.gd.src === 'gps' ? `GPS ile bulundu (±${Math.round(c.gd.acc || 0)} m)` : 'kayıtlı ilçenizin konumu';
    $('#qInfo').innerHTML = c ? `
      <div><small>Kıble açısı</small><b>${fmtDeg(c.q)}</b><i>kuzeyden saat yönünde</i></div>
      <div><small>Kâbe'ye uzaklık</small><b>${Math.round(c.dist).toLocaleString('tr-TR')} km</b><i>${src}</i></div>`
      : `<div class="wide"><b>Konum gerekli</b><i>“Kıbleyi bul”a basın; konumunuz otomatik bulunur.</i></div>`;
    if (c) {
      const face = sunAtAzimuth(c.gd.lat, c.gd.lon, c.q);
      $('#qSunMini').innerHTML = `<div class="qs-row"><span>☀️ Kıble saati: bu saatte <b>güneşe dönen kıbleye dönmüş olur</b></span><b>${face ? hm(face.time) : 'bugün yok'}</b></div>`;
    } else $('#qSunMini').innerHTML = '';
    if (page === 'guide') renderGuide(c);
    draw();
  }

  // ---------- yönergeler: yöntem seçimi + akordeon ----------
  let acc = null;                       // açık yöntem: eight | shadow | mihrab | sun | adv
  const cal8 = { phase: 'idle', bins: new Set(), bmin: 0, bmax: 0, gmin: 0, gmax: 0, t0: 0, res: '' };
  const gstat = {};                     // her bölümün durum mesajı
  const LIVE = `<div class="glive"><div class="glevel" title="Kabarcık"><i class="gl-dot"></i></div>
      <div class="gl-tx"><b class="g-flat">Sensör kapalı</b><small class="g-head">“Başlat”a basınca canlı gösterilir</small></div></div>`;
  const stat = (k) => gstat[k] ? `<p class="gmsg ${gstat[k][0]}">${gstat[k][1]}</p>` : '';
  function setStat(k, cls, html) { gstat[k] = cls ? [cls, html] : null; if (page === 'guide') renderGuide(calc()); }

  function ring8() {
    let p = '';
    for (let i = 0; i < 12; i++) {
      const a0 = (i * 30 + 2) * rad, a1 = (i * 30 + 28) * rad, R = 44;
      const x0 = 50 + R * Math.sin(a0), y0 = 50 - R * Math.cos(a0), x1 = 50 + R * Math.sin(a1), y1 = 50 - R * Math.cos(a1);
      p += `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" class="r8 ${cal8.bins.has(i) ? 'on' : ''}" data-b="${i}"/>`;
    }
    return `<svg viewBox="0 0 100 100" class="ring8">${p}<text x="50" y="47" class="r8p" id="r8p">%0</text><text x="50" y="62" class="r8s">tamamlandı</text></svg>`;
  }
  function prog8() {
    const tb = Math.min(1, (cal8.bmax - cal8.bmin) / 100), tg = Math.min(1, (cal8.gmax - cal8.gmin) / 100);
    return Math.min(1, 0.6 * cal8.bins.size / 12 + 0.2 * tb + 0.2 * tg);
  }

  function renderGuide(c) {
    const qs = qset(), now = new Date();
    const sec = (id, ic, title, sub, body) => `
      <section class="gacc ${acc === id ? 'open' : ''}">
        <button class="gacc-h" data-acc="${id}"><span class="gc-ic">${ic}</span><span class="gc-tx"><b>${title}</b><small>${sub}</small></span><span class="gacc-ar">${acc === id ? '▴' : '▾'}</span></button>
        ${acc === id ? `<div class="gacc-b">${body}</div>` : ''}
      </section>`;

    // Güneş bilgileri
    let sunInfo = '<p class="muted">Konum bulununca hesaplanır.</p>', winBlock = sunInfo, sNow = null;
    if (c) {
      sNow = sunPos(now, c.gd.lat, c.gd.lon);
      const face = sunAtAzimuth(c.gd.lat, c.gd.lon, c.q);
      const shadow = sunAtAzimuth(c.gd.lat, c.gd.lon, norm360(c.q + 180));
      const rel = diff180(c.q - sNow.az);
      sunInfo = `
        <div class="qs-row"><span>Kıble saati (güneşe dönün)</span><b>${face ? hm(face.time) : 'bugün yok'}</b></div>
        <div class="qs-row"><span>Gölgenin kıbleyi gösterdiği saat</span><b>${shadow ? hm(shadow.time) : 'bugün yok'}</b></div>
        ${sNow.alt > 3 ? `<p class="qs-hint">Şu an kıble, güneşin <b>${Math.abs(rel).toFixed(0)}° ${rel > 0 ? 'sağında' : 'solunda'}</b> kalıyor.</p>` : '<p class="qs-hint">Güneş şu an batmış durumda.</p>'}`;
      const wins = sunWindows(c.gd.lat, c.gd.lon);
      const winTxt = wins.length ? wins.map((w) => `${hm(w.from)} – ${hm(w.to)}`).join(' ve ') : 'bugün uygun saat yok';
      let live;
      if (sNow.alt <= 0.5) live = '<span class="bad">Güneş batmış; gölge yok. Uygun saatte tekrar deneyin.</span>';
      else {
        const ratio = 1 / Math.tan(sNow.alt * rad);
        live = sNow.alt >= 10 && sNow.alt <= 65 ? `<span class="good">Şu an gölge kalemin <b>${fmtX(ratio)} katı</b>: ölçüm için uygun ✓</span>`
          : sNow.alt < 10 ? `<span class="bad">Şu an gölge kalemin <b>${fmtX(ratio)} katı</b>, fazla uzun (güneş çok alçakta). Ölçebilirsiniz ama sonuç yanıltabilir.</span>`
          : `<span class="bad">Şu an gölge kalemin <b>${fmtX(ratio)} katı</b>, fazla kısa (güneş tepede). Biraz bekleyin.</span>`;
      }
      winBlock = `<div class="qwhen"><b>Ne zaman?</b>
          <p>Gölge, kalemin boyunun <b>yarısından uzun, 5,5 katından kısa</b> olmalı.</p>
          <p>Bugün uygun saatler: <b>${winTxt}</b></p><p class="live">${live}</p></div>`;
    }
    const offTxt = `<p class="qstat">Kayıtlı düzeltme: <b>${qs.offset ? (qs.offset > 0 ? '+' : '') + fmtDeg(qs.offset) : 'yok'}</b> ${qs.offset ? '<button class="btn sm" id="qOffReset">Sıfırla</button>' : ''}</p>`;
    const startBtn = st.on ? '' : '<button class="btn" data-act="sensor">▶️ Pusulayı başlat (canlı gösterge)</button>';

    // 8 çizme
    let e8;
    if (cal8.phase === 'idle' || cal8.phase === 'done') {
      e8 = `${cal8.res}<button class="btn primary" data-act="e8start">${cal8.phase === 'done' ? '🔁 Yeniden ayarla' : '▶️ Ayarı başlat'}</button>`;
    } else if (cal8.phase === 'run') {
      e8 = `<div class="e8run">${ring8()}<p><b>Şimdi havada yavaşça 8 çizin.</b> Bilek ile telefonu öne-arkaya ve sağa-sola da çevirin. Halkanın tüm parçaları yeşil olunca ayar biter.</p></div>
        <button class="btn" data-act="e8stop">Vazgeç</button>`;
    } else {
      e8 = `<div class="e8run"><div class="bigcount" id="e8cnt">3</div><p><b>Telefonu masaya koyar gibi düz tutun ve kıpırdatmayın.</b> Pusulanın oturduğu ölçülüyor…</p></div>`;
    }

    $('#qGuide').innerHTML = `
      <div class="vr-bar"><button class="btn sm" id="qBack">‹ Kıble</button><b class="qg-title">Yönergeler ve ayarlar</b><span></span></div>

      <section class="qg"><h3><span class="qn">1</span>Konumunuz</h3>
        <p>Konum <b>otomatik</b> bulunur; bir şey yazmanız gerekmez. İzin sorulursa <b>İzin ver</b> deyin.</p>
        <p class="qstat">${c ? (c.gd.src === 'gps' ? `✓ GPS ile bulundu (±${Math.round(c.gd.acc || 0)} m)${c.gd.ts ? ', saat ' + hm(new Date(c.gd.ts)) : ''}` : '⚠️ GPS konumu yok; kayıtlı ilçenizin konumu kullanılıyor.') : '⚠️ Henüz konum bulunmadı.'}</p>
        ${stat('loc')}
        <button class="btn" id="qRelocate" ${finding ? 'disabled' : ''}>${finding ? '📍 Konum bulunuyor…' : '📍 Konumu yeniden bul'}</button></section>

      <section class="qg"><h3><span class="qn">2</span>Her ölçümden önce</h3>
        ${SVG_FLAT}
        <ul><li>Telefonu <b>masaya koyar gibi düz</b> tutun: aşağıdaki kabarcık <b>yeşil ve ortada</b> olmalı.</li>
          <li><b>Mıknatıslı kılıfı</b> çıkarın; araba, demir masa, buzdolabı, hoparlör ve bilgisayardan <b>yarım metre</b> uzak durun.</li></ul>
        ${LIVE}${startBtn}</section>

      <h3 class="gq"><span class="qn">3</span>Hangi yöntemle ayar yapmak istersiniz?</h3>
      <p class="muted gq-sub">Birini seçin; açılan bölümdeki adımları sırayla yapıp düğmeye basın.</p>

      ${sec('eight', '♾️', '8 çizerek pusulayı ayarla', 'Her yerde, 30 saniye. “Sinyal oynak” uyarısında ilk bu.', `
        ${SVG_EIGHT}
        <ol class="qsteps"><li>Aşağıdaki <b>“Ayarı başlat”</b> düğmesine basın.</li>
          <li>Telefonu elinizde tutup havada <b>yavaşça 8 çizin</b>; bileğinizi de çevirin. Halka dolana kadar devam edin.</li>
          <li>Sonra telefonu <b>3 saniye düz</b> tutun; sonuç ekranda yazar.</li></ol>
        ${LIVE}${e8}${stat('eight')}`)}

      ${sec('shadow', '📏', 'Güneşin gölgesiyle düzelt', 'En doğru yöntem. Güneşli bir saatte, bir kalem yeterli.', `
        <p>Pusula birkaç derece şaşıyorsa gölge ile <b>bir kez</b> düzeltin; uygulama farkı kaydeder ve hep düzeltilmiş yönü gösterir.</p>
        ${winBlock}${SVG_SHADOW}
        <ol class="qsteps">
          <li>Güneş alan <b>düz bir zemine</b> bir kalemi <b>dik</b> sabitleyin (hamur, bant ya da kitap arası).</li>
          <li>Telefonu ekranı yukarı bakacak şekilde <b>yatırın</b>; <b>şarj girişi olan alt kenarı kalemin dibine</b> dayayın.</li>
          <li><b>Üst kenar gölgenin ucuna</b> baksın; gölge telefonun ortasından boydan boya geçsin.</li>
          <li>Telefona dokunmadan <b>“Ölç ve kaydet”</b>e basın, 3 saniye bekleyin.</li></ol>
        ${LIVE}
        <button class="btn primary" id="qCal">📏 Ölç ve kaydet</button>${stat('shadow')}${offTxt}`)}

      ${sec('mihrab', '🕌', 'Caminin kıblesine göre düzelt', 'Camideyseniz: mihraba bakarak bir kez kaydedin.', `
        <ol class="qsteps">
          <li>Camide <b>mihraba doğru</b> durun.</li>
          <li>Telefonu yere ya da rahleye <b>düz</b> koyun; <b>üst kenarı mihraba</b> baksın (halı çizgilerine paralel).</li>
          <li><b>“Kıble yönünü kaydet”</b>e basın ve 3 saniye dokunmayın.</li></ol>
        ${LIVE}
        <button class="btn primary" id="qMih">🕌 Kıble yönünü kaydet</button>${stat('mihrab')}${offTxt}`)}

      ${sec('sun', '☀️', 'Güneşle kontrol (ayar gerekmez)', 'Pusulasız: kıble saatinde güneşe dönün.', `
        <p><b>Kıble saatinde güneşe dönerseniz kıbleye dönmüş olursunuz.</b> Gölgenin kıbleyi gösterdiği saatte ise gölgenin uzandığı yön kıbledir.</p>
        <div class="qsun">${sunInfo}</div>`)}

      ${sec('adv', '⚙️', 'İleri ayar: pusula türü', 'Emin değilseniz dokunmayın.', `
        <p>Telefonların çoğu <b>manyetik kuzeyi</b> gösterir; uygulama aradaki farkı kendisi ekler. Telefonunuz zaten gerçek kuzeyi veriyorsa ikinciyi seçin. Gölge veya cami ile düzeltme yaptıysanız bu fark zaten düzelmiştir.</p>
        <div class="seg"><button data-ref="mag" class="${qs.northRef === 'mag' ? 'on' : ''}">Önerilen</button><button data-ref="true" class="${qs.northRef === 'true' ? 'on' : ''}">Telefon gerçek kuzey veriyor</button></div>
        ${stat('adv')}
        ${c ? `<p class="muted small">Bu konumda manyetik fark: ${c.decl > 0 ? '+' : ''}${fmtDeg(c.decl)} · Klasik pusulada kıble: ${fmtDeg(norm360(c.q - c.decl))}</p>` : ''}`)}
      `;
    drawGuide();
  }

  // Ölçüm: telefonun üst kenarı targetAz yönüne bakarken pusula farkını kaydeder
  let measuring = false;
  async function measureOffset(key, targetAz, btn, label) {
    if (measuring) return;
    const c = calc();
    if (!c) { setStat(key, 'bad', 'Önce konum bulunmalı. Yukarıdaki <b>“Konumu yeniden bul”</b>a basın.'); return; }
    measuring = true;
    if (!st.on) await start();
    btn.disabled = true;
    st.samples = [];
    for (let i = 3; i > 0; i--) { btn.textContent = `⏳ Ölçülüyor… ${i}  (telefona dokunmayın)`; await new Promise((r) => setTimeout(r, 1000)); }
    measuring = false;
    if (st.raw == null || st.heading == null || Date.now() - st.lastEvent > 2000) {
      setStat(key, 'bad', 'Pusula verisi alınamadı. Telefonun <b>hareket/yön sensörü</b> izni kapalı olabilir ya da bu cihazda pusula yok.'); return;
    }
    const tilt = Math.max(Math.abs(st.beta), Math.abs(st.gamma));
    if (tilt > 15) { setStat(key, 'bad', `Telefon düz değildi (eğim ${tilt.toFixed(0)}°). Düz bir zemine koyup tekrar deneyin.`); return; }
    const qs = qset();
    let base = st.heading; if (qs.northRef === 'mag') base += c.decl;
    const off = diff180(targetAz - base);
    if (Math.abs(off) > 25) {
      setStat(key, 'bad', `Ölçülen fark çok büyük (${fmtDeg(off)}). ${label} ve yakında metal olmadığını kontrol edip tekrar deneyin. Önce “8 çizerek ayarla” da yapabilirsiniz.`); return;
    }
    const j = jitter();
    saveQ({ offset: Math.round(off * 10) / 10 });
    g.NVFX?.vibrate([60, 60, 60]);
    setStat(key, 'good', `✓ Kaydedildi. Pusulanız <b>${fmtDeg(Math.abs(off))}</b> ${off > 0 ? 'eksik' : 'fazla'} gösteriyormuş; artık düzeltilmiş yön gösterilecek.${j > 4 ? ' (Sinyal biraz oynaktı; isterseniz bir kez daha ölçün.)' : ''}`);
  }
  function calibrateSun(btn) {
    const c = calc(); if (!c) return measureOffset('shadow', 0, btn, '');
    const s = sunPos(new Date(), c.gd.lat, c.gd.lon);
    if (s.alt <= 0.5) { setStat('shadow', 'bad', 'Güneş batmış; gölge yok. Yukarıda yazan uygun saatlerde tekrar deneyin.'); return; }
    measureOffset('shadow', norm360(s.az + 180), btn, 'Şarj girişinin kalem tarafında, üst kenarın gölgenin ucuna baktığını');
  }

  // 8 çizme ayarı
  async function start8() {
    gstat.eight = null;
    if (!st.on) await start();
    Object.assign(cal8, { phase: 'run', bins: new Set(), bmin: st.beta || 0, bmax: st.beta || 0, gmin: st.gamma || 0, gmax: st.gamma || 0, t0: Date.now(), res: '' });
    renderGuide(calc());
  }
  async function settle8() {
    cal8.phase = 'settle'; renderGuide(calc());
    g.NVFX?.vibrate([40]);
    for (let i = 3; i > 0; i--) { const e = $('#e8cnt'); if (e) e.textContent = i; await new Promise((r) => setTimeout(r, 1000)); if (cal8.phase !== 'settle') return; }
    const j = jitter(), tilt = Math.max(Math.abs(st.beta), Math.abs(st.gamma));
    const iosBad = st.kind === 'ios' && (st.acc == null || st.acc < 0 || st.acc > 20);
    cal8.phase = 'done';
    if (j <= 4 && !iosBad && tilt < 20) {
      cal8.res = `<p class="gmsg good">✓ Pusula ayarlandı. Sinyal sakin (±${j.toFixed(0)}°). Şimdi kıble ekranına dönüp kullanabilirsiniz; daha da kesin sonuç için <b>gölge</b> ya da <b>cami</b> yöntemiyle bir kez düzeltin.</p>`;
      g.NVFX?.vibrate([60, 60, 60]);
    } else {
      cal8.res = `<p class="gmsg bad">Sinyal hâlâ oynak (±${j.toFixed(0)}°${tilt >= 20 ? ', telefon düz değildi' : ''}). Metal ve mıknatıstan uzaklaşıp bir kez daha deneyin; pencere kenarı veya dışarısı daha iyidir.</p>`;
    }
    renderGuide(calc());
  }
  function track8(raw) {
    if (cal8.phase !== 'run') return;
    const b = Math.floor(norm360(raw) / 30) % 12;
    if (!cal8.bins.has(b)) { cal8.bins.add(b); const el = document.querySelector(`.ring8 [data-b="${b}"]`); if (el) el.classList.add('on'); }
    cal8.bmin = Math.min(cal8.bmin, st.beta); cal8.bmax = Math.max(cal8.bmax, st.beta);
    cal8.gmin = Math.min(cal8.gmin, st.gamma); cal8.gmax = Math.max(cal8.gmax, st.gamma);
    const p = prog8(), pe = $('#r8p'); if (pe) pe.textContent = '%' + Math.round(p * 100);
    if (p >= 1 && Date.now() - cal8.t0 > 6000) settle8();
  }

  // Yönergeler sayfasındaki canlı göstergeler
  function drawGuide() {
    if (page !== 'guide') return;
    const tilt = Math.max(Math.abs(st.beta), Math.abs(st.gamma));
    const live = st.on && Date.now() - st.lastEvent < 2000;
    const tx = Math.max(-1, Math.min(1, st.gamma / 30)) * 16, ty = Math.max(-1, Math.min(1, st.beta / 30)) * 16;
    document.querySelectorAll('.gl-dot').forEach((d) => { d.style.transform = `translate(${tx}px, ${ty}px)`; d.classList.toggle('ok', live && tilt < 8); });
    const j = jitter();
    document.querySelectorAll('.g-flat').forEach((e) => {
      e.textContent = !st.on ? 'Sensör kapalı' : !live ? 'Sensör bekleniyor…' : tilt < 8 ? '✓ Düz' : `Eğik (${tilt.toFixed(0)}°) — düzeltin`;
      e.className = 'g-flat ' + (live ? (tilt < 8 ? 'good' : 'bad') : '');
    });
    document.querySelectorAll('.g-head').forEach((e) => {
      e.textContent = !st.on ? '“Başlat”a basınca canlı gösterilir' : (st.heading == null ? 'Pusula verisi bekleniyor…'
        : `Yön ${fmtDeg(trueHeading(st.heading), 0)} · sinyal ${st.samples.length < 10 ? '…' : j <= 4 ? 'sakin ✓' : 'oynak (±' + j.toFixed(0) + '°)'}`);
    });
  }

  let page = 'main';
  let lastAlignVib = 0;
  function draw() {
    drawGuide();
    const c = calc(); const rose = $('#qRose'); if (!rose) return;
    const mark = $('#qMark');
    if (c) mark.setAttribute('transform', `rotate(${c.q} 150 150)`); else mark.setAttribute('transform', 'scale(0)');
    const turn = $('#qTurn'), sub = $('#qSub'), warn = $('#qWarn'), box = $('.qwrap');
    const bub = $('#qBubble');
    const tiltX = Math.max(-1, Math.min(1, st.gamma / 30)), tiltY = Math.max(-1, Math.min(1, st.beta / 30));
    bub.style.transform = `translate(${tiltX * 18}px, ${tiltY * 18}px)`;
    const tilt = Math.max(Math.abs(st.beta), Math.abs(st.gamma));
    bub.classList.toggle('ok', tilt < 10);

    if (!st.on || st.heading == null || !c) {
      rose.style.transform = 'rotate(0deg)';
      box.classList.remove('aligned');
      turn.textContent = c ? fmtDeg(c.q) : '—';
      sub.textContent = c ? (st.on ? 'sensör bekleniyor…' : 'kıble açısı · “Kıbleyi bul”a basın') : '“Kıbleyi bul”a basın';
      warn.hidden = true;
      return;
    }
    const h = trueHeading(st.heading);
    rose.style.transform = `rotate(${-h}deg)`;
    const d = diff180(c.q - h);
    const ok = Math.abs(d) <= 3;
    box.classList.toggle('aligned', ok);
    turn.textContent = ok ? 'Kıble ✓' : `${Math.abs(d).toFixed(0)}° ${d > 0 ? 'sağa' : 'sola'}`;
    sub.textContent = `telefon ${fmtDeg(h, 0)} · kıble ${fmtDeg(c.q, 0)}`;
    if (ok && !st.aligned && Date.now() - lastAlignVib > 2500) { g.NVFX?.vibrate([40]); lastAlignVib = Date.now(); }
    st.aligned = ok;

    // Uyarılar
    const w = [];
    if (tilt > 20) w.push('📱 Telefonu yere paralel tutun (eğim ' + tilt.toFixed(0) + '°).');
    const j = jitter();
    if (st.kind === 'ios' && (st.acc == null || st.acc < 0 || st.acc > 20)) w.push('🧭 Pusula hassasiyeti düşük (±' + (st.acc > 0 ? st.acc.toFixed(0) : '?') + '°). Telefonu 8 çizer gibi döndürün.');
    else if (j > 6 && tilt <= 20) w.push('🧲 Sinyal oynak (±' + j.toFixed(0) + '°). Metal/mıknatıstan uzaklaşın, 8 çizerek kalibre edin.');
    if (Date.now() - st.lastEvent > 2000) w.push('Sensör verisi gelmiyor.');
    warn.hidden = !w.length; warn.innerHTML = w.join('<br>');
  }

  g.NVQibla = {
    render, show() { render(); }, hide() { stop(); page = 'main'; cal8.phase = 'idle'; },
    canBack: () => page !== 'main',
    back() { page = 'main'; render(); window.scrollTo(0, 0); },
    _t: { qiblaBearing, distanceKm, sunPos, sunAtAzimuth },
  };
})(window);
