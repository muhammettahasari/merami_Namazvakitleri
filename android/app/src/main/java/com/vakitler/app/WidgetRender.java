package com.vakitler.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.widget.RemoteViews;

/** Tüm widget'ları çizer. Renk kuralı: Fazilet yeşil, Diyanet mavi; "üstteki" kaynak ayardan gelir. */
final class WidgetRender {
    private WidgetRender() {}

    static final int FZ = 0xFF18794A, DY = 0xFF1D5FB4, INK = 0xFF17212B, MUTED = 0xFF7A8592, GOLD = 0xFFB8893A;

    static void updateAll(Context c, Model m) {
        AppWidgetManager am = AppWidgetManager.getInstance(c);
        update(c, am, TabloWidget.class, tablo(c, m));
        update(c, am, KompaktWidget.class, kompakt(c, m));
        update(c, am, SeritWidget.class, serit(c, m));
        update(c, am, ListeWidget.class, liste(c, m));
    }

    private static void update(Context c, AppWidgetManager am, Class<?> cls, RemoteViews v) {
        int[] ids = am.getAppWidgetIds(new ComponentName(c, cls));
        if (ids != null && ids.length > 0) am.updateAppWidget(ids, v);
    }

    private static PendingIntent open(Context c) {
        Intent i = new Intent(c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static int id(Context c, String name) {
        return c.getResources().getIdentifier(name, "id", c.getPackageName());
    }

    /** Geri sayım: Chronometer, sistem tarafından her saniye kendiliğinden güncellenir. */
    private static void countdown(RemoteViews v, int viewId, Model.Ev e) {
        if (e == null) { v.setChronometer(viewId, SystemClock.elapsedRealtime(), "", false); return; }
        long base = SystemClock.elapsedRealtime() + (e.at - System.currentTimeMillis());
        v.setChronometer(viewId, base, null, true);
        v.setChronometerCountDown(viewId, true);
    }

    // Üstteki (a) ve alttaki (b) kaynak
    private static boolean aIsF(Model m) { return m.fazTop; }

    // ---------------- TABLO (4x2) ----------------
    static RemoteViews tablo(Context c, Model m) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_tablo);
        v.setOnClickPendingIntent(R.id.root, open(c));
        v.setTextViewText(R.id.t_loc, m.loc);
        v.setTextViewText(R.id.t_date, m.date);
        for (int i = 0; i < 5; i++) {
            int h = id(c, "h" + i);
            v.setTextViewText(h, Model.COL_LABEL[i]);
            v.setTextColor(h, i == m.curCol ? GOLD : MUTED);
        }
        if (!m.ok) {
            v.setTextViewText(R.id.t_next, m.msg);
            v.setChronometer(R.id.ch_next, SystemClock.elapsedRealtime(), "", false);
            for (int i = 0; i < 5; i++) { v.setTextViewText(id(c, "a" + i), "—"); v.setTextViewText(id(c, "b" + i), "—"); }
            v.setTextViewText(R.id.t_teh, "");
            v.setTextViewText(R.id.t_extra, "");
            return v;
        }
        boolean aF = aIsF(m);
        fillRow(c, v, "a", aF, m);
        fillRow(c, v, "b", !aF, m);
        Model.Ev nx = m.nextTop();
        v.setTextViewText(R.id.t_next, nx == null ? "" : nx.name());
        countdown(v, R.id.ch_next, nx);
        v.setTextViewText(R.id.t_teh, "Teheccüd  F " + m.tehF + "  ·  D " + m.tehD);
        v.setTextViewText(R.id.t_extra, "İmsak " + m.fImsak + " · Güneş " + m.fGunes);
        return v;
    }

    private static void fillRow(Context c, RemoteViews v, String p, boolean isF, Model m) {
        int row = id(c, "row" + p.toUpperCase());
        int src = id(c, p + "_src");
        v.setInt(row, "setBackgroundResource", isF ? R.drawable.row_fz : R.drawable.row_dy);
        v.setInt(src, "setBackgroundResource", isF ? R.drawable.badge_fz : R.drawable.badge_dy);
        v.setTextViewText(src, isF ? "F" : "D");
        String[] t = isF ? m.f : m.d;
        for (int i = 0; i < 5; i++) {
            int tv = id(c, p + i);
            v.setTextViewText(tv, t[i]);
            v.setTextColor(tv, isF ? FZ : DY);
        }
    }

