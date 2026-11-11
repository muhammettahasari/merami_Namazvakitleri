// Titreşim ve ses efektleri
// - Android: Vibration API
// - iOS Safari Vibration API'yi desteklemez; iOS 18+ için <input switch> dokunsal geri bildirim yolu kullanılır
// - Ses: Web Audio ile üretilir (dosya gerekmez, internetsiz çalışır)
// Not: Telefonlarda ses ancak bir dokunuştan (click/touchend) sonra açılabilir; ilk dokunuşta ses motoru "açılır".
(function (g) {
  'use strict';
  let ctx = null, sw = null, master = null;
  const canVibrate = typeof navigator.vibrate === 'function';

  function iosHaptic() {
    try {
      if (!sw) {
        const lab = document.createElement('label');
        lab.setAttribute('aria-hidden', 'true');
        lab.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
        const inp = document.createElement('input');
        inp.type = 'checkbox'; inp.setAttribute('switch', ''); inp.tabIndex = -1;
        lab.appendChild(inp); document.body.appendChild(lab); sw = lab;
      }
      sw.click();
    } catch (e) { /* yok say */ }
  }

  function vibrate(pattern) {
    if (canVibrate) { try { navigator.vibrate(pattern); } catch (e) {} return; }
    const pulses = Array.isArray(pattern) ? Math.ceil(pattern.length / 2) : 1;
    iosHaptic();
    for (let i = 1; i < Math.min(pulses, 3); i++) setTimeout(iosHaptic, i * 140);
  }

  // ---------- ses motoru ----------
  function ac() {
    if (!ctx) {
      const A = g.AudioContext || g.webkitAudioContext; if (!A) return null;
      ctx = new A();
      master = ctx.createGain(); master.gain.value = 0.9;
      // Yumuşatma: tiz sesleri hafifçe kıs
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
      master.connect(lp).connect(ctx.destination);
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  }
  // İlk dokunuşta sesi aç (iOS/Android kuralı). Sessiz bir tampon çalınır.
  function unlock() {
    const c = ac(); if (!c) return;
    try {
      const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
      s.buffer = b; s.connect(c.destination); s.start(0);
    } catch (e) {}
    // iOS 17+: sessize alma düğmesine rağmen kısa efektlerin çalabilmesi için
    try { if (navigator.audioSession && navigator.audioSession.type === 'auto') navigator.audioSession.type = 'transient'; } catch (e) {}
  }
  ['touchend', 'click', 'keydown'].forEach((ev) => g.addEventListener(ev, unlock, { capture: true, passive: true }));

  // Yumuşak "bip": sinüs, kısa atak ve sönüm (kulak tırmalamaz)
  function beep(freq = 880, dur = 0.09, vol = 0.22, when = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + 0.01 + when;
    const o = c.createOscillator(), gn = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(vol, t + 0.012);
    gn.gain.setValueAtTime(vol, t + dur * 0.55);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(master); o.start(t); o.stop(t + dur + 0.03);
  }
  function bell(freq, dur, vol, when = 0) {
    beep(freq, dur, vol, when); beep(freq * 2, dur * 0.7, vol * 0.25, when);
  }

  const SOUNDS = {
    bip: () => beep(880, 0.08, 0.2),                                  // her tık: yumuşak bip
    tik: () => beep(1200, 0.035, 0.14),                               // çok kısa tık
    damla: () => { beep(740, 0.06, 0.2); beep(1110, 0.07, 0.12, 0.04); },
    bip3: () => { beep(880, 0.12, 0.26); beep(880, 0.12, 0.26, 0.2); beep(1175, 0.2, 0.28, 0.4); }, // hedef: 3 bip
    zil: () => bell(660, 0.9, 0.24),
    bitis: () => { bell(660, 0.3, 0.24); bell(880, 0.3, 0.24, 0.25); bell(1100, 0.7, 0.26, 0.5); },
  };
  const play = (name) => { try { (SOUNDS[name] || SOUNDS.bip3)(); } catch (e) {} };

  const PATTERNS = { kisa: [35], orta: [80], uzun: [400], cift: [120, 80, 120], uclu: [150, 90, 150, 90, 300] };

  g.NVFX = { vibrate, play, unlock, PATTERNS, SOUNDS: Object.keys(SOUNDS), canVibrate };
})(window);
