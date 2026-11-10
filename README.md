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
