# NEXUS 1.2.0 — Store listing kit

Everything needed to publish on the **Chrome Web Store** and **Microsoft Edge Add-ons**. Copy the texts below into the developer dashboard fields.

## Files

| File | Use |
|---|---|
| `../nexus-1.2.0.zip` | Upload as the package (manifest.json at the root) |
| `icon-128.png` | Store icon (128×128) |
| `promo-small-440x280.png` | Small promo tile (required by Chrome Web Store) |
| `screenshot-1-overview-fa.png` … `screenshot-5-tasks-fa.png` | Screenshots, 1280×800 (upload 1–5) |
| `PRIVACY-POLICY.md` | Host it publicly (e.g. a GitHub Gist or Google Doc) and paste the URL |

## Basic info

- **Name:** NEXUS – Personal Control Center  (Persian locale shows: NEXUS – مرکز کنترل شخصی)
- **Category:** Productivity → Tools (Chrome) / Productivity (Edge)
- **Languages:** English, Persian (فارسی)
- **Visibility for friends only:** choose **Unlisted** — only people with the link can install it, and it still auto-updates.

## Short description (≤132 chars)

- EN: `Track domains, hosting, subscriptions and licenses with expiry reminders, a renewal calendar and tasks. 100% local.`
- FA: `مدیریت دامنه، هاست، اشتراک و لایسنس با یادآور انقضا، تقویم شمسی تمدید و مدیریت کارها. کاملاً محلی و آفلاین.`

## Detailed description — English

NEXUS is a personal control center for everything you renew: domains, hosting, VPS, cloud accounts, SaaS subscriptions, software licenses, SSL certificates and more.

• Expiration tracking — automatic countdowns and clear status: yellow at 30 days, red at 3 days, expired after.
• Smart reminders — desktop notifications 30, 15, 7, 3 and 1 days before and on the day; custom schedules per item, snooze, no duplicates. Works even when NEXUS is closed.
• Renewal calendar — month, week and agenda views with an upcoming timeline. Supports the Gregorian and Shamsi (Jalali) calendars.
• Tasks — today / upcoming / inbox, priorities, subtasks, recurring tasks and tasks linked to assets, with automatic renewal tasks.
• Providers — keep registrars and hosts with their dashboard and support links and every asset you have with them.
• Custom categories and fields — text, number, date, URL, email, dropdown, checkbox, password and more.
• Command palette (Ctrl/⌘ K), global search, quick access pins, activity history, bulk editing.
• English and Persian interface with full right-to-left layout; light and dark mode.
• Private by design — all data stays on your device. No account, no servers, no tracking. Optional AES-256 encryption for passwords. JSON/CSV export and import.

## Detailed description — فارسی

NEXUS مرکز کنترل شخصی شما برای هر چیزی است که تمدید می‌شود: دامنه، هاست، سرور مجازی، حساب‌های ابری، اشتراک‌ها، لایسنس نرم‌افزار، گواهی SSL و غیره.

• پیگیری انقضا — شمارش معکوس خودکار و وضعیت واضح: زرد از ۳۰ روز مانده، قرمز از ۳ روز مانده و منقضی‌شده بعد از آن.
• یادآور هوشمند — اعلان دسکتاپ ۳۰، ۱۵، ۷، ۳ و ۱ روز قبل و روز انقضا؛ برنامه‌ی سفارشی برای هر مورد، تعویق و بدون اعلان تکراری. حتی وقتی NEXUS بسته است کار می‌کند.
• تقویم تمدید — نمای ماهانه، هفتگی و برنامه با خط زمانی رویدادهای پیش رو. پشتیبانی کامل از تقویم شمسی و میلادی.
• مدیریت کارها — امروز / پیش رو / صندوق ورودی، اولویت، زیرکار، کارهای تکراری و کارهای مرتبط با دارایی، همراه با ساخت خودکار کار تمدید.
• ارائه‌دهندگان — ثبت‌کننده‌ها و هاستینگ‌ها را با لینک داشبورد و پشتیبانی و همه‌ی دارایی‌هایتان نزد آن‌ها یک‌جا داشته باشید.
• دسته‌بندی و فیلد سفارشی — متن، عدد، تاریخ، آدرس، ایمیل، فهرست کشویی، چک‌باکس، رمز عبور و…
• پالت دستورات (Ctrl+K)، جستجوی سراسری، دسترسی سریع، تاریخچه‌ی فعالیت و ویرایش گروهی.
• رابط کاربری فارسی و انگلیسی با چیدمان کامل راست‌به‌چپ؛ حالت روشن و تاریک.
• حریم خصوصی کامل — همه‌ی داده‌ها روی دستگاه خودتان می‌ماند. بدون حساب کاربری، بدون سرور، بدون ردیابی. رمزنگاری اختیاری AES-256 برای رمزهای عبور. خروجی و ورود JSON/CSV.

## Privacy practices tab (Chrome Web Store)

**Single purpose:**
> Track expiration dates of the user's digital assets (domains, hosting, subscriptions, licenses) and related tasks, and remind the user before they expire.

**Permission justifications:**
- `storage` — Saves the user's assets, tasks and settings locally on their device.
- `alarms` — Periodically checks expiration dates and schedules task reminders so notifications work while the extension UI is closed.
- `notifications` — Shows desktop reminders before an asset expires or when a task reminder is due.

**Remote code:** No, I am not using remote code. (All code is bundled; the extension makes no network requests.)

**Data usage:** Do **not** check any data type — the extension does not collect or transmit user data. Then check all three certifications:
- I do not sell or transfer user data to third parties…
- I do not use or transfer user data for purposes unrelated to the item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** paste the public link to `PRIVACY-POLICY.md` (fill in your email first).

## Publishing steps

### Chrome Web Store
1. Register at <https://chrome.google.com/webstore/devconsole> (one-time US$5 fee; needs an international card).
2. **New item** → upload `nexus-1.2.0.zip`.
3. **Store listing:** paste the descriptions, upload icon, promo tile and screenshots, choose category and language.
4. **Privacy practices:** paste the texts above.
5. **Distribution:** visibility **Unlisted** (for friends) or **Public**; regions: all.
6. **Submit for review** (usually a few days). Share the store link with friends.

### Microsoft Edge Add-ons (free)
1. Register at <https://partner.microsoft.com/dashboard/microsoftedge> (free).
2. **Create new extension** → upload the same zip → fill the listing with the same texts and images → submit.

### Sending a zip directly (no store)
Friends unzip `nexus-1.2.0.zip` into a folder, open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and pick that folder. No automatic updates in this mode.

## Releasing an update later

1. Increase `"version"` in `public/manifest.json` (and `package.json`), e.g. `1.1.1`.
2. Run `npm run release` → new `release/nexus-<version>.zip`.
3. In the developer dashboard: **Package → Upload new package** → submit. Installed copies update automatically after approval.
