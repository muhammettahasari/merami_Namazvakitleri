(function () {
  'use strict';
  const NV = window.NV, { STYLES } = window.NVW;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const APP_VER = '1.8';
  let view = 'home';
  let syncing = false;

  // ---------- tema ----------
  function applyTheme() {
    const t = NV.load().settings.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('is-dark', dark);
    const mc = document.querySelector('meta[name="theme-color"]'); if (mc) mc.content = dark ? '#0d1620' : '#f5f2ea';
  }

  function toast(msg, ms = 2600) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
  }

  function netBar() {
    const n = $('#netStatus');
    if (navigator.onLine) { n.hidden = true; return; }
    n.hidden = false; n.textContent = 'Çevrimdışı — kayıtlı vakitler gösteriliyor';
  }

  // ---------- VAKİTLER ----------
  function renderHome() {
    const s = NV.load(); const loc = NV.activeLoc(s);
    $('#locName').textContent = loc ? loc.label : 'Konum seçin';
    if (!loc) {
      $('#hero').innerHTML = `<div class="welcome"><h1>Hoş geldiniz</h1><p>Diyanet ve Fazilet vakitlerini alt alta görmek için yaşadığınız ili seçin.</p><button class="btn primary" id="wAdd">İl seç</button></div>`;
      $('#cmp').innerHTML = ''; $('#list').innerHTML = ''; $('#dMiladi').textContent = NV.fmtDate(NV.iso(new Date())); $('#dHicri').textContent = '';
      $('#wAdd').onclick = openAdd;
      return;
    }
    const now = new Date();
    const m = NV.model(loc, now);
    const top = s.settings.appTop === 'fazilet' ? 'f' : 'd';
    const bot = top === 'd' ? 'f' : 'd';
    const NAME = { d: 'Diyanet', f: 'Fazilet' }, CLS = { d: 'dy', f: 'fz' };
    $('#dMiladi').textContent = NV.fmtDate(m.today);
    $('#dHicri').textContent = m.hicri;
    $('#topLbl').textContent = NAME[top];
    const src = m[top] || m[bot];
    if (src) {
      const t = (hm) => new Date(`${m.today}T${hm}:00`);
      const day = now >= t(src.gunes) && now < t(src.aksam);
      const mins = Math.max(0, Math.round((t(src.aksam) - now) / 60000));
      const left = (mins >= 60 ? Math.floor(mins / 60) + ' sa ' : '') + (mins % 60) + ' dk';
      $('#dayPhase').innerHTML = day ? `☀️ Gündüz <small>akşama ${left}</small>` : '🌙 Gece';
      $('#dayPhase').dataset.tip = day ? 'Güneş doğdu, akşam vaktine kadar gündüz.' : 'Akşam vakti girdi; güneş doğana kadar gece. Teheccüd gecenin son üçte birindedir.';
    }

    if (!m.hasData) {
      $('#hero').innerHTML = `<div class="welcome"><p>Bugün için kayıtlı vakit yok.</p><p class="muted">${navigator.onLine ? 'Güncelleniyor…' : 'İnternete bağlanınca otomatik güncellenecek.'}</p></div>`;
      $('#cmp').innerHTML = ''; $('#list').innerHTML = '';
      return;
    }

    // Kahraman kart: sıradaki vakit
    const nm = (e, s) => !e ? '—' : (s === 'd' && e.raw === 'imsak') ? 'İmsak' : NV.LABEL[e.raw];
    const nt = m.next[top], nb = m.next[bot];
    $('#hero').innerHTML = `
      <div class="hero-in ${CLS[top]}">
        <small>${NAME[top]} · sıradaki</small>
        <div class="hn">${nm(nt, top)} <span>${nt?.hm || ''}</span></div>
        <div class="cd" data-to="${nt ? nt.time.getTime() : ''}">${nt ? NV.countdown(nt.time, now) : '—'}</div>
      </div>
      <div class="hero-sub ${CLS[bot]}${bot === 'f' && m.f?.est ? ' est' : ''}">
        <span>${NAME[bot]}</span><b>${nm(nb, bot)} ${nb?.hm || '—'}</b>
        <span class="cd" data-to="${nb ? nb.time.getTime() : ''}">${nb ? NV.countdown(nb.time, now) : ''}</span>
      </div>`;

    // Karşılaştırma tablosu (widget "tablo" ile aynı yapı, ana ekran sırası)
    $('#cmp').innerHTML = STYLES.tablo.render(m, s.settings.appTop, now, 'big');

    // Vakit kartları: her vakitte üst kaynak üstte, diğeri altta
    const est = (src) => (src === 'f' && m.f?.est ? ' est' : '');
    const val = (src, k) => m[src]?.[k] || '—';
    const diff = (a, b) => {
      const x = NV.toMin(a), y = NV.toMin(b);
      if (x == null || y == null) return '';
      const d = y - x; return d === 0 ? '=' : (d > 0 ? '+' : '−') + Math.abs(d) + ' dk';
    };
    const rows = [
      { k: 'sabah', l: 'Sabah', sub: 'Diyanet İmsak · Fazilet Sabah', d: val('d', 'imsak'), f: val('f', 'sabah') },
      { k: 'ogle', l: 'Öğle', d: val('d', 'ogle'), f: val('f', 'ogle') },
      { k: 'ikindi', l: 'İkindi', d: val('d', 'ikindi'), f: val('f', 'ikindi') },
      { k: 'aksam', l: 'Akşam', d: val('d', 'aksam'), f: val('f', 'aksam') },
      { k: 'yatsi', l: 'Yatsı', d: val('d', 'yatsi'), f: val('f', 'yatsi') },
    ];
    const card = (r) => {
      const lines = [top, bot].map((src) => `<div class="ln ${CLS[src]}${est(src)}" data-tip="${src === 'd' ? 'Mavi = Diyanet' : 'Yeşil = Fazilet'}${est(src) ? ' (≈ tahmini)' : ''}"><span>${NAME[src]}</span><b>${r[src]}</b></div>`).join('');
      return `<div class="card${m.cur.col === r.k ? ' on' : ''}"><div class="cl"><b>${r.l}</b>${r.sub ? `<small>${r.sub}</small>` : ''}<em>${diff(r[top], r[bot])}</em></div><div class="cv">${lines}</div></div>`;
    };
    const extra = `<div class="card extra"><div class="cl"><b>Fazilet ek</b><small>sabah bölümü</small></div><div class="cv">
        <div class="ln fz${est('f')}"><span>İmsak</span><b>${val('f', 'imsak')}</b></div>
        <div class="ln fz${est('f')}"><span>Sabah</span><b>${val('f', 'sabah')}</b></div>
        <div class="ln fz${est('f')}"><span>Güneş</span><b>${val('f', 'gunes')}</b></div>
        <div class="ln dy"><span>Diyanet Güneş</span><b>${val('d', 'gunes')}</b></div></div></div>`;
    const teh = `<div class="card teh"><div class="cl"><b>Teheccüd</b><small>gecenin son üçte biri</small></div><div class="cv">
        ${[top, bot].map((src) => `<div class="ln ${CLS[src]}${est(src)}"><span>${NAME[src]}</span><b>${m.teh[src]?.text || '—'}</b></div>`).join('')}</div></div>`;
    $('#list').innerHTML = rows.map(card).join('') + teh + extra;
  }

  // Saniyelik geri sayım (tam yeniden çizim dakikada bir)
  function tick() {
    const now = Date.now();
    $$('.cd[data-to]').forEach((el) => { const to = +el.dataset.to; if (to) el.textContent = NV.countdown(new Date(to), new Date(now)); });
    if ($$('.cd[data-to]').some((el) => +el.dataset.to && +el.dataset.to <= now)) render();
    if (view === 'wg' && !document.hidden && Date.now() % 15000 < 1000) renderGallery();
  }

  // ---------- İMSAKİYE ----------
  function renderCal() {
    const s = NV.load(); const loc = NV.activeLoc(s);
    if (!loc) { $('#cal').innerHTML = '<p class="muted">Önce konum ekleyin.</p>'; $('#calInfo').textContent = ''; return; }
    const data = NV.loadLoc(loc.id);
    const today = NV.iso(new Date());
    const days = Object.keys(data.d || {}).concat(Object.keys(data.f || {})).filter((d) => d >= today);
    const uniq = [...new Set(days)].sort().slice(0, 60);
    const realF = Object.keys(data.f || {}).filter((d) => d >= today).length;
    $('#calInfo').textContent = `Diyanet ${Object.keys(data.d || {}).filter((d) => d >= today).length} gün · Fazilet ${realF} gün (gerçek)`;
    const top = s.settings.appTop === 'fazilet' ? ['f', 'd'] : ['d', 'f'];
    const C = { d: 'dy', f: 'fz' };
    const head = `<div class="cr ch"><span>Tarih</span><span></span><span>Sabah</span><span>Öğle</span><span>İkindi</span><span>Akşam</span><span>Yatsı</span></div>`;
    const body = uniq.map((day) => {
      const { d, f } = NV.dayData(data, day, s.settings.estimate);
      const line = (src, x) => `<div class="cr ${C[src]}${x?.est ? ' est' : ''}${day === today ? ' today' : ''}"><span>${src === top[0] ? NV.fmtShort(day) : ''}</span><span class="tag">${src === 'd' ? 'D' : 'F'}</span>
        <span>${x ? (src === 'd' ? x.imsak : x.sabah) : '—'}</span><span>${x?.ogle || '—'}</span><span>${x?.ikindi || '—'}</span><span>${x?.aksam || '—'}</span><span>${x?.yatsi || '—'}</span></div>`;
      const X = { d, f };
      return `<div class="cg">${line(top[0], X[top[0]])}${line(top[1], X[top[1]])}</div>`;
    }).join('');
    $('#cal').innerHTML = head + body;
  }

  // ---------- WIDGET ----------
  const NATIVE_WG = ['tablo', 'kompakt', 'serit', 'liste'];
  function renderGallery() {
    const s = NV.load(); const loc = NV.activeLoc(s);
    $$('#wgTopSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === s.settings.widgetTop));
    if (!loc) { $('#gallery').innerHTML = '<p class="muted">Önce konum ekleyin.</p>'; return; }
    const now = new Date();
    const m = NV.model(loc, now);
    $('#gallery').innerHTML = Object.entries(STYLES).map(([k, st]) => `
      <figure class="wg-item${s.settings.widgetStyle === k ? ' sel' : ''}" data-k="${k}">
        <div class="wg-wrap size-${st.size.replace('×', 'x')}">${st.render(m, s.settings.widgetTop, now)}</div>
        <figcaption><b>${st.name}</b> <span>${st.size}</span><small>${st.desc}</small>
          <span class="acts"><button class="btn sm" data-act="def">${s.settings.widgetStyle === k ? '✓ Varsayılan' : 'Varsayılan yap'}</button>
          ${window.AndroidBridge ? '' : `<a class="btn sm" href="/widget.html?s=${k}" target="_blank" rel="noopener">Aç</a>`}
          ${NATIVE_WG.includes(k) ? `<button class="btn sm primary" data-pin="${k}">📌 Ana ekrana ekle</button>` : ''}</span>
          ${NATIVE_WG.includes(k) ? '' : '<small class="wg-only">Yalnızca uygulama içinde görünür (ana ekran widget\'ı yok)</small>'}</figcaption>
      </figure>`).join('');
  }

  // ---------- AYARLAR ----------
  function renderSettings() {
    const s = NV.load();
    $('#locList').innerHTML = s.locations.length ? s.locations.map((l) => {
      const data = NV.loadLoc(l.id);
      const nd = Object.keys(data.d || {}).length, nf = Object.keys(data.f || {}).length;
      return `<div class="li${l.id === s.active ? ' on' : ''}" data-id="${esc(l.id)}">
        <button class="pick"><b>${esc(l.label)}</b><small>Diyanet: ${esc(l.diyanet?.name || '—')} · Fazilet: ${esc(l.fazilet?.name || '—')}<br>${nd} gün D · ${nf} gün F</small></button>
        <button class="del" aria-label="Sil">✕</button></div>`;
    }).join('') : '<p class="muted">Henüz konum yok.</p>';
    $$('#appTopSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === s.settings.appTop));
    $$('#themeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === s.settings.theme));
    $('#estChk').checked = !!s.settings.estimate;
    $('#verInfo').textContent = `Web sürümü ${APP_VER} · ${window.AndroidBridge ? 'Android uygulaması ✓ (widget desteği var)' : 'tarayıcı / web uygulaması (widget için APK gerekir)'}`;
    if (window.AndroidBridge) { $('#lockRow').hidden = false; try { $('#lockChk').checked = !!window.AndroidBridge.getLockscreen(); } catch (e) {} }
    const loc = NV.activeLoc(s);
    const fmt = (t) => (t ? new Date(t).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : 'hiç');
    $('#dataInfo').textContent = loc ? `Son güncelleme — Diyanet: ${fmt(loc.updatedAt?.d)} · Fazilet: ${fmt(loc.updatedAt?.f)}` : '';
  }

  // Android uygulamasına widget verisini gönder (yalnızca değiştiğinde)
  let lastNative = '';
  function pushNative() {
    if (!window.AndroidBridge) return;
    try {
      const loc = NV.activeLoc(); if (!loc) return;
      const j = JSON.stringify(NV.nativeData(loc));
      if (j !== lastNative) { lastNative = j; window.AndroidBridge.saveWidgetData(j); }
    } catch (e) { console.warn(e); }
  }

  function render() {
    applyTheme(); netBar(); pushNative();
    if (view === 'home') renderHome();
    if (view === 'cal') renderCal();
    if (view === 'wg') renderGallery();
    if (view === 'set') renderSettings();
    if (view !== 'home') $('#locName').textContent = NV.activeLoc()?.label || 'Konum seçin';
  }

  const MODS = { qibla: () => window.NVQibla, zikir: () => window.NVZikir };
  function show(v) {
    if (view !== v) MODS[view]?.()?.hide();
    view = v;
    $$('.view').forEach((x) => x.classList.toggle('active', x.id === 'v-' + v));
    $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    const cur = $(`.tabs button[data-v="${v}"]`);
    if (cur) { $('#menuCur').textContent = cur.textContent.trim(); $('#menuIc').innerHTML = cur.querySelector('svg').outerHTML; }
    menu(false);
    document.body.dataset.view = v;
    render(); MODS[v]?.()?.show(); window.scrollTo(0, 0);
  }

  // ---------- açılır menü (sol altta) ----------
  function menu(open) {
    const nav = $('#fabnav'); if (!nav) return;
    nav.classList.toggle('open', open);
    $('#menuBtn').setAttribute('aria-expanded', open);
    $('#menuShade').hidden = !open;
  }

  // ---------- ipuçları (hover / dokunma) ----------
  function initTips() {
    const tip = $('#tip'); let cur = null, hideT = null;
    const place = (el) => {
      tip.textContent = el.dataset.tip; tip.hidden = false;
      const r = el.getBoundingClientRect(), tw = Math.min(280, window.innerWidth - 24);
      tip.style.maxWidth = tw + 'px';
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let x = Math.min(window.innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
      let y = r.bottom + 8; if (y + h > window.innerHeight - 90) y = r.top - h - 8;
      tip.style.left = x + 'px'; tip.style.top = y + 'px'; cur = el;
    };
    const hide = () => { tip.hidden = true; cur = null; };
    document.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-tip]'); if (el && matchMedia('(hover: hover)').matches) place(el); });
    document.addEventListener('mouseout', (e) => { if (e.target.closest('[data-tip]') === cur && matchMedia('(hover: hover)').matches) hide(); });
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-tip]');
      if (el && !matchMedia('(hover: hover)').matches && !el.closest('button.icon')) { place(el); clearTimeout(hideT); hideT = setTimeout(hide, 3500); }
      else if (!el) hide();
    });
    window.addEventListener('scroll', hide, { passive: true });
  }

  function toggleTheme() {
    const s = NV.load();
    const dark = s.settings.theme === 'dark' || (s.settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    s.settings.theme = dark ? 'light' : 'dark'; NV.save(s);
    toast(dark ? '☀️ Gündüz modu' : '🌙 Gece modu', 1400); render();
  }

  // ---------- senkron ----------
  async function syncAll(force = false) {
    if (syncing || !navigator.onLine) return;
    const s = NV.load(); if (!s.locations.length) return;
    syncing = true; $('#syncBtn').classList.add('spin');
    const errs = [];
    // Önce aktif konum
    const list = [NV.activeLoc(s), ...s.locations.filter((l) => l.id !== s.active)].filter(Boolean);
    for (const l of list) {
      const r = await NV.syncLoc(l, { force });
      errs.push(...r.errors);
      if (l.id === s.active) render();
    }
    syncing = false; $('#syncBtn').classList.remove('spin');
    render();
    if (errs.length) toast('Güncellenemedi: ' + errs[0]);
    else if (force) toast('Vakitler güncellendi');
  }

  // ---------- konum ekleme ----------
  let cache = { states: null, fzCities: null };
  async function openAdd() {
    if (!navigator.onLine) { toast('Konum eklemek için internet gerekli'); return; }
    const dlg = $('#addDlg'); dlg.showModal();
    const selIl = $('#selIl'), selIlce = $('#selIlce'), selFz = $('#selFz'), msg = $('#addMsg'), save = $('#addSave');
    msg.textContent = ''; save.disabled = true;
    selIlce.disabled = selFz.disabled = true;
    try {
      [cache.states, cache.fzCities] = await Promise.all([
        cache.states || NV.api('diyanet', { action: 'states' }),
        cache.fzCities || NV.api('fazilet', { action: 'cities' }).catch(() => []),
      ]);
      const sorted = [...cache.states].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      selIl.innerHTML = '<option value="">İl seçin</option>' + sorted.map((s) => `<option value="${esc(s.id)}">${esc(NV.titleTr(s.name))}</option>`).join('');
    } catch (e) {
      selIl.innerHTML = '<option value="">Yüklenemedi</option>'; msg.textContent = 'İl listesi alınamadı: ' + e.message;
    }
  }

  async function onIl() {
    const selIl = $('#selIl'), selIlce = $('#selIlce'), selFz = $('#selFz'), msg = $('#addMsg');
    const st = cache.states?.find((s) => s.id === selIl.value);
    $('#addSave').disabled = true;
    if (!st) return;
    selIlce.innerHTML = '<option>Yükleniyor…</option>'; selFz.innerHTML = '<option>Yükleniyor…</option>';
    const n = NV.norm(st.name);
    const city = (cache.fzCities || []).find((c) => NV.norm(c.name) === n) ||
      (cache.fzCities || []).find((c) => n.startsWith(NV.norm(c.name)) || NV.norm(c.name).startsWith(n));
    try {
      const [ilceler, fzD] = await Promise.all([
        NV.api('diyanet', { action: 'districts', state: st.id }),
        city?.more ? NV.api('fazilet', { action: 'districts', il: city.id }).catch(() => []) : Promise.resolve([]),
      ]);
      const ilName = NV.titleTr(st.name);
      selIlce.innerHTML = ilceler.map((x) => `<option value="${esc(x.id)}">${esc(NV.titleTr(x.name))}${NV.norm(x.name) === n ? ' (merkez)' : ''}</option>`).join('');
      const center = ilceler.find((x) => NV.norm(x.name) === n);
      if (center) selIlce.value = center.id;
      const fzOpts = (city ? [{ name: city.name + ' (merkez)', path: city.path, base: city.name }] : []).concat(fzD.map((d) => ({ name: d.name, path: d.path, base: d.name })));
      selFz.innerHTML = fzOpts.length ? fzOpts.map((o) => `<option value="${esc(o.path)}" data-n="${esc(NV.norm(o.base.split('/')[0]))}">${esc(o.name)}</option>`).join('') : '<option value="">Fazilet karşılığı bulunamadı</option>';
      selIlce.disabled = false; selFz.disabled = !fzOpts.length;
      selIlce._il = ilName; selIlce._list = ilceler;
      matchFz();
      $('#addSave').disabled = false; msg.textContent = '';
    } catch (e) {
      msg.textContent = 'İlçeler alınamadı: ' + e.message;
    }
  }

  function matchFz() {
    const selIlce = $('#selIlce'), selFz = $('#selFz');
    const ilce = selIlce._list?.find((x) => x.id === selIlce.value);
    if (!ilce) return;
    const n = NV.norm(ilce.name);
    const opt = $$('option', selFz).find((o) => o.dataset.n === n);
    selFz.value = opt ? opt.value : (selFz.options[0]?.value || '');
  }

  async function saveAdd(ev) {
    ev.preventDefault();
    const selIl = $('#selIl'), selIlce = $('#selIlce'), selFz = $('#selFz'), msg = $('#addMsg'), btn = $('#addSave');
    const ilce = selIlce._list?.find((x) => x.id === selIlce.value);
    if (!ilce) return;
    const il = selIlce._il;
    const ilceName = NV.titleTr(ilce.name);
    const label = NV.norm(ilceName) === NV.norm(il) ? il : `${ilceName}, ${il}`;
    const id = 'd' + ilce.id;
    const s = NV.load();
    const loc = {
      id, label, short: NV.norm(ilceName) === NV.norm(il) ? il : ilceName,
      diyanet: { id: ilce.id, name: ilceName, state: selIl.value },
      fazilet: selFz.value ? { path: selFz.value, name: selFz.selectedOptions[0]?.textContent || '' } : null,
    };
    btn.disabled = true; msg.textContent = 'Vakitler indiriliyor…';
    const r = await NV.syncLoc(loc, { force: true });
    const data = NV.loadLoc(id);
    if (!Object.keys(data.d || {}).length && !Object.keys(data.f || {}).length) {
      msg.textContent = 'Vakitler indirilemedi. ' + (r.errors[0] || ''); btn.disabled = false; return;
    }
    const s2 = NV.load();
    s2.locations = s2.locations.filter((l) => l.id !== id).concat([Object.assign(loc, {
      updated: { d: r.d ? NV.iso(new Date()) : null, f: r.f ? NV.iso(new Date()) : null },
      updatedAt: { d: r.d ? Date.now() : 0, f: r.f ? Date.now() : 0 },
    })]);
    s2.active = id; NV.save(s2);
    $('#addDlg').close();
    toast(`${label} eklendi · ${Object.keys(data.d || {}).length} gün Diyanet, ${Object.keys(data.f || {}).length} gün Fazilet` + (r.errors.length ? ' (' + r.errors[0] + ')' : ''), 4000);
    show('home');
  }

  // ---------- olaylar ----------
  function bind() {
    $$('.tabs button').forEach((b) => (b.onclick = () => show(b.dataset.v)));
    $('#menuBtn').onclick = () => menu(!$('#fabnav').classList.contains('open'));
    $('#menuShade').onclick = () => menu(false);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu(false); });
    $('#syncBtn').onclick = () => syncAll(true);
    $('#themeBtn').onclick = toggleTheme;
    $('#wgBtn').onclick = () => show('wg');
    $('#setWg').onclick = () => show('wg');
    initTips();
    $('#forceSync').onclick = () => syncAll(true);
    $('#addLoc').onclick = openAdd;
    $('#locBtn').onclick = () => { const s = NV.load(); if (s.locations.length) show('set'); else openAdd(); };
    $('#selIl').onchange = onIl;
    $('#selIlce').onchange = matchFz;
    $('#addSave').onclick = saveAdd;

    const seg = (id, key, after) => $(id).addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]'); if (!b) return;
      const s = NV.load(); s.settings[key] = b.dataset.v; NV.save(s); after?.(); render();
    });
    seg('#appTopSeg', 'appTop'); seg('#themeSeg', 'theme'); seg('#wgTopSeg', 'widgetTop');
    $('#lockChk').onchange = (e) => { try { window.AndroidBridge?.setLockscreen(e.target.checked); } catch (er) {} toast(e.target.checked ? 'Kilit ekranı bildirimi açıldı' : 'Kilit ekranı bildirimi kapatıldı'); };
    $('#estChk').onchange = (e) => { const s = NV.load(); s.settings.estimate = e.target.checked; NV.save(s); render(); };

    $('#locList').addEventListener('click', (e) => {
      const li = e.target.closest('.li'); if (!li) return;
      if (e.target.closest('.del')) {
        if (confirm('Bu konum ve kayıtlı vakitleri silinsin mi?')) { NV.removeLoc(li.dataset.id); render(); }
        return;
      }
      const s = NV.load(); s.active = li.dataset.id; NV.save(s); show('home'); syncAll();
    });
    $('#gallery').addEventListener('click', (e) => {
      const pin = e.target.closest('[data-pin]');
      if (pin) { pinWidget(pin.dataset.pin); return; }
      const b = e.target.closest('[data-act="def"]'); if (!b) return;
      const s = NV.load(); s.settings.widgetStyle = b.closest('.wg-item').dataset.k; NV.save(s); render();
      toast('Varsayılan widget: ' + STYLES[s.settings.widgetStyle].name);
    });

    window.addEventListener('online', () => { netBar(); syncAll(); });
    window.addEventListener('offline', netBar);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); syncAll(); } });
    window.addEventListener('storage', render);
  }

  // ---------- ana ekran widget'ı ----------
  function pinWidget(kind) {
    if (window.AndroidBridge) {
      try { window.AndroidBridge.pinWidget(kind); } catch (e) { toast('Ana ekranda boş bir yere basılı tutun → Widget\'lar → Vakitler', 5000); }
      return;
    }
    const d = $('#instDlg');
    d.innerHTML = `<form method="dialog" class="dlg">
      <h3>📌 Ana ekrana widget eklemek için</h3>
      <p>Telefonun ana ekranına (simgelerin olduğu yere) widget koymak için <b>Vakitler Android uygulaması (APK)</b> gerekiyor.
      Tarayıcıdan ya da “Ana ekrana ekle” ile kurulan sürüm widget ekleyemez; bu Android'in bir kuralı.</p>
      <ol class="isteps">
        <li>GitHub deponuzda <b>Releases</b> bölümünden <b>Vakitler.apk</b>'yı telefona indirin.</li>
        <li>APK'yı açıp kurun (“bilinmeyen uygulamalara izin ver” sorulursa izin verin).</li>
        <li>Vakitler uygulamasını açın → <b>Menü → Widget</b> → bu düğmeye tekrar basın. Telefon sorunca <b>“Ekle”</b> deyin.</li>
      </ol>
      <p class="muted small">Ya da APK kurulduktan sonra: ana ekranda boş bir yere basılı tutun → <b>Widget'lar</b> → <b>Vakitler</b> → widget'ı sürükleyin.</p>
      <div class="row"><a class="btn" href="/widget.html?s=${kind}" target="_blank" rel="noopener">Şimdilik tam ekran aç</a><button class="btn primary" value="ok">Tamam</button></div>
    </form>`;
    d.showModal();
  }

  // ---------- telefona yükleme ----------
  let deferredPrompt = null;
  const UA = navigator.userAgent;
  const isStandalone = () => !!window.AndroidBridge || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = () => /android/i.test(UA);
  // WhatsApp/Instagram/Facebook/Telegram vb. uygulama içi tarayıcılar yükleme yapamaz
  const inApp = () => /FBAN|FBAV|Instagram|Line\/|WhatsApp|Telegram|TikTok|Snapchat|; wv\)|GSA\//i.test(UA);
  const isSamsung = () => /SamsungBrowser/i.test(UA);
  const iosNotSafari = () => isIOS() && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(UA);
  const shareSvg = '<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align:-3px"><path fill="currentColor" d="M12 2 7.5 6.5l1.4 1.4L11 5.8V15h2V5.8l2.1 2.1 1.4-1.4L12 2ZM5 10v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10h-2v10H7V10H5Z"/></svg>';

  async function doPrompt() {
    const p = deferredPrompt; if (!p) return false;
    deferredPrompt = null; // bir istem yalnızca bir kez kullanılabilir
    try {
      await p.prompt();
      const r = await p.userChoice;
      if (r && r.outcome === 'accepted') {
        $('#installBar').hidden = true; $('#instDlg').open && $('#instDlg').close();
        toast('Yükleniyor… Birkaç saniye içinde ana ekranda ve uygulama listesinde görünecek.', 6000);
      } else toast('Yükleme iptal edildi. Tekrar denemek için sayfayı yenileyin.', 4000);
    } catch (e) { toast('Yükleme penceresi açılamadı: ' + e.message, 4000); }
    return true;
  }

  function steps() {
    const host = location.host + location.pathname;
    if (isStandalone()) return { t: 'Uygulama zaten yüklü ✓', b: '<p>Şu an uygulamanın içindesiniz. Ana ekrandaki gül simgesinden açabilirsiniz.</p>' };
    if (inApp()) return { t: 'Önce tarayıcıda açın', b: `<p>Bu sayfa WhatsApp / Instagram gibi bir uygulamanın <b>içindeki tarayıcıda</b> açılmış. Bu tarayıcılar uygulama yükleyemez.</p>
      ${isAndroid() ? `<a class="btn primary wide" href="intent://${host}#Intent;scheme=https;package=com.android.chrome;end">Chrome'da aç</a>` : ''}
      <p class="muted small">Ya da sağ üstteki <b>⋮</b> / <b>…</b> menüsünden <b>“Tarayıcıda aç”</b> deyin. ${isIOS() ? 'iPhone\'da <b>Safari</b>\'yi seçin.' : ''}</p>` };
    if (iosNotSafari()) return { t: 'Safari ile açın', b: '<p>iPhone\'da uygulama yalnızca <b>Safari</b> ile ana ekrana eklenebilir. Bu adresi kopyalayıp Safari\'de açın.</p>' };
    if (isIOS()) return { t: 'iPhone\'a yükleme', b: `<ol class="isteps"><li>Safari\'nin alt çubuğundaki <b>Paylaş</b> ${shareSvg} düğmesine dokunun.</li>
      <li>Açılan listeyi biraz kaydırıp <b>“Ana Ekrana Ekle”</b>ye dokunun.</li><li>Sağ üstte <b>“Ekle”</b> deyin. Gül simgesi ana ekrana gelir.</li></ol>` };
    if (isAndroid()) return { t: 'Android\'e yükleme', b: `${deferredPrompt ? '<button class="btn primary wide" id="instGo">📲 Şimdi yükle</button><p class="muted small">Açılan pencerede “Yükle”ye basın.</p>' : ''}
      <ol class="isteps"><li>${isSamsung() ? 'Samsung Internet\'te alttaki <b>☰ menü</b>ye' : 'Chrome\'da sağ üstteki <b>⋮</b> menüsüne'} dokunun.</li>
      <li><b>“Uygulamayı yükle”</b> ya da <b>“Ana ekrana ekle”</b> seçeneğine dokunun.</li>
      <li>“Ana ekrana ekle” sorulursa <b>“Yükle”</b>yi seçin (kısayol değil). Gül simgesi uygulama listesine gelir.</li></ol>
      <p class="muted small">Menüde seçenek yoksa: sayfayı bir kez yenileyin, 10-20 saniye bekleyip tekrar bakın. Uygulama zaten yüklüyse menüde “Uygulamayı aç” yazar.</p>` };
    return { t: 'Bilgisayara yükleme', b: `${deferredPrompt ? '<button class="btn primary wide" id="instGo">📲 Şimdi yükle</button>' : ''}<p>Chrome veya Edge\'de adres çubuğunun sağındaki <b>yükle</b> simgesine tıklayın.</p>` };
  }

  async function openInstall() {
    if (deferredPrompt && !inApp()) { if (await doPrompt()) return; }
    const st = steps(), d = $('#instDlg');
    let sw = 'yok';
    try { const reg = await navigator.serviceWorker?.getRegistration(); sw = reg?.active ? 'hazır' : (reg ? 'kuruluyor' : 'yok'); } catch (e) {}
    d.innerHTML = `<form method="dialog" class="dlg"><h3>${st.t}</h3>${st.b}
      <p class="muted small idiag">Çevrimdışı modülü: ${sw}</p>
      <div class="row"><button class="btn" value="ok">Tamam</button></div></form>`;
    d.showModal();
    const go = $('#instGo'); if (go) go.onclick = (e) => { e.preventDefault(); doPrompt(); };
  }

  function installBar(force = false) {
    const bar = $('#installBar');
    if (isStandalone()) { bar.hidden = true; return; }
    let until = 0; try { until = +localStorage.getItem('nv:installHide') || 0; } catch (e) {}
    if (!force && until > Date.now()) return;
    if (!force && !deferredPrompt && !isIOS() && !isAndroid()) return;
    bar.innerHTML = `<span>📲 Vakitler'i telefona uygulama olarak yükleyin</span><button class="btn sm primary" data-i="go">${deferredPrompt ? 'Yükle' : 'Nasıl?'}</button><button class="x" data-i="x" aria-label="Kapat">✕</button>`;
    bar.hidden = false;
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; installBar(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; $('#installBar').hidden = true; toast('Uygulama yüklendi ✓ Ana ekrandaki gül simgesinden açabilirsiniz.', 5000); });
  $('#installBar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    if (b.dataset.i === 'x') { try { localStorage.setItem('nv:installHide', Date.now() + 7 * 864e5); } catch (er) {} $('#installBar').hidden = true; return; }
    openInstall();
  });
  $('#setInstall').onclick = openInstall;
  setTimeout(() => installBar(), 2500);

  // ---------- başlat ----------
  bind(); show('home');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  setInterval(tick, 1000);
  setInterval(render, 60000);
  setInterval(() => syncAll(), 30 * 60000);
  syncAll();
  if (!NV.load().locations.length) setTimeout(openAdd, 300);
  const H = { '#widget': 'wg', '#kible': 'qibla', '#zikir': 'zikir', '#imsakiye': 'cal' };
  if (H[location.hash]) show(H[location.hash]);
})();
