# Puducherry Senior Care: doctor appointment booking prototype

A web prototype for senior citizens in the UT of Puducherry to book an appointment at a government hospital or health centre. It is built for older users: large text, large buttons, one question per screen, a spoken voice guide, and an SMS confirmation to their phone.

It is self-contained and separate from the Aalekh FRS app in this repository.

## Run it

Needs Node.js 18 or newer. There is nothing to install.

```bash
cd prototypes/senior-care-booking
npm start            # or: node server.js
```

Then open:
- http://localhost:4000 for the booking app. Try it on a phone, or use the browser's mobile view.
- http://localhost:4000/phone.html for the phone preview. It shows the SMS sent to a mobile number, so you can put it on a second screen during a demo.

Tests: `npm test`

## What the citizen sees

1. **Language**: English or Tamil (தமிழ்). You can switch at any time from the top bar.
2. **Region**: Puducherry, Karaikal, Mahé or Yanam.
3. **Facility**: hospitals and health centres in that region. Each one shows its area, clinic and wheelchair access. If a region has only one facility, this step is skipped.
4. **Day**: the next 7 open days. Sundays and holidays are left out. Days with no free times are greyed out and marked "Full".
5. **Time**: morning and afternoon times. Full times are struck through. Same-day booking closes 30 minutes before the time.
6. **Name and mobile number**: there is a large on-screen number pad, and the number is checked (10 digits, starting with 6 to 9).
7. **Check**: a summary with a "Change" button next to each item, then one large "Confirm booking" button.
8. **Booked**: a large token number (for example PY-4821) and the SMS text as it will appear on the phone.

**My appointments**: the citizen enters their mobile number to see upcoming appointments and cancel one. Cancelling asks "are you sure" first and sends a cancellation SMS.

## Designed for older users

- The base text size is 21 to 23 px, and the **A / A+ / A++** buttons make it up to 30% larger. Buttons are at least 64 px tall and have thick borders. Every choice has a number.
- The **voice guide** reads each screen and its numbered choices aloud, slowly (0.85 speed) and in an Indian English voice. It speaks Tamil when the device has a Tamil voice; most Android phones do. If there is no Tamil voice, a note says so and the guide speaks English. **Hear again** repeats the current screen. The guide can be turned off.
- **Speak your choice**: where the browser supports speech recognition (Chrome, Edge, Android), the citizen can say a number ("two", "இரண்டு") or a name ("Karaikal", "tomorrow", "confirm"). On the name screen, spoken words fill in the name, or the mobile number if 10 digits are spoken.
- High contrast, a warm off-white background to reduce glare, and a thick yellow outline showing where the keyboard focus is. Fonts: Atkinson Hyperlegible for English and Noto Sans Tamil for Tamil.
- Large **Back** and **Hear again** buttons stay fixed at the bottom of every screen. Clear messages cover every error (slot just filled, duplicate booking, no network), each with a single next action.
- Name and mobile are remembered on the device for next time. Press Shift+R to clear them on a shared demo device.

## How it works

| Part | File |
|---|---|
| Web server and API (no dependencies) | `server.js` |
| Open days, holidays, slots, seats left | `lib/slots.js` |
| SMS sending and the outbox | `lib/sms.js` |
| Facilities, regions, holidays, OPD times (sample data) | `data/facilities.json` |
| Screens and flow | `public/app.js` |
| Voice guide and voice answers | `public/voice.js` |
| English and Tamil text, date/time formats, SMS text | `public/i18n.js` |

API: `GET /api/config`, `GET /api/days?facility=`, `GET /api/slots?facility=&date=`, `POST /api/bookings`, `GET /api/bookings?mobile=`, `POST /api/bookings/:id/cancel`, `GET /api/sms?mobile=`.

Bookings are saved in `data/bookings.json`, and sent SMS in `data/outbox.json`. Neither file is committed. To show some full slots, the prototype simulates other people's bookings in a fixed, repeatable way.

**Real SMS**: set `SMS_WEBHOOK_URL` to a relay for a DLT-registered SMS gateway. The server sends it `POST {to, text, lang}` for every message. Without it, messages go only to the outbox and the phone preview.

## Before a pilot

- Replace the sample facilities, OPD times and holidays with the Health Department's real data, or connect to the hospital system (for example e-Hospital/ABDM facility and slot APIs).
- Verify the mobile number with an OTP, and link bookings to an ABHA number if needed.
- Send reminder SMS the day before, and add a missed-call or IVR route for citizens without smartphones.
- Get the Tamil text reviewed by a native speaker. Add Malayalam for Mahé and Telugu for Yanam.
- Run an accessibility audit (GIGW 3.0 / WCAG 2.1 AA) and test with senior citizens at a health centre.
