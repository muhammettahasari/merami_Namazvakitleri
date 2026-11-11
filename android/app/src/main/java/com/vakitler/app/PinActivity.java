package com.vakitler.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import android.widget.Toast;

/**
 * Web koduna bağlı olmadan widget ekleme: listeden seçilen widget'ı
 * Android'in "ana ekrana ekle" penceresiyle ekler.
 * Uygulama simgesine basılı tutunca çıkan "Widget ekle" kısayolu da buraya gelir.
 */
public class PinActivity extends Activity {

    static final String[] NAMES = {
            "Tablo (4×2) — 5 vakit, Fazilet ve Diyanet alt alta",
            "Kompakt (2×2) — sıradaki vakit ve geri sayım",
            "Şerit (4×1) — tek satır",
            "Liste (2×4) — dikey liste"
    };
    static final Class<?>[] CLASSES = {TabloWidget.class, KompaktWidget.class, SeritWidget.class, ListeWidget.class};

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        show(this, true);
    }

    /** Widget seçme penceresi. finishAfter: PinActivity içinden çağrıldıysa pencere kapanınca aktiviteyi kapat. */
    static void show(Activity a, boolean finishAfter) {
        AlertDialog d = new AlertDialog.Builder(a)
                .setTitle("Ana ekrana widget ekle")
                .setItems(NAMES, (dlg, which) -> pin(a, CLASSES[which]))
                .setNegativeButton("Kapat", null)
                .create();
        if (finishAfter) d.setOnDismissListener(x -> a.finish());
        d.show();
    }

    static void pin(Context c, Class<?> cls) {
        AppWidgetManager am = AppWidgetManager.getInstance(c);
        boolean ok = false;
        try {
            if (am.isRequestPinAppWidgetSupported()) ok = am.requestPinAppWidget(new ComponentName(c, cls), null, null);
        } catch (Exception ignored) {}
        Toast.makeText(c, ok
                ? "Telefon soracak: “Ekle”ye basın"
                : "Telefonunuz otomatik eklemeyi desteklemiyor. Ana ekranda boş bir yere basılı tutun → Widget'lar → Vakitler", Toast.LENGTH_LONG).show();
    }

    /** Ana ekranda bu uygulamanın kaç widget'ı var */
    static int count(Context c) {
        AppWidgetManager am = AppWidgetManager.getInstance(c);
        int n = 0;
        for (Class<?> cls : CLASSES) {
            int[] ids = am.getAppWidgetIds(new ComponentName(c, cls));
            if (ids != null) n += ids.length;
        }
        return n;
    }
}
