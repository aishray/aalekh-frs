// Puducherry Senior Care: one question per screen, large targets, voice guide.
(function () {
  const { T, formatDate, formatTime } = window.I18N;
  const Voice = window.Voice;

  const store = {
    get(key, fallback) { try { const v = localStorage.getItem('psc.' + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem('psc.' + key, JSON.stringify(value)); } catch { /* storage blocked */ } },
  };

  const state = {
    lang: store.get('lang', null),
    voice: store.get('voice', true),
    scale: store.get('scale', 1),
    screen: store.get('lang', null) ? 'home' : 'lang',
    config: null,
    region: null, facilityId: null, date: null, time: null,
    name: store.get('name', ''), mobile: store.get('mobile', ''),
    days: [], slots: [],
    booking: null, sms: null,
    loading: false, error: null, retry: null, formError: '',
    mine: { mobile: store.get('mobile', ''), list: null, confirming: null, notice: '' },
  };

  const STEPS = ['region', 'facility', 'date', 'time', 'details', 'review'];
  const BACK = { home: 'lang', region: 'home', facility: 'region', date: 'facility', time: 'date', details: 'time', review: 'details', done: 'home', mine: 'home' };

  let prompt = { en: '', ta: '' }; // what the voice guide says on this screen
  let voiceOptions = []; // what can be said on this screen

  const $ = (id) => document.getElementById(id);
  const screenEl = $('screen');
  const L = () => state.lang || 'en';
  const t = () => T[L()];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const both = (fn) => ({ en: fn(T.en, 'en'), ta: fn(T.ta, 'ta') });
  const facility = () => state.config && state.config.facilities.find((f) => f.id === state.facilityId);
  const maskMobile = (m) => (m ? '•••••• ' + m.slice(-4) : '');
  const prettyMobile = (m) => (m.length > 5 ? m.slice(0, 5) + ' ' + m.slice(5) : m);

  const ICON = {
    chevron: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M8 21h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="currentColor"/><path d="M14 25l7 7 13-15" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    wheelchair: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="4" r="2" fill="currentColor"/><path d="M11 7v6h6l2 6M11 10h5M8 11a5 5 0 1 0 7 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="18.5" r="1" fill="currentColor"/></svg>',
  };

  // ---------- API ----------
  async function api(path, options) {
    let res;
    try {
      res = await fetch(path, options && { method: options.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(options.body) });
    } catch {
      throw Object.assign(new Error('NETWORK'), { code: 'NETWORK' });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'NETWORK'), { code: data.error || 'NETWORK' });
    return data;
  }

  async function load(task) {
    state.loading = true; state.error = null; state.retry = () => load(task);
    render();
    try {
      await task();
      state.loading = false;
      render({ speak: true });
    } catch (err) {
      state.loading = false;
      state.error = err.code || 'NETWORK';
      render({ speak: true });
    }
  }

  // ---------- navigation ----------
  function go(screen) {
    Voice.stop();
    state.screen = screen; state.error = null; state.formError = '';
    if (screen === 'date') return load(async () => { state.days = (await api('/api/days?facility=' + state.facilityId)).days; });
    if (screen === 'time') return load(async () => { state.slots = (await api(`/api/slots?facility=${state.facilityId}&date=${state.date}`)).slots; });
    if (screen === 'mine') { state.mine.list = null; state.mine.confirming = null; state.mine.notice = ''; }
    render({ speak: true });
  }

  // ---------- screens ----------
  function stepHeader(screen) {
    const i = STEPS.indexOf(screen);
    if (i < 0) return '';
    const dots = STEPS.map((_, j) => `<span class="dot ${j < i ? 'done' : j === i ? 'now' : ''}"></span>`).join('');
    return `<div class="progress"><span>${esc(t().stepOf(i + 1, STEPS.length))}</span><span class="dots" aria-hidden="true">${dots}</span></div>`;
  }

  function choice({ n, action, arg, title, meta, extra, disabled }) {
    return `<button class="choice" type="button" data-action="${action}" data-arg="${esc(arg)}" ${disabled ? 'disabled' : ''}>
      ${n != null ? `<span class="num" aria-hidden="true">${n}</span>` : ''}
      <span class="choice-body"><span class="choice-title">${esc(title)}</span>${meta ? `<span class="choice-meta">${esc(meta)}</span>` : ''}${extra || ''}</span>
      ${disabled ? '' : ICON.chevron}
    </button>`;
  }

  function keypad(target) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];
    return `<div class="keypad" role="group" aria-label="${esc(t().mobile)}">${keys.map((k) => {
      if (k === 'clear') return `<button type="button" class="key key-sm" data-action="key" data-arg="${target}:clear">${esc(t().clear)}</button>`;
      if (k === 'del') return `<button type="button" class="key key-sm" data-action="key" data-arg="${target}:del">${esc(t().del)}</button>`;
      return `<button type="button" class="key" data-action="key" data-arg="${target}:${k}">${k}</button>`;
    }).join('')}</div>`;
  }

  const screens = {
    lang() {
      prompt = { en: 'Please choose your language. Touch English or Tamil.', ta: 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும். ஆங்கிலம் அல்லது தமிழைத் தொடவும்.' };
      voiceOptions = [{ n: 1, words: ['english', 'ஆங்கிலம்'], run: () => setLang('en') }, { n: 2, words: ['tamil', 'தமிழ்'], run: () => setLang('ta') }];
      return `<h1 tabindex="-1">Choose your language<br><span lang="ta">மொழியைத் தேர்ந்தெடுக்கவும்</span></h1>
        <div class="choices two">
          <button class="choice big-lang" type="button" data-action="lang" data-arg="en"><span class="num" aria-hidden="true">1</span><span class="choice-title">English</span></button>
          <button class="choice big-lang" type="button" data-action="lang" data-arg="ta" lang="ta"><span class="num" aria-hidden="true">2</span><span class="choice-title">தமிழ்</span></button>
        </div>`;
    },

    home() {
      prompt = both((x) => `${x.welcome} ${x.book}: 1. ${x.mine}: 2.`);
      voiceOptions = [
        { n: 1, words: ['book', 'appointment', 'முன்பதிவு செய்ய'], run: () => startBooking() },
        { n: 2, words: ['my appointment', 'எனது'], run: () => go('mine') },
      ];
      return `<h1 tabindex="-1">${esc(t().welcome)}</h1>
        <div class="choices">
          <button class="btn primary huge" type="button" data-action="start"><span class="num light" aria-hidden="true">1</span>${esc(t().book)}</button>
          <button class="btn secondary huge" type="button" data-action="go" data-arg="mine"><span class="num" aria-hidden="true">2</span>${esc(t().mine)}</button>
        </div>`;
    },

    region() {
      const regions = state.config.regions;
      prompt = both((x, lg) => `${x.regionSay} ${regions.map((r, i) => `${i + 1}: ${r.name[lg]}`).join('. ')}.`);
      voiceOptions = regions.map((r, i) => ({ n: i + 1, words: [r.name.en, r.name.ta, r.id], run: () => pickRegion(r.id) }));
      return `${stepHeader('region')}<h1 tabindex="-1">${esc(t().regionTitle)}</h1>
        <div class="choices">${regions.map((r, i) => choice({ n: i + 1, action: 'region', arg: r.id, title: r.name[L()] })).join('')}</div>`;
    },

    facility() {
      const list = state.config.facilities.filter((f) => f.region === state.region);
      prompt = both((x, lg) => `${x.facilitySay} ${list.map((f, i) => `${i + 1}: ${f.name[lg]}`).join('. ')}.`);
      voiceOptions = list.map((f, i) => ({ n: i + 1, words: [f.name.en.split(',')[1], f.name.ta.split(',')[1], f.area.en], run: () => pickFacility(f.id) }));
      return `${stepHeader('facility')}<h1 tabindex="-1">${esc(t().facilityTitle)}</h1>
        <div class="choices">${list.map((f, i) => choice({
          n: i + 1, action: 'facility', arg: f.id, title: f.name[L()], meta: `${f.area[L()]} · ${f.clinic[L()]}`,
          extra: f.wheelchair ? `<span class="tag">${ICON.wheelchair}${esc(t().wheelchair)}</span>` : '',
        })).join('')}</div>`;
    },

    date() {
      const f = facility();
      const open = state.days.filter((d) => d.free > 0);
      const label = (d, x, lg) => (d.isToday ? `${x.today}, ` : d.isTomorrow ? `${x.tomorrow}, ` : '') + formatDate(d.date, lg);
      prompt = both((x, lg) => `${x.dateSay} ${open.map((d, i) => `${i + 1}: ${label(d, x, lg)}`).join('. ')}.`);
      voiceOptions = open.map((d, i) => ({ n: i + 1, words: [d.isToday ? 'today' : '', d.isToday ? 'இன்று' : '', d.isTomorrow ? 'tomorrow' : '', d.isTomorrow ? 'நாளை' : '', formatDate(d.date, 'en').split(',')[0]], run: () => pickDate(d.date) }));
      let n = 0;
      return `${stepHeader('date')}<h1 tabindex="-1">${esc(t().dateTitle)}</h1>
        <p class="context">${esc(f.name[L()])}</p>
        <div class="choices">${state.days.map((d) => choice({
          n: d.free > 0 ? ++n : null, action: 'date', arg: d.date, title: label(d, t(), L()), meta: t().slotsLeft(d.free), disabled: d.free === 0,
        })).join('')}</div>`;
    },

    time() {
      const open = state.slots.filter((s) => s.left > 0);
      prompt = both((x, lg) => open.length ? `${x.timeSay} ${open.map((s, i) => `${i + 1}: ${formatTime(s.time, lg)}`).join('. ')}.` : x.noTimes);
      voiceOptions = open.map((s, i) => ({ n: i + 1, words: [], run: () => pickTime(s.time) }));
      const numOf = (s) => open.indexOf(s) + 1;
      const group = (title, slots) => slots.length ? `<h2>${esc(title)}</h2><div class="slots">${slots.map((s) => s.left > 0
        ? `<button class="slot" type="button" data-action="time" data-arg="${s.time}"><span class="num" aria-hidden="true">${numOf(s)}</span>${esc(formatTime(s.time, L()))}</button>`
        : `<button class="slot full" type="button" disabled><span>${esc(formatTime(s.time, L()))}</span><small>${esc(t().full)}</small></button>`).join('')}</div>` : '';
      return `${stepHeader('time')}<h1 tabindex="-1">${esc(t().timeTitle)}</h1>
        <p class="context">${esc(facility().name[L()])} · ${esc(formatDate(state.date, L()))}</p>
        ${open.length ? '' : `<p class="notice">${esc(t().noTimes)}</p>`}
        ${group(t().morning, state.slots.filter((s) => s.time < '12:30'))}
        ${group(t().afternoon, state.slots.filter((s) => s.time >= '12:30'))}`;
    },

    details() {
      prompt = both((x) => x.detailsSay);
      voiceOptions = [{ n: null, words: ['next', 'அடுத்து'], run: () => detailsNext() }];
      return `${stepHeader('details')}<h1 tabindex="-1">${esc(t().detailsTitle)}</h1>
        <div class="field"><label for="name">${esc(t().name)}</label>
          <input id="name" class="input" autocomplete="name" maxlength="60" placeholder="${esc(t().namePh)}" value="${esc(state.name)}"></div>
        <div class="field"><label for="mobile">${esc(t().mobile)}</label>
          <input id="mobile" class="input mono" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10" value="${esc(state.mobile)}"></div>
        ${keypad('mobile')}
        <p class="form-error" id="formError" role="alert">${esc(state.formError)}</p>
        <button class="btn primary huge" type="button" data-action="detailsNext">${esc(t().next)}${ICON.chevron}</button>`;
    },

    review() {
      const f = facility();
      const summary = (lg) => `${f.name[lg]}, ${formatDate(state.date, lg)}, ${formatTime(state.time, lg)}`;
      prompt = both((x, lg) => x.reviewSay(summary(lg)));
      voiceOptions = [{ n: null, words: ['confirm', 'yes', 'correct', 'உறுதி', 'ஆம்', 'சரி'], run: () => confirmBooking() }];
      const row = (label, value, to) => `<div class="row"><dt>${esc(label)}</dt><dd>${value}</dd><dd class="row-act"><button class="btn link" type="button" data-action="go" data-arg="${to}">${esc(t().change)}</button></dd></div>`;
      return `${stepHeader('review')}<h1 tabindex="-1">${esc(t().reviewTitle)}</h1>
        <dl class="summary">
          ${row(t().where, `<strong>${esc(f.name[L()])}</strong><br>${esc(f.clinic[L()])}`, 'facility')}
          ${row(t().when, `<strong>${esc(formatDate(state.date, L()))}</strong><br>${esc(formatTime(state.time, L()))}`, 'date')}
          ${row(t().who, `<strong>${esc(state.name)}</strong>`, 'details')}
          ${row(t().phone, `<strong class="mono">${esc(prettyMobile(state.mobile))}</strong>`, 'details')}
        </dl>
        <button class="btn success huge" type="button" data-action="confirm">${esc(t().confirm)}</button>`;
    },

    done() {
      const b = state.booking;
      const summary = (lg) => `${b.facility.name[lg]}, ${formatDate(b.date, lg)}, ${formatTime(b.time, lg)}`;
      prompt = both((x, lg) => `${x.doneSay(b.token.split('').join(' '), summary(lg), b.mobile.slice(-4).split('').join(' '))} ${x.bring}`);
      voiceOptions = [{ n: null, words: ['home', 'முகப்பு'], run: () => go('home') }, { n: null, words: ['another', 'மற்றொரு'], run: () => startBooking() }];
      return `<div class="success-head">${ICON.check}<h1 tabindex="-1">${esc(t().doneTitle)}</h1></div>
        <div class="token-card">
          <div class="token-label">${esc(t().token)}</div>
          <div class="token">${esc(b.token)}</div>
          <div class="token-when"><strong>${esc(formatDate(b.date, L()))}, ${esc(formatTime(b.time, L()))}</strong></div>
          <div>${esc(b.facility.name[L()])}<br>${esc(b.facility.clinic[L()])}</div>
        </div>
        <p class="notice">${esc(t().bring)}</p>
        <p class="sent">${ICON.phone}${esc(t().smsSent(maskMobile(b.mobile)))}</p>
        <h2>${esc(t().phonePreview)}</h2>
        ${phoneMock(state.sms)}
        <div class="choices two">
          <button class="btn primary" type="button" data-action="start">${esc(t().bookAnother)}</button>
          <button class="btn secondary" type="button" data-action="go" data-arg="home">${esc(t().home)}</button>
        </div>`;
    },

    mine() {
      const m = state.mine;
      prompt = m.notice ? both((x) => x.cancelledSay) : both((x) => x.mineSay);
      voiceOptions = [{ n: null, words: ['show', 'காட்டு'], run: () => showMine() }];
      const list = m.list == null ? '' : m.list.length === 0 ? `<p class="notice">${esc(t().none)}</p>` : `<div class="appts">${m.list.map((b) => `
        <article class="appt ${b.status}">
          <div class="appt-top"><span class="token small">${esc(b.token)}</span><span class="badge ${b.status}">${esc(b.status === 'cancelled' ? t().cancelled : t().upcoming)}</span></div>
          <div class="appt-when">${esc(formatDate(b.date, L()))}, ${esc(formatTime(b.time, L()))}</div>
          <div>${esc(b.facility.name[L()])}</div>
          ${b.status === 'confirmed' ? (m.confirming === b.id
            ? `<div class="confirm-box" role="alertdialog" aria-label="${esc(t().cancelAsk)}"><p><strong>${esc(t().cancelAsk)}</strong></p>
                 <div class="choices two"><button class="btn danger" type="button" data-action="cancelYes" data-arg="${b.id}">${esc(t().yesCancel)}</button>
                 <button class="btn secondary" type="button" data-action="cancelNo">${esc(t().noKeep)}</button></div></div>`
            : `<button class="btn outline-danger" type="button" data-action="cancelAsk" data-arg="${b.id}">${esc(t().cancel)}</button>`) : ''}
        </article>`).join('')}</div>`;
      return `<h1 tabindex="-1">${esc(t().mineTitle)}</h1>
        ${m.notice ? `<p class="notice good" role="status">${esc(m.notice)}</p>` : ''}
        <div class="field"><label for="mineMobile">${esc(t().mobile)}</label>
          <input id="mineMobile" class="input mono" type="tel" inputmode="numeric" maxlength="10" value="${esc(m.mobile)}"></div>
        ${m.list == null ? keypad('mineMobile') : ''}
        <p class="form-error" id="formError" role="alert">${esc(state.formError)}</p>
        <button class="btn primary huge" type="button" data-action="showMine">${esc(t().show)}</button>
        ${list}`;
    },
  };

  function phoneMock(sms) {
    if (!sms) return '';
    const time = new Date(sms.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    return `<div class="phone" aria-label="${esc(t().phonePreview)}">
      <div class="phone-bar"><span>${esc(time)}</span><span>PY-HLTH</span></div>
      <div class="bubble" lang="${sms.lang}">${esc(sms.text)}</div>
    </div>`;
  }

  // ---------- actions ----------
  function setLang(lang) {
    state.lang = lang; store.set('lang', lang);
    if (state.screen === 'lang') state.screen = 'home';
    render({ speak: true });
  }
  function startBooking() {
    state.region = null; state.facilityId = null; state.date = null; state.time = null; state.booking = null;
    if (!state.config) return load(async () => { state.config = await api('/api/config'); state.screen = 'region'; });
    go('region');
  }
  function pickRegion(id) {
    state.region = id;
    const list = state.config.facilities.filter((f) => f.region === id);
    if (list.length === 1) return pickFacility(list[0].id); // skip a choice of one
    go('facility');
  }
  function pickFacility(id) { state.facilityId = id; state.date = null; state.time = null; go('date'); }
  function pickDate(date) { state.date = date; state.time = null; go('time'); }
  function pickTime(time) { state.time = time; go('details'); }

  function detailsNext() {
    state.name = ($('name')?.value ?? state.name).trim();
    state.mobile = ($('mobile')?.value ?? state.mobile).replace(/\D/g, '');
    if (!state.name) return showFormError('errName', 'name');
    if (!/^[6-9]\d{9}$/.test(state.mobile)) return showFormError('errMobile', 'mobile');
    store.set('name', state.name); store.set('mobile', state.mobile);
    go('review');
  }
  function showFormError(key, fieldId) {
    state.formError = t()[key];
    $('formError').textContent = state.formError;
    $(fieldId)?.focus();
    if (state.voice) Voice.speak(both((x) => x[key]), L());
  }

  async function confirmBooking() {
    const body = { facilityId: state.facilityId, date: state.date, time: state.time, name: state.name, mobile: state.mobile, lang: L() };
    state.loading = true; state.error = null; render({ loadingText: t().booking });
    try {
      const res = await api('/api/bookings', { method: 'POST', body });
      state.booking = res.booking; state.sms = res.sms; state.loading = false;
      state.mine.mobile = state.mobile;
      go('done');
    } catch (err) {
      state.loading = false;
      state.error = err.code;
      // A full slot sends the citizen back to pick another time.
      state.retry = err.code === 'SLOT_FULL' ? () => go('time') : err.code === 'DUPLICATE' ? () => go('date') : () => confirmBooking();
      render({ speak: true });
    }
  }

  async function showMine() {
    const m = state.mine;
    m.mobile = ($('mineMobile')?.value ?? m.mobile).replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(m.mobile)) return showFormError('errMobile', 'mineMobile');
    store.set('mobile', m.mobile);
    m.notice = '';
    await load(async () => { m.list = (await api('/api/bookings?mobile=' + m.mobile)).bookings; });
    if (m.list && m.list.length === 0 && state.voice) Voice.speak(both((x) => x.none), L());
  }

  async function cancelBooking(id) {
    const m = state.mine;
    await load(async () => {
      await api(`/api/bookings/${id}/cancel`, { method: 'POST', body: { mobile: m.mobile } });
      m.list = (await api('/api/bookings?mobile=' + m.mobile)).bookings;
      m.confirming = null;
      m.notice = t().cancelledSay;
    });
  }

  function key(arg) {
    const [target, k] = arg.split(':');
    const input = $(target);
    if (!input) return;
    let v = input.value.replace(/\D/g, '');
    if (k === 'clear') v = '';
    else if (k === 'del') v = v.slice(0, -1);
    else if (v.length < 10) v += k;
    input.value = v;
    if (target === 'mobile') state.mobile = v; else state.mine.mobile = v;
    if (state.formError) { state.formError = ''; $('formError').textContent = ''; }
  }

  const ACTIONS = {
    lang: setLang,
    start: startBooking,
    go: (s) => go(s),
    region: pickRegion,
    facility: pickFacility,
    date: pickDate,
    time: pickTime,
    key,
    detailsNext,
    confirm: confirmBooking,
    showMine,
    cancelAsk: (id) => { state.mine.confirming = id; state.mine.notice = ''; render(); if (state.voice) Voice.speak(both((x) => x.cancelAsk), L()); },
    cancelNo: () => { state.mine.confirming = null; render(); },
    cancelYes: cancelBooking,
    retry: () => state.retry && state.retry(),
  };

  screenEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    ACTIONS[btn.dataset.action]?.(btn.dataset.arg);
  });
  screenEl.addEventListener('input', (e) => {
    if (e.target.id === 'name') state.name = e.target.value;
    if (e.target.id === 'mobile' || e.target.id === 'mineMobile') {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
      if (e.target.id === 'mobile') state.mobile = e.target.value; else state.mine.mobile = e.target.value;
    }
  });
  screenEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    if (state.screen === 'details') detailsNext();
    if (state.screen === 'mine') showMine();
  });

  // ---------- chrome: settings, back, hear again, mic ----------
  $('langBtn').addEventListener('click', () => setLang(L() === 'en' ? 'ta' : 'en'));
  $('voiceBtn').addEventListener('click', () => {
    state.voice = !state.voice; store.set('voice', state.voice);
    renderChrome();
    if (state.voice) Voice.speak(prompt, L()); else Voice.stop();
  });
  $('sizeGroup').addEventListener('click', (e) => {
    const b = e.target.closest('[data-scale]');
    if (!b) return;
    state.scale = Number(b.dataset.scale); store.set('scale', state.scale);
    renderChrome();
  });
  $('backBtn').addEventListener('click', () => {
    if (state.screen === 'mine' && state.mine.list) { state.mine.list = null; state.mine.notice = ''; return render({ speak: true }); }
    go(BACK[state.screen] || 'home');
  });
  $('hearBtn').addEventListener('click', () => Voice.speak(prompt, L()));

  function setStatus(text) {
    const s = $('status');
    s.textContent = text; s.hidden = !text;
  }

  $('micBtn').addEventListener('click', async () => {
    const mic = $('micBtn');
    mic.classList.add('listening');
    setStatus(t().listening);
    try {
      const heard = await Voice.listen(L());
      const common = [
        { n: null, words: ['back', 'go back', 'பின்'], run: () => $('backBtn').click() },
        { n: null, words: ['home', 'முகப்பு'], run: () => go('home') },
        { n: null, words: ['repeat', 'again', 'மீண்டும்'], run: () => Voice.speak(prompt, L()) },
      ];
      const hit = Voice.match(heard, voiceOptions) || Voice.match(heard, common);
      if (hit) { setStatus(''); hit.run(); }
      else if (state.screen === 'details' && heard[0]) {
        // Free speech on the details screen fills the name, or the mobile number if digits were spoken.
        const digits = heard[0].replace(/\D/g, '');
        if (digits.length >= 10) { state.mobile = digits.slice(-10); $('mobile').value = state.mobile; }
        else { state.name = heard[0].trim(); $('name').value = state.name; }
        setStatus('');
      } else {
        setStatus(t().notHeard);
        if (state.voice) Voice.speak(both((x) => x.notHeard), L());
      }
    } catch {
      setStatus(t().notHeard);
    } finally {
      mic.classList.remove('listening');
    }
  });

  function renderChrome() {
    const x = t();
    document.documentElement.lang = L() === 'ta' ? 'ta' : 'en';
    document.documentElement.style.setProperty('--scale', state.scale);
    $('brandName').textContent = x.appName;
    $('brandSub').textContent = x.appSub;
    $('banner').textContent = x.prototype;
    $('langBtn').textContent = L() === 'en' ? 'தமிழ்' : 'English';
    $('langBtn').setAttribute('lang', L() === 'en' ? 'ta' : 'en');
    $('langBtn').hidden = state.screen === 'lang';
    $('voiceBtn').innerHTML = `${ICON.speaker}<span>${esc(state.voice ? x.voiceOn : x.voiceOff)}</span>`;
    $('voiceBtn').setAttribute('aria-pressed', String(state.voice));
    $('voiceBtn').classList.toggle('off', !state.voice);
    document.querySelectorAll('[data-scale]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.scale) === state.scale)));
    $('sizeGroup').setAttribute('aria-label', x.textSize);
    $('backBtn').innerHTML = `${ICON.back}<span>${esc(state.screen === 'done' ? x.home : x.back)}</span>`;
    $('backBtn').hidden = state.screen === 'lang';
    $('hearBtn').innerHTML = `${ICON.speaker}<span>${esc(x.hearAgain)}</span>`;
    $('micBtn').hidden = !Voice.canListen;
    $('micBtn').innerHTML = `${ICON.mic}<span>${esc(x.speak)}</span>`;
    const tamilNote = L() === 'ta' && Voice.supported && !Voice.hasTamil() ? x.tamilVoiceMissing : '';
    $('banner').textContent = x.prototype + (tamilNote ? ' ' + tamilNote : '');
  }

  function render(opts = {}) {
    renderChrome();
    setStatus('');
    if (state.loading) {
      screenEl.innerHTML = `<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span><p>${esc(opts.loadingText || (L() === 'ta' ? 'காத்திருக்கவும்' : 'Please wait'))}</p></div>`;
      return;
    }
    if (state.error) {
      const msg = t().err[state.error] || t().err.NETWORK;
      prompt = both((x) => x.err[state.error] || x.err.NETWORK);
      voiceOptions = [];
      screenEl.innerHTML = `<div class="error-card" role="alert"><h1 tabindex="-1">${esc(msg)}</h1>
        <button class="btn primary huge" type="button" data-action="retry">${esc(state.error === 'NETWORK' ? (L() === 'ta' ? 'மீண்டும் முயற்சி' : 'Try again') : t().next)}</button></div>`;
    } else {
      screenEl.innerHTML = screens[state.screen]();
    }
    if (opts.speak) {
      screenEl.querySelector('h1')?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
      if (state.voice && state.lang) Voice.speak(prompt, L());
    }
  }

  // Shift+R clears saved details (for demos on a shared device).
  document.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key === 'R' && e.target.tagName !== 'INPUT') {
      ['lang', 'name', 'mobile', 'voice', 'scale'].forEach((k) => { try { localStorage.removeItem('psc.' + k); } catch { /* ignore */ } });
      location.reload();
    }
  });

  if (Voice.supported) window.speechSynthesis.addEventListener?.('voiceschanged', renderChrome);
  render({ speak: false });
  screenEl.querySelector('h1')?.focus({ preventScroll: true });
})();
