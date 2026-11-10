/**
 * Mookiland Birthday – aplikasi booking transisi
 * Backend Google Apps Script, ditempel pada spreadsheet "Mookiland Birthday Package Trans"
 * (Extensions > Apps Script). Satu file saja.
 *
 * Pemasangan singkat:
 *   1. Tempel seluruh file ini ke Code.gs, simpan.
 *   2. Jalankan fungsi `setup` sekali (izinkan akses).
 *   3. Deploy > New deployment > Web app: Execute as "Me", Who has access "Anyone".
 *   4. Salin URL Web app ke docs/config.js di GitHub.
 */

var TAB = {
  SETTINGS: 'Settings', PACKAGES: 'Packages', LOCATIONS: 'Locations', ADDONS: 'AddOns', MENU: 'BuffetMenu',
  BOOKINGS: 'Bookings', ITEMS: 'BookingItems', PARTICIPANTS: 'Participants', PAYMENTS: 'Payments',
  BLOCKED: 'BlockedSlots', CUSTOMERS: 'Customers', LOG: 'ActivityLog', HOLIDAYS: 'Holidays'
};
var TZ = 'Asia/Makassar';

var DEFAULT_SETTINGS = [
  ['MorningStartTimes', '09:00, 10:00', 'Pilihan jam mulai sesi pagi'],
  ['AfternoonStartTimes', '15:00, 16:00, 17:00', 'Pilihan jam mulai sesi siang/sore'],
  ['MinDaysAhead', '7', 'Booking online paling cepat H-berapa'],
  ['BankAccount', 'Account Holder: PT Entertainment Leisure Partner\nBank: BNI 46\nAccount Number: 1618996150\nSwift: BNINIDJADPS', 'Rekening untuk DP (tampil di email & layar sukses)'],
  ['SendEmails', 'TRUE', 'TRUE = kirim email konfirmasi ke klien & admin'],
  ['BookingFormOpen', 'TRUE', 'FALSE = form booking online ditutup sementara']
];

var EXTRA_TABS = {
  BookingItems: ['ItemId', 'BookingId', 'AddOnId', 'Category', 'Name', 'Qty', 'Unit', 'UnitPrice', 'Amount', 'Note'],
  Holidays: ['Date', 'Name'],
  CakeOptions: ['Group', 'Name', 'Active']
};

// Kolom tambahan di tab Bookings (ditambahkan otomatis oleh setup)
var BOOKING_EXTRA_COLS = ['CakeStatus', 'CakeReferenceUrl'];

// Pilihan cake custom (sumber: Google Form cake custom). Bisa diubah di tab CakeOptions.
var CAKE_GROUPS = { LAYERED: 'Flavor - Layered', PLAIN: 'Flavor - Non Layered', FILLING: 'Filling', FINISHING: 'Finishing' };
var CAKE_OPTIONS = [
  [CAKE_GROUPS.LAYERED, ['Chocolate sponge', 'Chocolate mud', 'Earl Grey Tea', 'Red Velvet', 'Vanilla', 'Vanilla Chocolate Chip', 'White Chocolate', 'Caramel', 'Almond',
    'Coffee', 'Cheese Sponge', 'Coconut', 'Raspberry', 'Strawberry', 'Passion Fruit', 'Green Tea', 'Carrot Cake with Cheese Cream', 'Banana']],
  [CAKE_GROUPS.PLAIN, ['Butter Cake', 'English Fruit Cake']],
  [CAKE_GROUPS.FILLING, ['Dark Chocolate Ganache', 'White Chocolate Ganache', 'Milk Chocolate Ganache', 'Coffee Ganache', 'Oreo Cream', 'Raspberry Ganache',
    'Strawberry Ganache', 'Cherry Ganache', 'Blueberry Ganache', 'Peanut Butter', 'Lemon Ganache', 'Passion Fruit Ganache', 'Green Tea Ganache',
    'Hazelnut Ganache', 'Caramel Ganache', 'Mint Ganache', 'Butter Cream (for naked cakes)']],
  [CAKE_GROUPS.FINISHING, ['Fondant (any color)', 'Butter Cream', 'Royal Icing', 'Cream Cheese', 'Coconut Floss', 'Chocolate Shards (white or dark)',
    'Chocolate Ganache (white or dark)', 'Chocolate Shaved']]
];
var CAKE_FOLDER_NAME = 'Mookiland Birthday – Cake References';

var HOLIDAYS_2026 = [
  ['2026-01-01', "New Year's Day"], ['2026-01-16', "Isra Mi'raj"], ['2026-02-17', 'Chinese New Year'],
  ['2026-03-19', 'Nyepi'], ['2026-03-21', 'Eid al-Fitr'], ['2026-03-22', 'Eid al-Fitr'], ['2026-04-03', 'Good Friday'],
  ['2026-04-05', 'Easter Sunday'], ['2026-05-01', 'Labour Day'], ['2026-05-14', 'Ascension of Jesus'],
  ['2026-05-27', 'Eid al-Adha'], ['2026-05-31', 'Vesak'], ['2026-06-01', 'Pancasila Day'], ['2026-06-16', 'Islamic New Year'],
  ['2026-08-17', 'Independence Day'], ['2026-08-25', "Prophet Muhammad's Birthday"], ['2026-12-25', 'Christmas Day']
];

/* ------------------------------------------------------------------ setup */

function setup() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(EXTRA_TABS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, EXTRA_TABS[name].length).setValues([EXTRA_TABS[name]]);
      sh.setFrozenRows(1);
    }
  });
  var hol = ss.getSheetByName(TAB.HOLIDAYS);
  if (hol.getLastRow() < 2) {
    hol.getRange(2, 1, HOLIDAYS_2026.length, 2).setValues(HOLIDAYS_2026.map(function (h) { return ["'" + h[0], h[1]]; }));
  }
  var st = ss.getSheetByName(TAB.SETTINGS);
  var keys = st.getRange(1, 1, Math.max(1, st.getLastRow()), 1).getValues().map(function (r) { return String(r[0]); });
  var today = Utilities.formatDate(new Date(), TZ, 'M/d/yyyy');
  DEFAULT_SETTINGS.forEach(function (s) {
    if (keys.indexOf(s[0]) < 0) st.appendRow([s[0], s[1], today]);
  });
  var co = ss.getSheetByName('CakeOptions');
  if (co.getLastRow() < 2) {
    var rows = [];
    CAKE_OPTIONS.forEach(function (g) { g[1].forEach(function (n) { rows.push([g[0], n, true]); }); });
    co.getRange(2, 1, rows.length, 3).setValues(rows);
  }
  var bk = ss.getSheetByName(TAB.BOOKINGS);
  var bh = head_(bk);
  BOOKING_EXTRA_COLS.forEach(function (c) {
    if (bh.indexOf(c) < 0) { bk.getRange(1, bh.length + 1).setValue(c); bh.push(c); }
  });
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_PASSWORD')) props.setProperty('ADMIN_PASSWORD', 'mooki2026');
  cakeFolder_(); // membuat folder Drive untuk foto referensi cake (dan meminta izin Drive)
  log_('setup', 'SYSTEM', 'Setup', '', 'Tabs & settings checked');
  return 'Setup selesai. Password admin awal: ' + props.getProperty('ADMIN_PASSWORD') + ' (ganti lewat halaman admin).';
}

