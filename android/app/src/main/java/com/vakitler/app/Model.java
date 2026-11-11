package com.vakitler.app;

import android.content.Context;

import org.json.JSONObject;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * Widget ve bildirim için o anki durum.
 * Veri, web uygulaması tarafından (AndroidBridge.saveWidgetData) 62 günlük olarak kaydedilir.
 */
final class Model {

    static final String[] COL_LABEL = {"Sabah", "Öğle", "İkindi", "Akşam", "Yatsı"};
    private static final String[] D_KEYS = {"imsak", "gunes", "ogle", "ikindi", "aksam", "yatsi"};
    private static final String[] F_KEYS = {"imsak", "sabah", "gunes", "ogle", "ikindi", "aksam", "yatsi"};
    private static final String[] AY = {"Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"};
    private static final String[] GUN = {"Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"};

    static final class Ev {
        String key;   // imsak, sabah, gunes...
        String hm;    // 05:39
        long at;      // epoch ms
        String name() { return label(key); }
    }

    boolean ok;
    String msg = "";
    String loc = "";
    String date = "";
    boolean fazTop = true;      // widget'ta Fazilet üstte mi
    boolean hasD, hasF, fEst;
    final String[] d = new String[5];
    final String[] f = new String[5];
    String fImsak = "—", fGunes = "—", dGunes = "—";
    String tehD = "—", tehF = "—";
    int curCol = -1;
    Ev nextD, nextF;

    /** Üstteki / alttaki kaynağın sıradaki vakti */
    Ev nextTop() { return fazTop ? (nextF != null ? nextF : nextD) : (nextD != null ? nextD : nextF); }

    static String label(String k) {
        switch (k) {
            case "imsak": return "İmsak";
            case "sabah": return "Sabah";
            case "gunes": return "Güneş";
            case "ogle": return "Öğle";
            case "ikindi": return "İkindi";
            case "aksam": return "Akşam";
            case "yatsi": return "Yatsı";
            default: return k;
        }
    }

    private static int colOf(String k) {
        switch (k) {
            case "imsak": case "sabah": return 0;
            case "ogle": return 1;
            case "ikindi": return 2;
            case "aksam": return 3;
            case "yatsi": return 4;
            default: return -1; // güneş: kerahat, sütun yok
        }
    }

    private static String s(JSONObject o, String k) {
        if (o == null) return "—";
        String v = o.optString(k, "");
        return v.isEmpty() ? "—" : v;
    }

    private static long at(LocalDate day, String hm) {
        try {
            LocalTime t = LocalTime.parse(hm);
            return LocalDateTime.of(day, t).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        } catch (Exception e) {
            return -1;
        }
    }

    private static List<Ev> events(JSONObject today, JSONObject tomorrow, LocalDate d0, String src, String[] keys) {
        List<Ev> out = new ArrayList<>();
        JSONObject[] arr = {today, tomorrow};
        for (int i = 0; i < 2; i++) {
            if (arr[i] == null) continue;
            JSONObject o = arr[i].optJSONObject(src);
            if (o == null) continue;
            for (String k : keys) {
                String hm = o.optString(k, "");
                if (hm.isEmpty()) continue;
                Ev e = new Ev();
                e.key = k; e.hm = hm; e.at = at(d0.plusDays(i), hm);
                if (e.at > 0) out.add(e);
            }
        }
        return out;
    }

    static Model load(Context c, long now) {
        Model m = new Model();
        String raw = Prefs.data(c);
        if (raw == null) { m.msg = "Uygulamayı açıp il seçin"; return m; }
        try {
            JSONObject root = new JSONObject(raw);
            JSONObject days = root.getJSONObject("days");
            m.loc = root.optString("loc", "");
            m.fazTop = !"diyanet".equals(root.optString("top", "fazilet"));
            LocalDate today = LocalDate.now();
            JSONObject T = days.optJSONObject(today.toString());
            JSONObject Y = days.optJSONObject(today.minusDays(1).toString());
            JSONObject N = days.optJSONObject(today.plusDays(1).toString());
            m.date = today.getDayOfMonth() + " " + AY[today.getMonthValue() - 1] + " " + GUN[today.getDayOfWeek().getValue() - 1];
            if (T == null) { m.msg = "Vakitleri yenilemek için uygulamayı açın"; return m; }

            JSONObject d = T.optJSONObject("d"), f = T.optJSONObject("f");
            m.hasD = d != null; m.hasF = f != null; m.fEst = T.optBoolean("fe", false);
            String[] dk = {"imsak", "ogle", "ikindi", "aksam", "yatsi"};
            String[] fk = {"sabah", "ogle", "ikindi", "aksam", "yatsi"};
            for (int i = 0; i < 5; i++) {
                m.d[i] = s(d, dk[i]);
                m.f[i] = (m.fEst && f != null ? "≈" : "") + s(f, fk[i]);
            }
            m.fImsak = s(f, "imsak"); m.fGunes = s(f, "gunes"); m.dGunes = s(d, "gunes");

            List<Ev> dEv = events(T, N, today, "d", D_KEYS);
            List<Ev> fEv = events(T, N, today, "f", F_KEYS);
            for (Ev e : dEv) if (e.at > now) { m.nextD = e; break; }
            for (Ev e : fEv) if (e.at > now) { m.nextF = e; break; }

            // Şu anki vakit sütunu (üstteki kaynağa göre)
            List<Ev> top = m.fazTop && m.hasF ? fEv : dEv;
            Ev cur = null;
            for (Ev e : top) if (e.at <= now) cur = e;
            m.curCol = cur == null ? 4 : colOf(cur.key);

            // Teheccüd: imsaktan önce dün akşamın gecesi, sonra bu gecenin
            String imsakTop = m.fazTop && m.hasF ? s(f, "imsak") : s(d, "imsak");
            long imsakAt = at(today, imsakTop);
            JSONObject tehSrc = (imsakAt > 0 && now < imsakAt) ? Y : T;
            if (tehSrc != null) {
                m.tehD = tehSrc.optString("td", "—");
                m.tehF = tehSrc.optString("tf", "—");
                if (m.tehD.isEmpty()) m.tehD = "—";
                if (m.tehF.isEmpty()) m.tehF = "—";
            }
            m.ok = m.hasD || m.hasF;
            if (!m.ok) m.msg = "Vakit verisi yok";
        } catch (Exception e) {
            m.ok = false;
            m.msg = "Veri okunamadı, uygulamayı açın";
        }
        return m;
    }
}
