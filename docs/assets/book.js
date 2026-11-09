(function () {
  const { api, rp, esc, dateLabel, waLink, MONTHS, DOW } = window.MK;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // ---------------- teks EN / ID ----------------
  const T = {
    en: {
      brand_sub: 'Birthday Party', wa: 'WhatsApp', hero_t: 'Birthday Party Package',
      hero_p: 'Pick a date, choose your party area and extras, and see the total straight away. Your slot is held while you pay the deposit.',
      weekday: 'Weekday (Mon–Fri)', weekend: 'Weekend & public holiday', per_child: 'per child', min: 'Minimum', children: 'children',
      s1: 'Choose the date', s1_sub: 'Green dates still have free party areas.', loading: 'Loading…',
      lg_free: 'Available', lg_few: 'Few left', lg_full: 'Full / closed', lg_we: 'Weekend / holiday price',
      s2: 'Party area & start time', s2_sub: 'Your area is reserved for 3 hours from the start time.', pick_date_first: 'Choose a date first.',
      s3: 'Guests & birthday child', f_children: 'Number of children', f_adults: 'Number of adults', f_theme: 'Party theme (optional)',
      f_bdkids: 'Birthday child(ren)', add_kid: '+ Add another birthday child', kid_name: 'Name', kid_dob: 'Date of birth', kid_age: 'Turning',
      s4: "Children's buffet menu", s4_sub: 'Included in the package. Choose up to', items: 'items', chosen: 'chosen',
      menu_note: 'The children’s buffet is for kids only. Adult meals can be ordered from our restaurant.',
      s5: 'Extras (optional)', s5_sub: 'Cake, decoration, entertainment, gift bags, food & drinks. Prices include 10% tax.',
      f_cake: 'Cake flavour / design notes', f_writing: 'Writing on the cake',
      s6: 'Your details', f_name: 'Your name', f_wa: 'WhatsApp number', f_email: 'Email', f_notes: 'Allergies or special requests',
      rules_t: 'Party rules & terms', agree: 'I have read and agree to the party rules and terms.', submit: 'Send booking',
      sum_t: 'Your party', sel_none: 'No date chosen yet.', sum_empty: 'Your price appears here.', total: 'Total', deposit: 'Deposit',
      sum_foot: 'The balance is paid on the party day. Prices include 10% tax.', details: 'Details',
      ok_t: 'Booking sent – thank you!', ok_p: 'Your booking number:', ok_dep: 'Deposit to pay', ok_hold: 'Please pay the deposit before', ok_hold2: 'to keep your slot.',
      ok_mail: 'We have emailed your confirmation (check your spam folder too). Send the transfer receipt with your booking number on WhatsApp.',
      ok_wa: 'Send booking no. on WhatsApp', ok_new: 'Make another booking',
      free: 'free', full: 'full', closed: 'closed', reserved: 'Booked', choose_time: 'Start time', session_Morning: 'Morning', session_Afternoon: 'Afternoon',
      per_event: 'per event', added: 'Added', add: 'Add', min_hint: 'Minimum charge {n} children', adult_hint: 'Up to {n} adults per child included',
      err_date: 'Please choose a date.', err_slot: 'Please choose a party area and start time.', err_children: 'Please fill in the number of children.',
      err_kid: 'Please fill in the birthday child’s name.', err_name: 'Please fill in your name.', err_wa: 'Please fill in your WhatsApp number.',
      err_agree: 'Please tick the box to agree to the rules.', sending: 'Sending…', closed_form: 'Online booking is closed at the moment. Please contact us on WhatsApp.',
      soon: 'Online booking opens {n} days ahead. For an earlier date, message us on WhatsApp.', wa_msg: 'Hi Bu Dwi, here is my birthday booking: {id}',
      remove: 'Remove', starting: 'starting price', unit_suffix: '',
      rules: [
        'Decorations, animations and the children’s food menu are only available through our Birthday Party Package.',
        'Outside food and beverages are not allowed. Outside cakes have an extra charge.',
        'No external decorations, event organizers, MCs or animators without prior approval.',
        'Please avoid outside games such as balloons and water guns. Personal speakers and pets are not allowed.',
        'Minimum charge is for 10 children; registered children who do not attend are charged 50%.',
        'Entertainment must be booked at least 3 days before the party; a 50% cancellation fee applies.',
        'The deposit secures your date. Cancelled bookings are non-refundable.',
        'Confirm the final number of children at least 3 days before the party. The balance is paid on the party day.'
      ]
    },
    id: {
      brand_sub: 'Pesta Ulang Tahun', wa: 'WhatsApp', hero_t: 'Paket Pesta Ulang Tahun',
      hero_p: 'Pilih tanggal, area pesta dan tambahan, lalu lihat totalnya langsung. Slot Anda ditahan selama Anda membayar DP.',
      weekday: 'Weekday (Sen–Jum)', weekend: 'Weekend & tanggal merah', per_child: 'per anak', min: 'Minimal', children: 'anak',
      s1: 'Pilih tanggal', s1_sub: 'Tanggal hijau masih punya area kosong.', loading: 'Memuat…',
      lg_free: 'Tersedia', lg_few: 'Sisa sedikit', lg_full: 'Penuh / tutup', lg_we: 'Harga weekend / libur',
      s2: 'Area pesta & jam mulai', s2_sub: 'Area dipakai 3 jam sejak jam mulai.', pick_date_first: 'Pilih tanggal dulu.',
      s3: 'Tamu & anak yang berulang tahun', f_children: 'Jumlah anak', f_adults: 'Jumlah dewasa', f_theme: 'Tema pesta (opsional)',
      f_bdkids: 'Anak yang berulang tahun', add_kid: '+ Tambah anak yang berulang tahun', kid_name: 'Nama', kid_dob: 'Tanggal lahir', kid_age: 'Usia (tahun)',
      s4: 'Menu buffet anak', s4_sub: 'Termasuk paket. Pilih maksimal', items: 'menu', chosen: 'dipilih',
      menu_note: 'Buffet anak khusus untuk anak-anak. Makanan dewasa bisa dipesan di restoran kami.',
      s5: 'Tambahan (opsional)', s5_sub: 'Kue, dekorasi, hiburan, gift bag, makanan & minuman. Harga sudah termasuk pajak 10%.',
      f_cake: 'Rasa / catatan desain kue', f_writing: 'Tulisan di kue',
      s6: 'Data Anda', f_name: 'Nama Anda', f_wa: 'Nomor WhatsApp', f_email: 'Email', f_notes: 'Alergi atau permintaan khusus',
      rules_t: 'Aturan & ketentuan pesta', agree: 'Saya sudah membaca dan setuju dengan aturan dan ketentuan pesta.', submit: 'Kirim booking',
      sum_t: 'Pesta Anda', sel_none: 'Belum memilih tanggal.', sum_empty: 'Harga muncul di sini.', total: 'Total', deposit: 'DP',
      sum_foot: 'Sisa dilunasi pada hari pesta. Harga sudah termasuk pajak 10%.', details: 'Rincian',
      ok_t: 'Booking terkirim – terima kasih!', ok_p: 'Nomor booking Anda:', ok_dep: 'DP yang perlu dibayar', ok_hold: 'Mohon bayar DP sebelum', ok_hold2: 'supaya slot tetap untuk Anda.',
      ok_mail: 'Konfirmasi sudah kami kirim ke email (cek juga folder spam). Kirim bukti transfer beserta nomor booking lewat WhatsApp.',
      ok_wa: 'Kirim no. booking lewat WhatsApp', ok_new: 'Buat booking lain',
      free: 'kosong', full: 'penuh', closed: 'tutup', reserved: 'Terisi', choose_time: 'Jam mulai', session_Morning: 'Pagi', session_Afternoon: 'Siang / sore',
      per_event: 'per acara', added: 'Ditambahkan', add: 'Tambah', min_hint: 'Paket dihitung minimal {n} anak', adult_hint: 'Maksimal {n} dewasa per anak sudah termasuk',
      err_date: 'Pilih tanggal acara.', err_slot: 'Pilih area pesta dan jam mulai.', err_children: 'Isi jumlah anak.',
      err_kid: 'Isi nama anak yang berulang tahun.', err_name: 'Isi nama Anda.', err_wa: 'Isi nomor WhatsApp.',
      err_agree: 'Centang kotak persetujuan aturan.', sending: 'Mengirim…', closed_form: 'Booking online sedang ditutup. Silakan hubungi kami lewat WhatsApp.',
      soon: 'Booking online paling cepat {n} hari sebelumnya. Untuk tanggal lebih dekat, hubungi kami lewat WhatsApp.', wa_msg: 'Halo Bu Dwi, ini booking ulang tahun saya: {id}',
      remove: 'Hapus', starting: 'harga mulai', unit_suffix: '',
      rules: [
        'Dekorasi, hiburan dan menu makanan anak hanya tersedia melalui Paket Pesta Ulang Tahun kami.',
        'Makanan dan minuman dari luar tidak diperbolehkan. Kue dari luar dikenakan biaya tambahan.',
        'Dekorasi, EO, MC atau animator dari luar tidak diperbolehkan tanpa persetujuan.',
        'Mohon tidak membawa permainan dari luar seperti balon dan pistol air. Speaker pribadi dan hewan peliharaan tidak diperbolehkan.',
        'Paket dihitung minimal 10 anak; anak terdaftar yang tidak hadir dikenakan 50%.',
        'Hiburan harus dipesan minimal 3 hari sebelum acara; biaya pembatalan 50%.',
        'DP mengamankan tanggal. Booking yang dibatalkan tidak dapat di-refund.',
        'Konfirmasi jumlah anak final paling lambat 3 hari sebelum acara. Sisa dibayar pada hari pesta.'
      ]
    }
  };
  let lang = 'en';
  try { const saved = localStorage.getItem('mk_lang'); lang = saved || ((navigator.language || '').startsWith('id') ? 'id' : 'en'); } catch (e) { lang = 'en'; }
  const t = (k, v) => { let s = (T[lang] && T[lang][k]) || T.en[k] || k; if (v) Object.keys(v).forEach((x) => { s = s.replace('{' + x + '}', v[x]); }); return s; };

  // ---------------- state ----------------
  const params = new URLSearchParams(location.search);
  let token = null;
  try { token = params.has('admin') ? localStorage.getItem('mk_admin_token') : null; } catch (e) { token = null; }
  const S = { cat: null, month: null, days: {}, date: null, avail: null, locationId: null, session: null, time: null, items: {}, menu: [], kids: [{ name: '', dob: '', age: '' }], quote: null };

  // ---------------- language ----------------
  function applyLang() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
    $('#rules').replaceChildren(...t('rules').map((r) => { const li = document.createElement('li'); li.textContent = r; return li; }));
    if (S.cat) { renderHero(); renderCal(); renderSlots(); renderKids(); renderMenu(); renderAddons(); renderSummary(); }
  }
  $$('.lang button').forEach((b) => b.addEventListener('click', () => { lang = b.dataset.lang; try { localStorage.setItem('mk_lang', lang); } catch (e) { /* abaikan */ } applyLang(); }));

  // ---------------- load ----------------
  async function init() {
    if (token) $('#adminBanner').classList.remove('hidden');
    applyLang();
    try {
      S.cat = await api('catalog');
    } catch (e) {
      const box = $('#loadErr'); box.textContent = e.message; box.classList.remove('hidden'); return;
    }
    const wa = S.cat.whatsapp.replace(/\(.*\)/, '');
    $('#waTop').href = waLink(wa);
    if (!S.cat.formOpen && !token) { const box = $('#loadErr'); box.textContent = t('closed_form'); box.classList.remove('hidden'); }
    const first = minDate();
    S.month = first.slice(0, 7);
    $('#children').value = '';
    renderHero(); renderKids(); renderMenu(); renderAddons(); renderSummary();
    loadMonth();
  }
  function minDate() {
    const d = new Date(S.cat.today + 'T00:00:00Z');
    if (!token) d.setUTCDate(d.getUTCDate() + S.cat.minDaysAhead);
    return d.toISOString().slice(0, 10);
  }

  function renderHero() {
    const c = S.cat;
    $('#pWeekday').textContent = rp(c.weekdayPrice);
    $('#pWeekend').textContent = rp(c.weekendPrice);
    $('#pMin').textContent = c.minChildren;
    $('#incl').replaceChildren(...c.inclusions.split(';').map((s) => s.trim()).filter(Boolean).map((s) => { const li = document.createElement('li'); li.textContent = s; return li; }));
    $('#maxMenu').textContent = c.maxBuffet;
    $('#minHint').textContent = t('min_hint', { n: c.minChildren });
    $('#adultHint').textContent = t('adult_hint', { n: c.adultsPerChild });
    $('#s1sub').textContent = t('s1_sub') + (token ? '' : ' ' + t('soon', { n: c.minDaysAhead }));
  }

  // ---------------- calendar ----------------
  async function loadMonth() {
    const m = S.month;
    $('#calTitle').textContent = MONTHS[lang][+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
    if (!S.days[m]) {
      $('#cal').innerHTML = '<div class="loading">' + esc(t('loading')) + '</div>';
      try { const r = await api('month', { month: m }); S.days[m] = r.days; } catch (e) { $('#cal').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    }
    if (S.month === m) renderCal();
  }
  function renderCal() {
    const m = S.month, days = S.days[m];
    $('#calTitle').textContent = MONTHS[lang][+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
    if (!days) return;
    const cal = $('#cal');
    cal.replaceChildren();
    DOW[lang].forEach((d) => { const e = document.createElement('div'); e.className = 'dow'; e.textContent = d; cal.appendChild(e); });
    const firstDow = new Date(m + '-01T00:00:00Z').getUTCDay();
    for (let i = 0; i < firstDow; i++) { const b = document.createElement('div'); b.className = 'day blank'; cal.appendChild(b); }
    const min = minDate();
    days.forEach((d) => {
      const b = document.createElement('button');
      b.type = 'button';
      const past = d.date < min;
      const cls = ['day'];
      if (d.weekend) cls.push('we');
      if (past) cls.push('past');
      else if (d.free === 0) cls.push('full');
      else if (d.free <= Math.ceil(d.total / 3)) cls.push('few');
      else cls.push('free');
      if (S.date === d.date) cls.push('sel');
      b.className = cls.join(' ');
      b.disabled = past || d.free === 0;
      b.innerHTML = '<span class="d">' + (+d.date.slice(8)) + '</span><span class="f">' + (past ? '' : d.free === 0 ? esc(t('full')) : d.free + ' ' + esc(t('free'))) + '</span>';
      b.addEventListener('click', () => pickDate(d.date));
      cal.appendChild(b);
    });
    const prevM = shiftMonth(m, -1);
    $('#calPrev').disabled = prevM < minDate().slice(0, 7);
  }
  function shiftMonth(m, n) { const d = new Date(m + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); }
  $('#calPrev').addEventListener('click', () => { S.month = shiftMonth(S.month, -1); loadMonth(); });
  $('#calNext').addEventListener('click', () => { S.month = shiftMonth(S.month, 1); loadMonth(); });

  async function pickDate(date) {
    S.date = date; S.locationId = null; S.session = null; S.time = null;
    renderCal();
    $('#slots').innerHTML = '<div class="loading">' + esc(t('loading')) + '</div>';
    try { S.avail = await api('availability', { date }); } catch (e) { $('#slots').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    renderSlots(); requestQuote();
    if (window.innerWidth < 900) $('#s-slot').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------------- slots ----------------
  function renderSlots() {
    const box = $('#slots');
    if (!S.date || !S.avail || S.avail.date !== S.date) { if (!S.date) box.innerHTML = '<div class="muted small">' + esc(t('pick_date_first')) + '</div>'; return; }
    box.replaceChildren();
    const we = S.avail.weekend;
    S.cat.locations.forEach((l) => {
      S.cat.sessions.forEach((s) => {
        const a = S.avail.slots.find((x) => x.locationId === l.id && x.session === s.id);
        const free = a && a.available;
        const el = document.createElement('div');
        el.className = 'slot' + (free ? '' : ' off') + (S.locationId === l.id && S.session === s.id ? ' sel' : '');
        const fee = we ? l.weekendFee : l.weekdayFee;
        el.innerHTML = '<b>' + esc(l.name) + '</b><div class="meta">' + esc(t('session_' + s.id)) + (fee ? ' · + ' + esc(rp(fee)) : '') + (l.capacity ? ' · ' + l.capacity + ' seats' : '') + '</div>' +
          (free ? '' : '<div class="meta" style="color:#c0392b;font-weight:700">' + esc(t('reserved')) + '</div>');
        if (free) {
          const times = document.createElement('div'); times.className = 'times';
          (token ? s.times.concat(['custom']) : s.times).forEach((tm) => {
            const c = document.createElement('button'); c.type = 'button';
            c.className = 'chip' + (S.locationId === l.id && S.session === s.id && S.time === tm ? ' sel' : '');
            c.textContent = tm === 'custom' ? '…' : tm;
            c.addEventListener('click', (ev) => {
              ev.stopPropagation();
              let tv = tm;
              if (tm === 'custom') { tv = (prompt('Jam mulai (HH:MM)', '11:00') || '').trim(); if (!/^\d{1,2}:\d{2}$/.test(tv)) return; }
              S.locationId = l.id; S.session = s.id; S.time = tv; renderSlots(); requestQuote();
            });
            times.appendChild(c);
          });
          const lab = document.createElement('div'); lab.className = 'meta'; lab.style.marginTop = '6px'; lab.textContent = t('choose_time');
          el.appendChild(lab); el.appendChild(times);
        }
        box.appendChild(el);
      });
    });
  }

  // ---------------- kids ----------------
  function renderKids() {
    const box = $('#kids');
    box.replaceChildren();
    S.kids.forEach((k, i) => {
      const row = document.createElement('div'); row.className = 'kid';
      row.innerHTML = '<div class="field"><label>' + esc(t('kid_name')) + '</label><input maxlength="80" data-k="name"></div>' +
        '<div class="field"><label>' + esc(t('kid_dob')) + '</label><input type="date" data-k="dob"></div>' +
        '<div class="field"><label>' + esc(t('kid_age')) + '</label><input type="number" min="0" max="18" data-k="age" inputmode="numeric"></div>' +
        (i > 0 ? '<button type="button" class="x" title="' + esc(t('remove')) + '">×</button>' : '<span></span>');
      $$('input', row).forEach((inp) => {
        inp.value = k[inp.dataset.k] || '';
        inp.addEventListener('input', () => {
          k[inp.dataset.k] = inp.value;
          if (inp.dataset.k === 'dob' && inp.value && S.date) {
            const b = new Date(inp.value + 'T00:00:00Z'), e = new Date(S.date + 'T00:00:00Z');
            let age = e.getUTCFullYear() - b.getUTCFullYear(); if (e.getUTCMonth() < b.getUTCMonth() || (e.getUTCMonth() === b.getUTCMonth() && e.getUTCDate() < b.getUTCDate())) age--;
            if (age >= 0 && age < 19) { k.age = String(age); $('[data-k="age"]', row).value = age; }
          }
        });
      });
      const x = $('.x', row); if (x) x.addEventListener('click', () => { S.kids.splice(i, 1); renderKids(); });
      box.appendChild(row);
    });
    $('#addKid').classList.toggle('hidden', S.kids.length >= 4);
  }
  $('#addKid').addEventListener('click', () => { if (S.kids.length < 4) { S.kids.push({ name: '', dob: '', age: '' }); renderKids(); } });

  // ---------------- buffet menu ----------------
  function renderMenu() {
    const box = $('#menu');
    box.replaceChildren();
    const groups = {};
    S.cat.menu.forEach((m) => { (groups[m.group] = groups[m.group] || []).push(m); });
    Object.keys(groups).forEach((g) => {
      const wrap = document.createElement('div'); wrap.className = 'menu-grp';
      const h = document.createElement('h4'); h.textContent = g; wrap.appendChild(h);
      const row = document.createElement('div'); row.className = 'menu';
      groups[g].forEach((m) => {
        const on = S.menu.includes(m.id);
        const full = !on && S.menu.length >= S.cat.maxBuffet;
        const c = document.createElement('button'); c.type = 'button';
        c.className = 'chip' + (on ? ' sel' : '') + (full ? ' dis' : '');
        c.textContent = m.name + (m.note ? ' (' + m.note + ')' : '');
        c.addEventListener('click', () => {
          if (on) S.menu = S.menu.filter((x) => x !== m.id);
          else if (!full) S.menu.push(m.id);
          renderMenu();
        });
        row.appendChild(c);
      });
      wrap.appendChild(row); box.appendChild(wrap);
    });
    $('#menuCount').textContent = S.menu.length;
  }

  // ---------------- add-ons ----------------
  const kidsCount = () => Math.max(0, parseInt($('#children').value, 10) || 0);
  function defaultQty(a) {
    if (/kid/.test(a.unit)) return Math.max(1, kidsCount());
    if (/bottle|can/.test(a.unit) && /beer/i.test(a.name)) return 24;
    return 1;
  }
  function renderAddons() {
    const box = $('#addons');
    const openCats = new Set($$('details.cat[open]', box).map((d) => d.dataset.cat));
    box.replaceChildren();
    const cats = {};
    S.cat.addons.forEach((a) => { (cats[a.category] = cats[a.category] || []).push(a); });
    Object.keys(cats).forEach((c) => {
      const det = document.createElement('details'); det.className = 'cat'; det.dataset.cat = c;
      if (openCats.has(c)) det.open = true;
      const n = cats[c].filter((a) => S.items[a.id]).length;
      det.innerHTML = '<summary>' + esc(c) + (n ? ' <span class="cnt">' + n + '</span>' : '') + '</summary>';
      const list = document.createElement('div'); list.className = 'items';
      cats[c].forEach((a) => {
        const q = S.items[a.id] || 0;
        const it = document.createElement('div'); it.className = 'item' + (q ? ' on' : '');
        const unit = a.unit ? ' ' + a.unit : '';
        it.innerHTML = '<div><b>' + esc(a.name) + '</b>' + (a.description ? '<div class="d">' + esc(a.description) + '</div>' : '') +
          '<div class="p">' + (a.price ? esc(rp(a.price)) + esc(unit) + (/starting/i.test(a.description) ? ' · ' + esc(t('starting')) : '') : '') + '</div></div>';
        const ctl = document.createElement('div');
        if (!q) {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost sm'; b.textContent = t('add');
          b.addEventListener('click', () => { S.items[a.id] = defaultQty(a); renderAddons(); requestQuote(); });
          ctl.appendChild(b);
        } else {
          const qty = document.createElement('div'); qty.className = 'qty';
          qty.innerHTML = '<button type="button" aria-label="-">−</button><input type="number" min="0" max="500" aria-label="qty"><button type="button" aria-label="+">+</button>';
          const [minus, inp, plus] = [qty.children[0], qty.children[1], qty.children[2]];
          inp.value = q;
          minus.addEventListener('click', () => { setQty(a.id, q - 1); });
          plus.addEventListener('click', () => { setQty(a.id, q + 1); });
          inp.addEventListener('change', () => setQty(a.id, parseInt(inp.value, 10) || 0));
          ctl.appendChild(qty);
        }
        it.appendChild(ctl); list.appendChild(it);
      });
      det.appendChild(list); box.appendChild(det);
    });
  }
  function setQty(id, q) { if (q <= 0) delete S.items[id]; else S.items[id] = Math.min(500, q); renderAddons(); requestQuote(); }

  // ---------------- quote & summary ----------------
  let qTimer = null, qSeq = 0;
  function payload() {
    return {
      date: S.date, session: S.session, time: S.time, locationId: S.locationId,
      children: kidsCount(), adults: parseInt($('#adults').value, 10) || 0,
      items: Object.keys(S.items).map((id) => ({ id, qty: S.items[id] })), menu: S.menu.slice(),
      birthdayChildren: S.kids.map((k) => ({ name: k.name.trim(), dob: k.dob, age: k.age })),
      theme: $('#theme').value, cakeDetails: $('#cakeDetails').value, cakeWriting: $('#cakeWriting').value,
      contactName: $('#contactName').value, whatsapp: $('#whatsapp').value, email: $('#email').value, notes: $('#notes').value,
      agree: $('#agree').checked, lang
    };
  }
  function requestQuote() {
    clearTimeout(qTimer);
    if (!S.date || !kidsCount()) { S.quote = null; renderSummary(); return; }
    qTimer = setTimeout(async () => {
      const my = ++qSeq;
      try { const q = await api('quote', payload(), token); if (my === qSeq) { S.quote = q; renderSummary(); } } catch (e) { if (my === qSeq) { S.quote = null; renderSummary(e.message); } }
    }, 350);
  }
  function renderSummary(errMsg) {
    const info = $('#selInfo');
    if (S.date) {
      const loc = S.cat && S.cat.locations.find((l) => l.id === S.locationId);
      info.textContent = dateLabel(S.date, lang) + (loc ? ' · ' + loc.name + ' · ' + t('session_' + S.session) + ' ' + (S.time || '') : '');
    } else info.textContent = t('sel_none');
    const lines = $('#lines');
    const q = S.quote;
    if (!q) {
      lines.innerHTML = '<div class="muted small">' + esc(errMsg || t('sum_empty')) + '</div>';
      $('#total').textContent = '—'; $('#deposit').textContent = '—'; $('#depPct').textContent = ''; $('#qNotes').textContent = '';
      $('#mbTotal').textContent = '—'; $('#mbDep').textContent = '—';
      return;
    }
    lines.replaceChildren(...q.lines.map((l) => {
      const d = document.createElement('div'); d.className = 'line';
      const a = document.createElement('span'); a.textContent = l.name + (l.qty > 1 ? ' × ' + l.qty : '');
      if (l.note) { const s = document.createElement('small'); s.textContent = l.note; a.appendChild(s); }
      const b = document.createElement('span'); b.textContent = rp(l.amount);
      d.append(a, b); return d;
    }));
    $('#total').textContent = rp(q.total); $('#deposit').textContent = rp(q.deposit); $('#depPct').textContent = '(' + q.depositPercent + '%)';
    $('#qNotes').textContent = q.notes.join(' · ');
    $('#mbTotal').textContent = rp(q.total); $('#mbDep').textContent = rp(q.deposit);
  }
  ['#children', '#adults'].forEach((s) => $(s).addEventListener('input', () => { requestQuote(); }));
  $('#children').addEventListener('change', () => {
    // perbarui jumlah item per anak yang sudah dipilih
    const n = kidsCount();
    S.cat.addons.forEach((a) => { if (S.items[a.id] && /kid/.test(a.unit) && n) S.items[a.id] = n; });
    renderAddons(); requestQuote();
  });

  // ---------------- submit ----------------
  function showErr(msg, focusSel) {
    const box = $('#formErr'); box.textContent = msg; box.classList.remove('hidden');
    if (focusSel) { const el = $(focusSel); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (el.focus) el.focus({ preventScroll: true }); } }
  }
  $('#bookForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    $('#formErr').classList.add('hidden');
    const p = payload();
    if (!p.date) return showErr(t('err_date'), '#s-date');
    if (!p.locationId || !p.session || !p.time) return showErr(t('err_slot'), '#s-slot');
    if (!p.children) return showErr(t('err_children'), '#children');
    if (!p.birthdayChildren.some((k) => k.name)) return showErr(t('err_kid'), '#kids input');
    if (!p.contactName.trim()) return showErr(t('err_name'), '#contactName');
    if (!token && !p.whatsapp.trim()) return showErr(t('err_wa'), '#whatsapp');
    if (!token && !p.agree) return showErr(t('err_agree'), '#agree');
    const btn = $('#submitBtn'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> ' + esc(t('sending'));
    try {
      const b = await api('createBooking', p, token);
      showSuccess(b);
    } catch (e) {
      showErr(e.message);
      if (/booked|terisi/i.test(e.message) && S.date) pickDate(S.date);
    } finally {
      btn.disabled = false; btn.textContent = t('submit');
    }
  });
  function showSuccess(b) {
    $('#formArea').classList.add('hidden'); $('#mobilebar').classList.add('hidden');
    $('#success').classList.remove('hidden');
    $('#okNo').textContent = b.id;
    $('#okWhen').textContent = dateLabel(b.date, lang) + ' · ' + b.location + ' · ' + t('session_' + b.session) + ' ' + b.time;
    $('#okTotal').textContent = rp(b.quote.total); $('#okDep').textContent = rp(b.quote.deposit);
    $('#okHold').textContent = b.holdUntil.slice(0, 16);
    $('#okBank').textContent = b.bank;
    $('#okWa').href = waLink(String(b.contact).replace(/\(.*\)/, ''), t('wa_msg', { id: b.id }));
    $('#okNew').href = location.pathname + location.search;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  init();
})();