/* ------------------------------------------------------------------ web */

function doGet(e) {
  return json_({ ok: true, app: 'mookiland-birthday-trans', time: new Date().toISOString() });
}

function doPost(e) {
  var req = {};
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var fn = ROUTES[req.action];
    if (!fn) throw new Error('Unknown action: ' + req.action);
    return json_({ ok: true, data: fn(req.payload || {}, req.token) });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

var ROUTES = {
  catalog: function () { return catalog_(); },
  month: function (p) { return monthAvailability_(p.month); },
  availability: function (p) { return dayAvailability_(p.date); },
  quote: function (p, token) { return quote_(p, catalog_(), isAdmin_(token)); },
  createBooking: function (p, token) { return createBooking_(p, isAdmin_(token)); },
  login: function (p) { return login_(p.password); },
  adminList: function (p, token) { requireAdmin_(token); return adminList_(p); },
  adminGet: function (p, token) { requireAdmin_(token); return adminGet_(p.id); },
  adminPay: function (p, token) { requireAdmin_(token); return adminPay_(p); },
  adminDeletePayment: function (p, token) { requireAdmin_(token); return adminDeletePayment_(p); },
  adminUpdate: function (p, token) { requireAdmin_(token); return adminUpdate_(p); },
  adminBlock: function (p, token) { requireAdmin_(token); return adminBlock_(p); },
  adminPassword: function (p, token) { requireAdmin_(token); return adminPassword_(p); },
  adminCakePrice: function (p, token) { requireAdmin_(token); return adminCakePrice_(p); }
};

/* ------------------------------------------------------------------ sheet helpers */

function sheet_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Tab "' + name + '" tidak ada. Jalankan setup.');
  return sh;
}
function head_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
}
function table_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  var head = head_(sh);
  if (last < 2) return { sh: sh, head: head, rows: [] };
  var vals = sh.getRange(2, 1, last - 1, head.length).getValues();
  var rows = vals.map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, j) { if (h) o[h] = r[j]; });
    return o;
  });
  return { sh: sh, head: head, rows: rows };
}
function append_(name, obj) {
  var sh = sheet_(name);
  var head = head_(sh);
  sh.appendRow(head.map(function (h) { return obj[h] === undefined || obj[h] === null ? '' : obj[h]; }));
  return sh.getLastRow();
}
function setFields_(name, row, obj) {
  var sh = sheet_(name);
  var head = head_(sh);
  Object.keys(obj).forEach(function (k) {
    var c = head.indexOf(k);
    if (c >= 0) sh.getRange(row, c + 1).setValue(obj[k] === null || obj[k] === undefined ? '' : obj[k]);
  });
}
function txt_(s) { return s === '' || s === null || s === undefined ? '' : "'" + String(s); }
function bool_(v) { return v === true || String(v).toUpperCase() === 'TRUE' || String(v).toLowerCase() === 'ya'; }
function num_(v) {
  if (typeof v === 'number') return v;
  var n = Number(String(v || '').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function iso_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  var s = String(v).replace(/^'/, '').trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
  return s;
}
function stamp_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss');
  return String(v).replace(/^'/, '');
}
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function addDays_(isoDate, n) {
  var d = new Date(isoDate + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekday_(isoDate) { return new Date(isoDate + 'T00:00:00Z').getUTCDay(); }
function log_(actor, action, entityType, entityId, details) {
  try { append_(TAB.LOG, { Timestamp: txt_(now_()), Actor: actor, Action: action, EntityType: entityType, EntityId: entityId, Details: details }); } catch (e) { /* abaikan */ }
}

/* ------------------------------------------------------------------ catalog */

function settings_() {
  var o = {};
  table_(TAB.SETTINGS).rows.forEach(function (r) { if (r.Key) o[String(r.Key).trim()] = r.Value; });
  return o;
}
function times_(s) { return String(s || '').split(',').map(function (t) { return t.trim(); }).filter(String); }

function catalog_() {
  var s = settings_();
  var pkg = table_(TAB.PACKAGES).rows.filter(function (r) { return bool_(r.Active); })[0] || {};
  var locations = table_(TAB.LOCATIONS).rows.filter(function (r) { return bool_(r.Active); }).map(function (r) {
    return { id: String(r.LocationId), name: String(r.Name), weekdayFee: num_(r.WeekdayFee), weekendFee: num_(r.WeekendFee), capacity: r.Capacity === '' ? null : num_(r.Capacity) };
  });
  var addons = table_(TAB.ADDONS).rows.filter(function (r) { return r.AddOnId && bool_(r.Active); }).map(function (r) {
    return { id: String(r.AddOnId), category: String(r.Category), name: String(r.Name), description: String(r.Description || ''), unit: String(r.Unit || ''), price: num_(r.Price) };
  });
  var menu = [];
  try {
    menu = table_(TAB.MENU).rows.filter(function (r) { return r.MenuId && bool_(r.Active); }).map(function (r) {
      return { id: String(r.MenuId), group: String(r.Group), name: String(r.Name), note: String(r.Note || '') };
    });
  } catch (e) { menu = []; }
  var holidays = [];
  try { holidays = table_(TAB.HOLIDAYS).rows.map(function (r) { return iso_(r.Date); }).filter(String); } catch (e) { holidays = []; }
  var customCake = addons.filter(function (a) { return /cake/i.test(a.category) && /CUSTOM/i.test(a.id); })[0];
  return {
    business: String(s.BusinessName || 'Mookiland Birthday Party'),
    currency: String(s.Currency || 'IDR'),
    depositPercent: num_(s.DepositPercent || 50),
    minChildren: num_(pkg.MinimumChildren || s.MinimumChildren || 10),
    weekdayPrice: num_(pkg.WeekdayPrice || s.WeekdayPackagePrice),
    weekendPrice: num_(pkg.WeekendPrice || s.WeekendPackagePrice),
    packageId: String(pkg.PackageId || 'BIRTHDAY-STD'),
    packageName: String(pkg.Name || 'Mookiland Birthday Package'),
    maxBuffet: num_(s.MaxBuffetItems || 4),
    adultsPerChild: num_(s.AdultsIncludedPerChild || 2),
    areaHours: num_(s.AreaHours || 3),
    inclusions: String(s.PackageInclusions || ''),
    whatsapp: String(s.ContactWhatsApp || ''),
    holdHours: num_(s.SlotHoldHours || 72),
    minDaysAhead: num_(s.MinDaysAhead || 7),
    formOpen: s.BookingFormOpen === undefined ? true : bool_(s.BookingFormOpen),
    bank: String(s.BankAccount || ''),
    sessions: [
      { id: 'Morning', label: String(s.SessionMorningLabel || 'Morning'), times: times_(s.MorningStartTimes || '09:00, 10:00') },
      { id: 'Afternoon', label: String(s.SessionAfternoonLabel || 'Afternoon'), times: times_(s.AfternoonStartTimes || '15:00, 16:00, 17:00') }
    ],
    locations: locations, addons: addons, menu: menu, holidays: holidays,
    customCakeId: customCake ? customCake.id : '', cakeOptions: cakeOptions_(),
    today: today_()
  };
}

function cakeOptions_() {
  var out = { layered: [], plain: [], filling: [], finishing: [] };
  var key = {}; key[CAKE_GROUPS.LAYERED] = 'layered'; key[CAKE_GROUPS.PLAIN] = 'plain'; key[CAKE_GROUPS.FILLING] = 'filling'; key[CAKE_GROUPS.FINISHING] = 'finishing';
  try {
    table_('CakeOptions').rows.forEach(function (r) {
      var k = key[String(r.Group).trim()];
      if (k && r.Name && (r.Active === '' || bool_(r.Active))) out[k].push(String(r.Name).trim());
    });
  } catch (e) {
    CAKE_OPTIONS.forEach(function (g) { out[key[g[0]]] = g[1].slice(); });
  }
  return out;
}

/* ------------------------------------------------------------------ custom cake */

function cakeFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CAKE_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* folder dihapus: buat lagi */ } }
  var f = DriveApp.createFolder(CAKE_FOLDER_NAME);
  props.setProperty('CAKE_FOLDER_ID', f.getId());
  return f;
}

// Validasi isian cake custom. Mengembalikan objek bersih + teks ringkas untuk kolom CakeDetails.
function customCake_(c, cat) {
  c = c || {};
  var o = cat.cakeOptions;
  var type = c.type === 'plain' ? 'plain' : 'layered';
  var pick = function (v, list, label, required) {
    v = clean_(v, 80);
    if (!v) { if (required) throw new Error('Custom cake: please choose the ' + label + '.'); return ''; }
    if (list.indexOf(v) < 0) throw new Error('Custom cake: unknown ' + label + ' "' + v + '".');
    return v;
  };
  var flavor = pick(c.flavor, type === 'plain' ? o.plain : o.layered, 'cake flavour', true);
  var filling = type === 'layered' ? pick(c.filling, o.filling, 'filling', false) : '';
  var finishing = pick(c.finishing, o.finishing, 'finishing', false);
  var notes = clean_(c.notes, 600);
  var parts = ['Custom cake (' + (type === 'plain' ? 'non layered' : 'layered') + ')', 'Flavour: ' + flavor];
  if (filling) parts.push('Filling: ' + filling);
  parts.push('Finishing: ' + (finishing || 'follow design / ask cake maker'));
  if (notes) parts.push('Design notes: ' + notes);
  return { type: type, flavor: flavor, filling: filling, finishing: finishing, notes: notes, text: parts.join(' · ') };
}

function saveCakePhoto_(bookingId, photo) {
  if (!photo || !photo.data) return '';
  var mime = String(photo.mime || '');
  if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/.test(mime)) throw new Error('Cake reference must be an image.');
  var bytes = Utilities.base64Decode(String(photo.data));
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Cake reference photo is too large (max 8 MB).');
  var ext = mime.split('/')[1].replace('jpeg', 'jpg');
  var blob = Utilities.newBlob(bytes, mime, bookingId + ' - cake reference.' + ext);
  var file = cakeFolder_().createFile(blob);
  file.setDescription('Cake reference for booking ' + bookingId + ' (' + clean_(photo.name, 120) + ')');
  return file.getUrl();
}

