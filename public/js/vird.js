// Aşk-ı Merami Virdi — kâğıttaki metnin sırasıyla (kalemle eklenen sayı ve notlar hariç)
(function (g) {
  'use strict';

  const VIRD = {
    title: 'Aşk-ı Merami Virdi',
    sections: [
      {
        kind: 'note',
        text: 'Şafak sökmüş ise kaza namazı kılar veya sabah namazı kılar ve ardından dersimizi çekeriz.',
      },
      {
        kind: 'step', title: 'Derse Şöyle Başlarız',
        text: 'Bir Nasr (İzaca…) Suresini ve 3 İhlası Şerif ve Bir Fatihayı Şerif Okuyup Hibe ederiz.',
      },
      {
        kind: 'prayer', title: 'Hibe İse Şöyledir',
        text: 'Bu Cümleden Hasıl olan Sevabı Hazreti Resulu Ekrem ve Nebiyyi Muhterem Sallahu Teala Aleyhi ve Sellem Efendimizin Ruhu Şerifine, ve Cemi Peygamberani Zişan Efendilerimiz Hazeratının Ruhu Şeriflerine ve Cihari Yari Güzin Efendilerimiz Hazeratının Ruhu Şeriflerine, ve Cemi Meşayihi İzam Efendilerimiz Hazeratının da Ruhu Şeriflerine, ve Mevlana Pirimiz Seyyid-i Abdulkadir-i Geylani Hazretlerinin Ruhu Şerifine, ve Mevlana Pirimiz Şah-ı Muhammed-i Bahaeddin Nakşibendi Hazretlerinin Ruhu Şerifine, ve Halidi Bağdadi Hazretlerinin Ruhu Şerifine, ve Mevlana Pirimiz Seyyid-i Ahmed-i Rufai Hazretlerinin Ruhu Şerifine, ve Mevlana Pirimiz Celaleddin-i Rum-i Hazretlerinin Ruhu Şeriflerine, ve On İki Pir Hazeratınında Ruhu Şeriflerine, ve Mevlana Şeyhimin Şeyhi Seyyid Hacı Ali Ruhi Rahmetullahi Aleyh Hazretlerinin Ruhu Şerifine, ve İla Nihaye Şeyhimin Şeyhlarınında Ruhu Şeriflerine, ve Çoban Hacı Mustafa Efendininde Ruhu Şerifine ve Mevlana Şeyhimiz Seyyid Hacı Ahmed Aşk-i Meram-i Hazretlerinin Ruhaniyetine, Ailesinin Ruhaniyetine Anasının Babasının Aba-ı Ecdadının Ruhlarına, Hayattakilerinin Ruhaniyetine, ve Babamızın Anamızın Aba-ı Ecdadımızın, ve Bu Yolda Metfun Olmuş Din Kardeşlerimizin Ruhu Şeriflerine ve Minel Meşrik İlel Mağrib Kaffe-i Ehli İman Olan Din Kardeşlerimizinde Ruhu Şeriflerine hediyye Eyledim. Bağışladım Ya Rabbim Sen Vasıl Eyle. Himmet-i Ruhaniyelerini Bizden Haberdar, Hoşnut ve Razı Eyle. Saye-i Şefaatlerini, Saye-i Himmetlerini Üzerimize Sayeban Eyle, Alem-i Dünyada Himmeti Ruhaniyelerine ve Alem-i Manemde Gül Yüzlerini Müşahedelerine, ve Alem-i Ukbada Şefatlerine Mazhar Eyle, Ya Rabbim Rıza-i İlahiyene ve Rıza-i Pakiyene Muvaffak Eyle…',
      },
      {
        kind: 'prayer', title: 'Rabıta-i Şerif',
        text: 'Karşımda Beyti Şerif, Sağımda Şeyhim, Solumda Hz. Peygamber Efendimiz, Pirimiz Seyyid Abdulkadir-i Geylani ve On İki Pir Hazeratı Dalı Başımdadır. Deriz ve ölüm halimizi düşünürüz (tefekkür ederiz).',
        quote: 'İlahi Ente Maksudi ve Rızake Matlubi',
        after: 'der ve gözümüzü açarız ve Feyz Duasını okuruz.',
      },
      {
        kind: 'prayer', title: 'Feyz Duası',
        intro: 'Sağ elinin başparmağını sol memenin altına göğse meyilli olarak kor ve şu duayı ederiz.',
        text: 'Feyzi İlahi Tecelli Ef’alden Hz. Resul-i Ekrem ve Nebi-yyi Muhterem Sallallahü Teala Aleyhi ve Sellem Efendimiz Hazretlerinin Kalbi Şerifinden ve Hz. Adem Atamızın Kalb-i Şerifinden ve Cemi Meşayih-i İzam Efendimiz Hazeratının Kalb-i Şerifinden Mevlana Şeyhimiz Seyyid Hacı Ahmed Aşk-ı Merami Hazretlerin Kalbi Şerifine, Ondan Benim Kalbime Latife-i Nefsiye-i Varide ve Naziledir.',
        after: 'der. Beş dakika Feyz bekleriz.',
      },
      {
        kind: 'zikir', title: 'Zikirler',
        groups: [
          ['Besmele-i Şerif', 'Estağfirullah', 'Salavat-i Şerif', { t: 'Lailahe İllallah', s: '(Muhammedürresulullah kalbden)', long: true },
            'Allah', 'Hu', 'Hayy', 'Ya Kerim', 'Ya Rahman', 'Ya Rahim', 'Ya Vedut', 'Ya Latif'],
          [{ t: 'Subhanallahi Velhamdulillahi Velailahe illallahu Vallahu Ekber, Vela Havle Vela Kuvvete İlla Billahilaliyyil Azim.', long: true }],
          ['La Mevcud-e İllallah', 'La Maksud-e İllallah', 'La Mabude İllallah', 'La Alime İllallah', 'La Habire İllallah', 'La Basire İllallah', 'La Semi’a İllallah', 'La Gadire İllallah'],
          [{ t: 'La İlahe İllallah Hayrun Halas Muhammedürresullah Bi Hakkı İhlas Min Cemi’il Afat.', long: true }],
          ['İhlas-ı Şerif'],
          [{ t: 'Ya Hafiyyel Eltaf Neccina Mim Manehaf.', long: true }],
          [{ t: 'Sübhanallahi Vebihamdih-i Sübhanallahi Azim.', long: true }],
        ],
      },
      {
        kind: 'step', title: 'Dersin Bitişi',
        text: 'Tekrar Nasr (İzaca Suresi), 3 İhlas, Bir Fatihayı Şerif okuyup, aynen önceki gibi hibe edip dersi bitiririz…',
      },
    ],
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ROSE = '<svg viewBox="0 0 24 24" class="vr-rose" aria-hidden="true"><path d="M12 13.5c-3.4 0-5-2.3-4.8-4.6.1-1.3 1-2 1.9-1.6C9 5.5 10.4 4 12 4s3 1.5 2.9 3.3c.9-.4 1.8.3 1.9 1.6.2 2.3-1.4 4.6-4.8 4.6Z" fill="#c8183c"/><path d="M12 13.5v7M12 17c-1.6-1.4-3.3-1.6-4.6-.8 1.3 1.2 3 1.4 4.6.8Zm0 1.4c1.6-1.4 3.3-1.6 4.6-.8-1.3 1.2-3 1.4-4.6.8Z" stroke="#2f9a5c" stroke-width="1.3" fill="#2f9a5c" stroke-linecap="round"/></svg>';

  function render() {
    let n = 0;
    const body = VIRD.sections.map((s) => {
      if (s.kind === 'note') return `<p class="vr-note">${esc(s.text)}</p>`;
      n++;
      const head = `<h3 class="vr-h"><span class="vr-n">${n}</span>${esc(s.title)}</h3>`;
      if (s.kind === 'zikir') {
        const groups = s.groups.map((gr) => `<ol class="vr-z">${gr.map((it) => {
          const o = typeof it === 'string' ? { t: it } : it;
          return `<li class="${o.long ? 'long' : ''}">${ROSE}<span>${esc(o.t)}${o.s ? `<small>${esc(o.s)}</small>` : ''}</span></li>`;
        }).join('')}</ol>`).join('<div class="vr-sep">❀</div>');
        return `<section class="vr-sec zk">${head}${groups}</section>`;
      }
      return `<section class="vr-sec ${s.kind}">${head}
        ${s.intro ? `<p class="vr-intro">${esc(s.intro)}</p>` : ''}
        <p class="vr-text">${esc(s.text)}</p>
        ${s.quote ? `<p class="vr-quote">“${esc(s.quote)}”</p>` : ''}
        ${s.after ? `<p class="vr-after">${esc(s.after)}</p>` : ''}
      </section>`;
    }).join('');
    return `<article class="vird">
      <header class="vr-top">${ROSE}<h2>${esc(VIRD.title)}</h2><div class="vr-orn">✦ ❀ ✦</div></header>
      ${body}
      <footer class="vr-end">❀</footer>
    </article>`;
  }

  g.NVVird = { VIRD, render };
})(window);
