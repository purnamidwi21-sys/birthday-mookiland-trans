(function () {
  const { api, rp, esc, dateLabel, waLink } = window.MK;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ST = { PENDING: 'Menunggu DP', CONFIRMED: 'Terkonfirmasi', COMPLETED: 'Selesai', CANCELLED: 'Batal' };
  const PS = { UNPAID: 'Belum bayar', DEPOSIT_PAID: 'DP masuk', PAID: 'Lunas', NO_PAYMENT_RECORD: 'Tidak tercatat' };
  const SES = { Morning: 'Pagi', Afternoon: 'Siang/sore' };
  PS.NOT_REQUIRED = 'Tanpa tagihan';
  const EV = { BIRTHDAY_PACKAGE: 'Birthday Package', BIRTHDAY_REGULAR_TICKET: 'Regular Ticket', SCHOOL_EXCURSION: 'School excursion', GROUP_EVENT: 'Group event', PRIVATE_EVENT: 'Private event', UNKNOWN: 'Belum diketahui' };
  const evBadge = (c) => '<span class="badge ev ev-' + (c === 'BIRTHDAY_PACKAGE' ? 'pkg' : c === 'BIRTHDAY_REGULAR_TICKET' ? 'reg' : 'oth') + '">' + esc(c === 'BIRTHDAY_PACKAGE' ? 'Package' : c === 'BIRTHDAY_REGULAR_TICKET' ? 'Regular' : (EV[c] || c || '—')) + '</span>';
  const PT = { DEPOSIT: 'DP', SECOND_PAYMENT: 'Pembayaran ke-2', FINAL: 'Pelunasan', ADJUSTMENT: 'Koreksi', REFUND: 'Refund', OTHER_BANK: 'Bank lain' };
  let token = null;
  try { token = localStorage.getItem('mk_admin_token'); } catch (e) { token = null; }
  const S = { list: [], today: '', view: 'upcoming', cat: null, current: null };

  // ---------------- login ----------------
  function showApp(on) {
    $('#loginView').classList.toggle('hidden', on);
    $('#appView').classList.toggle('hidden', !on);
    $('#btnNew').classList.toggle('hidden', !on);
    $('#btnLogout').classList.toggle('hidden', !on);
  }
  $('#loginForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('#loginBtn'); btn.disabled = true; $('#loginErr').classList.add('hidden');
    try {
      const r = await api('login', { password: $('#pw').value });
      token = r.token; try { localStorage.setItem('mk_admin_token', token); } catch (e) { /* abaikan */ }
      $('#pw').value = ''; showApp(true); load();
    } catch (e) { $('#loginErr').textContent = e.message; $('#loginErr').classList.remove('hidden'); }
    btn.disabled = false;
  });
  $('#btnLogout').addEventListener('click', () => { token = null; try { localStorage.removeItem('mk_admin_token'); } catch (e) { /* abaikan */ } showApp(false); });
  async function call(action, payload) {
    try { return await api(action, payload, token); } catch (e) {
      if (/login/i.test(e.message)) { token = null; showApp(false); }
      // koneksi putus saat menyimpan: muat ulang detail supaya terlihat apa yang sudah tersimpan
      if (e.network && !/^admin(Get|List|DraftItems)$/.test(action) && S.current && dlg.open) {
        try { renderDetail(await api('adminGet', { id: S.current.booking.id }, token)); refreshRow(); } catch (e2) { /* biarkan */ }
      }
      throw e;
    }
  }

  // ---------------- list ----------------
  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="8" class="muted">Memuat…</td></tr>';
    try {
      const [r, cat] = await Promise.all([call('adminList', {}), S.cat ? Promise.resolve(S.cat) : api('catalog')]);
      S.list = r.bookings; S.today = r.today; S.cat = cat;
      const years = Array.from(new Set(S.list.map((b) => b.date.slice(0, 4)).filter(Boolean))).sort().reverse();
      const sel = $('#fYear'); const cur = sel.value;
      sel.replaceChildren(new Option('Semua tahun', ''), ...years.map((y) => new Option(y, y))); sel.value = cur;
      renderStats(); renderList();
    } catch (e) { $('#tbody').innerHTML = '<tr><td colspan="8"><div class="err">' + esc(e.message) + '</div></td></tr>'; }
  }
  const nowStamp = () => { const d = new Date(Date.now() + 8 * 3600e3); return d.toISOString().slice(0, 19).replace('T', ' '); };
  const expired = (b) => b.status === 'PENDING' && b.hold && b.hold < nowStamp() && !(b.paid > 0);
  function renderStats() {
    const up = S.list.filter((b) => b.date >= S.today && b.status !== 'CANCELLED');
    const wait = up.filter((b) => b.status === 'PENDING');
    const month = S.today.slice(0, 7);
    const thisMonth = S.list.filter((b) => b.date.slice(0, 7) === month && b.status !== 'CANCELLED' && b.category === 'BIRTHDAY_PACKAGE');
    const next7 = up.filter((b) => b.date <= new Date(Date.parse(S.today) + 7 * 864e5).toISOString().slice(0, 10));
    const stat = (k, v) => '<div class="stat"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
    const cakeWait = up.filter((b) => b.cakeStatus === 'PRICE_PENDING').length;
    $('#stats').innerHTML = stat('Acara akan datang', up.length) + stat('7 hari ke depan', next7.length) + stat('Menunggu DP', wait.length) + stat('Cake belum final', cakeWait) +
      stat('Birthday bulan ini', thisMonth.length) + stat('Dibayar (bulan ini)', rp(thisMonth.reduce((s, b) => s + (b.paid || 0), 0)));
  }
  function filtered() {
    const q = $('#q').value.trim().toLowerCase();
    const y = $('#fYear').value;
    let rows = S.list;
    if (S.view === 'upcoming') rows = rows.filter((b) => b.date >= S.today && b.status !== 'CANCELLED').slice().reverse();
    if (S.view === 'pending') rows = rows.filter((b) => b.status === 'PENDING' && b.date >= S.today).slice().reverse();
    if (S.view === 'past') rows = rows.filter((b) => b.date < S.today);
    if (S.view === 'cake') rows = rows.filter((b) => b.cakeStatus === 'PRICE_PENDING' && b.status !== 'CANCELLED').slice().reverse();
    if (y) rows = rows.filter((b) => b.date.slice(0, 4) === y);
    const ft = $('#fType').value;
    if (ft === 'OTHER') rows = rows.filter((b) => b.category !== 'BIRTHDAY_PACKAGE' && b.category !== 'BIRTHDAY_REGULAR_TICKET');
    else if (ft) rows = rows.filter((b) => b.category === ft);
    if (q) rows = rows.filter((b) => [b.id, b.customer, b.child, b.whatsapp, b.venue].join(' ').toLowerCase().includes(q));
    return rows;
  }
  function renderList() {
    const rows = filtered();
    const tb = $('#tbody');
    if (!rows.length) { tb.innerHTML = '<tr><td colspan="8" class="muted">Tidak ada booking.</td></tr>'; $('#count').textContent = ''; return; }
    const show = rows.slice(0, 300);
    tb.innerHTML = show.map((b) => {
      const loc = (S.cat && S.cat.locations.find((l) => l.id === b.locationId)) || null;
      const st = expired(b) ? '<span class="badge b-exp">Masa tahan habis</span>' : '<span class="badge b-' + esc(b.status) + '">' + esc(ST[b.status] || b.status) + '</span>';
      return '<tr data-id="' + esc(b.id) + '"><td>' + esc(dateLabel(b.date, 'id')) + '<div class="sub">' + esc(SES[b.session] || b.session) + ' ' + esc(b.time) + '</div></td>' +
        '<td>' + esc(loc ? loc.name : (b.venue || '—')) + '</td><td>' + esc(b.id) + (b.source === 'LEGACY_GOOGLE_FORM' ? ' <span class="sub">lama</span>' : '') + '<div>' + evBadge(b.category) + '</div></td>' +
        '<td>' + esc(b.customer || '—') + '<div class="sub">' + esc(b.child) + '</div></td><td class="n">' + esc(b.children || '') + '</td>' +
        '<td class="n">' + (b.total == null ? '<span class="sub">—</span>' : esc(rp(b.total))) + '</td><td class="n">' + esc(rp(b.paid || 0)) + '</td>' +
        '<td class="st">' + st + '<br><span class="badge b-' + esc(b.payment) + '">' + esc(PS[b.payment] || b.payment) + '</span>' +
        (b.cakeStatus === 'PRICE_PENDING' && b.status !== 'CANCELLED' ? '<br><span class="badge b-cake">Harga cake belum final</span>' : '') + '</td></tr>';
    }).join('');
    $('#count').textContent = rows.length > 300 ? 'Menampilkan 300 dari ' + rows.length + ' booking. Pakai pencarian atau filter tahun.' : rows.length + ' booking';
  }
  $('#tbody').addEventListener('click', (ev) => { const tr = ev.target.closest('tr[data-id]'); if (tr) openBooking(tr.dataset.id); });
  $$('#viewSeg button').forEach((b) => b.addEventListener('click', () => { $$('#viewSeg button').forEach((x) => x.classList.toggle('on', x === b)); S.view = b.dataset.v; renderList(); }));
  $('#q').addEventListener('input', renderList);
  $('#fYear').addEventListener('change', renderList);
  $('#fType').addEventListener('change', renderList);
  $('#btnReload').addEventListener('click', load);

  // ---------------- detail ----------------
  const dlg = $('#dlg');
  $('#dlgClose').addEventListener('click', () => dlg.close());
  async function openBooking(id) {
    $('#dlgTitle').textContent = id;
    $('#dlgBody').innerHTML = '<div class="loading">Memuat…</div>';
    if (!dlg.open) dlg.showModal();
    try { renderDetail(await call('adminGet', { id })); } catch (e) { $('#dlgBody').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; }
  }
  function renderDetail(d) {
    S.current = d;
    const b = d.booking;
    const loc = S.cat && S.cat.locations.find((l) => l.id === b.locationId);
    const balance = b.total == null ? null : b.total - (b.paid || 0);
    const wa = b.whatsapp ? waLink(b.whatsapp, 'Halo ' + b.customer + ', ini Mookiland mengenai booking ulang tahun ' + b.id + '.') : '';
    const kv = (k, v) => '<div><span>' + esc(k) + '</span>' + esc(v || '—') + '</div>';
    let h = '<div class="info">' + kv('Jenis event', EV[b.category] || b.eventType || b.category) + kv('Tanggal', dateLabel(b.date, 'id')) + kv('Sesi / jam', (SES[b.session] || b.session) + ' ' + b.time) + kv('Area', loc ? loc.name : b.venue) +
      kv('Status', (ST[b.status] || b.status) + ' · ' + (PS[b.payment] || b.payment)) + kv('Klien', b.customer) + kv('WhatsApp', b.whatsapp) + kv('Email', b.email) +
      kv('Anak berulang tahun', b.child + (b.age ? ' (' + b.age + ')' : '')) + kv('Anak / dewasa', b.children + ' / ' + (b.adults || '—')) + kv('Tema', b.theme) +
      kv('Dibuat', b.createdAt + ' · ' + b.source) + kv('Masa tahan slot', b.status === 'PENDING' ? b.hold : '') + '</div>';
    if (b.notes) h += '<div class="legacy" style="background:#fff;border-color:var(--line)"><b>Catatan klien:</b> ' + esc(b.notes) + '</div>';
    h += '<div class="money"><div><span>Total</span><b>' + (b.total == null ? '—' : esc(rp(b.total))) + '</b></div><div><span>DP</span><b>' + (b.deposit == null ? '—' : esc(rp(b.deposit))) + '</b></div>' +
      '<div><span>Sudah dibayar</span><b>' + esc(rp(b.paid || 0)) + '</b></div><div><span>Sisa</span><b>' + (balance == null ? '—' : esc(rp(balance))) + '</b></div></div>';
    h += '<div class="sec sec-row"><span>Rincian</span><button type="button" class="btn ghost sm" id="itemsEdit">✎ ' + (d.items.length ? 'Ubah rincian / jumlah anak' : 'Buat rincian invoice') + '</button></div><div id="itemsBox">';
    if (!d.items.length) h += '<div class="muted small">Belum ada rincian item' + (b.legacy ? ' (booking lama)' : '') + '.</div>';
    if (d.items.length) {
      h += '<div class="tablewrap"><table class="tbl"><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Harga</th><th class="n">Jumlah</th></tr></thead><tbody>' +
        d.items.map((i) => '<tr style="cursor:default' + (i.billing === 'RESTAURANT' ? ';color:var(--muted)' : '') + '"><td>' + esc(i.name) + (i.billing === 'RESTAURANT' ? ' <span class="badge b-resto">Resto</span>' : '') + (i.note ? '<div class="sub">' + esc(i.note) + '</div>' : '') + '</td><td class="n">' + i.qty + '</td><td class="n">' + esc(rp(i.unitPrice)) + '</td><td class="n">' + (i.billing === 'RESTAURANT' ? '<span title="Dibayar di restoran, tidak masuk total">(' + esc(rp(i.amount)) + ')</span>' : esc(rp(i.amount))) + '</td></tr>').join('') + '</tbody></table></div>';
      if (d.items.some((i) => i.billing === 'RESTAURANT')) h += '<div class="small muted" style="margin-top:4px">Item <b>Resto</b> = dipesan & dibayar di restoran (penjualan biasa). Hanya info, tidak masuk total, DP, atau invoice.</div>';
    }
    h += '</div>';
    const extra = [['Menu buffet', b.menu], ['Kue', [b.cake, b.cakeDetails, b.cakeWriting && '“' + b.cakeWriting + '”'].filter(Boolean).join(' · ')], ['Dekorasi', b.decoration], ['Hiburan & lainnya', b.entertainment], ['Makanan & minuman tambahan', b.extraFood]].filter((x) => x[1]);
    if (extra.length) h += '<div class="info" style="margin-top:12px">' + extra.map((x) => kv(x[0], x[1])).join('') + '</div>';
    const cakeItem = d.items.find((i) => /CAKE-CUSTOM/i.test(i.addOnId) || (S.cat && i.addOnId === S.cat.customCakeId));
    if (b.cakeStatus || cakeItem) {
      const pending = b.cakeStatus !== 'PRICE_FINAL';
      h += '<div class="cakebox-a"><b>🎂 Cake custom</b> · ' + (pending ? '<span class="badge b-cake">Harga belum final</span>' : '<span class="ok">Harga final sudah diisi</span>') +
        '<div class="small" style="margin-top:6px">' + esc(b.cakeDetails || '—') + (b.cakeWriting ? '<br>Tulisan: “' + esc(b.cakeWriting) + '”' : '') + '</div>' +
        '<div class="small" style="margin-top:6px">' + (b.cakeRef ? '<a href="' + esc(b.cakeRef) + '" target="_blank" rel="noopener">Buka foto referensi (Google Drive)</a>' : '<span class="muted">Tidak ada foto referensi.</span>') + '</div>' +
        (cakeItem ? '<form id="cakeForm" class="formrow"><div class="field"><label>' + (pending ? 'Harga final cake dari cake maker (Rp)' : 'Ubah harga cake (Rp)') + '</label>' +
          '<input name="price" type="number" step="1000" min="1000" required value="' + (pending ? '' : esc(cakeItem.unitPrice)) + '" placeholder="Harga mulai ' + esc(rp(cakeItem.unitPrice)) + '"></div>' +
          '<label class="check small" style="align-self:end"><input type="checkbox" name="notify"' + (b.email ? ' checked' : ' disabled') + '> Email harga baru ke klien' + (b.email ? '' : ' (tidak ada email)') + '</label>' +
          '<button class="btn sm" type="submit">Simpan harga cake</button></form>' +
          '<p class="small muted" style="margin:6px 0 0">Total' + (b.paid > 0 ? '' : ' dan DP') + ' dihitung ulang otomatis.</p>' : '') + '</div>';
    }
    if (b.legacy) h += '<div class="legacy">Booking dari database lama. Ringkasan: ' + esc(b.legacy) + (b.total == null ? '<br>Total tagihan belum ada: isi di bawah supaya sisa tagihan bisa dihitung.' : '') + '</div>';
    if (d.participants.length) h += '<div class="sec">Anak berulang tahun</div><div class="small">' + d.participants.map((p) => esc(p.name) + (p.age !== '' ? ' (' + esc(p.age) + ')' : '') + (p.notes ? ' <span class="muted">' + esc(p.notes) + '</span>' : '')).join(' · ') + '</div>';

    h += '<div class="sec">Pembayaran</div>';
    h += d.payments.length ? '<div class="tablewrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Bank / cara</th><th class="n">Jumlah</th><th></th></tr></thead><tbody>' +
      d.payments.map((p) => '<tr style="cursor:default"><td>' + esc(p.date) + '</td><td>' + esc(PT[p.type] || p.type) + '</td><td>' + esc(p.bank) + '</td><td class="n">' + esc(rp(p.amount)) + '</td><td>' +
        (p.id.indexOf('PAY-L') === 0 ? '' : '<button type="button" class="btn danger sm" data-del="' + esc(p.id) + '">Hapus</button>') + '</td></tr>').join('') + '</tbody></table></div>'
      : '<div class="muted small">Belum ada pembayaran.</div>';
    const suggest = b.paid > 0 ? (balance > 0 ? balance : '') : (b.deposit || '');
    h += '<form id="payForm" class="formrow" style="margin-top:10px">' +
      '<div class="field"><label>Jenis</label><select name="type"><option value="DEPOSIT"' + (b.paid > 0 ? '' : ' selected') + '>DP</option><option value="SECOND_PAYMENT">Pembayaran ke-2</option><option value="FINAL"' + (b.paid > 0 ? ' selected' : '') + '>Pelunasan</option><option value="ADJUSTMENT">Koreksi (+/−)</option><option value="REFUND">Refund</option></select></div>' +
      '<div class="field"><label>Jumlah (Rp)</label><input name="amount" type="number" step="1000" value="' + esc(suggest) + '" required></div>' +
      '<div class="field"><label>Tanggal</label><input name="date" type="date" value="' + esc(S.today) + '"></div>' +
      '<div class="field"><label>Bank / cara</label><select name="method"><option>BNI transfer</option><option>Bank lain</option><option>QRIS</option><option>Kartu</option><option>Tunai</option></select></div>' +
      '<button class="btn sm" type="submit">Catat pembayaran</button></form>';

    const evOpts = ['BIRTHDAY_PACKAGE', 'BIRTHDAY_REGULAR_TICKET'];
    h += '<div class="sec">Ubah booking</div><form id="editForm" class="formrow">' +
      '<div class="field"><label>Jenis event</label><select name="category">' + (evOpts.includes(b.category) ? '' : '<option value="" selected>' + esc(EV[b.category] || b.category || '—') + '</option>') +
      evOpts.map((c) => '<option value="' + c + '"' + (b.category === c ? ' selected' : '') + '>' + EV[c] + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Total tagihan (Rp)</label><input name="total" type="number" step="1000" value="' + (b.total == null ? '' : esc(b.total)) + '"></div>' +
      '<div class="field"><label>DP (Rp)</label><input name="deposit" type="number" step="1000" value="' + (b.deposit == null ? '' : esc(b.deposit)) + '"></div>' +
      '<div class="field"><label>Jumlah anak</label><input name="children" type="number" min="0" value="' + esc(b.children || '') + '"></div>' +
      '<div class="field"><label>Jumlah dewasa</label><input name="adults" type="number" min="0" value="' + esc(b.adults || '') + '"></div>' +
      '<button class="btn ghost sm" type="submit">Simpan</button></form>' +
      '<div class="field" style="margin-top:8px"><label>Catatan / permintaan khusus</label><textarea id="editNotes" rows="2">' + esc(b.notes) + '</textarea></div>';

    h += '<div class="sec">Invoice</div><div class="actions" style="margin-top:0">' +
      '<button type="button" class="btn ghost sm" id="invDl">Unduh invoice (PDF)</button>' +
      '<button type="button" class="btn sm" id="invSend"' + (b.email ? '' : ' disabled title="Tidak ada email klien"') + '>Kirim invoice ke klien</button>' +
      '<span class="small muted" id="invMsg">' + (b.payment === 'PAID' ? 'Invoice akan bercap PAID.' : 'Proforma invoice dengan pembayaran terbaru.') + '</span></div>';
    const due = dueOf(b);
    const lastRem = d.log.filter((l) => /^REMINDER_/.test(l.action)).slice(-1)[0];
    h += '<div class="sec">Reminder pembayaran</div>' + (due.kind === 'NONE' ? '<div class="muted small">' + (b.total == null ? 'Total tagihan belum diisi.' : 'Tidak ada tagihan yang belum dibayar.') + '</div>' :
      '<div class="small" style="margin-bottom:6px">' + (due.kind === 'DEPOSIT' ? '<b>DP belum dibayar: ' + esc(rp(due.amount)) + '</b>' + (b.status === 'PENDING' && b.hold ? ' · masa tahan slot sampai ' + esc(b.hold.slice(0, 16)) : '') : '<b>Sisa pembayaran: ' + esc(rp(due.amount)) + '</b>') + '</div>' +
      '<div class="actions" style="margin-top:0">' +
      '<button type="button" class="btn sm" id="remEmail"' + (b.email ? '' : ' disabled title="Tidak ada email klien"') + '>Kirim reminder email</button>' +
      '<button type="button" class="btn sun sm" id="remWa"' + (b.whatsapp ? '' : ' disabled title="Tidak ada nomor WhatsApp"') + '>Reminder WhatsApp</button>' +
      '<span class="small muted" id="remMsg">' + (lastRem ? 'Terakhir: ' + esc(lastRem.at.slice(0, 16)) + ' via ' + (lastRem.action === 'REMINDER_WA' ? 'WhatsApp' : 'email') + (lastRem.actor === 'system' ? ' (otomatis)' : '') : 'Belum pernah dikirim.') + '</span></div>' +
      (due.kind === 'DEPOSIT' && b.source !== 'LEGACY_GOOGLE_FORM' ? '<p class="small muted" style="margin:6px 0 0">Email reminder DP juga dikirim otomatis sekali (dicek tiap pagi 09:00) bila booking sudah 1 hari belum dibayar.</p>' : ''));
    h += '<div class="actions">' + (wa ? '<a class="btn sun sm" target="_blank" rel="noopener" href="' + esc(wa) + '">WhatsApp klien</a>' : '') +
      (b.status === 'PENDING' ? '<button type="button" class="btn ghost sm" data-hold="1">Perpanjang masa tahan 3 hari</button>' : '') +
      (b.status !== 'COMPLETED' ? '<button type="button" class="btn ghost sm" data-status="COMPLETED">Tandai selesai</button>' : '') +
      (b.status !== 'CANCELLED' ? '<button type="button" class="btn danger sm" data-status="CANCELLED">Batalkan booking</button>' : '<button type="button" class="btn ghost sm" data-status="PENDING">Aktifkan lagi</button>') + '</div>';
    if (d.log.length) h += '<div class="sec">Riwayat</div>' + d.log.slice().reverse().map((l) => '<div class="logline">' + esc(l.at) + ' · ' + esc(l.actor) + ' · ' + esc(l.action) + (l.details ? ' · ' + esc(l.details) : '') + '</div>').join('');
    h += '<div id="dErr" class="err hidden"></div>';
    $('#dlgBody').innerHTML = h;

    const err = (m) => { const e = $('#dErr'); e.textContent = m; e.classList.remove('hidden'); };
    const after = (r) => { renderDetail(r.detail || r); refreshRow(); };
    const okMsg = (m) => { const x = document.createElement('div'); x.className = 'okbox small'; x.textContent = '✓ ' + m; $('#dlgBody').prepend(x); x.scrollIntoView({ block: 'nearest' }); };
    $('#payForm').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = new FormData(ev.target);
      const btn = $('button[type=submit]', ev.target); btn.disabled = true;
      try { after(await call('adminPay', { id: b.id, type: f.get('type'), amount: f.get('amount'), date: f.get('date'), method: f.get('method') })); } catch (e) { err(e.message); btn.disabled = false; }
    });
    if ($('#cakeForm')) $('#cakeForm').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = new FormData(ev.target);
      const btn = $('button[type=submit]', ev.target); btn.disabled = true;
      try {
        const r = await call('adminCakePrice', { id: b.id, price: f.get('price'), notify: f.get('notify') === 'on' });
        after(r);
        if (r.mailed) { const m = document.createElement('div'); m.className = 'okbox small'; m.textContent = 'Harga cake disimpan dan email terkirim ke klien.'; $('#dlgBody').prepend(m); }
      } catch (e) { err(e.message); btn.disabled = false; }
    });
    const invoice = async (send, btn) => {
      const msg = $('#invMsg'); btn.disabled = true; msg.textContent = send ? 'Mengirim invoice…' : 'Membuat PDF…';
      try {
        const r = await call('adminInvoice', { id: b.id, send });
        if (send) { msg.textContent = 'Invoice ' + r.number + ' terkirim ke ' + b.email + '.'; refreshRow(); }
        else {
          const bin = atob(r.pdf); const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
          const a = document.createElement('a'); a.href = url; a.download = r.fileName; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          msg.textContent = r.fileName + ' diunduh.';
        }
      } catch (e) { msg.textContent = ''; err(e.message); }
      btn.disabled = !b.email && send;
    };
    $('#invDl').addEventListener('click', (ev) => invoice(false, ev.currentTarget));
    $('#invSend').addEventListener('click', (ev) => { if (confirm('Kirim invoice terbaru ke ' + b.email + '?')) invoice(true, ev.currentTarget); });
    $('#itemsEdit').addEventListener('click', () => itemEditor(d, err, after));
    if ($('#remEmail')) $('#remEmail').addEventListener('click', async (ev) => {
      if (!confirm('Kirim email reminder pembayaran ke ' + b.email + '?')) return;
      const btn = ev.currentTarget; btn.disabled = true; $('#remMsg').textContent = 'Mengirim…';
      try { const r = await call('adminReminder', { id: b.id, channel: 'email' }); after(r); $('#remMsg').textContent = 'Reminder email terkirim ke ' + r.to + '.'; }
      catch (e) { $('#remMsg').textContent = ''; err(e.message); btn.disabled = false; }
    });
    if ($('#remWa')) $('#remWa').addEventListener('click', async (ev) => {
      const w = window.open('', '_blank'); // dibuka langsung supaya tidak diblokir browser
      const btn = ev.currentTarget; btn.disabled = true; $('#remMsg').textContent = 'Menyiapkan pesan…';
      try {
        const r = await call('adminReminder', { id: b.id, channel: 'wa' });
        if (w) w.location.href = r.url; else window.location.href = r.url;
        after(r); $('#remMsg').textContent = 'Pesan WhatsApp disiapkan. Periksa lalu tekan kirim di WhatsApp.';
      } catch (e) { if (w) w.close(); $('#remMsg').textContent = ''; err(e.message); btn.disabled = false; }
    });
    $('#editForm').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = new FormData(ev.target);
      const fields = { total: f.get('total'), deposit: f.get('deposit'), children: f.get('children'), adults: f.get('adults'), notes: $('#editNotes').value };
      if (f.get('category') && f.get('category') !== b.category) {
        if (!confirm('Ubah jenis event menjadi ' + EV[f.get('category')] + '? Total tagihan tidak dihitung ulang otomatis; sesuaikan Total & DP bila perlu.')) return;
        fields.category = f.get('category');
      }
      const btn = $('button[type=submit]', ev.target); btn.disabled = true; btn.textContent = 'Menyimpan…';
      try { after(await call('adminUpdate', { id: b.id, fields })); okMsg('Perubahan booking tersimpan.'); } catch (e) { err(e.message); btn.disabled = false; btn.textContent = 'Simpan'; }
    });
    $$('[data-status]').forEach((btn) => btn.addEventListener('click', async () => {
      const st = btn.dataset.status;
      if (st === 'CANCELLED' && !confirm('Batalkan booking ' + b.id + '? Slot akan terbuka lagi.')) return;
      try { after(await call('adminUpdate', { id: b.id, fields: { status: st } })); } catch (e) { err(e.message); }
    }));
    $$('[data-hold]').forEach((btn) => btn.addEventListener('click', async () => {
      const d2 = new Date(Date.now() + 8 * 3600e3 + 3 * 864e5).toISOString().slice(0, 19).replace('T', ' ');
      try { after(await call('adminUpdate', { id: b.id, fields: { hold: d2 } })); } catch (e) { err(e.message); }
    }));
    $$('[data-del]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Hapus pembayaran ini?')) return;
      try { after(await call('adminDeletePayment', { paymentId: btn.dataset.del })); } catch (e) { err(e.message); }
    }));
  }
  function dueOf(b) {
    const total = b.total == null ? 0 : b.total, dep = b.deposit == null ? 0 : b.deposit, paid = b.paid || 0;
    if (paid < dep) return { kind: 'DEPOSIT', amount: dep - paid };
    if (total > paid) return { kind: 'BALANCE', amount: total - paid };
    return { kind: 'NONE', amount: 0 };
  }

  // Editor rincian invoice: jumlah anak hadir, qty/harga, tambah/hapus item.
  async function itemEditor(d, err, after) {
    const b = d.booking;
    let draft = null;
    if (!d.items.length) {
      $('#itemsBox').innerHTML = '<div class="loading">Menyusun usulan rincian dari data booking…</div>';
      try { draft = await call('adminDraftItems', { id: b.id }); } catch (e) { draft = { items: [], hints: [] }; err(e.message); }
    }
    const minKids = (S.cat && S.cat.minChildren) || 0;
    const depPct = (S.cat && S.cat.depositPercent) || 50;
    let rows = draft ? draft.items.map((i) => ({ type: i.type, addOnId: i.addOnId, category: i.category, name: i.name, qty: i.qty, unitPrice: i.unitPrice, note: i.note, resto: !!i.resto }))
      : d.items.map((i) => ({ itemId: i.id, addOnId: i.addOnId, category: i.category, name: i.name, qty: i.qty, unitPrice: i.unitPrice, note: i.note, resto: i.billing === 'RESTAURANT' }));
    const isFree = (r) => r.addOnId === 'CUSTOM' || (!r.itemId && !r.addOnId && !r.type);
    const isPkg = (r) => r.category === 'package';
    const box = $('#itemsBox');
    $('#itemsEdit').classList.add('hidden');
    const addons = (S.cat && S.cat.addons) || [];
    const groups = {};
    addons.forEach((a) => { (groups[a.category] = groups[a.category] || []).push(a); });
    const opts = '<option value="">— pilih item —</option>' + Object.keys(groups).map((g) => '<optgroup label="' + esc(g) + '">' +
      groups[g].map((a) => '<option value="' + esc(a.id) + '">' + esc(a.name) + ' · ' + esc(rp(a.price)) + '</option>').join('') + '</optgroup>').join('') +
      '<option value="__custom">Item lain (isi nama & harga manual)</option>';
    const render = () => {
      const billed = rows.filter((r) => !r.resto).reduce((s, r) => s + r.qty * r.unitPrice, 0);
      const resto = rows.filter((r) => r.resto).reduce((s, r) => s + r.qty * r.unitPrice, 0);
      const dep = b.paid > 0 && b.deposit != null ? b.deposit : Math.round(billed * depPct / 100);
      box.innerHTML = '<datalist id="cakeFlavours">' + ['Chocolate', 'Red Velvet', 'Vegan Chocolate', 'Lemon', 'Apple Crumble', 'Strawberry Cheesecake', 'Raspberry Cheesecake'].map((f) => '<option value="' + f + '">').join('') + '</datalist><div class="itemsed">' +
        (draft ? '<div class="draftnote"><b>Usulan rincian dari formulir lama.</b> Paket & area memakai harga sekarang; add-on memakai harga yang tertulis di formulir bila ada. Periksa, ubah bila perlu, lalu simpan.' +
          (draft.hints && draft.hints.length ? '<div style="margin-top:6px"><b>Belum masuk otomatis, cek manual:</b><ul>' + draft.hints.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '') + '</div>' : '') +
        '<div class="formrow" style="margin:0 0 8px"><div class="field"><label>Jumlah anak hadir</label><input id="edKids" type="number" min="0" value="' + esc(b.children || 0) + '"></div>' +
        '<div class="small muted" style="align-self:end;max-width:420px">' + (rows.some(isPkg) && b.category === 'BIRTHDAY_PACKAGE' ? 'Qty paket ikut jumlah anak (minimum ' + minKids + ' anak tetap ditagih).' : 'Ubah qty & harga langsung di tabel.') + '</div></div>' +
        '<div class="tablewrap"><table class="tbl"><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Harga (Rp)</th><th class="n">Jumlah</th><th></th></tr></thead><tbody>' +
        rows.map((r, i) => '<tr style="cursor:default' + (r.resto ? ';color:var(--muted)' : '') + '"><td>' +
          (isFree(r) ? '<input class="ed-name" data-i="' + i + '" value="' + esc(r.name) + '" placeholder="Nama item">' : esc(r.name)) +
          '<input class="ed-note" data-i="' + i + '" value="' + esc(r.note || '') + '" maxlength="200" placeholder="' + esc(/cake/i.test(r.category || '') ? 'Rasa & tulisan, mis. 1 Lemon, 1 Chocolate · Happy Birthday Gabriel' : 'Keterangan (opsional)') + '"' + (/cake/i.test(r.category || '') ? ' list="cakeFlavours"' : '') + '>' +
          (r.resto ? ' <span class="badge b-resto">Resto</span>' : '') + '</td>' +
          '<td class="n"><input class="ed-qty" data-i="' + i + '" type="number" min="1" value="' + r.qty + '"' + (isPkg(r) ? ' title="Ikut jumlah anak"' : '') + '></td>' +
          '<td class="n"><input class="ed-price" data-i="' + i + '" type="number"' + (isFree(r) ? '' : ' min="0"') + ' step="1000" value="' + r.unitPrice + '"' + (isFree(r) ? ' title="Isi angka negatif untuk diskon"' : '') + '></td>' +
          '<td class="n">' + (r.resto ? '(' + esc(rp(r.qty * r.unitPrice)) + ')' : esc(rp(r.qty * r.unitPrice))) + '</td>' +
          '<td>' + (isPkg(r) ? '' : '<button type="button" class="btn danger sm ed-del" data-i="' + i + '" title="Hapus item">×</button>') + '</td></tr>').join('') +
        '</tbody></table></div>' +
        '<div class="formrow" style="margin-top:8px"><div class="field" style="flex:1 1 260px"><label>Tambah item</label><select id="edAdd">' + opts + '</select></div>' +
        '<button type="button" class="btn ghost sm" id="edAddBtn">＋ Tambah</button></div>' +
        '<div class="money" style="margin-top:10px"><div><span>Total baru</span><b>' + esc(rp(billed)) + '</b></div><div><span>DP' + (b.paid > 0 ? ' (sudah dibayar)' : ' baru') + '</span><b>' + esc(rp(dep || 0)) + '</b></div>' +
        '<div><span>Sudah dibayar</span><b>' + esc(rp(b.paid || 0)) + '</b></div><div><span>Sisa</span><b>' + esc(rp(billed - (b.paid || 0))) + '</b></div></div>' +
        (resto ? '<div class="small muted" style="margin-top:4px">Item Resto (' + esc(rp(resto)) + ') tidak masuk total.</div>' : '') +
        (b.total != null && billed !== b.total ? '<div class="small" style="margin-top:4px">Total berubah dari ' + esc(rp(b.total)) + ' menjadi <b>' + esc(rp(billed)) + '</b> (' + (billed > b.total ? '+' : '−') + esc(rp(Math.abs(billed - b.total))) + ').</div>' : '') +
        '<div class="actions"><label class="check small"><input type="checkbox" id="edNotify"' + (b.email ? ' checked' : ' disabled') + '> Kirim invoice terbaru ke klien' + (b.email ? '' : ' (tidak ada email)') + '</label>' +
        '<button type="button" class="btn sm" id="edSave">Simpan rincian</button><button type="button" class="btn ghost sm" id="edCancel">Batal</button></div></div>';
      const num = (v) => Math.max(0, Math.round(Number(v) || 0));
      $('#edKids').addEventListener('change', (ev) => {
        const k = num(ev.target.value);
        b.children = k;
        rows.forEach((r) => { if (isPkg(r)) r.qty = Math.max(1, r.unitPrice > 0 && b.category === 'BIRTHDAY_PACKAGE' ? Math.max(k, minKids) : k); });
        render();
      });
      $$('.ed-qty', box).forEach((el) => el.addEventListener('change', () => { rows[el.dataset.i].qty = Math.max(1, num(el.value)); render(); }));
      $$('.ed-price', box).forEach((el) => el.addEventListener('change', () => { const r = rows[el.dataset.i]; r.unitPrice = isFree(r) ? Math.round(Number(el.value) || 0) : num(el.value); render(); }));
      $$('.ed-name', box).forEach((el) => el.addEventListener('input', () => { rows[el.dataset.i].name = el.value; }));
      $$('.ed-note', box).forEach((el) => el.addEventListener('input', () => { rows[el.dataset.i].note = el.value; }));
      $$('.ed-del', box).forEach((el) => el.addEventListener('click', () => { rows.splice(Number(el.dataset.i), 1); render(); }));
      $('#edAddBtn').addEventListener('click', () => {
        const v = $('#edAdd').value; if (!v) return;
        if (v === '__custom') rows.push({ addOnId: '', category: 'Other', name: '', qty: 1, unitPrice: 0, resto: false });
        else {
          const a = addons.find((x) => x.id === v);
          const ex = rows.find((r) => r.addOnId === v && !r.itemId);
          if (ex) ex.qty++; else rows.push({ addOnId: a.id, category: a.category, name: a.name, qty: /per kid/i.test(a.unit) ? (b.children || 1) : 1, unitPrice: a.price, resto: !!a.restaurant });
        }
        render();
        if (v === '__custom') { const n = $$('.ed-name', box); n[n.length - 1].focus(); }
        else { const n = $$('.ed-note', box); if (/cake/i.test(rows[rows.length - 1].category || '')) n[n.length - 1].focus(); }
      });
      $('#edCancel').addEventListener('click', () => renderDetail(S.current));
      if (draft) $('#edNotify').checked = false; // booking lama: kirim invoice hanya bila dicentang
      $('#edSave').addEventListener('click', async (ev) => {
        if (!rows.length) return err('Rincian tidak boleh kosong.');
        if (rows.some((r) => isFree(r) && !String(r.name).trim())) return err('Isi nama untuk item manual.');
        const btn = ev.currentTarget; btn.disabled = true;
        try {
          const r = await call('adminItems', { id: b.id, children: b.children, notify: $('#edNotify').checked,
            items: rows.map((x) => x.itemId ? { itemId: x.itemId, qty: x.qty, unitPrice: x.unitPrice, name: x.name, note: x.note || '' } : { type: x.type, addOnId: x.addOnId === 'CUSTOM' ? '' : x.addOnId, name: x.name, qty: x.qty, unitPrice: x.unitPrice, note: x.note || '' }) });
          after(r);
          const m = document.createElement('div'); m.className = 'okbox small';
          m.textContent = 'Rincian disimpan' + (r.changes && r.changes.length ? ' (' + r.changes.length + ' perubahan)' : '') + (r.sent ? ' dan invoice terbaru terkirim ke ' + b.email + '.' : '.');
          $('#dlgBody').prepend(m);
        } catch (e) { err(e.message); btn.disabled = false; }
      });
    };
    render();
  }

  function refreshRow() {
    const b = S.current && S.current.booking; if (!b) return;
    const i = S.list.findIndex((x) => x.id === b.id);
    if (i >= 0) Object.assign(S.list[i], { category: b.category, total: b.total, paid: b.paid, status: b.status, payment: b.payment, children: b.children, hold: b.hold, cakeStatus: b.cakeStatus });
    renderStats(); renderList();
  }

  // ---------------- small dialogs ----------------
  const sm = $('#dlgSmall');
  $('#smClose').addEventListener('click', () => sm.close());
  $('#btnBlock').addEventListener('click', () => {
    $('#smTitle').textContent = 'Blokir slot';
    const locs = (S.cat ? S.cat.locations : []).map((l) => '<option value="' + esc(l.id) + '">' + esc(l.name) + '</option>').join('');
    $('#smBody').innerHTML = '<form id="blockForm"><div class="field"><label>Tanggal</label><input type="date" name="date" required value="' + esc(S.today) + '"></div>' +
      '<div class="field"><label>Area</label><select name="locationId"><option value="">Semua area</option>' + locs + '</select></div>' +
      '<div class="field"><label>Sesi</label><select name="session"><option value="">Pagi & siang</option><option value="Morning">Pagi</option><option value="Afternoon">Siang/sore</option></select></div>' +
      '<div class="field"><label>Alasan</label><input name="reason" maxlength="200" placeholder="Acara privat, perawatan, dll."></div>' +
      '<div id="bErr" class="err hidden"></div><button class="btn" type="submit" style="margin-top:10px">Blokir</button>' +
      '<p class="small muted">Untuk membuka blokir, hapus barisnya di tab BlockedSlots.</p></form>';
    sm.showModal();
    $('#blockForm').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = new FormData(ev.target);
      try { await call('adminBlock', { date: f.get('date'), locationId: f.get('locationId'), session: f.get('session'), reason: f.get('reason') }); sm.close(); } catch (e) { $('#bErr').textContent = e.message; $('#bErr').classList.remove('hidden'); }
    });
  });
  $('#btnPw').addEventListener('click', () => {
    $('#smTitle').textContent = 'Ganti password admin';
    $('#smBody').innerHTML = '<form id="pwForm"><div class="field"><label>Password baru (min. 8 karakter)</label><input type="password" name="pw" minlength="8" required autocomplete="new-password"></div>' +
      '<div id="pErr" class="err hidden"></div><button class="btn" type="submit" style="margin-top:10px">Simpan</button></form>';
    sm.showModal();
    $('#pwForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try { await call('adminPassword', { newPassword: new FormData(ev.target).get('pw') }); $('#smBody').innerHTML = '<div class="okbox">Password sudah diganti.</div>'; } catch (e) { $('#pErr').textContent = e.message; $('#pErr').classList.remove('hidden'); }
    });
  });

  if (token) { showApp(true); load(); }
})();
