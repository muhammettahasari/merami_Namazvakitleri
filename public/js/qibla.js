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
  const geo = () => S().settings.geo || null;
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
    setTimeout(() => { if (st.on && !st.lastEvent) msg('Bu cihazda pusula sensörü verisi alınamadı. Aşağıdaki güneş yöntemini kullanın.'); }, 3500);
    draw();
  }
  function stop() {
    st.on = false;
    g.removeEventListener('deviceorientationabsolute', onOrient);
    g.removeEventListener('deviceorientation', onOrient);
    clearInterval(st.timer);
  }

  function msg(t) { const m = $('#qMsg'); if (m) { m.textContent = t; m.hidden = !t; } }

  function locate() {
    if (!navigator.geolocation) { msg('Bu tarayıcı konum desteklemiyor; koordinatları elle girin.'); return; }
    msg('Konum alınıyor…');
    navigator.geolocation.getCurrentPosition((p) => {
      saveGeo({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, alt: p.coords.altitude || 0, ts: Date.now(), src: 'gps' });
      msg(''); render();
    }, (e) => {
      msg(e.code === 1 ? 'Konum izni verilmedi. Tarayıcı ayarlarından izin verin veya koordinat girin.' : 'Konum alınamadı (' + e.message + '). Açık alanda tekrar deneyin veya koordinat girin.');
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  }

  // ---------- çizim ----------
  const fmtDeg = (a, d = 1) => (a == null ? '—' : a.toFixed(d).replace('.', ',') + '°');
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

  function render() {
    const root = $('#v-qibla'); if (!root) return;
    const c = calc(), qs = qset();
    if (!root.dataset.built) {
      root.dataset.built = '1';
      root.innerHTML = `
        <div class="qtop">
          <div class="qwrap"><div class="qdial-box">${dialSvg()}</div>
            <div class="qcenter"><b id="qTurn">—</b><small id="qSub"></small></div>
            <div class="level" title="Eğim göstergesi: kabarcık ortada olmalı"><i id="qBubble"></i></div>
          </div>
          <div id="qWarn" class="qwarn" hidden></div>
          <p id="qMsg" class="qmsg" hidden></p>
          <div class="qbtns"><button id="qStart" class="btn primary">Pusulayı başlat</button><button id="qLoc" class="btn">Konumumu bul</button></div>
        </div>
        <div class="qgrid" id="qInfo"></div>
        <h2 class="sec">Güneş ile doğrula <small>sensörsüz, en güvenilir yöntem</small></h2>
        <div class="qsun" id="qSun"></div>
        <details class="howto"><summary>Doğru sonuç için yönergeler</summary><ol class="tips">
          <li><b>Telefonu yere paralel, düz tutun.</b> Eğim göstergesindeki kabarcık ortada (yeşil) olmalı.</li>
          <li><b>Metal ve mıknatıstan uzak durun:</b> mıknatıslı kılıf/kapak, araba, demir masa, hoparlör, laptop, prizler. En az 50 cm.</li>
          <li><b>Kalibrasyon:</b> “Sinyal oynak” veya “kalibrasyon” uyarısında telefonu havada birkaç kez <b>8</b> çizer gibi döndürün.</li>
          <li><b>Konum izni verin.</b> Kıble açısı ve manyetik sapma konumunuza göre hesaplanır (Türkiye'de sapma yaklaşık +5° ile +7°).</li>
          <li><b>Bina içinde</b> betondaki demirler pusulayı saptırabilir; pencere kenarında veya açık alanda kontrol edin.</li>
          <li><b>Güneşle doğrulayın:</b> “Kıble saati”nde güneşe dönen kişi kıbleye dönmüş olur. Gölge yöntemiyle pusulayı da kalibre edebilirsiniz.</li>
        </ol></details>
        <h2 class="sec">Konum ve ayar</h2>
        <div class="field"><span>Koordinat</span><span class="coord"><input id="qLat" inputmode="decimal" placeholder="Enlem"><input id="qLon" inputmode="decimal" placeholder="Boylam"><button id="qSet" class="btn sm">Kaydet</button></span></div>
        <div class="field"><span>Pusula kuzeyi<small>Cihazınız gerçek kuzey veriyorsa “Gerçek” seçin. Emin değilseniz güneşle kalibre edin.</small></span>
          <div class="seg" id="qRef"><button data-v="mag">Manyetik + sapma</button><button data-v="true">Gerçek</button></div></div>
        <div class="field"><span>Kalibrasyon farkı<small id="qOffTxt"></small></span><button id="qOffReset" class="btn sm">Sıfırla</button></div>`;
      $('#qStart').onclick = () => (st.on ? (stop(), render()) : start().then(render));
      $('#qLoc').onclick = locate;
      $('#qSet').onclick = () => {
        const la = parseFloat($('#qLat').value.replace(',', '.')), lo = parseFloat($('#qLon').value.replace(',', '.'));
        if (!(Math.abs(la) <= 90 && Math.abs(lo) <= 180)) { msg('Geçerli bir enlem/boylam girin (ör. 38,88 ve 37,67).'); return; }
        saveGeo({ lat: la, lon: lo, acc: null, alt: 0, ts: Date.now(), src: 'manual' }); msg(''); render();
      };
      $('#qRef').onclick = (e) => { const b = e.target.closest('button'); if (b) { saveQ({ northRef: b.dataset.v }); render(); } };
      $('#qOffReset').onclick = () => { saveQ({ offset: 0 }); render(); };
      root.addEventListener('click', (e) => { if (e.target.id === 'qCal') calibrateSun(); });
    }
    $('#qStart').textContent = st.on ? 'Pusulayı durdur' : 'Pusulayı başlat';
    document.querySelectorAll('#qRef button').forEach((b) => b.classList.toggle('on', b.dataset.v === qs.northRef));
    $('#qOffTxt').textContent = qs.offset ? `${qs.offset > 0 ? '+' : ''}${fmtDeg(qs.offset)} (güneşle ölçüldü)` : 'yok';
    if (c && c.gd.src === 'manual' && !$('#qLat').value) { $('#qLat').value = c.gd.lat; $('#qLon').value = c.gd.lon; }

    $('#qInfo').innerHTML = c ? `
      <div><small>Kıble açısı</small><b>${fmtDeg(c.q)}</b><i>gerçek kuzeyden</i></div>
      <div><small>Manyetik sapma</small><b>${c.decl > 0 ? '+' : ''}${fmtDeg(c.decl)}</b><i>WMM-2025</i></div>
      <div><small>Kâbe'ye uzaklık</small><b>${Math.round(c.dist).toLocaleString('tr-TR')} km</b><i>${c.gd.src === 'gps' ? 'GPS ±' + Math.round(c.gd.acc || 0) + ' m' : 'elle girildi'}</i></div>
      <div><small>Manyetik pusulada</small><b>${fmtDeg(norm360(c.q - c.decl))}</b><i>klasik pusula için</i></div>`
      : `<div class="wide"><b>Konum gerekli</b><i>“Konumumu bul”a basın veya koordinat girin.</i></div>`;
    renderSun(c);
    draw();
  }

  function renderSun(c) {
    const el = $('#qSun'); if (!el) return;
    if (!c) { el.innerHTML = '<p class="muted">Konum girildiğinde güneş yöntemi hesaplanır.</p>'; return; }
    const now = new Date(), s = sunPos(now, c.gd.lat, c.gd.lon);
    const face = sunAtAzimuth(c.gd.lat, c.gd.lon, c.q);
    const shadow = sunAtAzimuth(c.gd.lat, c.gd.lon, norm360(c.q + 180));
    const rel = diff180(c.q - s.az);
    const up = s.alt > 3;
    el.innerHTML = `
      <div class="qs-row"><span>☀️ Kıble saati (güneşe dönün)</span><b>${face ? hm(face.time) : 'bugün yok'}</b></div>
      <div class="qs-row"><span>Gölge kıbleyi gösterir</span><b>${shadow ? hm(shadow.time) : 'bugün yok'}</b></div>
      <div class="qs-row"><span>Güneş şu an</span><b>${up ? `${fmtDeg(s.az, 0)} · yükseklik ${fmtDeg(s.alt, 0)}` : 'ufkun altında'}</b></div>
      ${up ? `<div class="qs-hint">Kıble, güneşin <b>${Math.abs(rel).toFixed(0)}° ${rel > 0 ? 'sağında' : 'solunda'}</b>.</div>` : ''}
      <div class="qs-cal">
        <p><b>Gölge ile pusula kalibrasyonu</b> (güneşli havada, güneş 10°–65° yüksekteyken): Telefonu düz bir zemine koyun. Yanına dik tuttuğunuz bir kalemin gölgesine telefonun uzun kenarını hizalayın; <b>telefonun üst kenarı gölgenin ucunu</b> göstersin. Pusula açıkken “Ölç”e basın.</p>
        <button id="qCal" class="btn sm" ${up && s.alt >= 10 && s.alt <= 65 ? '' : 'disabled'}>Ölç ve kalibre et</button>
      </div>`;
  }

  function calibrateSun() {
    const c = calc(); if (!c) return;
    if (!st.on || st.raw == null) { msg('Önce pusulayı başlatın.'); return; }
    const s = sunPos(new Date(), c.gd.lat, c.gd.lon);
    const shadowAz = norm360(s.az + 180);
    const qs = qset();
    let base = st.heading; if (qs.northRef === 'mag') base += c.decl; // ofsetsiz yön
    const off = diff180(shadowAz - base);
    if (Math.abs(off) > 25) { msg(`Ölçülen fark çok büyük (${off.toFixed(1)}°). Hizalamayı ve metal yakınlığını kontrol edip tekrar deneyin.`); return; }
    saveQ({ offset: Math.round(off * 10) / 10 });
    msg(`Kalibrasyon kaydedildi: ${off > 0 ? '+' : ''}${off.toFixed(1)}°`);
    render();
  }

  let lastAlignVib = 0;
  function draw() {
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
      sub.textContent = c ? (st.on ? 'sensör bekleniyor…' : 'kıble açısı · pusulayı başlatın') : 'konum gerekli';
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
    render, show() { render(); }, hide() { stop(); },
    _t: { qiblaBearing, distanceKm, sunPos, sunAtAzimuth },
  };
})(window);
