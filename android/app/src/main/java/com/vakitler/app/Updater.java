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
        nm.notify(NOTIF_ID, b.build());
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
