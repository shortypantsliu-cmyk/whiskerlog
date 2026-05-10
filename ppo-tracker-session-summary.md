# Cat Care Tracker — Session Summary
## Design & Architecture Decisions
### May 4, 2026

---

## 1. App Identity

- **Working name:** "My Cats" (placeholder — final name TBD)
- **Tagline / subtitle:** "Pip · Parker · Ollie · v0.1"
- **Version display:** Subtitle line in header, format `v0.1`
- **Version constant:** Single `APP_VERSION` constant at top of `app.jsx`
- **Version in blob data:** Each saved blob includes `appVersion` field for future migration handling
- **Versioning scheme:**
  - v0.1 = prototype/design phase (current)
  - v1.0 = launch: Cats section live, Blobs wired up
  - v1.1 = post-launch polish (export, etc.)
  - v2.0 = Diary section added

---

## 2. Design Direction

- **Style:** Version B — warm & personal. NOT clinical or generic SaaS.
- **Color palette:** Terracotta/amber (`#C96A3A`) primary, cream background (`#FDF8F0`), warm card borders
- **Typography:** Nunito (Google Fonts) — rounded, friendly, 400/600/700/800 weights
- **Card style:** White rounded cards (`border-radius: 16px`), warm shadow, subtle amber border
- **Status colors:** Green (on schedule), Amber (due soon), Red (overdue)
- **Reference file:** `ppo-tracker-v2.html` — the working prototype with all design decisions applied

---

## 3. Navigation

### Phone (primary target):
- **Bottom nav bar** with two tabs: 🐾 CATS and 📓 DIARY
- Active tab: terracotta; inactive: muted warm gray
- Safe area inset respected for iPhone home indicator

### iPad / macOS (secondary):
- **Left sidebar** replaces bottom nav at viewport widths ≥ 700px
- CSS media query switches layout — one codebase
- Sidebar: cat names listed vertically, diary below, settings/export at bottom

### Cat selection:
- Three equal tappable cards (Pip / Parker / Ollie) with avatar photo, name, breed descriptor
- Active card: terracotta border + warm background highlight
- Sticky below header on phone

---

## 4. App Icon & Home Screen

- **Header icon:** 🐾 emoji (placeholder — custom 3-paw icon planned for later)
- **Bottom nav icon:** 🐾 emoji
- **Custom icon plan:** User will design a 3-paw icon externally; will be incorporated as SVG or PNG with transparent background
- **Home screen (PWA) meta tags included:**
  - `apple-mobile-web-app-capable`
  - `apple-mobile-web-app-status-bar-style: black-translucent`
  - `apple-mobile-web-app-title: My Cats`
  - `apple-touch-icon` generated at runtime via canvas (terracotta bg + 🐾 emoji, 180×180px)
- **When custom icon is ready:** Replace canvas drawing with real PNG; meta tag infrastructure unchanged

---

## 5. The Three Cats

| Cat | Breed | Size | Personality |
|-----|-------|------|-------------|
| Pip | Brown & White Short-hair Tabby | Small | Biggest personality |
| Parker | Brown Short-hair Tabby | Medium | Sweetest, gentlest |
| Ollie | White Long-hair | Large | Nervous, lovable one-on-one |

- Each cat has an individual profile with: photo, name, breed, current weight
- Photos stored as resized base64 (max ~400px wide before encoding)
- Photo upload via `+` button on avatar; persists to localStorage (prototype) / Blobs (production)

---

## 6. Features Per Cat (Cats Section — v1.0 scope)

### Tracked events:
| Event | Notes |
|-------|-------|
| Flea medicine | Every 4–6 weeks; individual schedules per cat |
| Nail trim | ~every 4 weeks; no historical data to import |
| Vet visits | Checkups, vaccines, teeth cleaning; 1–2/year per cat |
| Weight | Home scale or vet; 25–40 historical entries per cat |
| Health journal | Dated entries per cat, editable & deletable |

### Status cards (tappable):
- Flea medicine and nail trim show last date + color-coded due status
- Tapping opens a bottom sheet with: log form (date input) + full history list

### Bottom sheets (tap-to-expand):
- Flea medicine: log form + treatment history
- Nail trim: log form + trim history  
- Vet visits: log form (date, type, notes) + visit history
- Weight: weight chart (SVG line chart) + log form + history
- Health notes: editable cat description + dated journal entries (add/delete)

### Vet visit JSON schema (v1.0):
```json
{
  "date": "2025-03-05",
  "type": "Annual Checkup",
  "notes": "Mild anxiety noted"
}
```
Note: `pdfKey` field intentionally omitted at launch — added later without migration.

---

