package com.vakitler.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import java.time.LocalDate;
import java.time.ZoneId;

/** Widget'ları ve kilit ekranı bildirimini yeniler, bir sonraki vakit geçişine alarm kurar. */
final class Updater {
    private Updater() {}

    static final String CHANNEL = "vakit";
    static final int NOTIF_ID = 1;

    static void refresh(Context c) {
        long now = System.currentTimeMillis();
        Model m = Model.load(c, now);
        try { WidgetRender.updateAll(c, m); } catch (Exception ignored) {}
        try { notification(c, m); } catch (Exception ignored) {}
        try { schedule(c, m, now); } catch (Exception ignored) {}
    }

    // ---------------- alarm ----------------
    private static void schedule(Context c, Model m, long now) {
        long next = LocalDate.now().plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli() + 5000;
        if (m.nextD != null && m.nextD.at > now) next = Math.min(next, m.nextD.at + 1500);
        if (m.nextF != null && m.nextF.at > now) next = Math.min(next, m.nextF.at + 1500);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(c, TickReceiver.class).setAction("com.vakitler.app.TICK");
        PendingIntent pi = PendingIntent.getBroadcast(c, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
        // Halka ilerlemesi ve Cam rengi için 15 dakikada bir hafif yenileme (telefonu uyandırmaz)
        Intent i2 = new Intent(c, TickReceiver.class).setAction("com.vakitler.app.SOFT");
        PendingIntent pi2 = PendingIntent.getBroadcast(c, 2, i2, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.set(AlarmManager.RTC, now + 15 * 60 * 1000L, pi2);
    }

    // ---------------- kilit ekranı bildirimi ----------------
    static void notification(Context c, Model m) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        boolean allowed = Build.VERSION.SDK_INT < 33
                || c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        if (!Prefs.lock(c) || !allowed || !m.ok) { nm.cancel(NOTIF_ID); return; }

        NotificationChannel ch = new NotificationChannel(CHANNEL, "Kilit ekranında vakitler", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Sıradaki namaz vakti ve geri sayım");
        ch.setShowBadge(false);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);

        boolean aF = m.fazTop;
        Model.Ev nx = m.nextTop();
        Model.Ev other = aF ? m.nextD : m.nextF;
        String title = nx == null ? m.loc : ("Sıradaki: " + nx.name() + "  " + (aF ? "V " : "D ") + nx.hm
                + (other != null ? "  ·  " + (aF ? "D " : "V ") + other.hm : ""));
        String line = "Teheccüd  V " + m.tehF + "  ·  D " + m.tehD;

        StringBuilder big = new StringBuilder();
        String[] rowsA = aF ? m.f : m.d, rowsB = aF ? m.d : m.f;
        big.append(aF ? "Verâ  " : "Diyanet  ").append(join(rowsA)).append('\n');
        big.append(aF ? "Diyanet  " : "Verâ  ").append(join(rowsB)).append('\n');
        big.append("Verâ Sabah namazı ").append(m.fSabah).append(" · Asr-ı Sânî ").append(m.asrSani).append('\n');
        big.append("Oruç İmsak'ta başlar; Sabah saati namaz içindir.").append('\n');
        big.append(line);

        Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 2, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat)
                .setColor(aF ? WidgetRender.FZ : WidgetRender.DY)
                .setContentTitle(title)
                .setContentText(m.loc + " · " + line)
                .setSubText(m.loc)
                .setStyle(new Notification.BigTextStyle().bigText(big.toString()))
                .setContentIntent(pi)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(nx != null)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setCategory(Notification.CATEGORY_STATUS);
        if (nx != null) {
            b.setWhen(nx.at).setUsesChronometer(true).setChronometerCountDown(true);
        }
        String style = Prefs.lockStyle(c);
        try {
            android.widget.RemoteViews rv = null;
            if ("tablo".equals(style)) rv = notifTablo(c, m);
            else if ("sayac".equals(style) && nx != null) rv = notifSayac(c, nx.name() + " vaktine", nx.at,
                    (aF ? "V " : "D ") + nx.hm, other == null ? "" : (aF ? "D " : "V ") + other.hm);
            else if ("oruc".equals(style) && m.orucAt > 0) rv = notifSayac(c, (m.orucIftar ? "🌇 " : "🌙 ") + m.orucLabel, m.orucAt,
                    "İmsak V " + m.imsakF + " · D " + m.imsakD, "İftar V " + m.aksamF + " · D " + m.aksamD);
            if (rv != null) {
                b.setStyle(new Notification.DecoratedCustomViewStyle()).setCustomContentView(rv).setCustomBigContentView(rv);
                if ("tablo".equals(style)) b.setContentTitle(title);
            }
        } catch (Throwable ignored) {}
        nm.notify(NOTIF_ID, b.build());
    }

    private static android.widget.RemoteViews notifTablo(Context c, Model m) {
        android.widget.RemoteViews v = new android.widget.RemoteViews(c.getPackageName(), R.layout.notif_tablo);
        boolean aF = m.fazTop;
        String[][] rows = {aF ? m.f : m.d, aF ? m.d : m.f};
        String[] pre = {"na", "nb"};
        for (int r = 0; r < 2; r++) {
            boolean isF = (r == 0) == aF;
            int src = c.getResources().getIdentifier(pre[r] + "_s", "id", c.getPackageName());
            v.setTextViewText(src, isF ? "V" : "D");
            v.setInt(src, "setBackgroundResource", isF ? R.drawable.badge_fz : R.drawable.badge_dy);
            for (int i = 0; i < 5; i++) {
                int id = c.getResources().getIdentifier(pre[r] + i, "id", c.getPackageName());
                v.setTextViewText(id, rows[r][i]);
                v.setTextColor(id, isF ? WidgetRender.FZ : WidgetRender.DY);
            }
        }
        return v;
    }

    private static android.widget.RemoteViews notifSayac(Context c, String label, long at, String a, String b) {
        android.widget.RemoteViews v = new android.widget.RemoteViews(c.getPackageName(), R.layout.notif_sayac);
        v.setTextViewText(R.id.ns_lbl, label);
        long base = android.os.SystemClock.elapsedRealtime() + (at - System.currentTimeMillis());
        v.setChronometer(R.id.ns_ch, base, null, true);
        v.setChronometerCountDown(R.id.ns_ch, true);
        v.setTextViewText(R.id.ns_a, a);
        v.setTextViewText(R.id.ns_b, b);
        return v;
    }

    private static String join(String[] t) {
        StringBuilder s = new StringBuilder();
        for (int i = 0; i < t.length; i++) {
            if (i > 0) s.append(" · ");
            s.append(Model.COL_LABEL[i]).append(' ').append(t[i]);
        }
        return s.toString();
    }
}
