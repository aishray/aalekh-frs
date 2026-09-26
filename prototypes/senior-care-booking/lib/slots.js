'use strict';
// Date and slot logic. All times are Indian Standard Time (UTC+5:30).

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAYS_AHEAD = 7; // how many open days a citizen can book into

/** Current IST wall-clock as { date: 'YYYY-MM-DD', minutes: minutes since midnight }. */
function nowIST(now = Date.now()) {
  const d = new Date(now + IST_OFFSET_MS);
  return {
    date: d.toISOString().slice(0, 10),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekday(isoDate) {
  return new Date(isoDate + 'T00:00:00Z').getUTCDay(); // 0 = Sunday
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Times the OPD runs on a given date, or [] when closed. */
function sessionTimes(config, isoDate) {
  if (config.holidays.includes(isoDate)) return [];
  const wd = weekday(isoDate);
  if (wd === 0) return [];
  return wd === 6 ? config.sessions.saturday : config.sessions.weekday;
}

/** Next open days, starting today. */
function openDays(config, now = Date.now()) {
  const today = nowIST(now).date;
  const days = [];
  for (let i = 0; days.length < DAYS_AHEAD && i < 21; i++) {
    const date = addDays(today, i);
    if (sessionTimes(config, date).length) days.push(date);
  }
  return days;
}

// Deterministic "already booked by others" load so the prototype shows some full slots.
function seededLoad(facilityId, date, time, capacity) {
  let h = 2166136261;
  for (const c of `${facilityId}|${date}|${time}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = (h >>> 0) % 100;
  if (r < 18) return capacity; // about 1 in 6 slots is full
  return r % capacity;
}

/** Slots for a facility on a date, with seats left. */
function slotsFor(config, facility, date, bookings, now = Date.now()) {
  const current = nowIST(now);
  return sessionTimes(config, date).map((time) => {
    const ours = bookings.filter(
      (b) => b.status === 'confirmed' && b.facilityId === facility.id && b.date === date && b.time === time
    ).length;
    const taken = Math.min(facility.capacity, seededLoad(facility.id, date, time, facility.capacity) + ours);
    // Same-day booking closes 30 minutes before the slot.
    const past = date === current.date && toMinutes(time) - 30 <= current.minutes;
    const left = past ? 0 : facility.capacity - taken;
    return { time, left, past };
  });
}

module.exports = { nowIST, addDays, weekday, openDays, sessionTimes, slotsFor, toMinutes };
