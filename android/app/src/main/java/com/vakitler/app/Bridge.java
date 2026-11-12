package com.vakitler.app;

import android.Manifest;
import android.appwidget.AppWidgetManager;
import android.content.pm.PackageManager;
import android.os.Build;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;

/** Web uygulamasının (window.AndroidBridge) çağırdığı yerel işlevler. */
final class Bridge {
    private final MainActivity a;

    Bridge(MainActivity a) { this.a = a; }

    @JavascriptInterface
    public boolean isNative() { return true; }

    /** 62 günlük vakit verisi: widget ve bildirim bunu kullanır. */
    @JavascriptInterface
    public void saveWidgetData(String json) {
        Prefs.setData(a, json);
        Updater.refresh(a);
    }

    @JavascriptInterface
    public boolean getLockscreen() { return Prefs.lock(a); }

    @JavascriptInterface
    public void setLockscreen(boolean on) {
        Prefs.setLock(a, on);
        if (on && Build.VERSION.SDK_INT >= 33
                && a.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            a.runOnUiThread(() -> a.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, MainActivity.REQ_NOTIF));
        }
        Updater.refresh(a);
    }

    @JavascriptInterface
    public void keepScreenOn(boolean on) {
        a.runOnUiThread(() -> {
            if (on) a.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else a.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }

    /** Widget'ı doğrudan ana ekrana ekleme isteği (telefon onay sorar). */
    @JavascriptInterface
    public boolean pinWidget(String kind) {
        Class<?> cls;
        switch (kind == null ? "" : kind) {
            case "kompakt": cls = KompaktWidget.class; break;
            case "serit": cls = SeritWidget.class; break;
            case "liste": cls = ListeWidget.class; break;
            default: cls = TabloWidget.class;
        }
        final Class<?> c = cls;
        a.runOnUiThread(() -> PinActivity.pin(a, c));
        return AppWidgetManager.getInstance(a).isRequestPinAppWidgetSupported();
    }

    /** Yerel widget seçme penceresi */
    @JavascriptInterface
    public void showWidgetPicker() { a.runOnUiThread(() -> PinActivity.show(a, false)); }

    @JavascriptInterface
    public int widgetCount() { return PinActivity.count(a); }

    @JavascriptInterface
    public String appVersion() { return UpdateChecker.currentName(a); }

    @JavascriptInterface
    public void checkUpdate() { a.runOnUiThread(() -> UpdateChecker.check(a, true)); }

    @JavascriptInterface
    public void changeSite() { a.runOnUiThread(a::askUrl); }
}