/* ------------------------------------------------------------------ availability */

function sessionOf_(b) {
  if (b.Session) return String(b.Session);
  var t = String(b.EventTime || '');
  var h = parseInt(t, 10);
  return !isNaN(h) && h < 12 ? 'Morning' : 'Afternoon';
}
function holdsSlot_(b, nowStamp) {
  var st = String(b.BookingStatus || '').toUpperCase();
  if (st === 'CANCELLED') return false;
  if (st === 'PENDING') {
    var hold = stamp_(b.HoldExpiresAt);
    if (hold && hold < nowStamp && num_(b.TotalPaid) <= 0) return false; // masa tahan habis, belum bayar
  }
  return true;
}
function takenMap_(fromIso, toIso) {
  var nowStamp = now_();
  var map = {};
  table_(TAB.BOOKINGS).rows.forEach(function (b) {
    var d = iso_(b.EventDate);
    if (!d || d < fromIso || d > toIso || !b.LocationId) return;
    if (!holdsSlot_(b, nowStamp)) return;
    map[d + '|' + b.LocationId + '|' + sessionOf_(b)] = String(b.BookingId);
  });
  table_(TAB.BLOCKED).rows.forEach(function (r) {
    var d = iso_(r.Date);
    if (!d || d < fromIso || d > toIso) return;
    var locs = r.LocationId ? [String(r.LocationId)] : ['*'];
    var sess = r.Session ? [String(r.Session)] : ['Morning', 'Afternoon'];
    locs.forEach(function (l) { sess.forEach(function (s) { map[d + '|' + l + '|' + s] = 'BLOCKED'; }); });
  });
  return map;
}
function isTaken_(map, d, loc, ses) {
  return !!(map[d + '|' + loc + '|' + ses] || map[d + '|*|' + ses]);
}
function dayAvailability_(date) {
  date = iso_(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Tanggal tidak valid');
  var cat = catalog_();
  var map = takenMap_(date, date);
  var out = [];
  cat.locations.forEach(function (l) {
    cat.sessions.forEach(function (s) {
      out.push({ locationId: l.id, session: s.id, available: !isTaken_(map, date, l.id, s.id) });
    });
  });
  return { date: date, weekend: isWeekend_(date, cat), slots: out };
}
function monthAvailability_(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month))) throw new Error('Bulan tidak valid');
  var cat = catalog_();
  var first = month + '-01';
  var y = +month.slice(0, 4), m = +month.slice(5, 7);
  var last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  var map = takenMap_(first, last);
  var days = [];
  for (var d = first; d <= last; d = addDays_(d, 1)) {
    var free = 0, total = 0;
    cat.locations.forEach(function (l) { cat.sessions.forEach(function (s) { total++; if (!isTaken_(map, d, l.id, s.id)) free++; }); });
    days.push({ date: d, free: free, total: total, weekend: isWeekend_(d, cat) });
  }
  return { month: month, days: days };
}

