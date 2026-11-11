package com.vakitler.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Vakit geçişi, açılış, saat/tarih değişimi: widget ve bildirimi yenile. */
public class TickReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Updater.refresh(context);
    }
}
