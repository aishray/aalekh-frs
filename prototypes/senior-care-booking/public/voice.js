// Voice guide (speech synthesis) and optional voice answers (speech recognition).
(function () {
  const synth = window.speechSynthesis;
  let voices = [];
  function loadVoices() { voices = synth ? synth.getVoices() : []; }
  if (synth) { loadVoices(); synth.addEventListener?.('voiceschanged', loadVoices); }

  function pickVoice(lang) {
    const want = lang === 'ta' ? 'ta' : 'en';
    const matches = voices.filter((v) => v.lang.toLowerCase().startsWith(want));
    if (want === 'en') return matches.find((v) => /en-IN/i.test(v.lang)) || matches[0] || null;
    return matches[0] || null;
  }

  const Voice = {
    supported: !!synth,
    hasTamil() { return !!pickVoice('ta'); },
    /** texts: { en, ta }. Speaks Tamil only when the device has a Tamil voice. */
    speak(texts, lang) {
      if (!synth) return;
      synth.cancel();
      const useLang = lang === 'ta' && this.hasTamil() ? 'ta' : 'en';
      const u = new SpeechSynthesisUtterance(texts[useLang]);
      const voice = pickVoice(useLang);
      if (voice) u.voice = voice;
      u.lang = useLang === 'ta' ? 'ta-IN' : 'en-IN';
      u.rate = 0.85; // slower, clearer speech
      u.pitch = 1;
      synth.speak(u);
    },
    stop() { if (synth) synth.cancel(); },
  };

  // Speech recognition (Chrome, Edge, Android). Hidden where unsupported.
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  Voice.canListen = !!Rec;
  Voice.listen = function (lang) {
    return new Promise((resolve, reject) => {
      if (!Rec) return reject(new Error('unsupported'));
      Voice.stop();
      const r = new Rec();
      r.lang = lang === 'ta' ? 'ta-IN' : 'en-IN';
      r.interimResults = false;
      r.maxAlternatives = 3;
      let done = false;
      r.onresult = (e) => {
        done = true;
        resolve(Array.from(e.results[0]).map((a) => a.transcript));
      };
      r.onerror = (e) => { done = true; reject(e.error || e); };
      r.onend = () => { if (!done) resolve([]); };
      r.start();
    });
  };

  const NUMBER_WORDS = {
    1: ['one', 'first', 'ஒன்று', 'ஒன்னு', 'முதல்'],
    2: ['two', 'second', 'இரண்டு', 'ரெண்டு'],
    3: ['three', 'third', 'மூன்று', 'மூணு'],
    4: ['four', 'fourth', 'நான்கு', 'நாலு'],
    5: ['five', 'fifth', 'ஐந்து', 'அஞ்சு'],
    6: ['six', 'sixth', 'ஆறு'],
    7: ['seven', 'seventh', 'ஏழு'],
    8: ['eight', 'eighth', 'எட்டு'],
    9: ['nine', 'ninth', 'ஒன்பது'],
    10: ['ten', 'tenth', 'பத்து'],
    11: ['eleven', 'பதினொன்று'],
    12: ['twelve', 'பன்னிரண்டு'],
  };

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim();

  /**
   * Match spoken alternatives to options: [{ n, words: [...] }].
   * Tries option names first (more specific), then a spoken number.
   */
  Voice.match = function (alternatives, options) {
    for (const raw of alternatives) {
      const said = norm(raw);
      for (const o of options) {
        if (o.words.some((w) => w && said.includes(norm(w)))) return o;
      }
      const tokens = said.split(' ');
      for (const o of options) {
        if (o.n == null) continue;
        if (tokens.includes(String(o.n)) || (NUMBER_WORDS[o.n] || []).some((w) => tokens.includes(norm(w)))) return o;
      }
    }
    return null;
  };

  window.Voice = Voice;
})();
