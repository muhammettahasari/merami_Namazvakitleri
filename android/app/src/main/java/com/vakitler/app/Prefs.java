package com.vakitler.app;

import android.content.Context;
import android.content.SharedPreferences;

/** Uygulama ayarları: site adresi, widget verisi, kilit ekranı tercihi. */
final class Prefs {
    private Prefs() {}

    private static SharedPreferences sp(Context c) {
        return c.getSharedPreferences("nvw", Context.MODE_PRIVATE);
    }

    static String siteUrl(Context c) {
        String s = sp(c).getString("site", null);
        if (s == null || s.isEmpty()) s = c.getString(R.string.site_url);
        return s == null ? "" : s.trim();
    }

    static void setSiteUrl(Context c, String url) {
        sp(c).edit().putString("site", url).apply();
    }

    static String data(Context c) {
        return sp(c).getString("data", null);
    }

    static void setData(Context c, String json) {
        sp(c).edit().putString("data", json).apply();
    }

    static boolean flag(Context c, String k) { return sp(c).getBoolean(k, false); }

    static void setFlag(Context c, String k, boolean v) { sp(c).edit().putBoolean(k, v).apply(); }

    static boolean lock(Context c) {
        return sp(c).getBoolean("lock", false);
    }

    static void setLock(Context c, boolean on) {
        sp(c).edit().putBoolean("lock", on).apply();
    }
}