## 7. Health Journal (Per Cat)

- **Two-part structure:**
  1. Permanent cat description (editable in app)
  2. Append journal: dated entries, newest first
- **Entries:** Editable and deletable
- **No tags** (decided against — not useful without search)
- **Storage:** Part of each cat's blob

---

## 7a. PDF Attachments for Vet Visits (post-launch — deferred)

**Not a launch feature.** Fully additive when ready — no existing data or functions change.

### Use case:
- Scanned physical vet reports (always PDF, not photos)
- Attached optionally per vet visit entry

### Planned implementation (when built):
- **Storage:** Separate blob per PDF, key pattern `pdf_{catid}_{date}` (e.g. `pdf_pip_20250305`)
- **Vet visit JSON addition:** Optional `pdfKey` field — existing entries without it are unaffected
- **Upload:** Client-side compression via **pdf-lib** targeting ~500KB (scanned pages typically 2–4MB at 300 DPI, ~500KB at 150 DPI — still fully legible on screen)
- **Fallback:** If compressed file still exceeds 4MB, app prompts user to paste a Google Drive link instead (stored as `pdfUrl` field)
- **View:** Fetch blob → object URL → opens in new browser tab
- **New functions needed:** `save-pdf.js` and `get-pdf.js` (no changes to existing functions)

### Why it's easy to add later:
1. Add `pdfKey` / `pdfUrl` optional fields to vet visit schema — zero migration needed
2. Add two new Netlify Functions — touch nothing existing
3. Add optional UI in vet visit bottom sheet — "Attach PDF" button + "View PDF" link

- **Two-part structure:**
  1. Permanent cat description (editable in app)
  2. Append journal: dated entries, newest first
- **Entries:** Editable and deletable
- **No tags** (decided against — not useful without search)
- **Storage:** Part of each cat's blob

---

## 8. Diary Section (v2.0 — deferred)

- **Purpose:** Household-level daily journal covering all three cats together
- **Navigation:** Second tab in bottom nav (📓 DIARY); shows "Coming in v2.0" placeholder at launch
- **Entry format:** Date-stamped, free-form text, multi-paragraph
- **Historical import:** Bulk paste from iOS Notes — parser detects monthly subheadings + date lines
  - iOS Notes structure: monthly subheadings, entries separated by blank lines, date headers per entry
  - Parser extracts entries in one operation (not one-by-one copy-paste)
- **iPad/Mac UI:** Two-panel layout — entry list left, editor right (keyboard-friendly)
- **Storage:** Single `diary` blob, array of `{date, text}` objects
- **Deferred because:** Not needed for launch; self-contained; existing Notes workflow is fine for now

---

## 9. Data Storage — Netlify Blobs

- **Why Blobs:** Two users (one primary logger, one reader); already used in Astro Diary and MySofa; free tier generous; no new infrastructure
- **Two users:** One iPhone each + Mac/Safari; unlikely to write simultaneously → no conflict handling needed
- **Blob structure:** One blob per cat (`cat_pip`, `cat_parker`, `cat_ollie`) + one `diary` blob later
- **Schema per cat blob:**
```json
{
  "appVersion": "1.0",
  "name": "Pip",
  "photo": "base64...",
  "flea": [{ "date": "2025-04-01" }],
  "nails": [{ "date": "2025-04-05" }],
  "vet": [{ "date": "2025-03-05", "type": "Annual Checkup", "notes": "..." }],
  "weight": [{ "date": "2025-04-10", "lbs": 8.4, "src": "Home" }],
  "journal": [{ "date": "2025-04-10", "text": "..." }]
}
```
- **Dates:** Always ISO format `YYYY-MM-DD` — non-negotiable
- **Photos:** Resized to ~400px wide in browser before base64 encoding (keeps blobs small, avoids 4.5MB Netlify Function limit)
- **Netlify Function payload limit:** 4.5MB (binary/base64) — photo resize is the mitigation

---

## 10. Netlify Functions (API Layer)

Two simple functions, same pattern as Astro Diary `/api/data`:

```
GET  /api/get-cat?id=pip     → reads cat_pip blob, returns JSON
POST /api/save-cat           → body: { id, data }, writes blob
```

- Auth: shared secret token (same approach as Astro Diary — private family app)
- Both functions needed before any real data can be saved

---

## 11. Data Import Strategy

| Data | Method | When |
|------|--------|------|
| Weight (25–40 entries/cat) | Excel import via app | Before launch |
| Vet visits (~20–30 total) | Hand entry in app | Before launch |
| Vaccines/shots | Hand entry in app | Before launch |
| Flea medicine history | Hand entry or clean start | Before/after launch |
| Nail trims | Clean start | After launch |
| Diary (125+ entries) | Bulk paste import | v2.0 |

