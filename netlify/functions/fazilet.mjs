// Fazilet Takvimi: il/ilçe listesi ve vakitler
// /api/fazilet?action=cities            (Türkiye illeri)
// /api/fazilet?action=districts&il=46
// /api/fazilet?action=times&path=/malatya/kuluncak
// Not: Fazilet sitesi tek seferde dün/bugün/yarın (3 gün) verir. Uygulama her açılışta
// bu günleri biriktirerek saklar.
import { parseFaziletHtml } from './_parse.mjs';

const BASE = 'https://namaz-vakitleri.fazilettakvimi.com';
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36';

const json = (data, maxAge = 3600, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=300',
      'netlify-cdn-cache-control': `public, s-maxage=${maxAge}, stale-while-revalidate=3600`,
    },
  });

async function get(url, type = 'text') {
  const r = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'tr-TR,tr;q=0.9' },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return type === 'json' ? r.json() : r.text();
}

export default async (req) => {
  const q = new URL(req.url).searchParams;
  const action = q.get('action');
  try {
    if (action === 'cities') {
      const j = await get(`${BASE}/api/yerler?lang=tr&ulke=1`, 'json');
      return json(j.places, 604800);
    }
    if (action === 'districts') {
      const il = q.get('il');
      if (!/^\d+$/.test(il || '')) return json({ error: 'il gerekli' }, 0, 400);
      const j = await get(`${BASE}/api/yerler?lang=tr&il=${il}`, 'json');
      return json(j.places, 604800);
    }
    if (action === 'times') {
      const path = q.get('path') || '';
      if (!/^(\/[a-z0-9-]+){1,3}$/.test(path)) return json({ error: 'path geçersiz' }, 0, 400);
      const days = parseFaziletHtml(await get(BASE + path));
      if (!Object.keys(days).length) throw new Error('Vakit bulunamadı');
      // Gün değişiminde eski veri kalmasın diye kısa önbellek
      return json({ source: 'fazilet', fetched: new Date().toISOString(), days }, 1800);
    }
    return json({ error: 'action: cities | districts | times' }, 0, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 0, 502);
  }
};
