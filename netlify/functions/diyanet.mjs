// Diyanet: il listesi, ilçe listesi ve ilçe vakitleri (yıllık + gelecek 30 gün)
// /api/diyanet?action=states
// /api/diyanet?action=districts&state=554
// /api/diyanet?action=times&id=9702
import { parseDiyanetHtml } from './_parse.mjs';

const BASE = 'https://namazvakitleri.diyanet.gov.tr';
const MIRROR = 'https://ezanvakti.emushaf.net'; // Diyanet verisinin yedek aynası
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36';

const json = (data, maxAge = 3600, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=300',
      'netlify-cdn-cache-control': `public, s-maxage=${maxAge}, stale-while-revalidate=86400`,
    },
  });

async function get(url, type = 'text', ms = 15000) {
  const r = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'tr-TR,tr;q=0.9', 'x-requested-with': 'XMLHttpRequest' },
    signal: AbortSignal.timeout(ms),
  });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return type === 'json' ? r.json() : r.text();
}

const toIso = (s) => { const [d, m, y] = s.split('.'); return `${y}-${m}-${d}`; };

export default async (req) => {
  const q = new URL(req.url).searchParams;
  const action = q.get('action');
  try {
    if (action === 'states') {
      try {
        const j = await get(`${BASE}/tr-TR/home/GetRegList?ChangeType=country&CountryId=2&Culture=tr-TR`, 'json');
        return json(j.StateList.map((s) => ({ id: s.SehirID, name: s.SehirAdi })), 604800);
      } catch {
        const j = await get(`${MIRROR}/sehirler/2`, 'json');
        return json(j.map((s) => ({ id: s.SehirID, name: s.SehirAdi })), 604800);
      }
    }
    if (action === 'districts') {
      const st = q.get('state');
      if (!/^\d+$/.test(st || '')) return json({ error: 'state gerekli' }, 0, 400);
      try {
        const j = await get(`${BASE}/tr-TR/home/GetRegList?ChangeType=state&CountryId=2&StateId=${st}&Culture=tr-TR`, 'json');
        return json(j.StateRegionList.map((s) => ({ id: s.IlceID, name: s.IlceAdi })), 604800);
      } catch {
        const j = await get(`${MIRROR}/ilceler/${st}`, 'json');
        return json(j.map((s) => ({ id: s.IlceID, name: s.IlceAdi })), 604800);
      }
    }
    if (action === 'times') {
      const id = q.get('id');
      if (!/^\d+$/.test(id || '')) return json({ error: 'id gerekli' }, 0, 400);
      let days = {}, source = 'diyanet';
      try {
        days = parseDiyanetHtml(await get(`${BASE}/tr-TR/${id}`, 'text', 20000));
      } catch (e) { /* yedeğe geç */ }
      if (Object.keys(days).length < 7) {
        let j = [];
        try { j = await get(`${MIRROR}/vakitler/${id}`, 'json'); source = 'diyanet-ayna'; } catch (e) {
          if (!Object.keys(days).length) throw e;
        }
        for (const v of j) {
          days[toIso(v.MiladiTarihKisa)] = {
            imsak: v.Imsak, gunes: v.Gunes, ogle: v.Ogle, ikindi: v.Ikindi, aksam: v.Aksam, yatsi: v.Yatsi,
            hicri: v.HicriTarihUzun || '',
          };
        }
      }
      if (!Object.keys(days).length) throw new Error('Vakit bulunamadı');
      return json({ source, fetched: new Date().toISOString(), days }, 21600);
    }
    return json({ error: 'action: states | districts | times' }, 0, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 0, 502);
  }
};
