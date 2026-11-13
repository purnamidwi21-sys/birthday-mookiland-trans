# Mookiland Birthday – Transition Booking App

Replaces the old Google Form + Excel invoice. Every booking is written to the
**Mookiland Birthday Package Trans** Google Sheet, which also holds all 545
migrated legacy bookings (IDs `LG-…`), so the slots booked under the old system
stay blocked and the historical report keeps working.

```
apps-script/Code.gs   backend (Google Apps Script, bound to the Trans sheet)
docs/                 frontend (GitHub Pages)
  index.html          public booking form (EN / ID)
  admin.html          admin page (bookings, payments, slot blocks)
  config.js           the single setting: the Web App URL
```

## Installation (one-off)

1. **Backend**
   - Open the Trans sheet, then go to **Extensions → Apps Script**.
   - Replace the contents of `Code.gs` with `apps-script/Code.gs`, then save.
   - Choose the `setup` function and click **Run**, then approve the permissions.
     It creates the `BookingItems` and `Holidays` tabs, adds the new keys in
     `Settings`, and sets the default admin password `mooki2026`.
2. **Deploy**
   - Go to **Deploy → New deployment → Web app**.
   - Set *Execute as: Me* and *Who has access: Anyone*.
   - Copy the URL that ends in `/exec`.
3. **Frontend**
   - Paste that URL into `docs/config.js`:
     `window.API_URL = 'https://script.google.com/macros/s/…/exec';`
   - Commit and push.
4. **GitHub Pages**
   - Go to **Settings → Pages → Deploy from a branch**.
   - Set *main* / `/docs`.
5. **Change the admin password**
   - Open `admin.html`, log in with `mooki2026`, then use **Ganti password**.

When you change `Code.gs` later:
1. Paste the new code and save.
2. Run `setup` once. It adds any new tabs or columns and asks for new permissions (for example Google Drive for cake photos).
3. Go to **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The URL stays the same.

## Custom cake
- When a client adds the custom cake, the form asks for:
  - type (layered / non layered)
  - flavour (required)
  - filling and finishing
  - a design reference photo
  - design notes
- The flavour, filling and finishing lists come from the `CakeOptions` tab. Edit that tab to change them, and set `Active` to `FALSE` to hide an option.
- Photos are resized in the browser and saved to the Drive folder *Mookiland Birthday – Cake References* of the script owner. Each file is named after the booking number.
- The custom cake price is a starting price, so the client sees an *estimated total*. The booking gets `CakeStatus = PRICE_PENDING`.
- Once the cake maker confirms the price, the admin enters it in the booking detail (*Harga final cake*). The admin page then:
  - updates the cake line and the total;
  - recalculates the deposit, if nothing has been paid yet;
  - sets `CakeStatus = PRICE_FINAL`;
  - can email the new total to the client.

## Settings (`Settings` tab)

| Key | Purpose |
|---|---|
| `MorningStartTimes` / `AfternoonStartTimes` | start times available per session |
| `MinDaysAhead` | how many days ahead an online booking must be made (admins are exempt) |
| `DepositPercent`, `SlotHoldHours` | deposit amount and how long an unpaid slot is held |
| `BankAccount` | bank details shown to the client after booking |
| `SendEmails` | `TRUE` / `FALSE` for confirmation emails |
| `BookingFormOpen` | `FALSE` closes the public form |
| `AdminEmail` | address that receives notifications of new bookings |

Public holidays (weekend prices) are listed in the `Holidays` tab, which should
be filled in each year.

## Pricing rules
- Prices include 10% tax.
- Weekend price applies on Saturday, Sunday and public holidays.
- Billed children = max(children, minimum number of children).
- Total = price per child × billed children + area fee + add-ons.
- Deposit = `DepositPercent` × total.
- A `PENDING` booking stops holding its slot after `HoldExpiresAt` if no
  payment has been made. Admins can extend the hold from the detail screen.

## Invoice
- **Proforma invoice:** when a client books, the confirmation email includes the proforma invoice as a PDF attachment.
  - The invoice is in English and follows the old Excel PROFORMA INVOICE layout.
  - The invoice number is `INV-<booking no.>`.
- **Admin page:** the booking detail has two buttons, **Unduh invoice (PDF)** and **Kirim invoice ke klien**. Both always use the latest data:
  - payments (deposit, 2nd payment, final payment);
  - the final custom cake price;
  - changes to the total.
- **After full payment:** the invoice title becomes INVOICE and it carries a PAID stamp.
- **Updated cake price:** the email sent with a new cake price includes the updated invoice.
- **Settings (`Settings` tab):**
  - `InvoiceTaxNote` is the tax note. The default text is: "The birthday package is not subject to tax. Prices of extras include 10% tax."
  - `InvoiceFooter` is the line under the Mookiland name.
  - Bank details come from `BankAccount`.