/* ------------------------------------------------------------------ pricing */

function isWeekend_(date, cat) {
  var wd = weekday_(date);
  return wd === 0 || wd === 6 || cat.holidays.indexOf(date) >= 0;
}

function quote_(p, cat, admin) {
  var date = iso_(p.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Pilih tanggal acara.');
  var weekend = isWeekend_(date, cat);
  var children = Math.max(0, Math.floor(num_(p.children)));
  if (children < 1) throw new Error('Isi jumlah anak.');
  var billedKids = Math.max(children, cat.minChildren);
  var unit = weekend ? cat.weekendPrice : cat.weekdayPrice;
  var lines = [];
  lines.push({ type: 'package', id: cat.packageId, name: cat.packageName + (weekend ? ' (weekend / holiday)' : ' (weekday)'),
    qty: billedKids, unit: 'per child', unitPrice: unit, amount: unit * billedKids,
    note: children < cat.minChildren ? 'Minimum charge ' + cat.minChildren + ' children' : '' });
  var loc = null;
  if (p.locationId) {
    loc = cat.locations.filter(function (l) { return l.id === p.locationId; })[0];
    if (!loc) throw new Error('Area tidak tersedia.');
    var fee = weekend ? loc.weekendFee : loc.weekdayFee;
    if (fee > 0) lines.push({ type: 'venue', id: loc.id, name: loc.name + ' upgrade', qty: 1, unit: 'per event', unitPrice: fee, amount: fee, note: '' });
  }
  var byId = {};
  cat.addons.forEach(function (a) { byId[a.id] = a; });
  var notes = [];
  (p.items || []).forEach(function (it) {
    var a = byId[it.id];
    if (!a) throw new Error('Add-on tidak tersedia: ' + it.id);
    var qty = Math.floor(num_(it.qty));
    if (qty < 1) return;
    if (qty > 500) throw new Error('Jumlah terlalu besar: ' + a.name);
    var line = { type: 'addon', id: a.id, category: a.category, name: a.name, qty: qty, unit: a.unit, unitPrice: a.price, amount: a.price * qty, note: String(it.note || '').slice(0, 200) };
    if (a.price === 0) line.note = (line.note ? line.note + ' · ' : '') + 'price per menu, billed at the restaurant';
    if (a.id === cat.customCakeId) {
      line.startingPrice = true;
      line.note = 'Starting price · final price confirmed by our cake maker';
      notes.push('Custom cake: starting price. The final price is confirmed after our cake maker reviews your design.');
    } else if (/starting/i.test(a.description)) { line.startingPrice = true; notes.push(a.name + ': starting price, final price confirmed by our team'); }
    lines.push(line);
  });
  var adults = Math.max(0, Math.floor(num_(p.adults)));
  if (adults > children * cat.adultsPerChild) notes.push((adults - children * cat.adultsPerChild) + ' extra adult(s) pay the regular entrance at the park');
  var packageAmount = lines[0].amount;
  var venueFee = lines.filter(function (l) { return l.type === 'venue'; }).reduce(function (s, l) { return s + l.amount; }, 0);
  var addOnsTotal = lines.filter(function (l) { return l.type === 'addon'; }).reduce(function (s, l) { return s + l.amount; }, 0);
  var total = packageAmount + venueFee + addOnsTotal;
  var deposit = Math.round(total * cat.depositPercent / 100);
  return { date: date, weekend: weekend, children: children, billedKids: billedKids, unitPrice: unit, lines: lines,
    packageAmount: packageAmount, venueFee: venueFee, addOnsTotal: addOnsTotal, total: total, deposit: deposit,
    depositPercent: cat.depositPercent, notes: notes,
    estimate: lines.some(function (l) { return l.startingPrice; }),
    customCake: lines.some(function (l) { return l.id === cat.customCakeId; }) };
}

/* ------------------------------------------------------------------ create booking */

function clean_(s, max) { return String(s === undefined || s === null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 200); }
function phone_(s) {
  var d = String(s || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.charAt(0) === '+') return d;
  if (d.indexOf('0') === 0) return '+62' + d.slice(1);
  if (d.indexOf('8') === 0) return '+62' + d;
  return '+' + d;
}

function nextBookingId_(date, rows) {
  var prefix = 'BD-' + date.slice(2, 4) + date.slice(5, 7) + date.slice(8, 10) + '-';
  var n = 0;
  rows.forEach(function (b) {
    var id = String(b.BookingId || '');
    if (id.indexOf(prefix) === 0) n = Math.max(n, parseInt(id.slice(prefix.length), 10) || 0);
  });
  return prefix + ('0' + (n + 1)).slice(-2);
}

function createBooking_(p, admin) {
  var cat = catalog_();
  if (!admin && !cat.formOpen) throw new Error('Online booking is temporarily closed. Please contact us on WhatsApp.');
  var date = iso_(p.date);
  if (!admin && date < addDays_(today_(), cat.minDaysAhead)) throw new Error('Online booking must be at least ' + cat.minDaysAhead + ' days ahead. Please contact us on WhatsApp.');
  if (date < today_()) throw new Error('Tanggal acara sudah lewat.');
  var session = String(p.session || '');
  var ses = cat.sessions.filter(function (s) { return s.id === session; })[0];
  if (!ses) throw new Error('Pilih sesi.');
  var time = clean_(p.time, 5);
  if (!admin && ses.times.indexOf(time) < 0) throw new Error('Pilih jam mulai.');
  if (!p.locationId) throw new Error('Pilih area pesta.');
  var name = clean_(p.contactName, 100), wa = phone_(p.whatsapp), email = clean_(p.email, 120).toLowerCase();
  if (!name) throw new Error('Isi nama kontak.');
  if (!admin && !wa) throw new Error('Isi nomor WhatsApp.');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Email tidak valid.');
  var kids = (p.birthdayChildren || []).map(function (c) { return { name: clean_(c.name, 80), age: c.age === '' || c.age === undefined ? '' : Math.floor(num_(c.age)), dob: iso_(c.dob) }; })
    .filter(function (c) { return c.name; }).slice(0, 4);
  if (!kids.length) throw new Error('Isi nama anak yang berulang tahun.');
  var menuIds = (p.menu || []).slice(0, 20);
  if (menuIds.length > cat.maxBuffet) throw new Error('Maksimal ' + cat.maxBuffet + ' menu buffet.');
  var menuNames = menuIds.map(function (id) { var m = cat.menu.filter(function (x) { return x.id === id; })[0]; if (!m) throw new Error('Menu tidak tersedia: ' + id); return m.name; });
  if (!admin && !p.agree) throw new Error('Please agree to the rules and terms.');

  var q = quote_(p, cat, admin);
  var cake = q.customCake ? customCake_(p.customCake, cat) : null;
  if (p.cakePhoto && p.cakePhoto.data && String(p.cakePhoto.data).length > 11 * 1024 * 1024) throw new Error('Cake reference photo is too large.');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var bt = table_(TAB.BOOKINGS);
    var map = takenMap_(date, date);
    if (isTaken_(map, date, p.locationId, session)) throw new Error('Sorry, this area and session was just booked. Please choose another.');
    var id = nextBookingId_(date, bt.rows);
    var nowStamp = now_();
    var hold = Utilities.formatDate(new Date(Date.now() + cat.holdHours * 3600 * 1000), TZ, 'yyyy-MM-dd HH:mm:ss');
    var loc = cat.locations.filter(function (l) { return l.id === p.locationId; })[0];
    var custId = upsertCustomer_(name, email, wa, nowStamp);
    var addonLines = q.lines.filter(function (l) { return l.type === 'addon'; });
    var cats = function (re) { return addonLines.filter(function (l) { return re.test(l.category); }); };
    var cakeLines = cats(/cake/i);
    var cakeSummary = cakeLines.length ? cakeLines.map(function (l) {
      if (/CUSTOM/.test(l.id)) return 'Custom cake';
      if (/OUTSIDE/.test(l.id)) return 'Bring own cake';
      return 'Favorite cake (standard) ' + l.name.replace(/^Favorite Cake\s*/i, '');
    }).join(', ') : 'No cake';
    var ent = cats(/entertainment|science|workshop/i).map(function (l) { return l.name + (l.qty > 1 && /pax|kid|pc|20 min/.test(l.unit) ? ' x' + l.qty : ''); }).join(', ');
    var fb = cats(/food|beverage/i).map(function (l) { return l.name + ' x' + l.qty; }).join(', ');
    var byo = cats(/bring your own/i).map(function (l) { return l.name + ' x' + l.qty; }).join(', ');
    var favours = cats(/favour/i).map(function (l) { return l.name + ' x' + l.qty; }).join(', ');

    append_(TAB.BOOKINGS, {
      BookingId: id, CreatedAt: txt_(nowStamp), UpdatedAt: txt_(nowStamp),
      CustomerName: name, Email: email, WhatsApp: txt_(wa),
      BirthdayChild: kids.map(function (k) { return k.name; }).join(' & '),
      BirthdayAge: kids.map(function (k) { return k.age; }).filter(function (a) { return a !== ''; }).join(' & '),
      EventDate: txt_(date), Session: session, LocationId: p.locationId, ChildrenCount: q.children,
      PackageUnitPrice: q.unitPrice, VenueFee: q.venueFee, AddOnsTotal: q.addOnsTotal, BookingTotal: q.total, DepositRequired: q.deposit,
      BookingStatus: 'PENDING', HoldExpiresAt: txt_(hold), PaymentStatus: 'UNPAID',
      SpecialRequest: clean_(p.notes, 1000), Source: admin ? 'ADMIN' : 'WEBSITE',
      CustomerId: custId, EventCategory: 'BIRTHDAY_PACKAGE', EventType: 'Birthday Package', EventTime: txt_(time),
      VenueLegacy: loc ? loc.name : '', AdultsCount: Math.floor(num_(p.adults)) || '', ChildrenPlanned: q.children,
      Theme: clean_(p.theme, 100), BirthdayCake: cakeSummary,
      CakeDetails: cake ? cake.text + (clean_(p.cakeDetails, 300) ? ' · ' + clean_(p.cakeDetails, 300) : '') : clean_(p.cakeDetails, 300),
      CakeWriting: clean_(p.cakeWriting, 120), CakeStatus: cake ? 'PRICE_PENDING' : '',
      Decoration: cats(/decoration/i).map(function (l) { return l.name; }).join(', '),
      Entertainment: [ent, byo, favours].filter(String).join(', '),
      BuffetMenu: menuNames.join(', '), ExtraFoodBeverage: fb, TotalPaid: 0
    });
    var itemsTable = table_(TAB.ITEMS);
    var seq = itemsTable.rows.length;
    q.lines.forEach(function (l) {
      seq++;
      append_(TAB.ITEMS, { ItemId: 'IT-' + ('00000' + seq).slice(-6), BookingId: id, AddOnId: l.id, Category: l.category || l.type, Name: l.name, Qty: l.qty, Unit: l.unit, UnitPrice: l.unitPrice, Amount: l.amount, Note: l.note || '' });
    });
    var pt = table_(TAB.PARTICIPANTS);
    var pn = pt.rows.length;
    kids.forEach(function (k) {
      pn++;
      append_(TAB.PARTICIPANTS, { ParticipantId: 'PT-' + ('00000' + pn).slice(-5), BookingId: id, ChildName: k.name, Age: k.age, Notes: k.dob ? 'DOB ' + k.dob : '' });
    });
    log_(admin ? 'admin' : 'website', 'CREATE_BOOKING', 'Booking', id, date + ' ' + session + ' ' + p.locationId + ' total ' + q.total);
  } finally {
    lock.releaseLock();
  }
  var photoUrl = '';
  if (cake && p.cakePhoto && p.cakePhoto.data) {
    try {
      photoUrl = saveCakePhoto_(id, p.cakePhoto);
      var saved = findBooking_(id);
      setFields_(TAB.BOOKINGS, saved._row, { CakeReferenceUrl: photoUrl });
    } catch (e) { log_('system', 'CAKE_PHOTO_FAILED', 'Booking', id, String(e)); }
  }
  var booking = { id: id, date: date, session: session, time: time, location: loc ? loc.name : '', contactName: name, email: email, whatsapp: wa,
    children: q.children, adults: Math.floor(num_(p.adults)) || 0, kids: kids, menu: menuNames, quote: q, holdUntil: hold, bank: cat.bank, contact: cat.whatsapp,
    cake: cake ? cake.text : '', cakeWriting: clean_(p.cakeWriting, 120), cakePhoto: photoUrl, cakePhotoSent: !!(p.cakePhoto && p.cakePhoto.data) };
  try { sendBookingEmails_(booking, cat); } catch (e) { log_('system', 'EMAIL_FAILED', 'Booking', id, String(e)); }
  return booking;
}

