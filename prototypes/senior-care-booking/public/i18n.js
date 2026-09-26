// Text in English and Tamil, plus date/time formatting. Loaded by the browser
// (window.I18N) and by the server (for SMS text).
(function (root) {
  const MONTHS = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    ta: ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'],
  };
  const DAYS = {
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    ta: ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'],
  };

  function formatDate(iso, lang) {
    const d = new Date(iso + 'T00:00:00Z');
    const day = DAYS[lang][d.getUTCDay()];
    const month = MONTHS[lang][d.getUTCMonth()];
    return lang === 'ta' ? `${day}, ${d.getUTCDate()} ${month}` : `${day}, ${d.getUTCDate()} ${month}`;
  }

  function formatTime(hhmm, lang) {
    const [h, m] = hhmm.split(':').map(Number);
    const h12 = ((h + 11) % 12) + 1;
    const mm = String(m).padStart(2, '0');
    if (lang === 'ta') {
      const part = h < 12 ? 'காலை' : h < 16 ? 'மதியம்' : 'மாலை';
      return `${part} ${h12}:${mm}`;
    }
    return `${h12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
  }

  function smsText(kind, b, lang) {
    const fac = b.facility.name[lang];
    const when = `${formatDate(b.date, lang)}, ${formatTime(b.time, lang)}`;
    if (lang === 'ta') {
      if (kind === 'cancel') return `புதுச்சேரி சுகாதாரம்: உங்கள் முன்பதிவு ${b.token} (${fac}, ${when}) ரத்து செய்யப்பட்டது.`;
      return `புதுச்சேரி சுகாதாரம்: ${b.name}, உங்கள் முன்பதிவு உறுதி. டோக்கன் ${b.token}. ${fac}, ${b.facility.clinic.ta}. ${when}. 15 நிமிடம் முன்பே ஆதார் அட்டை மற்றும் பழைய மருந்துச் சீட்டுடன் வரவும். உதவி: ${b.facility.helpdesk}`;
    }
    if (kind === 'cancel') return `Puducherry Health: Your appointment ${b.token} (${fac}, ${when}) is cancelled.`;
    return `Puducherry Health: ${b.name}, your appointment is confirmed. Token ${b.token}. ${fac}, ${b.facility.clinic.en}. ${when}. Please come 15 min early with Aadhaar card and old prescriptions. Help: ${b.facility.helpdesk}`;
  }

  const T = {
    en: {
      appName: 'Puducherry Senior Care',
      appSub: 'Doctor appointments for senior citizens',
      prototype: 'Prototype with sample data. Not connected to real hospitals.',
      chooseLang: 'Choose your language',
      welcome: 'Welcome. You can book a doctor appointment in a few easy steps.',
      book: 'Book an appointment',
      mine: 'My appointments',
      voiceOn: 'Voice: On',
      voiceOff: 'Voice: Off',
      textSize: 'Text size',
      hearAgain: 'Hear again',
      speak: 'Speak your choice',
      listening: 'Listening. Please say the number or the name.',
      notHeard: 'Sorry, I did not understand. Please try again or touch your choice.',
      back: 'Back',
      home: 'Home',
      stepOf: (a, b) => `Step ${a} of ${b}`,
      regionTitle: 'Where do you live?',
      regionSay: 'Where do you live? Touch your region.',
      facilityTitle: 'Choose a hospital or health centre',
      facilitySay: 'Choose a hospital or health centre.',
      wheelchair: 'Wheelchair access',
      dateTitle: 'Choose a day',
      dateSay: 'Which day would you like to visit?',
      today: 'Today',
      tomorrow: 'Tomorrow',
      slotsLeft: (n) => (n === 0 ? 'Full' : `${n} time${n === 1 ? '' : 's'} free`),
      timeTitle: 'Choose a time',
      timeSay: 'Choose a time. Morning and afternoon times are shown.',
      morning: 'Morning',
      afternoon: 'Afternoon',
      full: 'Full',
      noTimes: 'All times on this day are full. Please go back and choose another day.',
      detailsTitle: 'Your name and mobile number',
      detailsSay: 'Please tell us your name and your mobile number. The confirmation will be sent to this phone.',
      name: 'Your name',
      namePh: 'For example: Lakshmi',
      mobile: 'Mobile number (10 digits)',
      clear: 'Clear',
      del: 'Delete',
      next: 'Next',
      errName: 'Please write your name.',
      errMobile: 'Please enter a 10 digit mobile number starting with 6, 7, 8 or 9.',
      reviewTitle: 'Please check your appointment',
      reviewSay: (s) => `Please check. ${s}. If this is correct, press Confirm booking.`,
      where: 'Where',
      when: 'When',
      who: 'Name',
      phone: 'Mobile',
      change: 'Change',
      confirm: 'Confirm booking',
      booking: 'Booking, please wait',
      doneTitle: 'Your appointment is booked',
      doneSay: (tok, s, ph) => `Your appointment is booked. Your token number is ${tok}. ${s}. A message has been sent to your phone ending ${ph}.`,
      token: 'Token number',
      smsSent: (ph) => `Confirmation SMS sent to ${ph}`,
      bring: 'Please come 15 minutes early. Bring your Aadhaar card and old prescriptions.',
      phonePreview: 'What you will see on your phone',
      bookAnother: 'Book another',
      mineTitle: 'My appointments',
      mineSay: 'Enter your mobile number to see your appointments.',
      show: 'Show my appointments',
      none: 'No appointments found for this number.',
      cancel: 'Cancel this appointment',
      cancelAsk: 'Do you want to cancel this appointment?',
      yesCancel: 'Yes, cancel it',
      noKeep: 'No, keep it',
      cancelled: 'Cancelled',
      cancelledSay: 'Your appointment is cancelled. A message has been sent to your phone.',
      upcoming: 'Confirmed',
      err: {
        SLOT_FULL: 'Sorry, this time just became full. Please choose another time.',
        DUPLICATE: 'You already have an appointment at this place on this day.',
        INVALID: 'Some details are not correct. Please check and try again.',
        NETWORK: 'Could not connect. Please check the internet and try again.',
        NOT_FOUND: 'This appointment was not found.',
      },
      tamilVoiceMissing: '',
    },
    ta: {
      appName: 'புதுச்சேரி முதியோர் நலம்',
      appSub: 'மூத்த குடிமக்களுக்கான மருத்துவர் முன்பதிவு',
      prototype: 'மாதிரி பயன்பாடு. உண்மையான மருத்துவமனைகளுடன் இணைக்கப்படவில்லை.',
      chooseLang: 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்',
      welcome: 'வணக்கம். சில எளிய படிகளில் மருத்துவரைச் சந்திக்க முன்பதிவு செய்யலாம்.',
      book: 'முன்பதிவு செய்ய',
      mine: 'எனது முன்பதிவுகள்',
      voiceOn: 'குரல்: ஆன்',
      voiceOff: 'குரல்: ஆஃப்',
      textSize: 'எழுத்து அளவு',
      hearAgain: 'மீண்டும் கேட்க',
      speak: 'பேசித் தேர்வு செய்ய',
      listening: 'கேட்கிறேன். எண்ணையோ பெயரையோ சொல்லுங்கள்.',
      notHeard: 'மன்னிக்கவும், புரியவில்லை. மீண்டும் சொல்லுங்கள் அல்லது தொட்டுத் தேர்வு செய்யுங்கள்.',
      back: 'பின் செல்ல',
      home: 'முகப்பு',
      stepOf: (a, b) => `படி ${a} / ${b}`,
      regionTitle: 'நீங்கள் எந்தப் பகுதியில் வசிக்கிறீர்கள்?',
      regionSay: 'நீங்கள் எந்தப் பகுதியில் வசிக்கிறீர்கள்? உங்கள் பகுதியைத் தொடவும்.',
      facilityTitle: 'மருத்துவமனை அல்லது சுகாதார நிலையத்தைத் தேர்ந்தெடுக்கவும்',
      facilitySay: 'மருத்துவமனை அல்லது சுகாதார நிலையத்தைத் தேர்ந்தெடுக்கவும்.',
      wheelchair: 'சக்கர நாற்காலி வசதி',
      dateTitle: 'தேதியைத் தேர்ந்தெடுக்கவும்',
      dateSay: 'எந்த நாளில் வர விரும்புகிறீர்கள்?',
      today: 'இன்று',
      tomorrow: 'நாளை',
      slotsLeft: (n) => (n === 0 ? 'நிரம்பியது' : `${n} நேரங்கள் உள்ளன`),
      timeTitle: 'நேரத்தைத் தேர்ந்தெடுக்கவும்',
      timeSay: 'நேரத்தைத் தேர்ந்தெடுக்கவும். காலை மற்றும் மதிய நேரங்கள் காட்டப்பட்டுள்ளன.',
      morning: 'காலை',
      afternoon: 'மதியம்',
      full: 'நிரம்பியது',
      noTimes: 'இந்த நாளில் எல்லா நேரங்களும் நிரம்பிவிட்டன. பின் சென்று வேறு நாளைத் தேர்ந்தெடுக்கவும்.',
      detailsTitle: 'உங்கள் பெயர் மற்றும் கைபேசி எண்',
      detailsSay: 'உங்கள் பெயரையும் கைபேசி எண்ணையும் உள்ளிடவும். உறுதிச் செய்தி இந்த எண்ணுக்கு அனுப்பப்படும்.',
      name: 'உங்கள் பெயர்',
      namePh: 'உதாரணம்: லட்சுமி',
      mobile: 'கைபேசி எண் (10 இலக்கம்)',
      clear: 'அழி',
      del: 'நீக்கு',
      next: 'அடுத்து',
      errName: 'உங்கள் பெயரை எழுதவும்.',
      errMobile: '6, 7, 8 அல்லது 9 இல் தொடங்கும் 10 இலக்க கைபேசி எண்ணை உள்ளிடவும்.',
      reviewTitle: 'உங்கள் முன்பதிவைச் சரிபார்க்கவும்',
      reviewSay: (s) => `சரிபார்க்கவும். ${s}. சரியாக இருந்தால், முன்பதிவை உறுதிசெய் என்பதை அழுத்தவும்.`,
      where: 'இடம்',
      when: 'நேரம்',
      who: 'பெயர்',
      phone: 'கைபேசி',
      change: 'மாற்று',
      confirm: 'முன்பதிவை உறுதிசெய்',
      booking: 'முன்பதிவு செய்கிறோம், காத்திருக்கவும்',
      doneTitle: 'உங்கள் முன்பதிவு உறுதியானது',
      doneSay: (tok, s, ph) => `உங்கள் முன்பதிவு உறுதியானது. உங்கள் டோக்கன் எண் ${tok}. ${s}. ${ph} இல் முடியும் உங்கள் கைபேசிக்கு செய்தி அனுப்பப்பட்டது.`,
      token: 'டோக்கன் எண்',
      smsSent: (ph) => `உறுதிச் செய்தி ${ph} எண்ணுக்கு அனுப்பப்பட்டது`,
      bring: '15 நிமிடம் முன்பே வரவும். ஆதார் அட்டை மற்றும் பழைய மருந்துச் சீட்டுகளைக் கொண்டு வரவும்.',
      phonePreview: 'உங்கள் கைபேசியில் வரும் செய்தி',
      bookAnother: 'மற்றொரு முன்பதிவு',
      mineTitle: 'எனது முன்பதிவுகள்',
      mineSay: 'உங்கள் முன்பதிவுகளைப் பார்க்க கைபேசி எண்ணை உள்ளிடவும்.',
      show: 'முன்பதிவுகளைக் காட்டு',
      none: 'இந்த எண்ணுக்கு முன்பதிவுகள் இல்லை.',
      cancel: 'இந்த முன்பதிவை ரத்து செய்',
      cancelAsk: 'இந்த முன்பதிவை ரத்து செய்ய வேண்டுமா?',
      yesCancel: 'ஆம், ரத்து செய்',
      noKeep: 'வேண்டாம்',
      cancelled: 'ரத்து செய்யப்பட்டது',
      cancelledSay: 'உங்கள் முன்பதிவு ரத்து செய்யப்பட்டது. உங்கள் கைபேசிக்கு செய்தி அனுப்பப்பட்டது.',
      upcoming: 'உறுதி',
      err: {
        SLOT_FULL: 'மன்னிக்கவும், இந்த நேரம் இப்போது நிரம்பிவிட்டது. வேறு நேரத்தைத் தேர்ந்தெடுக்கவும்.',
        DUPLICATE: 'இதே நாளில் இதே இடத்தில் உங்களுக்கு ஏற்கனவே முன்பதிவு உள்ளது.',
        INVALID: 'சில விவரங்கள் சரியாக இல்லை. சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
        NETWORK: 'இணைக்க முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
        NOT_FOUND: 'இந்த முன்பதிவு கிடைக்கவில்லை.',
      },
      tamilVoiceMissing: 'இந்தச் சாதனத்தில் தமிழ் குரல் இல்லை. குரல் வழிகாட்டி ஆங்கிலத்தில் பேசும்.',
    },
  };

  const api = { T, formatDate, formatTime, smsText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.I18N = api;
})(typeof window !== 'undefined' ? window : globalThis);
