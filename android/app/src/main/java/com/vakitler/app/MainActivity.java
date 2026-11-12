package com.vakitler.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.ViewGroup;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.TextView;

/** Netlify'daki web uygulamasını tam ekran açar; widget/bildirim verisini köprüden alır. */
public class MainActivity extends Activity {
    static final int REQ_LOC = 1, REQ_NOTIF = 2;

    private WebView web;
    private GeolocationPermissions.Callback geoCb;
    private String geoOrigin;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        FrameLayout box = new FrameLayout(this);
        box.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(box);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " VakitlerApp/1");

        web.addJavascriptInterface(new Bridge(this), "AndroidBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String host = Uri.parse(Prefs.siteUrl(MainActivity.this)).getHost();
                if (host != null && host.equalsIgnoreCase(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                offerWidgetOnce();
            }

            @Override
            public void onReceivedError(WebView v, android.webkit.WebResourceRequest req, android.webkit.WebResourceError err) {
                if (req.isForMainFrame()) showOffline();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    cb.invoke(origin, true, false);
                } else {
                    geoCb = cb;
                    geoOrigin = origin;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOC);
                }
            }
        });

        String url = Prefs.siteUrl(this);
        if (url.isEmpty()) askUrl();
        else web.loadUrl(url);
    }

    /** İlk açılışta, ana ekranda hiç widget yoksa bir kez widget eklemeyi önerir (web kodundan bağımsız). */
    private boolean offered;
    private void offerWidgetOnce() {
        if (offered || Prefs.flag(this, "pinOffered") || PinActivity.count(this) > 0) return;
        offered = true;
        web.postDelayed(() -> {
            if (isFinishing()) return;
            Prefs.setFlag(this, "pinOffered", true);
            new AlertDialog.Builder(this)
                    .setTitle("Ana ekrana vakit widget'ı")
                    .setMessage("Namaz vakitlerini telefonun ana ekranında görmek ister misiniz?\n\nDaha sonra da: uygulama simgesine basılı tutun → “Widget ekle”, ya da ana ekranda boş yere basılı tutun → Widget'lar → Vakitler.")
                    .setPositiveButton("Widget seç", (d, w) -> PinActivity.show(this, false))
                    .setNegativeButton("Sonra", null)
                    .show();
        }, 2500);
    }

    /** İlk açılışta (veya istenince) Netlify site adresini sorar. */
    void askUrl() {
        final EditText in = new EditText(this);
        in.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        String cur = Prefs.siteUrl(this);
        in.setText(cur.isEmpty() ? "https://" : cur);
        in.setSelection(in.getText().length());
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        FrameLayout f = new FrameLayout(this);
        f.setPadding(pad, pad / 2, pad, 0);
        f.addView(in);
        new AlertDialog.Builder(this)
                .setTitle("Site adresi")
                .setMessage("Netlify sitenizin adresini yazın (ör. vakitlerim.netlify.app)")
                .setView(f)
                .setCancelable(false)
                .setPositiveButton("Kaydet", (d, w) -> {
                    String u = in.getText().toString().trim();
                    if (!u.startsWith("http")) u = "https://" + u;
                    if (!u.endsWith("/")) u = u + "/";
                    Prefs.setSiteUrl(this, u);
                    web.loadUrl(u);
                })
                .show();
    }

    private void showOffline() {
        // Service worker önbelleği varsa sayfa zaten açılır; yoksa bilgi göster
        TextView t = new TextView(this);
        int pad = (int) (24 * getResources().getDisplayMetrics().density);
        t.setPadding(pad, pad * 3, pad, pad);
        t.setTextSize(17);
        t.setText("İlk açılış için internet gerekiyor.\n\nİnternete bağlanıp uygulamayı yeniden açın. Bir kez açıldıktan sonra vakitler internetsiz de çalışır.\n\nAdresi değiştirmek için buraya dokunun.");
        t.setOnClickListener(v -> askUrl());
        ((FrameLayout) web.getParent()).addView(t, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        t.setBackgroundColor(0xFFF5F2EA);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        boolean ok = res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED;
        if (code == REQ_LOC && geoCb != null) { geoCb.invoke(geoOrigin, ok, false); geoCb = null; }
        if (code == REQ_NOTIF) Updater.refresh(this);
    }

    @Override
    protected void onResume() {
        super.onResume();
        try { Updater.refresh(this); } catch (Throwable ignored) {}
        try { UpdateChecker.check(this, false); } catch (Throwable ignored) {} // yeni sürüm varsa otomatik indirip kurar
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
