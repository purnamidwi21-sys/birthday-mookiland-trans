// Fungsi bersama: panggil API Apps Script, format angka & tanggal, escape teks
window.MK = (function () {
  async function api(action, payload, token) {
    const url = window.API_URL;
    if (!url || /PASTE_WEB_APP_URL/.test(url)) throw new Error('API_URL belum diisi di config.js');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // tanpa preflight CORS
      body: JSON.stringify({ action, payload: payload || {}, token: token || undefined })
    });
    let out;
    try { out = await res.json(); } catch (e) { throw new Error('Server tidak menjawab dengan benar (' + res.status + ')'); }
    if (!out.ok) throw new Error(out.error || 'Terjadi kesalahan');
    return out.data;
  }
  const rp = (n) => (n == null || isNaN(n) ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MON = { en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] };
  const DOW = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], id: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] };
  const MONTHS = { en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'] };
  function dateLabel(iso, lang) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00Z');
    if (isNaN(d)) return iso;
    lang = lang || 'id';
    return DOW[lang][d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MON[lang][d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }
  const waLink = (num, text) => 'https://wa.me/' + String(num || '').replace(/\D/g, '') + (text ? '?text=' + encodeURIComponent(text) : '');
  return { api, rp, esc, dateLabel, waLink, MON, DOW, MONTHS };
})();
