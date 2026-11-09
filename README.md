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

When you change `Code.gs` later, go to **Deploy → Manage deployments → Edit →
New version** so the URL stays the same.

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