## Extra makanan & minuman (dibayar di restoran)

Add-on dengan kategori di setting **RestaurantCategories** (default: `Food & Beverage, Food & Beverage (Adults)`, misalnya cold beer) dicatat sebagai **info saja**:

- tetap tampil di form booking, email, invoice, dan halaman admin (bagian "At the restaurant");
- **tidak** masuk total booking, DP, sisa bayar, atau tabel tagihan invoice. Item ini dipesan dan dibayar di restoran sebagai penjualan biasa;
- di tab BookingItems, kolom **Billing** berisi `RESTAURANT` atau `INVOICE`. Kolom ini ditambahkan otomatis saat `setup` dijalankan.

Untuk mengubah kategori yang dibayar di restoran, edit nilai RestaurantCategories di tab Settings (pisahkan dengan koma).

## Jenis event: Birthday Package atau Regular Ticket

- **Halaman admin:** setiap booking diberi label jenis event (Package / Regular / lainnya). Ada filter "Semua jenis event", dan di detail booking ada pilihan **Jenis event** di bagian "Ubah booking". Saat jenis event diubah, total tagihan tidak dihitung ulang otomatis.
- **Booking baru dari admin** (`index.html?admin=1`): pilih jenis event di bagian atas form.
  - **Birthday Package:** harga per anak, minimum anak, dan menu buffet berlaku seperti biasa.
  - **Regular Ticket:** tamu membayar tiket masuk reguler di gerbang. Yang ditagih hanya biaya area dan extra. Tidak ada harga paket, minimum anak, atau menu buffet.
  - Jika total Regular Ticket Rp 0, booking langsung **Terkonfirmasi** dengan status bayar "Tanpa tagihan". Booking seperti ini tidak punya masa tahan slot dan emailnya tidak meminta DP.
- **Form online untuk klien** tetap hanya untuk Birthday Package.
- **Laporan** tetap menghitung Option #2 (Birthday Package) saja.

## Mengubah invoice (jumlah anak hadir, tambah item, harga)

Di detail booking, bagian **Rincian**, klik **✎ Ubah rincian / jumlah anak**. Di sana admin bisa:

- mengisi **Jumlah anak hadir**. Qty paket ikut menyesuaikan, dan minimum anak tetap berlaku untuk Birthday Package;
- mengubah qty atau harga setiap item, termasuk harga cake custom;
- menghapus item, atau menambah item dari katalog maupun item lain dengan nama dan harga manual.

Total baru langsung terlihat sebelum disimpan. Setelah disimpan:

- Total dihitung ulang. DP ikut dihitung ulang bila belum ada pembayaran.
- Perubahan dicatat di Riwayat.
- Bila dicentang, invoice terbaru (subjek "Updated invoice") dikirim ke email klien.

Booking lama yang belum punya rincian bisa dibuatkan rincian dengan tombol **Buat rincian invoice**. Rincian akan diisi otomatis dari data formulir lama:

- **Paket:** jumlah anak × harga weekday/weekend saat ini, dengan minimum anak tetap berlaku.
- **Area:** biaya upgrade area.
- **Cake:** own cake, favorite cake sesuai ukurannya, atau custom cake.
- **Dekorasi, pinata, hiburan, dan workshop:** dipakai harga yang tertulis di formulir lama bila ada. Kalau tidak tertulis, dipakai harga katalog.
- **Diskon:** dimasukkan sebagai baris diskon.

Teks yang tidak dikenali ditampilkan sebagai daftar "cek manual". Periksa hasilnya, sesuaikan bila perlu, lalu simpan.

## Reminder pembayaran (DP / sisa)

Di detail booking, bagian **Reminder pembayaran**:

- **Kirim reminder email:** mengirim email berisi jumlah DP (atau sisa pembayaran), batas waktu, rekening bank, dan invoice terbaru (PDF).
- **Reminder WhatsApp:** membuka WhatsApp dengan pesan yang sudah terisi ke nomor klien. Admin memeriksa pesan lalu menekan kirim sendiri.

Setiap reminder tercatat di Riwayat.

**Reminder otomatis:** setiap pagi pukul 09:00, booking yang sudah 1 hari belum membayar DP dan masa tahan slotnya belum habis akan dikirimi email reminder satu kali. Pemicu harian ini dipasang oleh `setup`. Untuk mematikannya, ubah setting `AutoDepositReminder` menjadi FALSE. Jeda waktunya diatur di `ReminderAfterHours`.
