package com.vakitler.app;

import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Uygulama içi güncelleme: GitHub "Releases" sayfasındaki en son Vakitler.apk'yı denetler,
 * yeni sürüm varsa sorar, indirir ve Android'in kurulum penceresini açar.
 */
final class UpdateChecker {
    private UpdateChecker() {}

    static final String API = "https://api.github.com/repos/muhammettahasari/merami_Namazvakitleri/releases/latest";
    private static final long INTERVAL = 10L * 60 * 1000; // uygulama her açıldığında (en fazla 10 dakikada bir) denetlenir
    private static volatile boolean busy;

    static long currentCode(Context c) {
        try {
            PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    static String currentName(Context c) {
        try {
            return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }

    /** manual: kullanıcı "Güncellemeleri denetle"ye bastıysa sonuç ne olursa olsun bilgi verir. */
    static void check(MainActivity a, boolean manual) {
        if (busy) return;
        long now = System.currentTimeMillis();
        if (!manual && now - Prefs.num(a, "updCheck") < INTERVAL) return;
        busy = true;
        if (manual) Toast.makeText(a, "Güncelleme denetleniyor…", Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            try {
                HttpURLConnection con = (HttpURLConnection) new URL(API).openConnection();
                con.setRequestProperty("Accept", "application/vnd.github+json");
                con.setConnectTimeout(15000);
                con.setReadTimeout(15000);
                String body;
                try (InputStream in = con.getInputStream()) {
                    // readAllBytes() Android 13 öncesinde yok: elle oku
                    java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                    byte[] b = new byte[16384]; int n;
                    while ((n = in.read(b)) > 0) bo.write(b, 0, n);
                    body = bo.toString("UTF-8");
                }
                JSONObject j = new JSONObject(body);
                String tag = j.optString("tag_name", "");           // ör. v1.0.6
                long latest = Long.parseLong(tag.substring(tag.lastIndexOf('.') + 1));
                String url = null;
                JSONArray assets = j.optJSONArray("assets");
                if (assets != null) for (int i = 0; i < assets.length(); i++) {
                    JSONObject as = assets.getJSONObject(i);
                    if (as.optString("name").endsWith(".apk")) { url = as.optString("browser_download_url"); break; }
                }
                Prefs.setNum(a, "updCheck", System.currentTimeMillis());
                final String dl = url;
                final String ver = tag.startsWith("v") ? tag.substring(1) : tag;
                a.runOnUiThread(() -> {
                    busy = false;
                    if (a.isFinishing()) return;
                    if (latest > currentCode(a) && dl != null) {
                        // Otomatik: sormadan indirir ve kurar
                        Toast.makeText(a, "Yeni sürüm " + ver + " indiriliyor…", Toast.LENGTH_SHORT).show();
                        download(a, dl, manual);
                    } else if (manual) {
                        Toast.makeText(a, "Uygulama güncel ✓ (" + currentName(a) + ")", Toast.LENGTH_LONG).show();
                    }
                });
            } catch (Throwable e) {
                a.runOnUiThread(() -> {
                    busy = false;
                    if (manual) Toast.makeText(a, "Güncelleme denetlenemedi. İnternet bağlantısını kontrol edin.", Toast.LENGTH_LONG).show();
                });
            }
        }).start();
    }

    private static void download(MainActivity a, String url, boolean showProgress) {
        // Android 8+: "Bu kaynaktan uygulama yükle" izni yoksa ayarı aç
        if (Build.VERSION.SDK_INT >= 26 && !a.getPackageManager().canRequestPackageInstalls()) {
            new AlertDialog.Builder(a)
                    .setTitle("Otomatik güncelleme izni")
                    .setMessage("Uygulamanın kendini güncelleyebilmesi için bir kez izin vermeniz gerekiyor.\n\nAçılan ekranda “Bu kaynaktan izin ver”i açıp geri dönün.")
                    .setPositiveButton("İzin ver", (d, w) -> {
                        try { a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName()))); } catch (Exception ignored) {}
                    })
                    .setNegativeButton("Sonra", null)
                    .show();
            Prefs.setNum(a, "updCheck", 0); // geri dönünce yeniden denesin
            return;
        }
        final AlertDialog prog = new AlertDialog.Builder(a)
                .setTitle("Güncelleme indiriliyor")
                .setMessage("Lütfen bekleyin… %0")
                .setCancelable(false)
                .create();
        if (showProgress) prog.show();
        new Thread(() -> {
            try {
                PackageInstaller pi = a.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams p = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                p.setAppPackageName(a.getPackageName());
                // Android 12+: uygulama kendini daha önce güncellediyse onay sormadan kurulur
                if (Build.VERSION.SDK_INT >= 31) p.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
                int id = pi.createSession(p);
                try (PackageInstaller.Session s = pi.openSession(id)) {
                    HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
                    con.setInstanceFollowRedirects(true);
                    con.setConnectTimeout(20000);
                    con.setReadTimeout(30000);
                    long total = con.getContentLengthLong();
                    try (InputStream in = con.getInputStream(); OutputStream out = s.openWrite("Vakitler.apk", 0, total > 0 ? total : -1)) {
                        byte[] buf = new byte[65536];
                        long done = 0; int n, last = -1;
                        while ((n = in.read(buf)) > 0) {
                            out.write(buf, 0, n);
                            done += n;
                            int pct = total > 0 ? (int) (done * 100 / total) : -1;
                            if (pct != last) { last = pct; final int pp = pct; a.runOnUiThread(() -> prog.setMessage("Lütfen bekleyin… %" + Math.max(pp, 0))); }
                        }
                        s.fsync(out);
                    }
                    Intent i = new Intent(a, InstallReceiver.class);
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                    PendingIntent pend = PendingIntent.getBroadcast(a, id, i, flags);
                    s.commit(pend.getIntentSender());
                }
                a.runOnUiThread(() -> { if (prog.isShowing()) prog.dismiss(); });
            } catch (Throwable e) {
                a.runOnUiThread(() -> {
                    if (prog.isShowing()) prog.dismiss();
                    Toast.makeText(a, "Güncelleme indirilemedi: " + e.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        }).start();
    }
}
