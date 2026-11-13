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
  ['BookingFormOpen', 'TRUE', 'FALSE = form booking online ditutup sementara'],
  ['InvoiceTaxNote', 'The birthday package is not subject to tax. Prices of extras include 10% tax.', 'Catatan pajak di invoice & email klien'],
  ['InvoiceFooter', 'Mookiland Family Park, Bali', 'Baris alamat/nama usaha di bagian atas invoice'],
  ['RestaurantCategories', 'Food & Beverage, Food & Beverage (Adults)', 'Kategori add-on yang dipesan & dibayar di restoran (penjualan biasa): tampil sebagai info, tidak masuk invoice/total/DP'],
  ['AutoDepositReminder', 'TRUE', 'TRUE = kirim email reminder DP otomatis (sekali, setiap pagi jam 09:00 dicek) untuk booking yang belum bayar DP'],
  ['ReminderAfterHours', '24', 'Reminder otomatis dikirim bila booking sudah berumur sekian jam dan masa tahan slot belum habis']
];

var EXTRA_TABS = {
  BookingItems: ['ItemId', 'BookingId', 'AddOnId', 'Category', 'Name', 'Qty', 'Unit', 'UnitPrice', 'Amount', 'Note', 'Billing'],
  Holidays: ['Date', 'Name'],
  CakeOptions: ['Group', 'Name', 'Active']
};

