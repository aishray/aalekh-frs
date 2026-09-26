'use strict';
// SMS sending. The prototype keeps an outbox (shown on the phone preview page).
// To send real SMS, set SMS_WEBHOOK_URL to a relay for a DLT-registered SMS gateway;
// it receives POST { to, text, lang } as JSON.

const fs = require('node:fs');
const path = require('node:path');

const OUTBOX = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'outbox.json');

function readOutbox() {
  try { return JSON.parse(fs.readFileSync(OUTBOX, 'utf8')); } catch { return []; }
}

async function sendSms(to, text, lang) {
  const message = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), to, text, lang, at: new Date().toISOString(), status: 'sent' };
  const url = process.env.SMS_WEBHOOK_URL;
  if (url) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to, text, lang }) });
      if (!res.ok) message.status = `gateway error ${res.status}`;
    } catch (err) {
      message.status = 'gateway unreachable';
    }
  }
  const outbox = readOutbox();
  outbox.push(message);
  fs.writeFileSync(OUTBOX, JSON.stringify(outbox.slice(-500), null, 2));
  console.log(`[sms] to ${to}: ${text}`);
  return message;
}

function messagesFor(mobile) {
  return readOutbox().filter((m) => m.to === mobile).reverse();
}

module.exports = { sendSms, messagesFor, OUTBOX };
