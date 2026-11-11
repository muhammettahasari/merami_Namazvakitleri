# Namaz Vakitleri — Diyanet & Fazilet (PWA)

Android, iPhone ve web'de çalışan, internetsiz açılan namaz vakti uygulaması.
Diyanet (mavi) ve Fazilet (yeşil) vakitlerini alt alta gösterir, 7 farklı widget stili içerir.

## Netlify'a yükleme

Uygulama, vakitleri sitelerden çekmek için **Netlify Functions** kullanır
(tarayıcı bu sitelere doğrudan erişemez). Netlify'ın sürükle-bırak (Drop) yüklemesi
fonksiyonları her zaman kurmaz, bu yüzden şu iki yoldan birini kullanın:

**A) GitHub ile (önerilen)**
1. Bu klasörü bir GitHub deposuna yükleyin.
2. Netlify → *Add new site* → *Import an existing project* → depoyu seçin.
3. Ayarlar `netlify.toml`'dan otomatik gelir (publish: `public`, functions: `netlify/functions`). *Deploy*.

**B) Netlify CLI ile**
```
npm i -g netlify-cli
netlify login
netlify deploy --prod      # bu klasörün içinde çalıştırın
```

## Telefona kurma
- **Android (Chrome):** siteyi açın → ⋮ → *Uygulamayı yükle / Ana ekrana ekle*.
- **iPhone (Safari):** Paylaş → *Ana Ekrana Ekle*.
- İlk açılışta il ve ilçe seçilir; vakitler indirilip telefona kaydedilir.
- “İl ekle” için internet gerekir, sonrası internetsiz çalışır.

## Veri kaynakları
| Kaynak | Ne kadar veri | Nasıl |
|---|---|---|
| namazvakitleri.diyanet.gov.tr | Yılın tamamı (yıllık tablo) + gelecek 30 gün | İlçe sayfasındaki tablolar okunur. Ulaşılamazsa ezanvakti.emushaf.net aynasından (Diyanet verisi) 30 gün alınır. |
| namaz-vakitleri.fazilettakvimi.com | Tek seferde 3 gün (dün/bugün/yarın) | Site daha fazlasını vermiyor. Uygulama her açılışta (ve açıkken 30 dk'da bir) yeni günleri biriktirir. |

Fazilet verisi olmayan günler için (isteğe bağlı, Ayarlar'dan kapatılabilir) en yakın gerçek
Fazilet gününün Diyanet'e göre farkı uygulanarak **≈ tahmini** değer gösterilir.

**Teheccüd:** gecenin son üçte biri — akşam ile ertesi gün imsak arası sürenin son 1/3'ü.
Her kaynak için kendi akşam/imsak vaktiyle ayrı hesaplanır.

## Widget'lar
Tablo (4×2), Kompakt (2×2), Şerit (4×1), Liste (2×4), Halka (2×2), Gece (AMOLED), Cam.
Widget'larda varsayılan: **Fazilet yeşil üstte, Diyanet mavi altta** (Widget sekmesinden değiştirilebilir).
Ana ekranda varsayılan: Diyanet üstte (Ayarlar'dan değiştirilebilir).

Not: PWA'lar Android/iOS'ta gerçek ana ekran widget'ı oluşturamaz (işletim sistemi kısıtı).
Her stil `/widget.html?s=<stil>` adresinde tam ekran “widget ekranı” olarak açılır ve ayrı
bir simge olarak ana ekrana eklenebilir. Gerçek widget isterseniz proje Capacitor ile yerel
uygulamaya sarılıp native widget eklenebilir.

## Kıble bulucu
- Kıble açısı büyük daire formülüyle hesaplanır (İstanbul 151,6°, Ankara 160,2°, Londra 119,0° gibi bilinen değerlerle doğrulandı).
- Manyetik sapma NOAA **WMM-2025** modeliyle konuma göre hesaplanır (`public/js/wmm.js`, NOAA'nın 100 resmi test değeriyle ±0,01° doğrulandı). Türkiye'de ≈ +5…+7°.
- Pusula: Android `deviceorientationabsolute`, iPhone `webkitCompassHeading` (iOS'ta “Pusulayı başlat” izin ister).
- Uyarılar: eğim (kabarcık), sinyal oynaklığı / kalibrasyon (8 çizme), iOS pusula hassasiyeti, sensör yok.
- Sensörsüz doğrulama: **Kıble saati** (güneşe dönünce kıble), gölge yöntemi ve **gölge ile pusula kalibrasyonu** (ölçülen fark kaydedilir).
- Kıbleye hizalanınca halka yeşil olur ve titrer.

## Zikirmatik
- Serbest sayaç: hedef (33/99/100/500/1000/özel), mod: *Tek hedef*, *Her hedefte uyar* (100, 200, 300…), *Uyar ve sıfırla* (tur sayar).
- Her tıkta ve hedefte titreşim/ses ayrı ayrı açılıp kapatılır, desen ve ses seçilir, ▶ ile denenir. Ara uyarı (her 10/33/100).
- Zikir listeleri: ad, not, zikirler (ad, adet, not), sıralama. “Başlat” → sırayla sayar, her hedefte titreşir/ses verir, otomatik sonrakine geçer (ayardan kapatılabilir).
- Günlük toplam ve son 7 gün kaydı, ekranı açık tutma, klavyede boşluk/Enter ile sayma.
- iPhone: Safari titreşim API'sini desteklemez; iOS 18+ için hafif dokunsal tık kullanılır.

## Android uygulaması (gerçek ana ekran widget'ları + kilit ekranı)
`android/` klasörü, web uygulamasını açan ve telefonun widget listesine 4 widget ekleyen bir Android uygulamasıdır
(Tablo 4×2, Kompakt 2×2, Şerit 4×1, Liste 2×4). Ayarlar'daki “Kilit ekranında vakitleri göster” açılınca
sıradaki vakit ve geri sayım kilit ekranında bildirim olarak durur.

- GitHub'a yüklenen her değişiklikte `.github/workflows/android.yml` APK'yı derler ve **Releases** sayfasına `Vakitler.apk` olarak koyar.
- APK sabit bir anahtarla imzalanır (`android/app/vakitler.jks`), yeni sürümler eskisinin üzerine güncelleme olarak kurulur.
- İlk açılışta Netlify site adresi sorulur (istenirse `android/app/src/main/res/values/strings.xml` içindeki `site_url`'ye yazılabilir).
- Widget verisi web uygulamasından gelir (62 gün); widget'lar vakit geçişlerinde ve gece yarısı kendiliğinden yenilenir.

## Klasör yapısı
```
netlify.toml
netlify/functions/diyanet.mjs   il/ilçe/vakit (Diyanet)
netlify/functions/fazilet.mjs   il/ilçe/vakit (Fazilet)
netlify/functions/_parse.mjs    HTML ayrıştırıcılar
public/index.html               uygulama
public/widget.html              tam ekran widget sayfası
public/js/core.js               depolama, senkron, hesaplar
public/js/widgets.js            widget çizicileri
public/js/app.js                arayüz
public/js/qibla.js              kıble bulucu
public/js/wmm.js                manyetik sapma modeli (WMM-2025)
public/js/zikir.js              zikirmatik
public/js/fx.js                 titreşim ve ses
public/sw.js                    çevrimdışı önbellek
```

## API (kendi sitenizde)
- `/api/diyanet?action=states` · `?action=districts&state=554` · `?action=times&id=9702`
- `/api/fazilet?action=cities` · `?action=districts&il=46` · `?action=times&path=/malatya/kuluncak`

Sitelerin yapısı değişirse `netlify/functions/_parse.mjs` güncellenmelidir.
