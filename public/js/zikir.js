// Zikirmatik: serbest sayaç (hedef, tekrarlı hedef), zikir listeleri (sırayla), titreşim/ses ayarları, günlük kayıt
(function (g) {
  'use strict';
  const NV = g.NV, FX = g.NVFX;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const KEY = 'nv:zk';
  const uid = () => Math.random().toString(36).slice(2, 9);

  const DEF_SET = {
    tapVib: true, tapVibPat: 'kisa', tapSound: false, tapSoundName: 'bip',
    targetVib: true, targetVibPat: 'uzun', targetSound: true, targetSoundName: 'bip3',
    itemVib: true, itemVibPat: 'cift', itemSound: true, itemSoundName: 'bip3',
    doneVib: true, doneVibPat: 'uclu', doneSound: true, doneSoundName: 'bitis',
    stepAlert: 0, autoNext: true, keepAwake: true,
  };
  const PRESETS = [
    { name: 'Namaz sonrası tesbihat', note: 'Her farz namazdan sonra', items: [
      { name: 'Sübhânallah', target: 33 }, { name: 'Elhamdülillah', target: 33 }, { name: 'Allâhu ekber', target: 33 },
      { name: 'Lâ ilâhe illallâhu vahdehû lâ şerîke leh…', target: 1 }] },
    { name: 'Günlük virdim', note: '', items: [
      { name: 'Estağfirullah', target: 100 }, { name: 'Salavât-ı şerîfe', target: 100 }, { name: 'Lâ ilâhe illallah', target: 100 }] },
  ];

  function load() {
    let z; try { z = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { z = {}; }
    z.set = Object.assign({}, DEF_SET, z.set || {});
    if ((z.v || 1) < 2) { // ses sürümü 2: yumuşak bip sesleri
      z.set.tapSoundName = 'bip'; z.set.targetSoundName = 'bip3'; z.set.itemSoundName = 'bip3'; z.v = 2;
    }
    for (const k of ['tap', 'target', 'item', 'done']) if (!FX.SOUNDS.includes(z.set[k + 'SoundName'])) z.set[k + 'SoundName'] = DEF_SET[k + 'SoundName'];
    z.free ||= { name: 'Serbest zikir', count: 0, target: 33, mode: 'tek', rounds: 0, note: '' };
    if (!z.lists) z.lists = PRESETS.map((p) => ({ id: uid(), name: p.name, note: p.note, items: p.items.map((i) => ({ ...i, note: '' })) }));
    z.hist ||= {};
    z.tab ||= 'sayac';
    return z;
  }
  let Z = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(Z)); } catch (e) {} };
  const today = () => NV.iso(new Date());
  const H = () => (Z.hist[today()] ||= { total: 0, lists: {} });

  // ---------- geri bildirim ----------
  function fb(kind) {
    const s = Z.set;
    const v = s[kind + 'Vib'], snd = s[kind + 'Sound'];
    if (v) FX.vibrate(FX.PATTERNS[s[kind + 'VibPat']] || [40]);
    if (snd) FX.play(s[kind + 'SoundName']);
  }
  function flash(text) {
    const el = $('#zFlash'); if (!el) return;
    el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  // ---------- sayma ----------
  const run = () => (Z.run ? Z.lists.find((l) => l.id === Z.run.listId) : null);

  function tap() {
    H().total++;
    const L = run();
    if (L) {
      const it = L.items[Z.run.idx];
      Z.run.count++;
      if (Z.run.count === it.target) {
        Z.run.done[Z.run.idx] = true;
        const last = Z.run.done.every(Boolean);
        let text;
        if (last) {
          fb('done'); text = 'Liste tamamlandı ✓';
          const h = H(); h.lists[L.id] = (h.lists[L.id] || 0) + 1;
          Z.run.finished = true;
        } else {
          fb('item'); text = `${it.name} tamam ✓`;
          if (Z.set.autoNext) nextItem();
        }
        save(); render(); flash(text); return;
      } else {
        stepOrTap(Z.run.count);
      }
    } else {
      const f = Z.free; f.count++;
      let hit = false;
      if (f.target > 0) {
        if (f.mode === 'tek' && f.count === f.target) hit = true;
        if (f.mode === 'tekrar' && f.count % f.target === 0) { hit = true; f.rounds = f.count / f.target; }
        if (f.mode === 'sifirla' && f.count >= f.target) { hit = true; f.rounds++; f.count = 0; }
      }
      if (hit) { fb('target'); flash(f.mode === 'tek' ? 'Hedefe ulaşıldı ✓' : `${f.mode === 'sifirla' ? f.rounds : f.rounds} × ${f.target} ✓`); }
      else stepOrTap(f.count);
    }
    save(); draw();
  }
  function stepOrTap(n) {
    const s = Z.set;
    if (s.stepAlert > 0 && n > 0 && n % s.stepAlert === 0) { FX.vibrate(FX.PATTERNS.orta); if (s.tapSound) FX.play('damla'); }
    else fb('tap');
  }
  function undo() {
    const L = run();
    if (L) { if (Z.run.count > 0) { Z.run.count--; H().total = Math.max(0, H().total - 1); Z.run.done[Z.run.idx] = Z.run.count >= L.items[Z.run.idx].target; Z.run.finished = false; } }
    else {
      const f = Z.free;
      if (f.count > 0) { f.count--; H().total = Math.max(0, H().total - 1); if (f.mode === 'tekrar') f.rounds = Math.floor(f.count / (f.target || 1)); }
      else if (f.mode === 'sifirla' && f.rounds > 0) { f.rounds--; f.count = f.target - 1; H().total = Math.max(0, H().total - 1); }
    }
    save(); draw();
  }
  function reset() {
    const L = run();
    if (L) { Z.run.count = 0; Z.run.done[Z.run.idx] = false; Z.run.finished = false; }
    else { Z.free.count = 0; Z.free.rounds = 0; }
    save(); draw();
  }
  function nextItem(dir = 1) {
    const L = run(); if (!L) return;
    let i = Z.run.idx + dir;
    i = Math.max(0, Math.min(L.items.length - 1, i));
    if (dir > 0) { // sıradaki tamamlanmamış zikre geç
      const j = L.items.findIndex((_, k) => k >= i && !Z.run.done[k]);
      if (j >= 0) i = j;
    }
    Z.run.idx = i; Z.run.count = Z.run.done[i] ? L.items[i].target : 0;
    save(); render();
  }
  function startList(id) {
    const L = Z.lists.find((l) => l.id === id); if (!L || !L.items.length) return;
    Z.run = { listId: id, idx: 0, count: 0, done: L.items.map(() => false), finished: false, startedAt: Date.now() };
    Z.tab = 'sayac'; save(); render();
  }
  function stopList() { delete Z.run; save(); render(); }

  // ---------- ekran kilidi ----------
  let wake = null;
  async function keepAwake(on) {
    if (window.AndroidBridge) { try { window.AndroidBridge.keepScreenOn(!!(on && Z.set.keepAwake && !document.hidden)); } catch (e) {} return; }
    try {
      if (on && Z.set.keepAwake && 'wakeLock' in navigator && !document.hidden) { if (!wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => (wake = null)); } }
      else if (wake) { await wake.release(); wake = null; }
    } catch (e) { wake = null; }
  }

  // ---------- çizim ----------
  let built = false, visible = false;
  function build() {
    const root = $('#v-zikir');
    root.innerHTML = `
      <div class="seg zseg" id="zTabs"><button data-v="sayac">Sayaç</button><button data-v="listeler">Zikir listelerim</button><button data-v="ayar">Ayarlar</button></div>
      <div id="zPane"></div>`;
    $('#zTabs').onclick = (e) => { const b = e.target.closest('button'); if (b) { Z.tab = b.dataset.v; save(); render(); } };
    // Sayma "click" ile yapılır: telefonlarda ses ve titreşim yalnızca gerçek dokunuş olaylarında çalışır
    root.addEventListener('click', (e) => { if (e.target.closest('#zBtn')) { e.preventDefault(); tap(); } });
    root.addEventListener('pointerdown', (e) => { if (e.target.closest('#zBtn')) $('#zBtn').classList.add('press'); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => root.addEventListener(ev, () => $('#zBtn')?.classList.remove('press')));
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    document.addEventListener('keydown', (e) => {
      if (!visible || Z.tab !== 'sayac' || e.target.closest('input,textarea,select,dialog')) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') { e.preventDefault(); tap(); }
      if (e.code === 'Backspace' || e.code === 'ArrowDown') { e.preventDefault(); undo(); }
    });
    built = true;
  }

  function render() {
    if (!built) build();
    $$('#zTabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === (Z.tab === 'vird' ? 'listeler' : Z.tab)));
    const P = $('#zPane');
    if (Z.tab === 'sayac') P.innerHTML = paneCounter();
    else if (Z.tab === 'listeler') P.innerHTML = paneLists();
    else if (Z.tab === 'vird') P.innerHTML = paneVird();
    else P.innerHTML = paneSettings();
    draw();
  }

  const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');

  function paneCounter() {
    const L = run();
    const head = L ? `
      <div class="zrun">
        <div class="zrh"><span>📿 ${esc(L.name)}</span><button class="btn sm" data-a="stop">Bitir</button></div>
        <div class="zsteps">${L.items.map((it, i) => `<button data-a="goto" data-i="${i}" class="zst${i === Z.run.idx ? ' on' : ''}${Z.run.done[i] ? ' ok' : ''}">${Z.run.done[i] ? '✓ ' : ''}${esc(it.name)} <small>${it.target}</small></button>`).join('')}</div>
      </div>` : `
      <div class="zfree">
        <input id="zName" class="zname" value="${esc(Z.free.name)}" aria-label="Zikir adı" placeholder="Zikir adı">
        <div class="ztg">
          ${[33, 99, 100, 500, 1000].map((n) => `<button data-a="tgt" data-n="${n}" class="chip${Z.free.target === n ? ' on' : ''}">${n}</button>`).join('')}
          <label class="chip in">Hedef <input id="zTarget" type="number" min="0" inputmode="numeric" value="${Z.free.target || ''}" placeholder="yok"></label>
        </div>
        <div class="seg zmode" id="zMode">
          <button data-v="tek" title="Hedefe gelince bir kez uyarır, saymaya devam eder">Tek hedef</button>
          <button data-v="tekrar" title="Her hedef katında uyarır (100, 200, 300…)">Her hedefte uyar</button>
          <button data-v="sifirla" title="Her hedefte uyarır ve sayacı sıfırlar, turları sayar">Uyar ve sıfırla</button>
        </div>
      </div>`;
    return `${head}
      <div class="zcount">
        <button id="zBtn" class="zbtn" aria-label="Say">
          <svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="90" class="zr-bg"/><circle id="zRing" cx="100" cy="100" r="90" class="zr-fg" transform="rotate(-90 100 100)"/></svg>
          <span class="zin"><small id="zItem"></small><b id="zNum">0</b><span id="zOf"></span><em id="zRounds"></em></span>
        </button>
        <div id="zFlash" class="zflash"></div>
      </div>
      <p id="zNote" class="znote" hidden></p>
      <div class="zctl">
        <button class="btn" data-a="undo" title="Geri al (−1)">−1</button>
        <button class="btn" data-a="reset">Sıfırla</button>
        ${L ? `<button class="btn" data-a="prev">‹ Önceki</button><button class="btn primary" data-a="next">Sonraki ›</button>` : ''}
      </div>
      <div class="zquick">
        ${qt('tapVib', '📳 Her tık')}${qt('tapSound', '🔊 Her tık')}${qt(L ? 'itemVib' : 'targetVib', '📳 Hedef')}${qt(L ? 'itemSound' : 'targetSound', '🔊 Hedef')}
      </div>
      <p class="muted small zday">Bugün toplam: <b id="zToday">${fmt(H().total)}</b> · Ekrana dokunun ya da boşluk tuşuna basın${FX.canVibrate ? '' : ' · iPhone\'da titreşim hafif dokunsal tık olarak çalışır (iOS 18+)'}</p>`;
  }
  const qt = (k, label) => `<button class="chip${Z.set[k] ? ' on' : ''}" data-a="qt" data-k="${k}">${label}</button>`;

  function paneLists() {
    const h = H();
    return `
      <button class="vird-card" data-a="vird">
        <span class="vc-ic">${g.NVVird ? '❀' : ''}</span>
        <span class="vc-tx"><b>Aşk-ı Merami Virdi</b><small>Hibe, Rabıta-i Şerif, Feyz Duası ve zikirler — sırasıyla</small></span>
        <span class="vc-go">›</span>
      </button>
      <p class="muted small">Günlük zikirlerinizi ve adetlerini liste olarak kaydedin. “Başlat” dediğinizde sırayla sayılır; her hedefte titreşim/ses ile bir sonrakine geçer.</p>
      <div class="zlists">${Z.lists.map((l) => `
        <div class="zl">
          <div class="zlh"><b>${esc(l.name)}</b>${h.lists[l.id] ? `<span class="badge">Bugün ${h.lists[l.id]}× ✓</span>` : ''}</div>
          ${l.note ? `<p class="zln">${esc(l.note)}</p>` : ''}
          <p class="zli">${l.items.map((i) => `${esc(i.name)} <b>×${i.target}</b>`).join(' · ') || '<i>boş</i>'}</p>
          <div class="zla"><button class="btn sm primary" data-a="start" data-id="${l.id}">▶ Başlat</button><button class="btn sm" data-a="edit" data-id="${l.id}">Düzenle</button><button class="btn sm" data-a="del" data-id="${l.id}">Sil</button></div>
        </div>`).join('')}</div>
      <button class="btn primary wide" data-a="new">+ Yeni liste</button>
      ${histHtml()}`;
  }

  function paneVird() {
    const fs = Z.virdFont || 17;
    return `<div class="vr-bar">
        <button class="btn sm" data-a="back">‹ Zikirlerim</button>
        <span class="vr-fs"><button class="btn sm" data-a="fs" data-d="-1" aria-label="Yazıyı küçült">A−</button><button class="btn sm" data-a="fs" data-d="1" aria-label="Yazıyı büyüt">A+</button></span>
      </div>
      <div class="vr-wrap" style="--vr-fs:${fs}px">${g.NVVird ? g.NVVird.render() : ''}</div>`;
  }

  function histHtml() {
    const days = Object.keys(Z.hist).sort().reverse().slice(0, 7);
    if (!days.length) return '';
    return `<h2 class="sec">Son 7 gün</h2><div class="zhist">${days.map((d) => {
      const x = Z.hist[d]; const ls = Object.entries(x.lists || {}).map(([id, n]) => (Z.lists.find((l) => l.id === id)?.name || 'Liste') + (n > 1 ? ` ×${n}` : '')).join(', ');
      return `<div><span>${NV.fmtShort(d)}</span><b>${fmt(x.total)}</b><small>${esc(ls)}</small></div>`;
    }).join('')}</div>`;
  }

  function sel(k, opts) { return `<select data-k="${k}">${opts.map(([v, l]) => `<option value="${v}"${String(Z.set[k]) === String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select>`; }
  const VP = [['kisa', 'Kısa'], ['orta', 'Orta'], ['uzun', 'Uzun'], ['cift', 'Çift'], ['uclu', 'Üçlü']];
  const SN = [['bip', 'Bip (yumuşak)'], ['bip3', '3 bip'], ['tik', 'Kısa tık'], ['damla', 'Damla'], ['zil', 'Zil'], ['bitis', 'Bitiş melodisi']];
  function row(label, k, kind) {
    return `<div class="zsr"><span>${label}</span>
      <label class="sw2"><input type="checkbox" data-k="${k}Vib"${Z.set[k + 'Vib'] ? ' checked' : ''}><i></i>📳</label>${sel(k + 'VibPat', VP)}
      <label class="sw2"><input type="checkbox" data-k="${k}Sound"${Z.set[k + 'Sound'] ? ' checked' : ''}><i></i>🔊</label>${sel(k + 'SoundName', SN)}
      <button class="btn sm" data-a="test" data-k="${k}" title="Dene">▶</button></div>`;
  }
  function paneSettings() {
    return `
      <div class="zset">
        <h3>Titreşim ve ses</h3>
        ${row('Her tıkta', 'tap')}${row('Hedefe ulaşınca', 'target')}${row('Listede her zikir bitince', 'item')}${row('Liste tamamlanınca', 'done')}
        <h3>Sayma</h3>
        <div class="zsr"><span>Ara uyarı<small>Hedeften bağımsız, her X'te kısa titreşim</small></span>${sel('stepAlert', [[0, 'Kapalı'], [10, 'Her 10'], [33, 'Her 33'], [100, 'Her 100']])}</div>
        <label class="zsr"><span>Listede otomatik sonrakine geç</span><span class="sw2"><input type="checkbox" data-k="autoNext"${Z.set.autoNext ? ' checked' : ''}><i></i></span></label>
        <label class="zsr"><span>Sayarken ekranı açık tut</span><span class="sw2"><input type="checkbox" data-k="keepAwake"${Z.set.keepAwake ? ' checked' : ''}><i></i></span></label>
        <p class="muted small">Ses gelmiyorsa: telefonun medya sesini açın; iPhone'da yan taraftaki sessiz düğmesini kapatın. iPhone'da Safari titreşim desteklemez; iOS 18 ve sonrasında hafif dokunsal tık verilir.</p>
        <button class="btn" data-a="resetset">Varsayılanlara dön</button>
      </div>`;
  }

  function draw() {
    if (!visible || Z.tab !== 'sayac' || !$('#zBtn')) return;
    const L = run();
    let count, target, rounds = 0, item = '', note = '';
    if (L) {
      const it = L.items[Z.run.idx]; count = Z.run.count; target = it.target; item = `${Z.run.idx + 1}/${L.items.length} · ${it.name}`; note = it.note || (Z.run.idx === 0 ? L.note : '');
      if (Z.run.finished) item = 'Liste tamamlandı ✓';
    } else {
      const f = Z.free; count = f.count; target = f.target; rounds = f.rounds; item = f.name; note = f.note;
      $$('#zMode button').forEach((b) => b.classList.toggle('on', b.dataset.v === f.mode));
    }
    $('#zNum').textContent = fmt(count);
    $('#zOf').textContent = target ? '/ ' + fmt(target) : '';
    $('#zItem').textContent = item;
    $('#zRounds').textContent = !L && rounds && Z.free.mode !== 'tek' ? `Tur ${rounds}` : '';
    const C = 2 * Math.PI * 90;
    let pct = target ? ((L || Z.free.mode === 'tek') ? Math.min(1, count / target) : (count % target) / target) : 0;
    if (!L && Z.free.mode === 'tekrar' && count > 0 && count % target === 0) pct = 1;
    const ring = $('#zRing'); ring.style.strokeDasharray = C; ring.style.strokeDashoffset = C * (1 - pct);
    $('#zBtn').classList.toggle('done', !!(L ? Z.run.finished || Z.run.done[Z.run.idx] : (Z.free.mode === 'tek' && target && count >= target)));
    const n = $('#zNote'); n.hidden = !note; n.textContent = note ? '📝 ' + note : '';
    const td = $('#zToday'); if (td) td.textContent = fmt(H().total);
  }

  // ---------- olaylar ----------
  function onClick(e) {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'undo') undo();
    else if (a === 'reset') { if (confirm('Sayaç sıfırlansın mı?')) reset(); }
    else if (a === 'next') nextItem(1);
    else if (a === 'prev') nextItem(-1);
    else if (a === 'goto') { Z.run.idx = +b.dataset.i; const L = run(); Z.run.count = Z.run.done[Z.run.idx] ? L.items[Z.run.idx].target : 0; save(); render(); }
    else if (a === 'stop') { if (confirm('Liste bitirilsin mi? (Bugünkü sayımlar kayıtlı kalır)')) stopList(); }
    else if (a === 'tgt') { Z.free.target = +b.dataset.n; Z.free.count = 0; Z.free.rounds = 0; save(); render(); }
    else if (a === 'qt') { Z.set[b.dataset.k] = !Z.set[b.dataset.k]; save(); b.classList.toggle('on', Z.set[b.dataset.k]); }
    else if (a === 'start') startList(b.dataset.id);
    else if (a === 'vird') { Z.tab = 'vird'; save(); render(); window.scrollTo(0, 0); }
    else if (a === 'back') { Z.tab = 'listeler'; save(); render(); window.scrollTo(0, 0); }
    else if (a === 'fs') { Z.virdFont = Math.max(13, Math.min(26, (Z.virdFont || 17) + 2 * +b.dataset.d)); save(); $('.vr-wrap').style.setProperty('--vr-fs', Z.virdFont + 'px'); }
    else if (a === 'new') editList(null);
    else if (a === 'edit') editList(b.dataset.id);
    else if (a === 'del') { if (confirm('Liste silinsin mi?')) { Z.lists = Z.lists.filter((l) => l.id !== b.dataset.id); if (Z.run?.listId === b.dataset.id) delete Z.run; save(); render(); } }
    else if (a === 'test') { const k = b.dataset.k; if (Z.set[k + 'Vib']) FX.vibrate(FX.PATTERNS[Z.set[k + 'VibPat']]); FX.play(Z.set[k + 'SoundName']); }
    else if (a === 'resetset') { Z.set = Object.assign({}, DEF_SET); save(); render(); }
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === 'zName') { Z.free.name = t.value.trim() || 'Serbest zikir'; save(); return; }
    if (t.id === 'zTarget') { Z.free.target = Math.max(0, parseInt(t.value, 10) || 0); Z.free.count = 0; Z.free.rounds = 0; save(); render(); return; }
    if (t.dataset.k) {
      const k = t.dataset.k;
      Z.set[k] = t.type === 'checkbox' ? t.checked : (k === 'stepAlert' ? +t.value : t.value);
      save(); if (k === 'keepAwake') keepAwake(visible);
    }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#zMode button'); if (!b) return;
    Z.free.mode = b.dataset.v; Z.free.count = 0; Z.free.rounds = 0; save(); draw();
  });

  // ---------- liste düzenleyici ----------
  function editList(id) {
    const L = id ? Z.lists.find((l) => l.id === id) : { id: uid(), name: '', note: '', items: [{ name: '', target: 33, note: '' }] };
    const dlg = $('#zDlg');
    const rowHtml = (it) => `<div class="zer"><input class="zn" placeholder="Zikir adı" value="${esc(it.name)}"><input class="zt" type="number" min="1" inputmode="numeric" value="${it.target || ''}" placeholder="Adet">
      <input class="znt" placeholder="Not (isteğe bağlı)" value="${esc(it.note || '')}"><span class="zea"><button type="button" data-m="up">↑</button><button type="button" data-m="down">↓</button><button type="button" data-m="x">✕</button></span></div>`;
    dlg.innerHTML = `<form method="dialog" class="dlg">
      <h3>${id ? 'Listeyi düzenle' : 'Yeni zikir listesi'}</h3>
      <label>Liste adı<input id="zeName" required value="${esc(L.name)}" placeholder="ör. Sabah virdim"></label>
      <label>Not<textarea id="zeNote" rows="2" placeholder="ör. Sabah namazından sonra">${esc(L.note)}</textarea></label>
      <div class="zerows" id="zeRows">${L.items.map(rowHtml).join('')}</div>
      <button type="button" class="btn sm" id="zeAdd">+ Zikir ekle</button>
      <div class="row"><button value="cancel" class="btn" formnovalidate>Vazgeç</button><button value="ok" class="btn primary" id="zeSave">Kaydet</button></div>
    </form>`;
    dlg.showModal();
    $('#zeAdd').onclick = () => { $('#zeRows').insertAdjacentHTML('beforeend', rowHtml({ name: '', target: 33 })); $('#zeRows .zer:last-child .zn').focus(); };
    $('#zeRows').onclick = (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return; const r = b.closest('.zer');
      if (b.dataset.m === 'x') r.remove();
      if (b.dataset.m === 'up' && r.previousElementSibling) r.parentNode.insertBefore(r, r.previousElementSibling);
      if (b.dataset.m === 'down' && r.nextElementSibling) r.parentNode.insertBefore(r.nextElementSibling, r);
    };
    $('#zeSave').onclick = (e) => {
      const name = $('#zeName').value.trim();
      const items = $$('#zeRows .zer').map((r) => ({ name: $('.zn', r).value.trim(), target: Math.max(1, parseInt($('.zt', r).value, 10) || 1), note: $('.znt', r).value.trim() })).filter((i) => i.name);
      if (!name || !items.length) { e.preventDefault(); alert('Liste adı ve en az bir zikir girin.'); return; }
      L.name = name; L.note = $('#zeNote').value.trim(); L.items = items;
      if (!id) Z.lists.push(L);
      if (Z.run?.listId === L.id) delete Z.run; // yapı değişti
      save(); setTimeout(render, 0);
    };
  }

  g.NVZikir = {
    show() { visible = true; Z = load(); render(); keepAwake(true); },
    hide() { visible = false; keepAwake(false); },
  };
  document.addEventListener('visibilitychange', () => { if (visible) keepAwake(!document.hidden); });
})(window);
