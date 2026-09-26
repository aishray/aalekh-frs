'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'psc-'));
const { server } = require('../server');
const { openDays, slotsFor, sessionTimes } = require('../lib/slots');
const config = require('../data/facilities.json');

let base;
test.before(() => new Promise((r) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); })));
test.after(() => server.close());

const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('closed on Sundays and holidays, half day on Saturday', () => {
  assert.deepStrictEqual(sessionTimes(config, '2026-09-27'), []); // Sunday
  assert.deepStrictEqual(sessionTimes(config, '2026-10-02'), []); // Gandhi Jayanti
  assert.ok(sessionTimes(config, '2026-10-03').every((t) => t <= '12:00')); // Saturday
});

test('open days skip closed days', () => {
  const days = openDays(config, Date.parse('2026-09-26T03:00:00Z'));
  assert.strictEqual(days.length, 7);
  assert.ok(!days.includes('2026-09-27') && !days.includes('2026-10-02'));
});

test('same-day slots close 30 minutes before', () => {
  const f = config.facilities[0];
  const slots = slotsFor(config, f, '2026-09-28', [], Date.parse('2026-09-28T04:00:00Z')); // 09:30 IST
  assert.strictEqual(slots.find((s) => s.time === '09:30').left, 0);
  assert.strictEqual(slots.find((s) => s.time === '09:00').past, true);
  assert.strictEqual(slots.find((s) => s.time === '10:30').past, false);
});

test('book, reject duplicates and full slots, list, cancel, SMS sent', async () => {
  const { days } = await (await fetch(base + '/api/days?facility=gh-pdy')).json();
  const day = days.find((d) => d.free > 0);
  const { slots } = await (await fetch(`${base}/api/slots?facility=gh-pdy&date=${day.date}`)).json();
  const slot = slots.find((s) => s.left > 0);
  const full = slots.find((s) => s.left === 0 && !s.past);

  const bad = await post('/api/bookings', { facilityId: 'gh-pdy', date: day.date, time: slot.time, name: 'Lakshmi', mobile: '12345' });
  assert.strictEqual(bad.status, 400);

  const res = await post('/api/bookings', { facilityId: 'gh-pdy', date: day.date, time: slot.time, name: 'Lakshmi', mobile: '9876543210', lang: 'ta' });
  assert.strictEqual(res.status, 201);
  const { booking, sms } = await res.json();
  assert.match(booking.token, /^PY-\d{4}$/);
  assert.ok(sms.text.includes(booking.token));
  assert.ok(sms.text.includes('அரசு பொது மருத்துவமனை'));

  const dup = await post('/api/bookings', { facilityId: 'gh-pdy', date: day.date, time: slot.time, name: 'Lakshmi', mobile: '9876543210' });
  assert.strictEqual((await dup.json()).error, 'DUPLICATE');

  if (full) {
    const r = await post('/api/bookings', { facilityId: 'gh-pdy', date: day.date, time: full.time, name: 'Ravi', mobile: '9876500000' });
    assert.strictEqual((await r.json()).error, 'SLOT_FULL');
  }

  const list = await (await fetch(base + '/api/bookings?mobile=9876543210')).json();
  assert.strictEqual(list.bookings.length, 1);

  const wrongOwner = await post(`/api/bookings/${booking.id}/cancel`, { mobile: '9000000000' });
  assert.strictEqual(wrongOwner.status, 404);
  const cancelled = await (await post(`/api/bookings/${booking.id}/cancel`, { mobile: '9876543210' })).json();
  assert.strictEqual(cancelled.booking.status, 'cancelled');

  const { messages } = await (await fetch(base + '/api/sms?mobile=9876543210')).json();
  assert.strictEqual(messages.length, 2);
  assert.match(messages[0].text, /ரத்து/);
});

test('static files cannot escape the public folder', async () => {
  const res = await fetch(base + '/..%2fserver.js');
  assert.notStrictEqual(res.status, 200);
});
