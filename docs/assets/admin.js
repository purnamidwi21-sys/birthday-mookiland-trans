(function () {
  const { api, rp, esc, dateLabel, waLink } = window.MK;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ST = { PENDING: 'Menunggu DP', CONFIRMED: 'Terkonfirmasi', COMPLETED: 'Selesai', CANCELLED: 'Batal' };
  const PS = { UNPAID: 'Belum bayar', DEPOSIT_PAID: 'DP masuk', PAID: 'Lunas', NO_PAYMENT_RECORD: 'Tidak tercatat' };
  const SES = { Morning: 'Pagi', Afternoon: 'Siang/sore' };
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
    $('#stats').innerHTML = stat('Acara akan datang', up.length) + stat('7 hari ke depan', next7.length) + stat('Menunggu DP', wait.length) +
      stat('Birthday bulan ini', thisMonth.length) + stat('Dibayar (bulan ini)', rp(thisMonth.reduce((s, b) => s + (b.paid || 0), 0)));
  }
  function filtered() {
    const q = $('#q').value.trim().toLowerCase();
    const y = $('#fYear').value;
    let rows = S.list;
    if (S.view === 'upcoming') rows = rows.filter((b) => b.date >= S.today && b.status !== 'CANCELLED').slice().reverse();
    if (S.view === 'pending') rows = rows.filter((b) => b.status === 'PENDING' && b.date >= S.today).slice().reverse();
    if (S.view === 'past') rows = rows.filter((b) => b.date < S.today);
    if (y) rows = rows.filter((b) => b.date.slice(0, 4) === y);
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
        '<td>' + esc(loc ? loc.name : (b.venue || '—')) + '</td><td>' + esc(b.id) + (b.source === 'LEGACY_GOOGLE_FORM' ? ' <span class="sub">lama</span>' : '') + '</td>' +
        '<td>' + esc(b.customer || '—') + '<div class="sub">' + esc(b.child) + '</div></td><td class="n">' + esc(b.children || '') + '</td>' +
        '<td class="n">' + (b.total == null ? '<span class="sub">—</span>' : esc(rp(b.total))) + '</td><td class="n">' + esc(rp(b.paid || 0)) + '</td>' +
        '<td class="st">' + st + '<br><span class="badge b-' + esc(b.payment) + '">' + esc(PS[b.payment] || b.payment) + '</span></td></tr>';
    }).join('');
    $('#count').textContent = rows.length > 300 ? 'Menampilkan 300 dari ' + rows.length + ' booking. Pakai pencarian atau filter tahun.' : rows.length + ' booking';
  }
  $('#tbody').addEventListener('click', (ev) => { const tr = ev.target.closest('tr[data-id]'); if (tr) openBooking(tr.dataset.id); });
  $$('#viewSeg button').forEach((b) => b.addEventListener('click', () => { $$('#viewSeg button').forEach((x) => x.classList.toggle('on', x === b)); S.view = b.dataset.v; renderList(); }));
  $('#q').addEventListener('input', renderList);
  $('#fYear').addEventListener('change', renderList);
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
    let h = '<div class="info">' + kv('Tanggal', dateLabel(b.date, 'id')) + kv('Sesi / jam', (SES[b.session] || b.session) + ' ' + b.time) + kv('Area', loc ? loc.name : b.venue) +
      kv('Status', (ST[b.status] || b.status) + ' · ' + (PS[b.payment] || b.payment)) + kv('Klien', b.customer) + kv('WhatsApp', b.whatsapp) + kv('Email', b.email) +
      kv('Anak berulang tahun', b.child + (b.age ? ' (' + b.age + ')' : '')) + kv('Anak / dewasa', b.children + ' / ' + (b.adults || '—')) + kv('Tema', b.theme) +
      kv('Dibuat', b.createdAt + ' · ' + b.source) + kv('Masa tahan slot', b.status === 'PENDING' ? b.hold : '') + '</div>';
    if (b.notes) h += '<div class="legacy" style="background:#fff;border-color:var(--line)"><b>Catatan klien:</b> ' + esc(b.notes) + '</div>';
    h += '<div class="money"><div><span>Total</span><b>' + (b.total == null ? '—' : esc(rp(b.total))) + '</b></div><div><span>DP</span><b>' + (b.deposit == null ? '—' : esc(rp(b.deposit))) + '</b></div>' +
      '<div><span>Sudah dibayar</span><b>' + esc(rp(b.paid || 0)) + '</b></div><div><span>Sisa</span><b>' + (balance == null ? '—' : esc(rp(balance))) + '</b></div></div>';
    if (d.items.length) {
      h += '<div class="sec">Rincian</div><div class="tablewrap"><table class="tbl"><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Harga</th><th class="n">Jumlah</th></tr></thead><tbody>' +
        d.items.map((i) => '<tr style="cursor:default"><td>' + esc(i.name) + (i.note ? '<div class="sub">' + esc(i.note) + '</div>' : '') + '</td><td class="n">' + i.qty + '</td><td class="n">' + esc(rp(i.unitPrice)) + '</td><td class="n">' + esc(rp(i.amount)) + '</td></tr>').join('') + '</tbody></table></div>';
    }
    const extra = [['Menu buffet', b.menu], ['Kue', [b.cake, b.cakeDetails, b.cakeWriting && '“' + b.cakeWriting + '”'].filter(Boolean).join(' · ')], ['Dekorasi', b.decoration], ['Hiburan & lainnya', b.entertainment], ['Makanan & minuman tambahan', b.extraFood]].filter((x) => x[1]);
    if (extra.length) h += '<div class="info" style="margin-top:12px">' + extra.map((x) => kv(x[0], x[1])).join('') + '</div>';
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

    h += '<div class="sec">Ubah booking</div><form id="editForm" class="formrow">' +
      '<div class="field"><label>Total tagihan (Rp)</label><input name="total" type="number" step="1000" value="' + (b.total == null ? '' : esc(b.total)) + '"></div>' +
      '<div class="field"><label>DP (Rp)</label><input name="deposit" type="number" step="1000" value="' + (b.deposit == null ? '' : esc(b.deposit)) + '"></div>' +
      '<div class="field"><label>Jumlah anak</label><input name="children" type="number" min="0" value="' + esc(b.children || '') + '"></div>' +
      '<div class="field"><label>Jumlah dewasa</label><input name="adults" type="number" min="0" value="' + esc(b.adults || '') + '"></div>' +
      '<button class="btn ghost sm" type="submit">Simpan</button></form>' +
      '<div class="field" style="margin-top:8px"><label>Catatan / permintaan khusus</label><textarea id="editNotes" rows="2">' + esc(b.notes) + '</textarea></div>';

    h += '<div class="actions">' + (wa ? '<a class="btn sun sm" target="_blank" rel="noopener" href="' + esc(wa) + '">WhatsApp klien</a>' : '') +
      (b.status === 'PENDING' ? '<button type="button" class="btn ghost sm" data-hold="1">Perpanjang masa tahan 3 hari</button>' : '') +
      (b.status !== 'COMPLETED' ? '<button type="button" class="btn ghost sm" data-status="COMPLETED">Tandai selesai</button>' : '') +
      (b.status !== 'CANCELLED' ? '<button type="button" class="btn danger sm" data-status="CANCELLED">Batalkan booking</button>' : '<button type="button" class="btn ghost sm" data-status="PENDING">Aktifkan lagi</button>') + '</div>';
    if (d.log.length) h += '<div class="sec">Riwayat</div>' + d.log.slice().reverse().map((l) => '<div class="logline">' + esc(l.at) + ' · ' + esc(l.actor) + ' · ' + esc(l.action) + (l.details ? ' · ' + esc(l.details) : '') + '</div>').join('');
    h += '<div id="dErr" class="err hidden"></div>';
    $('#dlgBody').innerHTML = h;

    const err = (m) => { const e = $('#dErr'); e.textContent = m; e.classList.remove('hidden'); };
    const after = (r) => { renderDetail(r.detail || r); refreshRow(); };
    $('#payForm').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = new FormData(ev.target);
      const btn = $('button[type=submit]', ev.target); btn.disabled = true;
      try { after(await call('adminPay', { id: b.id, type: f.get('type'), amount: f.get('amount'), date: f.get('date'), method: f.get('method') })); } catch (e) { err(e.message); btn.disabled = false; }
    });
    $('#editForm').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = new FormData(ev.target);
      try { after(await call('adminUpdate', { id: b.id, fields: { total: f.get('total'), deposit: f.get('deposit'), children: f.get('children'), adults: f.get('adults'), notes: $('#editNotes').value } })); } catch (e) { err(e.message); }
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
  function refreshRow() {
    const b = S.current && S.current.booking; if (!b) return;
    const i = S.list.findIndex((x) => x.id === b.id);
    if (i >= 0) Object.assign(S.list[i], { total: b.total, paid: b.paid, status: b.status, payment: b.payment, children: b.children, hold: b.hold });
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