// Jenis event yang bisa dipilih admin (EventCategory -> label EventType)
var EVENT_TYPES = { BIRTHDAY_PACKAGE: 'Birthday Package', BIRTHDAY_REGULAR_TICKET: 'Regular Ticket' };
function eventLabel_(cat, type) {
  if (cat === 'BIRTHDAY_PACKAGE') return 'Birthday Package';
  if (cat === 'BIRTHDAY_REGULAR_TICKET') return 'Regular Ticket';
  return String(type || cat || '');
}
function isRegular_(p, admin) { return !!admin && String(p.eventCategory || '') === 'BIRTHDAY_REGULAR_TICKET'; }

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
    } else {
      var h = head_(sh);
      EXTRA_TABS[name].forEach(function (c) {
        if (h.indexOf(c) < 0) { sh.getRange(1, h.length + 1).setValue(c); h.push(c); }
      });
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
  installReminderTrigger_();
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
  adminCakePrice: function (p, token) { requireAdmin_(token); return adminCakePrice_(p); },
  adminItems: function (p, token) { requireAdmin_(token); return adminItems_(p); },
  adminInvoice: function (p, token) { requireAdmin_(token); return adminInvoice_(p); },
  adminReminder: function (p, token) { requireAdmin_(token); return adminReminder_(p); }
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
  var restoCats = restaurantCats_(s);
  var addons = table_(TAB.ADDONS).rows.filter(function (r) { return r.AddOnId && bool_(r.Active); }).map(function (r) {
    var a = { id: String(r.AddOnId), category: String(r.Category), name: String(r.Name), description: String(r.Description || ''), unit: String(r.Unit || ''), price: num_(r.Price) };
    if (restoCats.indexOf(a.category.trim().toLowerCase()) >= 0) a.restaurant = true;
    return a;
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

// Kategori add-on yang dibayar di restoran (Settings: RestaurantCategories, dipisah koma).
function restaurantCats_(s) {
  var v = s.RestaurantCategories === undefined ? 'Food & Beverage, Food & Beverage (Adults)' : String(s.RestaurantCategories);
  return v.split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(String);
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
  var regular = isRegular_(p, admin);
  var billedKids = regular ? children : Math.max(children, cat.minChildren);
  var unit = regular ? 0 : weekend ? cat.weekendPrice : cat.weekdayPrice;
  var lines = [];
  if (regular) {
    lines.push({ type: 'package', id: 'REGULAR-TICKET', name: 'Birthday with regular tickets', qty: children, unit: 'per child', unitPrice: 0, amount: 0,
      note: 'Guests pay the regular entrance ticket at the gate' });
  } else lines.push({ type: 'package', id: cat.packageId, name: cat.packageName + (weekend ? ' (weekend / holiday)' : ' (weekday)'),
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
    if (a.restaurant) {
      line.restaurant = true;
      line.note = (line.note ? line.note + ' · ' : '') + 'Ordered & paid at the restaurant';
    } else if (a.price === 0) line.note = (line.note ? line.note + ' · ' : '') + 'price per menu, billed at the restaurant';
    if (a.id === cat.customCakeId) {
      line.startingPrice = true;
      line.note = 'Starting price · final price confirmed by our cake maker';
      notes.push('Custom cake: starting price. The final price is confirmed after our cake maker reviews your design.');
    } else if (/starting/i.test(a.description)) { line.startingPrice = true; notes.push(a.name + ': starting price, final price confirmed by our team'); }
    lines.push(line);
  });
  var adults = Math.max(0, Math.floor(num_(p.adults)));
  if (regular) notes.push('Regular ticket booking: every guest pays the regular entrance ticket at the gate; only the extras above are billed by us.');
  else if (adults > children * cat.adultsPerChild) notes.push((adults - children * cat.adultsPerChild) + ' extra adult(s) pay the regular entrance at the park');
  var packageAmount = lines[0].amount;
  var venueFee = lines.filter(function (l) { return l.type === 'venue'; }).reduce(function (s, l) { return s + l.amount; }, 0);
  var addOnsTotal = lines.filter(function (l) { return l.type === 'addon' && !l.restaurant; }).reduce(function (s, l) { return s + l.amount; }, 0);
  var restaurantTotal = lines.filter(function (l) { return l.restaurant; }).reduce(function (s, l) { return s + l.amount; }, 0);
  if (restaurantTotal > 0) notes.push('Food & beverage extras are ordered and paid at the restaurant (regular restaurant sale), so they are not part of the booking total or deposit.');
  var total = packageAmount + venueFee + addOnsTotal;
  var deposit = Math.round(total * cat.depositPercent / 100);
  return { date: date, weekend: weekend, children: children, billedKids: billedKids, unitPrice: unit, lines: lines,
    packageAmount: packageAmount, venueFee: venueFee, addOnsTotal: addOnsTotal, restaurantTotal: restaurantTotal, total: total, deposit: deposit,
    depositPercent: cat.depositPercent, notes: notes, eventCategory: regular ? 'BIRTHDAY_REGULAR_TICKET' : 'BIRTHDAY_PACKAGE',
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
  var menuIds = isRegular_(p, admin) ? [] : (p.menu || []).slice(0, 20); // buffet hanya untuk Birthday Package
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
      BookingStatus: q.total > 0 ? 'PENDING' : 'CONFIRMED', HoldExpiresAt: q.total > 0 ? txt_(hold) : '', PaymentStatus: q.total > 0 ? 'UNPAID' : 'NOT_REQUIRED',
      SpecialRequest: clean_(p.notes, 1000), Source: admin ? 'ADMIN' : 'WEBSITE',
      CustomerId: custId, EventCategory: q.eventCategory, EventType: EVENT_TYPES[q.eventCategory], EventTime: txt_(time),
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
      append_(TAB.ITEMS, { ItemId: 'IT-' + ('00000' + seq).slice(-6), BookingId: id, AddOnId: l.id, Category: l.category || l.type, Name: l.name, Qty: l.qty, Unit: l.unit, UnitPrice: l.unitPrice, Amount: l.amount, Note: l.note || '', Billing: l.restaurant ? 'RESTAURANT' : 'INVOICE' });
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
    children: q.children, adults: Math.floor(num_(p.adults)) || 0, kids: kids, menu: menuNames, quote: q, holdUntil: q.total > 0 ? hold : '', eventCategory: q.eventCategory, bank: cat.bank, contact: cat.whatsapp,
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
  var row = function (l) {
    return '<tr><td style="padding:4px 8px">' + esc_(l.name) + (l.note ? '<br><small style="color:#777">' + esc_(l.note) + '</small>' : '') +
      '</td><td style="padding:4px 8px;text-align:right">' + l.qty + '</td><td style="padding:4px 8px;text-align:right">' + rp_(l.amount) + '</td></tr>';
  };
  var resto = q.lines.filter(function (l) { return l.restaurant; });
  var restoHtml = resto.length ? '<tr><td colspan="3" style="padding:12px 8px 4px"><b>At the restaurant (for information)</b><br><small style="color:#777">Ordered and paid separately at the restaurant · not included in the total above</small></td></tr>' +
    resto.map(row).join('') +
    '<tr><td style="padding:4px 8px;color:#555">Estimated restaurant bill</td><td></td><td style="padding:4px 8px;text-align:right;color:#555">' + rp_(q.restaurantTotal) + '</td></tr>' : '';
  return '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' + q.lines.filter(function (l) { return !l.restaurant; }).map(row).join('') +
    '<tr><td style="padding:6px 8px;border-top:1px solid #ccc"><b>' + (q.estimate ? 'Estimated total' : 'Total') + '</b></td><td></td><td style="padding:6px 8px;border-top:1px solid #ccc;text-align:right"><b>' + rp_(q.total) + '</b></td></tr>' +
    '<tr><td style="padding:4px 8px">Deposit (' + q.depositPercent + '%)</td><td></td><td style="padding:4px 8px;text-align:right">' + rp_(q.deposit) + '</td></tr>' + restoHtml + '</table>';
}

function sendBookingEmails_(b, cat) {
  if (!bool_(settings_().SendEmails === undefined ? 'TRUE' : settings_().SendEmails)) return;
  var info = '<p style="font-family:Arial,sans-serif;font-size:14px"><b>Booking no.:</b> ' + esc_(b.id) + '<br><b>Event:</b> ' + esc_(eventLabel_(b.eventCategory)) + '<br><b>Date:</b> ' + esc_(b.date) + ' · ' + esc_(b.session) + ' ' + esc_(b.time) +
    '<br><b>Area:</b> ' + esc_(b.location) + '<br><b>Birthday child:</b> ' + esc_(b.kids.map(function (k) { return k.name + (k.age !== '' ? ' (' + k.age + ')' : ''); }).join(', ')) +
    '<br><b>Children / adults:</b> ' + b.children + ' / ' + b.adults + (b.menu.length ? '<br><b>Buffet menu:</b> ' + esc_(b.menu.join(', ')) : '') +
    (b.cake ? '<br><b>Cake:</b> ' + esc_(b.cake) + (b.cakeWriting ? ' · Writing: “' + esc_(b.cakeWriting) + '”' : '') : '') + '</p>';
  var notes = b.quote.notes.length ? '<p style="font-family:Arial,sans-serif;font-size:13px;color:#555">' + b.quote.notes.map(esc_).join('<br>') + '</p>' : '';
  if (b.email) {
    var mail = {
      to: b.email,
      subject: 'Your birthday booking at Mookiland – ' + b.id,
      htmlBody: '<p style="font-family:Arial,sans-serif;font-size:14px">Hi ' + esc_(b.contactName) + ',<br><br>Thank you for booking a birthday party at Mookiland! Here is your booking summary. Your proforma invoice is attached.</p>' +
        info + bookingHtml_(b) + notes +
        (b.quote.total > 0 ? '<p style="font-family:Arial,sans-serif;font-size:14px">Please pay the <b>' + rp_(b.quote.deposit) + '</b> deposit by <b>' + esc_(b.holdUntil.slice(0, 16)) + '</b> to secure your date. Your slot is held until then.<br><br>' +
        esc_(cat.bank).replace(/\n/g, '<br>') + '<br><br>Please send the transfer receipt with your booking number to ' + esc_(cat.whatsapp) + ' on WhatsApp.<br>The balance is paid on the party day. ' + esc_(taxNote_()) + '</p>' :
        '<p style="font-family:Arial,sans-serif;font-size:14px">Your booking is confirmed. No deposit is needed: every guest pays the regular entrance ticket at the gate on the party day.<br><br>If you have any questions, message us on WhatsApp ' + esc_(cat.whatsapp) + '.</p>'),
      name: cat.business
    };
    mail.attachments = safeInvoice_(b.id);
    MailApp.sendEmail(mail);
  }
  var admin = String(settings_().AdminEmail || '');
  if (admin) {
    var cakeAdmin = b.cake ? '<p style="font-family:Arial,sans-serif;font-size:14px;background:#fff7e6;padding:8px"><b>Cake custom – harga belum final.</b> Kirim detail ke cake maker, lalu isi harga final di halaman admin.' +
      (b.cakePhoto ? '<br>Foto referensi: <a href="' + esc_(b.cakePhoto) + '">' + esc_(b.cakePhoto) + '</a>' : b.cakePhotoSent ? '<br>Foto referensi gagal disimpan – minta lewat WhatsApp.' : '<br>Klien tidak mengunggah foto referensi.') + '</p>' : '';
    MailApp.sendEmail({ to: admin, subject: 'Booking baru ' + b.id + ' – ' + b.date + ' ' + b.session + (b.eventCategory === 'BIRTHDAY_REGULAR_TICKET' ? ' (Regular Ticket)' : '') + (b.cake ? ' (cake custom)' : ''), htmlBody: '<p style="font-family:Arial,sans-serif">Kontak: ' + esc_(b.contactName) + ' · ' + esc_(b.whatsapp) + ' · ' + esc_(b.email) + '</p>' + info + cakeAdmin + bookingHtml_(b) + notes, name: cat.business });
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
      '<br>Your updated invoice is attached. If you have any questions, message us on WhatsApp ' + esc_(cat.whatsapp) + '.<br>' + esc_(taxNote_()) + '</p>',
    name: cat.business,
    attachments: safeInvoice_(row.BookingId)
  });
  return true;
}

/* ------------------------------------------------------------------ invoice */

function safeInvoice_(id) {
  try { return [invoicePdf_(id).blob]; } catch (e) { log_('system', 'INVOICE_FAILED', 'Booking', String(id), String(e)); return []; }
}

function taxNote_() {
  var s = settings_();
  return String(s.InvoiceTaxNote || 'The birthday package is not subject to tax. Prices of extras include 10% tax.');
}

var PAYMENT_LABELS = { DEPOSIT: 'Deposit', SECOND_PAYMENT: '2nd payment', FINAL: 'Final payment', ADJUSTMENT: 'Adjustment', REFUND: 'Refund' };

// Invoice (bahasa Inggris, format mengikuti PROFORMA INVOICE di Excel lama). Nomor invoice = INV-<no. booking>.
function invoiceHtml_(d, cat) {
  var b = d.booking, s = settings_();
  var number = 'INV-' + b.id;
  var resto = d.items.filter(function (i) { return i.billing === 'RESTAURANT'; });
  var billed = d.items.filter(function (i) { return i.billing !== 'RESTAURANT'; });
  var total = b.total === null ? billed.reduce(function (t, i) { return t + i.amount; }, 0) : b.total;
  var paid = d.payments.reduce(function (t, p) { return t + p.amount; }, 0);
  var balance = total - paid;
  var isPaid = total > 0 && balance <= 0;
  var noCharge = b.total !== null && total <= 0 && paid <= 0;
  var cakePending = b.cakeStatus === 'PRICE_PENDING';
  var kids = d.participants.length ? d.participants.map(function (k) { return k.name + (k.age !== '' ? ' (' + k.age + ')' : ''); }).join(', ') : (b.child + (b.age ? ' (' + b.age + ')' : ''));
  var area = (cat.locations.filter(function (l) { return l.id === b.locationId; })[0] || {}).name || b.venue || b.locationId || '';
  var cell = 'padding:6px 8px;border-bottom:1px solid #e3e8e4;';
  var kv = function (k, v) { return v === '' || v === null || v === undefined ? '' : '<tr><td style="padding:2px 12px 2px 0;color:#5d6b62;white-space:nowrap">' + esc_(k) + '</td><td style="padding:2px 0">' + esc_(v) + '</td></tr>'; };
  var itemRow = function (i) {
    return '<tr><td style="' + cell + '">' + esc_(i.name) + (i.note ? '<br><span style="font-size:11px;color:#777">' + esc_(i.note) + '</span>' : '') + '</td>' +
      '<td style="' + cell + 'text-align:right">' + i.qty + '</td><td style="' + cell + 'text-align:right">' + rp_(i.unitPrice) + '</td><td style="' + cell + 'text-align:right">' + rp_(i.amount) + '</td></tr>';
  };
  var lines = billed.length ? billed.map(itemRow).join('') : '<tr><td style="' + cell + '">Birthday package – ' + b.children + ' children' + (b.legacy ? '<br><span style="font-size:11px;color:#777">' + esc_(b.legacy) + '</span>' : '') + '</td><td style="' + cell + 'text-align:right">1</td><td style="' + cell + 'text-align:right">' + rp_(total) + '</td><td style="' + cell + 'text-align:right">' + rp_(total) + '</td></tr>';
  var pays = d.payments.map(function (p) {
    return '<tr><td colspan="3" style="padding:3px 8px;text-align:right;color:#5d6b62">' + esc_(PAYMENT_LABELS[p.type] || p.type) + (p.date ? ' (' + esc_(p.date) + ')' : '') + '</td><td style="padding:3px 8px;text-align:right">' + (p.amount >= 0 ? '− ' : '+ ') + rp_(Math.abs(p.amount)) + '</td></tr>';
  }).join('');
  var message = noCharge ? 'No payment is due for this booking. Every guest pays the regular entrance ticket at the gate on the party day.' :
    isPaid ? 'This invoice has been paid in full. Thank you!' :
    paid <= 0 ? 'To confirm your booking, please make a ' + cat.depositPercent + '% deposit of <b>' + rp_(b.deposit === null ? Math.round(total * cat.depositPercent / 100) : b.deposit) + '</b>' + (b.hold && b.status === 'PENDING' ? ' before <b>' + esc_(String(b.hold).slice(0, 16)) + '</b>' : '') + '. This deposit will be deducted from the final invoice total.' :
    'The remaining balance of <b>' + rp_(balance) + '</b> is paid on the party day.';
  return '<html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1d2a22;margin:28px">' +
    '<table style="width:100%"><tr><td><img src="' + INVOICE_LOGO + '" alt="Mookiland Bali" style="height:72px;display:block;margin-bottom:4px"><div style="color:#5d6b62">' + esc_(s.InvoiceFooter || 'Mookiland Family Park, Bali') + '<br>WhatsApp ' + esc_(cat.whatsapp) + '</div></td>' +
    '<td style="text-align:right;vertical-align:top"><div style="font-size:20px;font-weight:bold;letter-spacing:1px">' + (isPaid ? 'INVOICE' : 'PROFORMA INVOICE') + '</div>' +
    '<div>No. <b>' + number + '</b><br>Date: ' + today_() + '</div>' + (isPaid ? '<div style="display:inline-block;margin-top:8px;border:3px solid #1f6b3a;color:#1f6b3a;font-size:22px;font-weight:bold;padding:2px 14px;transform:rotate(-6deg)">PAID</div>' : '') + '</td></tr></table>' +
    '<hr style="border:0;border-top:2px solid #1f6b3a;margin:14px 0">' +
    '<table style="width:100%"><tr><td style="vertical-align:top;width:50%"><div style="font-weight:bold;margin-bottom:4px">Bill to</div><table>' +
    kv('Contact person', b.customer) + kv('Email', b.email) + kv('Phone', b.whatsapp) + kv('Birthday child', kids) + '</table></td>' +
    '<td style="vertical-align:top"><div style="font-weight:bold;margin-bottom:4px">Event</div><table>' +
    kv('Event', eventLabel_(b.category, b.eventType) || 'Birthday Package') + kv('Booking no.', b.id) + kv('Date of event', b.date) + kv('Time', b.time || b.session) + kv('Venue', area) +
    kv('Children / adults', b.children + ' / ' + b.adults) + kv('Theme', b.theme) + '</table></td></tr></table>' +
    '<table style="width:100%;border-collapse:collapse;margin-top:16px"><tr style="background:#e8f3ea"><th style="padding:6px 8px;text-align:left">Description</th><th style="padding:6px 8px;text-align:right">Qty</th><th style="padding:6px 8px;text-align:right">Price</th><th style="padding:6px 8px;text-align:right">Amount</th></tr>' +
    lines +
    '<tr><td colspan="3" style="padding:8px;text-align:right;font-weight:bold">Total' + (cakePending ? ' (estimated)' : '') + '</td><td style="padding:8px;text-align:right;font-weight:bold">' + rp_(total) + '</td></tr>' +
    pays +
    '<tr><td colspan="3" style="padding:6px 8px;text-align:right;font-weight:bold;border-top:1px solid #1f6b3a">Balance due</td><td style="padding:6px 8px;text-align:right;font-weight:bold;border-top:1px solid #1f6b3a">' + rp_(Math.max(0, balance)) + '</td></tr></table>' +
    (resto.length ? '<div style="margin-top:16px;border:1px dashed #b9c4bc;padding:8px 10px;background:#fafbf9">' +
      '<div style="font-weight:bold">At the restaurant – for information only</div>' +
      '<div style="font-size:11px;color:#5d6b62;margin-bottom:6px">These items are ordered and paid separately at the Mookiland restaurant. They are not part of this invoice, the deposit or the balance due.</div>' +
      '<table style="width:100%;border-collapse:collapse;color:#3c4a41">' + resto.map(itemRow).join('') +
      '<tr><td colspan="3" style="padding:6px 8px;text-align:right">Estimated restaurant bill</td><td style="padding:6px 8px;text-align:right">' + rp_(resto.reduce(function (t, i) { return t + i.amount; }, 0)) + '</td></tr></table></div>' : '') +
    '<p style="color:#5d6b62;font-size:11px">' + esc_(taxNote_()) + (cakePending ? ' The custom cake has a starting price; we will send an updated invoice once our cake maker confirms the final price.' : '') + '</p>' +
    (b.menu ? '<p><b>Buffet menu:</b> ' + esc_(b.menu) + '</p>' : '') +
    (b.cakeDetails ? '<p><b>Cake:</b> ' + esc_(b.cakeDetails) + (b.cakeWriting ? ' · Writing: “' + esc_(b.cakeWriting) + '”' : '') + '</p>' : '') +
    (b.notes ? '<p><b>Remarks:</b> ' + esc_(b.notes) + '</p>' : '') +
    '<p style="margin-top:14px">' + message + '</p>' +
    (isPaid || noCharge ? '' : '<p>The payment can be made via bank transfer using the details below:<br>' + esc_(cat.bank).replace(/\n/g, '<br>') + '<br>Please send the transfer receipt with your booking number to ' + esc_(cat.whatsapp) + ' on WhatsApp.</p>') +
    '<p style="margin-top:18px">Kind regards,<br><b>Mookiland Team</b></p></body></html>';
}

function invoicePdf_(id) {
  var d = adminGet_(id);
  var cat = catalog_();
  var number = 'INV-' + d.booking.id;
  var name = 'Mookiland ' + number + '.pdf';
  var blob = Utilities.newBlob(invoiceHtml_(d, cat), 'text/html', number + '.html').getAs('application/pdf').setName(name);
  return { blob: blob, name: name, number: number, booking: d.booking };
}

function adminInvoice_(p) {
  var inv = invoicePdf_(p.id);
  var sent = false;
  if (p.send) {
    var b = inv.booking, cat = catalog_();
    if (!b.email) throw new Error('Booking ini tidak punya email klien.');
    MailApp.sendEmail({
      to: b.email,
      subject: (p.updated ? 'Updated invoice ' : 'Invoice ') + inv.number + ' – Mookiland Birthday',
      htmlBody: '<p style="font-family:Arial,sans-serif;font-size:14px">Hi ' + esc_(b.customer) + ',<br><br>' + (p.updated ? 'Your booking details have been updated. ' : '') + 'Please find attached the latest invoice for your birthday party at Mookiland on <b>' + esc_(b.date) + '</b> (booking ' + esc_(b.id) + ').<br><br>' +
        'If you have any questions, message us on WhatsApp ' + esc_(cat.whatsapp) + '.<br><br>Kind regards,<br>Mookiland Team</p>',
      name: cat.business,
      attachments: [inv.blob]
    });
    sent = true;
    log_('admin', 'INVOICE_SENT', 'Booking', b.id, inv.number + ' to ' + b.email);
  }
  return { number: inv.number, fileName: inv.name, sent: sent, pdf: Utilities.base64Encode(inv.blob.getBytes()) };
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
    payment: String(b.PaymentStatus || ''), hold: stamp_(b.HoldExpiresAt), source: String(b.Source || ''), category: String(b.EventCategory || ''), eventType: String(b.EventType || ''),
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
    return { id: String(r.ItemId), addOnId: String(r.AddOnId), category: String(r.Category), name: String(r.Name), qty: num_(r.Qty), unit: String(r.Unit), unitPrice: num_(r.UnitPrice), amount: num_(r.Amount), note: String(r.Note || ''), billing: String(r.Billing || 'INVOICE') };
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
  var noCharge = b.BookingTotal !== '' && total <= 0 && paid <= 0;
  var ps = noCharge ? 'NOT_REQUIRED' : paid <= 0 ? (iso_(b.EventDate) < today_() ? 'NO_PAYMENT_RECORD' : 'UNPAID') : (total > 0 && paid >= total ? 'PAID' : 'DEPOSIT_PAID');
  var st = String(b.BookingStatus || '');
  if (st !== 'CANCELLED' && st !== 'COMPLETED') st = paid > 0 || noCharge ? 'CONFIRMED' : 'PENDING';
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
  if (f.category !== undefined && f.category !== String(b.EventCategory || '')) {
    if (!EVENT_TYPES[f.category]) throw new Error('Jenis event tidak dikenal.');
    out.EventCategory = f.category;
    out.EventType = EVENT_TYPES[f.category];
  }
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

// Ubah rincian invoice dari admin: jumlah anak hadir, qty/harga item, tambah/hapus item.
// p.items = daftar lengkap item booking (menggantikan yang lama). Item lama dikenali dari itemId.
function adminItems_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var b, changes = [];
  try {
    b = findBooking_(p.id);
    var cat = catalog_();
    var byAddon = {};
    cat.addons.forEach(function (a) { byAddon[a.id] = a; });
    var t = table_(TAB.ITEMS);
    var old = t.rows.filter(function (r) { return String(r.BookingId) === String(b.BookingId); });
    var oldById = {};
    old.forEach(function (r) { oldById[String(r.ItemId)] = r; });
    var list = (p.items || []).slice(0, 80);
    if (!list.length) throw new Error('Rincian tidak boleh kosong.');
    var keep = {};
    var norm = list.map(function (it) {
      var qty = Math.floor(num_(it.qty));
      var price = Math.round(num_(it.unitPrice));
      if (qty < 1) throw new Error('Qty minimal 1 (hapus item bila tidak dipakai).');
      if (qty > 5000 || price < 0) throw new Error('Qty atau harga tidak valid.');
      var o = oldById[String(it.itemId || '')];
      if (o) {
        keep[o.ItemId] = true;
        return { row: o, AddOnId: String(o.AddOnId), Category: String(o.Category), Name: clean_(it.name || o.Name, 150), Qty: qty, Unit: String(o.Unit || ''), UnitPrice: price,
          Amount: qty * price, Note: clean_(it.note === undefined ? o.Note : it.note, 200), Billing: String(o.Billing || 'INVOICE') };
      }
      var a = it.addOnId ? byAddon[it.addOnId] : null;
      if (it.addOnId && !a) throw new Error('Add-on tidak tersedia: ' + it.addOnId);
      var name = clean_(it.name || (a ? a.name : ''), 150);
      if (!name) throw new Error('Isi nama item.');
      return { row: null, AddOnId: a ? a.id : 'CUSTOM', Category: a ? a.category : 'Other', Name: name, Qty: qty, Unit: a ? a.unit : clean_(it.unit, 40),
        UnitPrice: price, Amount: qty * price, Note: clean_(it.note, 200), Billing: a && a.restaurant ? 'RESTAURANT' : 'INVOICE' };
    });
    // hapus item yang tidak ada lagi (dari bawah ke atas)
    old.filter(function (r) { return !keep[r.ItemId]; }).sort(function (x, y) { return y._row - x._row; }).forEach(function (r) {
      changes.push('hapus ' + r.Name);
      t.sh.deleteRow(r._row);
    });
    // baris bergeser setelah dihapus: baca ulang
    var fresh = {};
    table_(TAB.ITEMS).rows.forEach(function (r) { fresh[String(r.ItemId)] = r; });
    var seq = 0;
    table_(TAB.ITEMS).rows.forEach(function (r) { seq = Math.max(seq, parseInt(String(r.ItemId).replace(/\D/g, ''), 10) || 0); });
    norm.forEach(function (n) {
      if (n.row) {
        var cur = fresh[String(n.row.ItemId)];
        if (num_(cur.Qty) !== n.Qty || num_(cur.UnitPrice) !== n.UnitPrice || String(cur.Name) !== n.Name || String(cur.Note || '') !== n.Note) {
          changes.push(n.Name + ': ' + num_(cur.Qty) + ' x ' + num_(cur.UnitPrice) + ' -> ' + n.Qty + ' x ' + n.UnitPrice);
          setFields_(TAB.ITEMS, cur._row, { Name: n.Name, Qty: n.Qty, UnitPrice: n.UnitPrice, Amount: n.Amount, Note: n.Note });
        }
        n.ItemId = String(cur.ItemId);
      } else {
        seq++;
        n.ItemId = 'IT-' + ('00000' + seq).slice(-6);
        changes.push('tambah ' + n.Name + ' x' + n.Qty);
        append_(TAB.ITEMS, { ItemId: n.ItemId, BookingId: b.BookingId, AddOnId: n.AddOnId, Category: n.Category, Name: n.Name, Qty: n.Qty, Unit: n.Unit,
          UnitPrice: n.UnitPrice, Amount: n.Amount, Note: n.Note, Billing: n.Billing });
      }
    });
    var billed = norm.filter(function (n) { return n.Billing !== 'RESTAURANT'; });
    var sum = function (f) { return billed.filter(f).reduce(function (s, n) { return s + n.Amount; }, 0); };
    var total = sum(function () { return true; });
    var out = {
      AddOnsTotal: sum(function (n) { return n.Category !== 'package' && n.Category !== 'venue'; }),
      VenueFee: sum(function (n) { return n.Category === 'venue'; }),
      BookingTotal: total, UpdatedAt: txt_(now_())
    };
    var pkg = norm.filter(function (n) { return n.Category === 'package'; })[0];
    if (pkg) out.PackageUnitPrice = pkg.UnitPrice;
    if (p.children !== undefined && p.children !== '' && p.children !== null) {
      var kids = Math.floor(num_(p.children));
      if (kids < 0) throw new Error('Jumlah anak tidak valid.');
      if (kids !== num_(b.ChildrenCount)) changes.push('anak ' + num_(b.ChildrenCount) + ' -> ' + kids);
      out.ChildrenCount = kids;
    }
    if (num_(b.TotalPaid) <= 0) out.DepositRequired = Math.round(total * cat.depositPercent / 100);
    var cakeLine = norm.filter(function (n) { return n.AddOnId === cat.customCakeId || /CAKE-CUSTOM/i.test(n.AddOnId); })[0];
    if (String(b.CakeStatus) === 'PRICE_PENDING' && cakeLine && cakeLine.row && num_(cakeLine.row.UnitPrice) !== cakeLine.UnitPrice) out.CakeStatus = 'PRICE_FINAL';
    out.ExtraFoodBeverage = norm.filter(function (n) { return /food|beverage/i.test(n.Category); }).map(function (n) { return n.Name + ' x' + n.Qty; }).join(', ');
    setFields_(TAB.BOOKINGS, b._row, out);
    log_('admin', 'UPDATE_ITEMS', 'Booking', String(b.BookingId), (changes.join('; ') || 'tidak ada perubahan') + ' · total ' + total);
  } finally {
    lock.releaseLock();
  }
  var r = recompute_(b.BookingId);
  var sent = false;
  if (p.notify) {
    try { sent = adminInvoice_({ id: b.BookingId, send: true, updated: true }).sent; } catch (e) { log_('system', 'EMAIL_FAILED', 'Booking', String(b.BookingId), String(e)); }
  }
  return { result: r, sent: sent, changes: changes, detail: adminGet_(b.BookingId) };
}

/* ------------------------------------------------------------------ reminder pembayaran */

// Apa yang perlu dibayar: DP (bila belum lunas DP) atau sisa pembayaran.
function dueInfo_(b) {
  var total = b.total === null ? 0 : b.total;
  var deposit = b.deposit === null ? 0 : b.deposit;
  if (b.paid < deposit) return { kind: 'DEPOSIT', amount: deposit - b.paid, total: total };
  if (total > b.paid) return { kind: 'BALANCE', amount: total - b.paid, total: total };
  return { kind: 'NONE', amount: 0, total: total };
}

function reminderText_(b, cat) {
  var due = dueInfo_(b);
  var when = b.date + ' (' + (b.session === 'Morning' ? 'morning' : 'afternoon') + (b.time ? ' ' + b.time : '') + ')';
  var lines = ['Hi ' + (b.customer || 'there') + ',', ''];
  if (due.kind === 'DEPOSIT') {
    lines.push('This is a friendly reminder about your Mookiland birthday booking ' + b.id + ' on ' + when + '.');
    lines.push('');
    lines.push('Deposit due: ' + rp_(due.amount) + (b.hold && b.status === 'PENDING' ? ' – please transfer before ' + b.hold.slice(0, 16) + ' so we can keep your date and area reserved.' : '.'));
  } else {
    lines.push('Thank you for your deposit for booking ' + b.id + ' on ' + when + '.');
    lines.push('');
    lines.push('Remaining balance: ' + rp_(due.amount) + ' (total ' + rp_(due.total) + '), payable on the party day or by transfer before the event.');
  }
  lines.push('');
  lines.push(String(cat.bank || '').trim());
  lines.push('');
  lines.push('Please send the transfer receipt with your booking number to this WhatsApp number. Thank you!');
  lines.push('');
  lines.push('Mookiland Team');
  return { due: due, text: lines.join('\n') };
}

function sendReminderEmail_(b, cat, actor) {
  if (!b.email) throw new Error('Booking ini tidak punya email klien.');
  var r = reminderText_(b, cat);
  if (r.due.kind === 'NONE') throw new Error('Tidak ada tagihan yang belum dibayar.');
  var inv = null;
  try { inv = invoicePdf_(b.id); } catch (e) { inv = null; }
  var body = esc_(r.text).replace(/\n/g, '<br>').replace('this WhatsApp number', 'WhatsApp ' + esc_(cat.whatsapp));
  MailApp.sendEmail({
    to: b.email,
    subject: (r.due.kind === 'DEPOSIT' ? 'Reminder: deposit for your Mookiland birthday booking ' : 'Reminder: balance for your Mookiland birthday booking ') + b.id,
    htmlBody: '<p style="font-family:Arial,sans-serif;font-size:14px">' + body + '</p>' + (inv ? '<p style="font-family:Arial,sans-serif;font-size:12px;color:#666">Your latest invoice is attached.</p>' : ''),
    name: cat.business,
    attachments: inv ? [inv.blob] : []
  });
  log_(actor, 'REMINDER_EMAIL', 'Booking', b.id, r.due.kind + ' ' + r.due.amount + ' to ' + b.email);
  return r;
}

// Admin: kirim reminder lewat email, atau siapkan pesan WhatsApp (dikirim admin lewat WhatsApp sendiri).
function adminReminder_(p) {
  var b = bookingOut_(findBooking_(p.id));
  var cat = catalog_();
  if (p.channel === 'wa') {
    var r = reminderText_(b, cat);
    var phone = String(b.whatsapp || '').replace(/\D/g, '').replace(/^0/, '62');
    log_('admin', 'REMINDER_WA', 'Booking', b.id, r.due.kind + ' ' + r.due.amount + (phone ? ' to +' + phone : ''));
    return { channel: 'wa', phone: phone, text: r.text, due: r.due, url: 'https://wa.me/' + phone + '?text=' + encodeURIComponent(r.text), detail: adminGet_(b.id) };
  }
  var res = sendReminderEmail_(b, cat, 'admin');
  return { channel: 'email', sent: true, to: b.email, due: res.due, detail: adminGet_(b.id) };
}

// Pemicu harian (dipasang oleh setup): email reminder DP otomatis, sekali per booking.
function reminderJob() {
  var s = settings_();
  if (!bool_(s.AutoDepositReminder === undefined ? 'TRUE' : s.AutoDepositReminder) || !bool_(s.SendEmails === undefined ? 'TRUE' : s.SendEmails)) return 0;
  var after = num_(s.ReminderAfterHours || 24) * 3600 * 1000;
  var cat = catalog_();
  var now = now_();
  var sentBefore = {};
  table_(TAB.LOG).rows.forEach(function (r) { if (String(r.Action) === 'REMINDER_EMAIL') sentBefore[String(r.EntityId)] = true; });
  var n = 0;
  table_(TAB.BOOKINGS).rows.forEach(function (row) {
    var b = bookingOut_(row);
    if (b.source === 'LEGACY_GOOGLE_FORM' || b.status !== 'PENDING' || !b.email || b.paid > 0 || !b.total || sentBefore[b.id]) return;
    if (!b.hold || b.hold <= now) return; // masa tahan sudah habis: tindak lanjut manual
    var created = new Date(String(b.createdAt).replace(' ', 'T') + '+08:00').getTime();
    if (!created || Date.now() - created < after) return;
    try { sendReminderEmail_(b, cat, 'system'); n++; } catch (e) { log_('system', 'EMAIL_FAILED', 'Booking', b.id, 'reminder: ' + e); }
  });
  return n;
}

function installReminderTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'reminderJob') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('reminderJob').timeBased().everyDays(1).atHour(9).inTimezone(TZ).create();
}

// Logo Mookiland Bali untuk invoice (PNG, 300 px)
var INVOICE_LOGO = 'data:image/png;base64,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';