function upsertCustomer_(name, email, wa, nowStamp) {
  var t = table_(TAB.CUSTOMERS);
  var digits = String(wa || '').replace(/\D/g, '');
  var hit = t.rows.filter(function (r) {
    return (email && String(r.Email || '').toLowerCase() === email) || (digits && String(r.WhatsApp || '').replace(/\D/g, '') === digits);
  })[0];
  if (hit) {
    setFields_(TAB.CUSTOMERS, hit._row, { LastBookingAt: txt_(nowStamp), BookingCount: num_(hit.BookingCount) + 1 });
    return String(hit.CustomerId);
  }
  var n = 0;
  t.rows.forEach(function (r) { n = Math.max(n, parseInt(String(r.CustomerId || '').replace(/\D/g, ''), 10) || 0); });
  var id = 'CUST-' + ('000' + (n + 1)).slice(-4);
  append_(TAB.CUSTOMERS, { CustomerId: id, Name: name, Email: email, WhatsApp: txt_(wa), FirstSeenAt: txt_(nowStamp), LastBookingAt: txt_(nowStamp), BookingCount: 1 });
  return id;
}

/* ------------------------------------------------------------------ email */

function rp_(n) { return 'Rp ' + String(Math.round(num_(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function esc_(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function bookingHtml_(b) {
  var q = b.quote;
  var rows = q.lines.map(function (l) {
    return '<tr><td style="padding:4px 8px">' + esc_(l.name) + (l.note ? '<br><small style="color:#777">' + esc_(l.note) + '</small>' : '') +
      '</td><td style="padding:4px 8px;text-align:right">' + l.qty + '</td><td style="padding:4px 8px;text-align:right">' + rp_(l.amount) + '</td></tr>';
  }).join('');
  return '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' + rows +
    '<tr><td style="padding:6px 8px;border-top:1px solid #ccc"><b>' + (q.estimate ? 'Estimated total' : 'Total') + '</b></td><td></td><td style="padding:6px 8px;border-top:1px solid #ccc;text-align:right"><b>' + rp_(q.total) + '</b></td></tr>' +
    '<tr><td style="padding:4px 8px">Deposit (' + q.depositPercent + '%)</td><td></td><td style="padding:4px 8px;text-align:right">' + rp_(q.deposit) + '</td></tr></table>';
}

function sendBookingEmails_(b, cat) {
  if (!bool_(settings_().SendEmails === undefined ? 'TRUE' : settings_().SendEmails)) return;
  var info = '<p style="font-family:Arial,sans-serif;font-size:14px"><b>Booking no.:</b> ' + esc_(b.id) + '<br><b>Date:</b> ' + esc_(b.date) + ' · ' + esc_(b.session) + ' ' + esc_(b.time) +
    '<br><b>Area:</b> ' + esc_(b.location) + '<br><b>Birthday child:</b> ' + esc_(b.kids.map(function (k) { return k.name + (k.age !== '' ? ' (' + k.age + ')' : ''); }).join(', ')) +
    '<br><b>Children / adults:</b> ' + b.children + ' / ' + b.adults + '<br><b>Buffet menu:</b> ' + esc_(b.menu.join(', ')) +
    (b.cake ? '<br><b>Cake:</b> ' + esc_(b.cake) + (b.cakeWriting ? ' · Writing: “' + esc_(b.cakeWriting) + '”' : '') : '') + '</p>';
  var notes = b.quote.notes.length ? '<p style="font-family:Arial,sans-serif;font-size:13px;color:#555">' + b.quote.notes.map(esc_).join('<br>') + '</p>' : '';
  if (b.email) {
    MailApp.sendEmail({
      to: b.email,
      subject: 'Your birthday booking at Mookiland – ' + b.id,
      htmlBody: '<p style="font-family:Arial,sans-serif;font-size:14px">Hi ' + esc_(b.contactName) + ',<br><br>Thank you for booking a birthday party at Mookiland! Here is your booking summary.</p>' +
        info + bookingHtml_(b) + notes +
        '<p style="font-family:Arial,sans-serif;font-size:14px">Please pay the <b>' + rp_(b.quote.deposit) + '</b> deposit by <b>' + esc_(b.holdUntil.slice(0, 16)) + '</b> to secure your date. Your slot is held until then.<br><br>' +
        esc_(cat.bank).replace(/\n/g, '<br>') + '<br><br>Please send the transfer receipt with your booking number to ' + esc_(cat.whatsapp) + ' on WhatsApp.<br>The balance is paid on the party day. All prices include 10% tax.</p>',
      name: cat.business
    });
  }
  var admin = String(settings_().AdminEmail || '');
  if (admin) {
    var cakeAdmin = b.cake ? '<p style="font-family:Arial,sans-serif;font-size:14px;background:#fff7e6;padding:8px"><b>Cake custom – harga belum final.</b> Kirim detail ke cake maker, lalu isi harga final di halaman admin.' +
      (b.cakePhoto ? '<br>Foto referensi: <a href="' + esc_(b.cakePhoto) + '">' + esc_(b.cakePhoto) + '</a>' : b.cakePhotoSent ? '<br>Foto referensi gagal disimpan – minta lewat WhatsApp.' : '<br>Klien tidak mengunggah foto referensi.') + '</p>' : '';
    MailApp.sendEmail({ to: admin, subject: 'Booking baru ' + b.id + ' – ' + b.date + ' ' + b.session + (b.cake ? ' (cake custom)' : ''), htmlBody: '<p style="font-family:Arial,sans-serif">Kontak: ' + esc_(b.contactName) + ' · ' + esc_(b.whatsapp) + ' · ' + esc_(b.email) + '</p>' + info + cakeAdmin + bookingHtml_(b) + notes, name: cat.business });
  }
}

function sendCakePriceEmail_(row, oldPrice, newPrice) {
  var email = String(row.Email || '');
  if (!email || !bool_(settings_().SendEmails === undefined ? 'TRUE' : settings_().SendEmails)) return false;
  var cat = catalog_();
  var paid = num_(row.TotalPaid), total = num_(row.BookingTotal);
  MailApp.sendEmail({
    to: email,
    subject: 'Your custom cake price – ' + row.BookingId,
    htmlBody: '<p style="font-family:Arial,sans-serif;font-size:14px">Hi ' + esc_(row.CustomerName) + ',<br><br>Our cake maker has reviewed your custom cake design for booking <b>' + esc_(row.BookingId) + '</b> (' + esc_(iso_(row.EventDate)) + ').<br><br>' +
      'Custom cake – final price: <b>' + rp_(newPrice) + '</b> (starting price was ' + rp_(oldPrice) + ')<br>' +
      'New booking total: <b>' + rp_(total) + '</b><br>' + (paid > 0 ? 'Already paid: ' + rp_(paid) + '<br>Balance: <b>' + rp_(total - paid) + '</b><br>' : 'Deposit: <b>' + rp_(row.DepositRequired) + '</b><br>') +
      '<br>If you have any questions, message us on WhatsApp ' + esc_(cat.whatsapp) + '.<br>All prices include 10% tax.</p>',
    name: cat.business
  });
  return true;
}

/* ------------------------------------------------------------------ admin */

function login_(password) {
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!real) throw new Error('Jalankan setup dulu di Apps Script.');
  if (String(password || '') !== real) { Utilities.sleep(800); throw new Error('Password salah.'); }
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put('adm_' + token, '1', 21600);
  return { token: token };
}
function isAdmin_(token) { return !!(token && CacheService.getScriptCache().get('adm_' + token)); }
function requireAdmin_(token) { if (!isAdmin_(token)) throw new Error('Sesi admin habis. Silakan login lagi.'); }
function adminPassword_(p) {
  var pw = String(p.newPassword || '');
  if (pw.length < 8) throw new Error('Password minimal 8 karakter.');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', pw);
  log_('admin', 'CHANGE_PASSWORD', 'Admin', '', '');
  return { ok: true };
}

function bookingOut_(b) {
  return {
    id: String(b.BookingId), createdAt: stamp_(b.CreatedAt), date: iso_(b.EventDate), session: String(b.Session || ''), time: stamp_(b.EventTime),
    locationId: String(b.LocationId || ''), venue: String(b.VenueLegacy || ''), customer: String(b.CustomerName || ''), email: String(b.Email || ''),
    whatsapp: String(b.WhatsApp || '').replace(/^'/, ''), child: String(b.BirthdayChild || ''), age: String(b.BirthdayAge || ''),
    children: num_(b.ChildrenCount), adults: num_(b.AdultsCount), total: b.BookingTotal === '' ? null : num_(b.BookingTotal),
    deposit: b.DepositRequired === '' ? null : num_(b.DepositRequired), paid: num_(b.TotalPaid), status: String(b.BookingStatus || ''),
    payment: String(b.PaymentStatus || ''), hold: stamp_(b.HoldExpiresAt), source: String(b.Source || ''), category: String(b.EventCategory || ''),
    theme: String(b.Theme || ''), notes: String(b.SpecialRequest || ''), cake: String(b.BirthdayCake || ''), cakeDetails: String(b.CakeDetails || ''),
    cakeWriting: String(b.CakeWriting || ''), decoration: String(b.Decoration || ''), entertainment: String(b.Entertainment || ''),
    menu: String(b.BuffetMenu || ''), extraFood: String(b.ExtraFoodBeverage || ''), legacy: String(b.LegacySummary || ''),
    cakeStatus: String(b.CakeStatus || ''), cakeRef: String(b.CakeReferenceUrl || '')
  };
}

function adminList_(p) {
  var rows = table_(TAB.BOOKINGS).rows.filter(function (b) { return b.BookingId; }).map(bookingOut_);
  rows.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return { today: today_(), bookings: rows.map(function (b) {
    return { id: b.id, date: b.date, session: b.session, time: b.time, locationId: b.locationId, venue: b.venue, customer: b.customer, whatsapp: b.whatsapp,
      child: b.child, children: b.children, total: b.total, paid: b.paid, status: b.status, payment: b.payment, hold: b.hold, source: b.source, category: b.category, cakeStatus: b.cakeStatus };
  }) };
}

function findBooking_(id) {
  var t = table_(TAB.BOOKINGS);
  var b = t.rows.filter(function (r) { return String(r.BookingId) === String(id); })[0];
  if (!b) throw new Error('Booking tidak ditemukan: ' + id);
  return b;
}

function adminGet_(id) {
  var b = findBooking_(id);
  var items = [];
  try { items = table_(TAB.ITEMS).rows.filter(function (r) { return String(r.BookingId) === String(id); }).map(function (r) {
    return { id: String(r.ItemId), addOnId: String(r.AddOnId), category: String(r.Category), name: String(r.Name), qty: num_(r.Qty), unit: String(r.Unit), unitPrice: num_(r.UnitPrice), amount: num_(r.Amount), note: String(r.Note || '') };
  }); } catch (e) { items = []; }
  var payments = table_(TAB.PAYMENTS).rows.filter(function (r) { return String(r.BookingId) === String(id); }).map(function (r) {
    return { id: String(r.PaymentId), type: String(r.PaymentType), amount: num_(r.Amount), date: iso_(r.TransferDate), bank: String(r.Bank || ''), status: String(r.VerificationStatus || ''), by: String(r.VerifiedBy || ''), at: stamp_(r.VerifiedAt) };
  });
  var kids = table_(TAB.PARTICIPANTS).rows.filter(function (r) { return String(r.BookingId) === String(id); }).map(function (r) {
    return { name: String(r.ChildName), age: r.Age === '' ? '' : num_(r.Age), notes: String(r.Notes || '') };
  });
  var log = table_(TAB.LOG).rows.filter(function (r) { return String(r.EntityId) === String(id); }).map(function (r) {
    return { at: stamp_(r.Timestamp), actor: String(r.Actor), action: String(r.Action), details: String(r.Details || '') };
  });
  return { booking: bookingOut_(b), items: items, payments: payments, participants: kids, log: log };
}

function recompute_(id) {
  var b = findBooking_(id);
  var paid = table_(TAB.PAYMENTS).rows.filter(function (r) { return String(r.BookingId) === String(id); })
    .reduce(function (s, r) { return s + num_(r.Amount); }, 0);
  var total = b.BookingTotal === '' ? 0 : num_(b.BookingTotal);
  var ps = paid <= 0 ? (iso_(b.EventDate) < today_() ? 'NO_PAYMENT_RECORD' : 'UNPAID') : (total > 0 && paid >= total ? 'PAID' : 'DEPOSIT_PAID');
  var st = String(b.BookingStatus || '');
  if (st !== 'CANCELLED' && st !== 'COMPLETED') st = paid > 0 ? 'CONFIRMED' : 'PENDING';
  setFields_(TAB.BOOKINGS, b._row, { TotalPaid: paid, PaymentStatus: ps, BookingStatus: st, UpdatedAt: txt_(now_()) });
  return { paid: paid, payment: ps, status: st };
}

function adminPay_(p) {
  var b = findBooking_(p.id);
  var amount = Math.round(num_(p.amount));
  if (!amount) throw new Error('Isi jumlah pembayaran.');
  var type = ['DEPOSIT', 'SECOND_PAYMENT', 'FINAL', 'ADJUSTMENT', 'REFUND'].indexOf(p.type) >= 0 ? p.type : 'DEPOSIT';
  if (type === 'REFUND' && amount > 0) amount = -amount;
  var t = table_(TAB.PAYMENTS);
  var n = 0;
  t.rows.forEach(function (r) { n = Math.max(n, parseInt(String(r.PaymentId || '').replace(/\D/g, ''), 10) || 0); });
  var pid = 'PAY-' + ('00000' + (n + 1)).slice(-5);
  append_(TAB.PAYMENTS, { PaymentId: pid, BookingId: String(b.BookingId), PaymentType: type, Amount: amount, TransferDate: txt_(iso_(p.date) || today_()),
    ProofUrl: clean_(p.proofUrl, 300), VerificationStatus: 'VERIFIED', VerifiedBy: 'admin', VerifiedAt: txt_(now_()), Bank: clean_(p.method, 60) });
  var r = recompute_(b.BookingId);
  log_('admin', 'PAYMENT', 'Booking', String(b.BookingId), type + ' ' + amount + ' via ' + clean_(p.method, 60));
  return { paymentId: pid, result: r, detail: adminGet_(b.BookingId) };
}

function adminDeletePayment_(p) {
  var t = table_(TAB.PAYMENTS);
  var r = t.rows.filter(function (x) { return String(x.PaymentId) === String(p.paymentId); })[0];
  if (!r) throw new Error('Pembayaran tidak ditemukan.');
  t.sh.deleteRow(r._row);
  recompute_(r.BookingId);
  log_('admin', 'DELETE_PAYMENT', 'Booking', String(r.BookingId), p.paymentId + ' ' + r.Amount);
  return adminGet_(r.BookingId);
}

function adminUpdate_(p) {
  var b = findBooking_(p.id);
  var f = p.fields || {};
  var out = {};
  if (f.status !== undefined) {
    if (['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].indexOf(f.status) < 0) throw new Error('Status tidak dikenal.');
    out.BookingStatus = f.status;
  }
  if (f.total !== undefined) out.BookingTotal = f.total === '' || f.total === null ? '' : Math.round(num_(f.total));
  if (f.deposit !== undefined) out.DepositRequired = f.deposit === '' || f.deposit === null ? '' : Math.round(num_(f.deposit));
  if (f.notes !== undefined) out.SpecialRequest = clean_(f.notes, 1000);
  if (f.children !== undefined) out.ChildrenCount = Math.floor(num_(f.children));
  if (f.adults !== undefined) out.AdultsCount = Math.floor(num_(f.adults));
  if (f.theme !== undefined) out.Theme = clean_(f.theme, 100);
  if (f.hold !== undefined) out.HoldExpiresAt = txt_(clean_(f.hold, 19));
  out.UpdatedAt = txt_(now_());
  setFields_(TAB.BOOKINGS, b._row, out);
  var r = recompute_(b.BookingId);
  log_('admin', 'UPDATE', 'Booking', String(b.BookingId), JSON.stringify(f).slice(0, 400));
  return { result: r, detail: adminGet_(b.BookingId) };
}

function adminBlock_(p) {
  var date = iso_(p.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Tanggal tidak valid');
  if (p.remove) {
    var t = table_(TAB.BLOCKED);
    var hit = t.rows.filter(function (r) { return String(r.BlockId) === String(p.blockId); })[0];
    if (hit) t.sh.deleteRow(hit._row);
    return { removed: !!hit };
  }
  var n = table_(TAB.BLOCKED).rows.length + 1;
  var id = 'BLK-' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + '-' + n;
  append_(TAB.BLOCKED, { BlockId: id, Date: txt_(date), LocationId: clean_(p.locationId, 40), Session: clean_(p.session, 20), Reason: clean_(p.reason, 200), CreatedAt: txt_(now_()), CreatedBy: 'admin' });
  return { blockId: id };
}

// Harga final cake custom dari cake maker: ubah item cake, hitung ulang total (dan DP bila belum ada pembayaran).
function adminCakePrice_(p) {
  var b = findBooking_(p.id);
  var price = Math.round(num_(p.price));
  if (price <= 0) throw new Error('Isi harga final cake.');
  var cat = catalog_();
  var it = table_(TAB.ITEMS);
  var item = it.rows.filter(function (r) {
    return String(r.BookingId) === String(b.BookingId) && (String(r.AddOnId) === cat.customCakeId || /CAKE-CUSTOM/i.test(String(r.AddOnId)));
  })[0];
  if (!item) throw new Error('Booking ini tidak punya item cake custom.');
  var qty = Math.max(1, num_(item.Qty));
  var oldPrice = num_(item.UnitPrice);
  var diff = price * qty - num_(item.Amount);
  setFields_(TAB.ITEMS, item._row, { UnitPrice: price, Amount: price * qty, Note: 'Final price confirmed by cake maker' + (oldPrice ? ' (starting price ' + rp_(oldPrice) + ')' : '') });
  var total = num_(b.BookingTotal) + diff;
  var out = { AddOnsTotal: num_(b.AddOnsTotal) + diff, BookingTotal: total, CakeStatus: 'PRICE_FINAL', UpdatedAt: txt_(now_()) };
  if (num_(b.TotalPaid) <= 0) out.DepositRequired = Math.round(total * cat.depositPercent / 100);
  setFields_(TAB.BOOKINGS, b._row, out);
  var r = recompute_(b.BookingId);
  log_('admin', 'CAKE_PRICE', 'Booking', String(b.BookingId), 'Cake ' + oldPrice + ' -> ' + price + ', total ' + total);
  var mailed = false;
  if (p.notify) {
    try { mailed = sendCakePriceEmail_(findBooking_(b.BookingId), oldPrice, price); } catch (e) { log_('system', 'EMAIL_FAILED', 'Booking', String(b.BookingId), String(e)); }
  }
  return { result: r, mailed: mailed, detail: adminGet_(b.BookingId) };
}
