'use strict';
// Zero-dependency web server for the Puducherry Senior Care booking prototype.
// Run: node server.js   then open http://localhost:4000

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { openDays, slotsFor, nowIST, addDays } = require('./lib/slots');
const { sendSms, messagesFor } = require('./lib/sms');
const { smsText } = require('./public/i18n');

const PORT = Number(process.env.PORT) || 4000;
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const BOOKINGS = path.join(DATA_DIR, 'bookings.json');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'facilities.json'), 'utf8'));
const TOKEN_PREFIX = { puducherry: 'PY', karaikal: 'KK', mahe: 'MH', yanam: 'YN' };
const MOBILE_RE = /^[6-9]\d{9}$/;

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadBookings() {
  try { return JSON.parse(fs.readFileSync(BOOKINGS, 'utf8')); } catch { return []; }
}
function saveBookings(list) {
  fs.writeFileSync(BOOKINGS, JSON.stringify(list, null, 2));
}
const facilityById = (id) => config.facilities.find((f) => f.id === id);

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function newToken(region, bookings) {
  const prefix = TOKEN_PREFIX[region] || 'PD';
  for (;;) {
    const token = `${prefix}-${1000 + Math.floor(Math.random() * 9000)}`;
    if (!bookings.some((b) => b.token === token)) return token;
  }
}

function publicBooking(b) {
  const f = facilityById(b.facilityId);
  return { ...b, facility: { id: f.id, name: f.name, clinic: f.clinic, area: f.area, helpdesk: f.helpdesk } };
}

async function api(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/config') {
    return send(res, 200, { regions: config.regions, facilities: config.facilities, note: config.note });
  }

  if (route === 'GET /api/days') {
    const facility = facilityById(url.searchParams.get('facility'));
    if (!facility) return send(res, 404, { error: 'NOT_FOUND' });
    const bookings = loadBookings();
    const today = nowIST().date;
    const days = openDays(config).map((date) => {
      const slots = slotsFor(config, facility, date, bookings);
      return { date, isToday: date === today, isTomorrow: date === addDays(today, 1), free: slots.filter((s) => s.left > 0).length };
    });
    return send(res, 200, { days });
  }

  if (route === 'GET /api/slots') {
    const facility = facilityById(url.searchParams.get('facility'));
    const date = url.searchParams.get('date');
    if (!facility || !openDays(config).includes(date)) return send(res, 404, { error: 'NOT_FOUND' });
    return send(res, 200, { slots: slotsFor(config, facility, date, loadBookings()) });
  }

  if (route === 'POST /api/bookings') {
    const body = await readBody(req);
    const facility = facilityById(body.facilityId);
    const name = String(body.name || '').trim().slice(0, 60);
    const mobile = String(body.mobile || '').replace(/\D/g, '');
    const lang = body.lang === 'ta' ? 'ta' : 'en';
    if (!facility || !name || !MOBILE_RE.test(mobile) || !openDays(config).includes(body.date)) {
      return send(res, 400, { error: 'INVALID' });
    }
    const bookings = loadBookings();
    const slot = slotsFor(config, facility, body.date, bookings).find((s) => s.time === body.time);
    if (!slot) return send(res, 400, { error: 'INVALID' });
    if (slot.left <= 0) return send(res, 409, { error: 'SLOT_FULL' });
    if (bookings.some((b) => b.status === 'confirmed' && b.mobile === mobile && b.facilityId === facility.id && b.date === body.date)) {
      return send(res, 409, { error: 'DUPLICATE' });
    }
    const booking = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      token: newToken(facility.region, bookings),
      facilityId: facility.id, date: body.date, time: body.time,
      name, mobile, lang, status: 'confirmed', createdAt: new Date().toISOString(),
    };
    bookings.push(booking);
    saveBookings(bookings);
    const full = publicBooking(booking);
    const sms = await sendSms(mobile, smsText('confirm', full, lang), lang);
    return send(res, 201, { booking: full, sms });
  }

  if (route === 'GET /api/bookings') {
    const mobile = String(url.searchParams.get('mobile') || '').replace(/\D/g, '');
    if (!MOBILE_RE.test(mobile)) return send(res, 400, { error: 'INVALID' });
    const today = nowIST().date;
    const list = loadBookings()
      .filter((b) => b.mobile === mobile && b.date >= today)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map(publicBooking);
    return send(res, 200, { bookings: list });
  }

  const cancel = url.pathname.match(/^\/api\/bookings\/([a-z0-9]+)\/cancel$/);
  if (req.method === 'POST' && cancel) {
    const body = await readBody(req);
    const bookings = loadBookings();
    const booking = bookings.find((b) => b.id === cancel[1] && b.mobile === String(body.mobile || ''));
    if (!booking) return send(res, 404, { error: 'NOT_FOUND' });
    if (booking.status !== 'cancelled') {
      booking.status = 'cancelled';
      booking.cancelledAt = new Date().toISOString();
      saveBookings(bookings);
      await sendSms(booking.mobile, smsText('cancel', publicBooking(booking), booking.lang), booking.lang);
    }
    return send(res, 200, { booking: publicBooking(booking) });
  }

  if (route === 'GET /api/sms') {
    const mobile = String(url.searchParams.get('mobile') || '').replace(/\D/g, '');
    return send(res, 200, { messages: MOBILE_RE.test(mobile) ? messagesFor(mobile) : [] });
  }

  return send(res, 404, { error: 'NOT_FOUND' });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

function serveStatic(req, res, url) {
  const rel = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'SERVER' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Puducherry Senior Care prototype: http://localhost:${PORT}  (phone preview: /phone.html)`));
}

module.exports = { server };
