// Ortak ayrıştırıcılar (Diyanet HTML tablosu ve Fazilet sayfa verisi)

const AYLAR = {
  ocak: 1, şubat: 2, subat: 2, mart: 3, nisan: 4, mayıs: 5, mayis: 5, haziran: 6,
  temmuz: 7, ağustos: 8, agustos: 8, eylül: 9, eylul: 9, ekim: 10, kasım: 11, kasim: 11, aralık: 12, aralik: 12,
};

const pad = (n) => String(n).padStart(2, '0');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}

// "10 Kasım 2026 Salı" -> "2026-11-10"
export function trDateToIso(s) {
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})/);
  if (!m) return null;
  const ay = AYLAR[m[2].toLocaleLowerCase('tr-TR')];
  if (!ay) return null;
  return `${m[3]}-${pad(ay)}-${pad(+m[1])}`;
}

// Diyanet ilçe sayfasındaki tüm tabloları (haftalık, aylık, yıllık) okur
export function parseDiyanetHtml(html) {
  const days = {};
  const rows = html.split(/<tr[\s>]/i).slice(1);
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    );
    if (cells.length < 8) continue;
    const iso = trDateToIso(cells[0]);
    const t = cells.slice(2, 8);
    if (!iso || !t.every((x) => /^\d{2}:\d{2}$/.test(x))) continue;
    days[iso] = {
      imsak: t[0], gunes: t[1], ogle: t[2], ikindi: t[3], aksam: t[4], yatsi: t[5],
      hicri: cells[1],
    };
  }
  return days;
}

// Fazilet sayfasına gömülü {"timeZone":..,"days":[...]} verisini okur
export function parseFaziletHtml(html) {
  const t = html.replace(/\\\\"/g, '"').replace(/\\"/g, '"');
  const days = {};
  let pos = 0;
  while (true) {
    const k = t.indexOf('"days":[{"date"', pos);
    if (k < 0) break;
    let i = k + 7, depth = 0, end = -1, inStr = false;
    for (; i < t.length; i++) {
      const c = t[i];
      if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    pos = k + 10;
    if (end < 0) continue;
    let arr;
    try { arr = JSON.parse(t.slice(k + 7, end)); } catch { continue; }
    for (const d of arr) {
      if (!d || !d.date || !Array.isArray(d.times)) continue;
      const o = { hicri: d.hijri || '' };
      for (const v of d.times) if (v && v.key && v.hm) o[v.key] = v.hm;
      if (o.imsak && o.ogle) days[d.date] = o;
    }
  }
  // Yedek: "Dün, bugün ve yarın" tablosu
  if (!Object.keys(days).length) {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const keys = { 'İmsak': 'imsak', 'Sabah': 'sabah', 'Güneş': 'gunes', 'Öğle': 'ogle', 'İkindi': 'ikindi', 'Akşam': 'aksam', 'Yatsı': 'yatsi' };
    const today = new Date(Date.now() + 3 * 3600e3);
    const iso = (off) => new Date(today.getTime() + off * 864e5).toISOString().slice(0, 10);
    for (const [label, key] of Object.entries(keys)) {
      const m = text.match(new RegExp(label + ' (\\d{2}:\\d{2}) (\\d{2}:\\d{2}) (\\d{2}:\\d{2})'));
      if (!m) continue;
      [-1, 0, 1].forEach((off, j) => { (days[iso(off)] ||= {})[key] = m[j + 1]; });
    }
  }
  return days;
}
