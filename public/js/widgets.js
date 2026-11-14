// Widget çizicileri: her stil, model'den HTML üretir.
// Renk kuralı: Verâ = yeşil, Diyanet = mavi. "top" hangi kaynağın üstte olacağını belirler.
(function (g) {
  'use strict';
  const { LABEL, countdown, fmtShort } = g.NV;

  // İlk sütun İmsak (oruç başlar) — iki kaynakta da imsak saati; Verâ'nın Sabah namazı vakti ayrı satırda
  const COLS = [['sabah', 'İmsak'], ['ogle', 'Öğle'], ['ikindi', 'İkindi'], ['aksam', 'Akşam'], ['yatsi', 'Yatsı']];
  const SRC = { d: { name: 'Diyanet', short: 'D', cls: 'dy' }, f: { name: 'Verâ', short: 'V', cls: 'fz' } };

  const v = (m, s, col) => {
    const x = m[s]; if (!x) return '—';
    if (col === 'sabah') return x.imsak;
    return x[col] || '—';
  };
  const estMark = (m, s) => (s === 'f' && m.f?.est ? ' est' : '');
  const order = (top) => (top === 'diyanet' ? ['d', 'f'] : ['f', 'd']);
  const loc = (m) => m.loc?.short || m.loc?.label || '';
  const nextOf = (m, s) => m.next[s];
  const nextName = (e, s) => (!e ? '—' : e.raw === 'sabah' ? 'Sabah n.' : LABEL[e.raw] || e.raw);
  const tehText = (m, s) => m.teh[s]?.text || '—';
  const empty = (m) => `<div class="wg-empty">Bu gün için veri yok.<br><small>İnternete bağlanınca güncellenecek.</small></div>`;

  // 1) TABLO — 4x2: 5 sütun, üstte bir kaynak altta diğeri, alt satırlar: Verâ sabah namazı, Asr-ı Sânî, teheccüd
  function tablo(m, top, now, variant = '') {
    if (!m.hasData) return `<div class="wg wg-tablo ${variant}">${empty(m)}</div>`;
    const [a, b] = order(top);
    const nx = nextOf(m, a) || nextOf(m, b);
    const row = (s) => `<div class="tr ${SRC[s].cls}${estMark(m, s)}"><span class="src" data-tip="${s === 'd' ? 'D (mavi) = Diyanet' : 'V (yeşil) = Verâ'}">${SRC[s].short}</span>` +
      COLS.map(([c]) => `<span class="c${m.cur.col === c ? ' on' : ''}">${v(m, s, c)}</span>`).join('') + '</div>';
    return `<div class="wg wg-tablo ${variant}">
      <div class="wh"><b>${loc(m)}</b><span>${fmtShort(m.today)}</span>
        <span class="nx">${nx ? nextName(nx, nx === nextOf(m, a) ? a : b) + ' ' + countdown(nx.time, now) : ''}</span></div>
      <div class="tr th"><span class="src"></span>${COLS.map(([c, l]) => `<span class="c${m.cur.col === c ? ' on' : ''}">${l}</span>`).join('')}</div>
      ${row(a)}${row(b)}
      <div class="t3">
        <span class="fz${estMark(m, 'f')}"><i>Sabah n.</i> ${m.f?.sabah || '—'}</span>
        <span class="fz${estMark(m, 'f')}"><i>Güneş</i> ${m.f?.gunes || '—'}</span>
        <span class="asx"><i>Asr-ı Sânî</i> ${m.asrSani || '—'}</span>
      </div>
      <div class="t3 t4"><span class="teh"><i>Teheccüd</i> <em class="fz${estMark(m, 'f')}">V ${tehText(m, 'f')}</em> <em class="dy">D ${tehText(m, 'd')}</em></span></div>
    </div>`;
  }

  // 2) KOMPAKT — 2x2: sıradaki vakit, iki kaynak alt alta, geri sayım
  function kompakt(m, top, now) {
    if (!m.hasData) return `<div class="wg wg-kompakt">${empty(m)}</div>`;
    const [a, b] = order(top);
    const item = (s) => { const e = nextOf(m, s); return `<div class="kr ${SRC[s].cls}${estMark(m, s)}"><span>${SRC[s].name}</span><b>${e ? e.hm : '—'}</b><small>${e ? countdown(e.time, now) : ''}</small></div>`; };
    const e = nextOf(m, a) || nextOf(m, b);
    return `<div class="wg wg-kompakt">
      <div class="kh"><span>${loc(m)}</span><b>${e ? nextName(e, a) : ''}</b></div>
      ${item(a)}${item(b)}
      <div class="kt">Teheccüd <span class="${SRC[a].cls}">${tehText(m, a)}</span></div>
    </div>`;
  }

  // 3) ŞERİT — 4x1: her vakit hücresinde iki saat alt alta
  function serit(m, top) {
    if (!m.hasData) return `<div class="wg wg-serit">${empty(m)}</div>`;
    const [a, b] = order(top);
    return `<div class="wg wg-serit">${COLS.map(([c, l]) => `<div class="sc${m.cur.col === c ? ' on' : ''}">
      <i>${l}</i><b class="${SRC[a].cls}${estMark(m, a)}">${v(m, a, c)}</b><b class="${SRC[b].cls}${estMark(m, b)}">${v(m, b, c)}</b></div>`).join('')}
      <div class="sc teh"><i>Teheccüd</i><b class="${SRC[a].cls}${estMark(m, a)}">${(m.teh[a]?.text || '—').split('–')[0]}</b><b class="${SRC[b].cls}${estMark(m, b)}">${(m.teh[b]?.text || '—').split('–')[0]}</b></div>
    </div>`;
  }

  // 4) LİSTE — 2x4 dikey: her satırda vakit + iki kaynak
  function liste(m, top) {
    if (!m.hasData) return `<div class="wg wg-liste">${empty(m)}</div>`;
    const [a, b] = order(top);
    const rows = COLS.map(([c, l]) => `<div class="lr${m.cur.col === c ? ' on' : ''}"><span>${l}</span><b class="${SRC[a].cls}${estMark(m, a)}">${v(m, a, c)}</b><b class="${SRC[b].cls}${estMark(m, b)}">${v(m, b, c)}</b></div>`).join('');
    return `<div class="wg wg-liste">
      <div class="lh"><span>${loc(m)}</span><span class="${SRC[a].cls}">${SRC[a].short}</span><span class="${SRC[b].cls}">${SRC[b].short}</span></div>
      ${rows}
      <div class="lx fz${estMark(m, 'f')}"><span>V Sabah namazı</span><b>${m.f?.sabah || '—'}</b></div>
      <div class="lx asx"><span>Asr-ı Sânî</span><b>${m.asrSani || '—'}</b></div>
      <div class="lx"><span>Teheccüd</span><b><em class="fz${estMark(m, 'f')}">V ${tehText(m, 'f')}</em><em class="dy">D ${tehText(m, 'd')}</em></b></div>
    </div>`;
  }

  // 5) HALKA — 2x2: sıradaki vakte kalan süre halkası
  function halka(m, top, now) {
    if (!m.hasData) return `<div class="wg wg-halka">${empty(m)}</div>`;
    const [a, b] = order(top);
    const ea = nextOf(m, a), eb = nextOf(m, b), ca = m.cur[a];
    let pct = 0;
    if (ea && ca?.hm) {
      const start = new Date(`${ca.day}T${ca.hm}:00`);
      pct = Math.min(1, Math.max(0, (now - start) / (ea.time - start)));
    }
    const R = 42, C = 2 * Math.PI * R;
    return `<div class="wg wg-halka">
      <svg viewBox="0 0 100 100" class="ring"><circle cx="50" cy="50" r="${R}" class="bg"/>
        <circle cx="50" cy="50" r="${R}" class="fg ${SRC[a].cls}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 50 50)"/></svg>
      <div class="hc"><small>${nextName(ea, a)}</small><b>${ea ? countdown(ea.time, now) : '—'}</b>
        <span class="${SRC[a].cls}${estMark(m, a)}">${SRC[a].short} ${ea?.hm || '—'}</span>
        <span class="${SRC[b].cls}${estMark(m, b)}">${SRC[b].short} ${eb?.hm || '—'} <i>${eb ? nextName(eb, b) : ''}</i></span></div>
    </div>`;
  }

  // 6) GECE — AMOLED siyah, ince çizgili tablo
  const gece = (m, top, now) => tablo(m, top, now, 'gece');

  // 7) CAM — günün saatine göre değişen degrade üzerinde buzlu cam
  function cam(m, top, now) {
    const h = now.getHours();
    const sky = h < 5 ? 'night' : h < 8 ? 'dawn' : h < 16 ? 'day' : h < 19 ? 'dusk' : 'night';
    return `<div class="wg-cam-bg sky-${sky}">${tablo(m, top, now, 'cam')}</div>`;
  }

  // ---- oruç hesabı: imsak öncesi → sahura kalan, gündüz → iftara kalan, akşamdan sonra → yarınki sahura
  function orucInfo(m, top, now) {
    const [a, b] = order(top);
    const src = m[a] ? a : b; const x = m[src]; if (!x) return null;
    const at = (day, hm) => (hm ? new Date(`${day}T${hm}:00`) : null);
    const im = at(m.today, x.imsak), ak = at(m.today, x.aksam);
    if (now < im) return { mode: 'sahur', target: im, label: 'Sahura (İmsak) kalan' };
    if (now < ak) return { mode: 'iftar', target: ak, label: 'İftara kalan' };
    const tom = m.tomorrow?.[src]; const tm = NV.addDays(m.today, 1);
    return { mode: 'sahur', target: tom ? at(tm, tom.imsak) : null, label: 'Sahura (İmsak) kalan' };
  }

  // 8) MİNİ — 2x1: sıradaki vakit ve geri sayım
  function mini(m, top, now) {
    if (!m.hasData) return `<div class="wg wg-mini">${empty(m)}</div>`;
    const [a, b] = order(top);
    const ea = nextOf(m, a), eb = nextOf(m, b), e = ea || eb;
    return `<div class="wg wg-mini">
      <div class="mn-l"><small>${loc(m)}</small><b>${e ? nextName(e, a) : '—'}</b><span>${e ? countdown(e.time, now) : ''}</span></div>
      <div class="mn-r"><span class="${SRC[a].cls}${estMark(m, a)}"><i>${SRC[a].short}</i>${ea?.hm || '—'}</span><span class="${SRC[b].cls}${estMark(m, b)}"><i>${SRC[b].short}</i>${eb?.hm || '—'}</span></div>
    </div>`;
  }

  // 9) ORUÇ — 2x2: sahur / iftar sayacı
  function oruc(m, top, now) {
    if (!m.hasData) return `<div class="wg wg-oruc">${empty(m)}</div>`;
    const [a, b] = order(top);
    const o = orucInfo(m, top, now);
    return `<div class="wg wg-oruc ${o?.mode || ''}">
      <div class="or-h"><span>${o?.mode === 'iftar' ? '🌇' : '🌙'} ${o?.label || ''}</span></div>
      <b class="or-cd">${o?.target ? countdown(o.target, now) : '—'}</b>
      <div class="or-g"><span></span><i class="${SRC[a].cls}">${SRC[a].short}</i><i class="${SRC[b].cls}">${SRC[b].short}</i>
        <span>İmsak</span><em class="${SRC[a].cls}${estMark(m, a)}">${m[a]?.imsak || '—'}</em><em class="${SRC[b].cls}${estMark(m, b)}">${m[b]?.imsak || '—'}</em>
        <span>İftar</span><em class="${SRC[a].cls}${estMark(m, a)}">${m[a]?.aksam || '—'}</em><em class="${SRC[b].cls}${estMark(m, b)}">${m[b]?.aksam || '—'}</em></div>
    </div>`;
  }

  // 10) TARİH — 4x1: hicri ve miladi tarih, sıradaki vakit
  function tarih(m, top, now) {
    const [a, b] = order(top);
    const e = nextOf(m, a) || nextOf(m, b);
    return `<div class="wg wg-tarih">
      <div class="tr-l"><b>${m.hicri || '—'}</b><span>${NV.fmtDate(m.today)}</span></div>
      <div class="tr-r"><small>${loc(m)}</small><b>${e ? nextName(e, a) + ' ' + e.hm : '—'}</b><span>${e ? countdown(e.time, now) : ''}</span></div>
    </div>`;
  }

  const STYLES = {
    tablo: { name: 'Tablo', size: '4×2', render: tablo, desc: '5 vakit, iki satır + teheccüd satırı' },
    kompakt: { name: 'Kompakt', size: '2×2', render: kompakt, desc: 'Sıradaki vakit ve geri sayım' },
    serit: { name: 'Şerit', size: '4×1', render: serit, desc: 'Tek satır, her hücrede iki saat' },
    liste: { name: 'Liste', size: '2×4', render: liste, desc: 'Dikey liste, tüm vakitler' },
    halka: { name: 'Halka', size: '2×2', render: halka, desc: 'Kalan süre halkası' },
    gece: { name: 'Gece', size: '4×2', render: gece, desc: 'AMOLED siyah, pil dostu' },
    cam: { name: 'Cam', size: '4×2', render: cam, desc: 'Gökyüzü renginde degrade' },
    mini: { name: 'Mini', size: '2×1', render: mini, desc: 'Sıradaki vakit ve geri sayım, küçük' },
    oruc: { name: 'Oruç', size: '2×2', render: oruc, desc: 'Sahur ve iftar sayacı, imsak ve iftar saatleri' },
    tarih: { name: 'Tarih', size: '4×1', render: tarih, desc: 'Hicri ve miladi tarih, sıradaki vakit' },
  };

  g.NVW = { STYLES, COLS, orucInfo };
})(window);