- **Weight import format:**
```
Cat    | Date       | Weight | Source
Pip    | 2024-08-20 | 8.4    | Home
Parker | 2024-08-20 | 10.2   | Home
```
- Weight data comes from iOS Notes tables → paste into Excel → import CSV/XLSX
- Importer merges by cat name; reusable for other bulk imports later

---

## 12. Notifications / Reminders

### Phase 1 (launch):
- Visual due-soon indicators only (already in prototype)
- Color-coded status on each care card (green/amber/red)
- "Due soon" summary banner at top of Cats screen showing anything due within 7 days across all cats

### Phase 2 (post-launch):
- Email reminders via Netlify scheduled function
- Reads cat blobs, calculates due dates, sends email when treatment due within N days
- Email service: Resend or SendGrid (free tier)
- **Phase 1 prep for Phase 2:** Store notification preferences in a settings blob from day one:
  - Email address(es)
  - Days-ahead warning threshold
  - Which events to remind about
- No push notifications (too complex for a personal web app)

---

## 13. Tech Stack & Development Environment

Identical to Astro Diary and MySofa — no new tools:

| Layer | Choice |
|-------|--------|
| Framework | React, single-file JSX (`app.jsx`) |
| Local dev | Vite (`npx vite`) |
| Deployment | GitHub → Netlify auto-deploy |
| Storage | Netlify Blobs via Netlify Functions |
| Fonts | Google Fonts (Nunito) |
| Auth | Shared secret token (same as Astro Diary) |

### Project structure:
```
[app-name]/
  app.jsx
  index.html
  package.json
  vite.config.js
  netlify.toml
  netlify/
    functions/
      get-cat.js
      save-cat.js
```

---

## 14. Launch Definition

**Launch = the app is the primary record for all three cats.**

### Launch checklist:
- [ ] Netlify project + GitHub repo created
- [ ] Blobs API functions working (get-cat, save-cat)
- [ ] Prototype migrated to live React/JSX app
- [ ] Weight data imported from Excel
- [ ] Historical vet visits and vaccines hand-entered
- [ ] Photos uploaded for all three cats
- [ ] Both users have app on iPhone home screen
- [ ] Both users can read and write data

### Explicitly NOT required for launch:
- Export
- Email reminders
- Diary section
- iPad/Mac sidebar layout
- Every edge case handled

---

## 15. Prototype Reference

The working HTML prototype (`ppo-tracker-v2.html`) demonstrates:
- Full visual design with all color/font/layout decisions
- Cat selector with photo upload
- Tappable cards with bottom sheets
- Weight SVG line chart
- Health journal with add/delete
- Bottom nav with Cats/Diary tabs
- Version display in subtitle
- Home screen PWA meta tags + canvas icon generation

This file is the **visual specification** for the real JSX app build — not the starting point for code.

---

---

# Prompt for Next Conversation

```
I'm building a cat care tracking app called "My Cats" (final name TBD) for 
tracking health events for my 3 cats: Pip, Parker, and Ollie. We've completed 
a full design and architecture session, and I have a working HTML prototype 
called ppo-tracker-v2.html that defines all visual decisions.

I want to start building the real app now. Please refer to the session summary 
document I'm uploading for all decisions already made. The summary covers: 
design direction, navigation, data storage (Netlify Blobs), tech stack, 
features, and launch definition.

Today's goal: scaffold the project from scratch.

Tech stack (identical to my Astro Diary app):
- React, single-file JSX (app.jsx)
- Vite for local development
- GitHub + Netlify auto-deploy
- Netlify Functions for Blobs API (get-cat.js, save-cat.js)
- Shared secret token auth (same pattern as Astro Diary)

Note: PDF attachments for vet visits are planned but explicitly post-launch.
Do not build PDF upload/storage at this stage. Vet visit entries have
date, type, and notes fields only for now.

Please start by:
1. Providing the exact file structure for the project
2. The content of each scaffold file: index.html, package.json, 
   vite.config.js, netlify.toml
3. The two Netlify Functions: get-cat.js and save-cat.js
4. A starter app.jsx that renders the correct header (🐾 emoji, app title, 
   version v0.1 in subtitle), the three cat selector cards (Pip/Parker/Ollie), 
   and the bottom nav (Cats/Diary tabs) — wired to the live Blobs API with 
   loading and error states, but placeholder content sections for now.

The visual design spec is in ppo-tracker-v2.html — match colors, fonts, 
spacing, and component patterns from that file exactly.

I'll upload both the session summary and ppo-tracker-v2.html to this 
conversation before we start.
```