    // ---------------- KOMPAKT (2x2) ----------------
    static RemoteViews kompakt(Context c, Model m) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_kompakt);
        v.setOnClickPendingIntent(R.id.root, open(c));
        v.setTextViewText(R.id.k_loc, m.loc);
        if (!m.ok) {
            v.setTextViewText(R.id.k_name, "");
            v.setTextViewText(R.id.ka_src, m.msg); v.setTextViewText(R.id.ka_time, "");
            v.setTextViewText(R.id.kb_src, ""); v.setTextViewText(R.id.kb_time, "");
            countdown(v, R.id.ka_ch, null); countdown(v, R.id.kb_ch, null);
            v.setTextViewText(R.id.k_teh, "");
            return v;
        }
        boolean aF = aIsF(m);
        Model.Ev a = aF ? m.nextF : m.nextD, b = aF ? m.nextD : m.nextF;
        Model.Ev nx = a != null ? a : b;
        v.setTextViewText(R.id.k_name, nx == null ? "" : nx.name());
        box(v, R.id.boxA, R.id.ka_src, R.id.ka_time, R.id.ka_ch, aF, a, m);
        box(v, R.id.boxB, R.id.kb_src, R.id.kb_time, R.id.kb_ch, !aF, b, m);
        v.setTextViewText(R.id.k_teh, "Teheccüd " + (aF ? m.tehF : m.tehD));
        return v;
    }

    private static void box(RemoteViews v, int box, int src, int time, int ch, boolean isF, Model.Ev e, Model m) {
        v.setInt(box, "setBackgroundResource", isF ? R.drawable.box_fz : R.drawable.box_dy);
        String name = e == null ? "" : " · " + e.name();
        v.setTextViewText(src, (isF ? "Fazilet" : "Diyanet") + name);
        v.setTextViewText(time, e == null ? "—" : ((isF && m.fEst ? "≈" : "") + e.hm));
        countdown(v, ch, e);
    }

    // ---------------- ŞERİT (4x1) ----------------
    static RemoteViews serit(Context c, Model m) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_serit);
        v.setOnClickPendingIntent(R.id.root, open(c));
        boolean aF = aIsF(m);
        for (int i = 0; i < 6; i++) {
            int l = id(c, "s" + i + "_l"), a = id(c, "s" + i + "_a"), b = id(c, "s" + i + "_b"), col = id(c, "col" + i);
            v.setTextColor(a, aF ? FZ : DY);
            v.setTextColor(b, aF ? DY : FZ);
            if (i < 5) {
                v.setTextViewText(l, Model.COL_LABEL[i]);
                v.setTextViewText(a, m.ok ? (aF ? m.f[i] : m.d[i]) : "—");
                v.setTextViewText(b, m.ok ? (aF ? m.d[i] : m.f[i]) : "—");
                v.setInt(col, "setBackgroundResource", i == m.curCol && m.ok ? R.drawable.cell_on : R.drawable.cell_off);
            } else {
                v.setTextViewText(l, "Teheccüd");
                v.setTextViewText(a, first(aF ? m.tehF : m.tehD));
                v.setTextViewText(b, first(aF ? m.tehD : m.tehF));
            }
        }
        return v;
    }

    private static String first(String teh) {
        if (teh == null) return "—";
        int k = teh.indexOf('–');
        return k > 0 ? teh.substring(0, k) : teh;
    }

    // ---------------- LİSTE (2x4) ----------------
    static RemoteViews liste(Context c, Model m) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_liste);
        v.setOnClickPendingIntent(R.id.root, open(c));
        boolean aF = aIsF(m);
        v.setTextViewText(R.id.l_loc, m.ok ? m.loc : m.msg);
        v.setTextViewText(R.id.l_ha, aF ? "F" : "D");
        v.setTextViewText(R.id.l_hb, aF ? "D" : "F");
        v.setInt(R.id.l_ha, "setBackgroundResource", aF ? R.drawable.badge_fz : R.drawable.badge_dy);
        v.setInt(R.id.l_hb, "setBackgroundResource", aF ? R.drawable.badge_dy : R.drawable.badge_fz);
        for (int i = 0; i < 5; i++) {
            int n = id(c, "l" + i + "_n"), a = id(c, "l" + i + "_a"), b = id(c, "l" + i + "_b"), row = id(c, "lr" + i);
            v.setTextViewText(n, Model.COL_LABEL[i]);
            v.setTextViewText(a, m.ok ? (aF ? m.f[i] : m.d[i]) : "—");
            v.setTextViewText(b, m.ok ? (aF ? m.d[i] : m.f[i]) : "—");
            v.setTextColor(a, aF ? FZ : DY);
            v.setTextColor(b, aF ? DY : FZ);
            v.setInt(row, "setBackgroundResource", i == m.curCol && m.ok ? R.drawable.cell_on : R.drawable.cell_off);
        }
        v.setTextViewText(R.id.l_x1, m.fImsak + " · " + m.fGunes);
        v.setTextViewText(R.id.l_x2, "F " + m.tehF + "\nD " + m.tehD);
        return v;
    }
}
