# WhiskerLog 🐾

A private family app for tracking the health and care of three cats — Pip, Parker, and Ollie. Built as a mobile-first progressive web app, added to the iPhone home screen by both users.

---

## What it tracks

**Per cat**
- Flea medicine — logged per cat with a shared date, green/amber/red status badge
- Nail trims — same pattern
- Vet visits — date, visit type, optional notes, overdue warnings for Annual Checkup and Vaccine
- Weight — chart, history table, source toggle (Home / Vet) per entry
- Health journal — dated free-text entries, collapsible, inline edit

**Household**
- Litter box refresh — shared across all cats, green < 5 weeks, amber 5–8 weeks, red > 8 weeks

**Settings**
- Export all data as a JSON backup
- Import from a JSON backup (full restore)
- Import weight history from an Excel file (see format below)
- Clear all data

---

## Stack

| Layer | Tool |
|---|---|
| UI | React (single-file JSX, no build-time components) |
| Dev server | Vite |
| Hosting | Netlify |
| Data | Netlify Blobs (via Netlify Functions) |
| Image crop | Cropper.js (CDN) |
| Excel parsing | SheetJS (CDN, loaded on demand) |

---

## Running locally

Requires [Netlify CLI](https://docs.netlify.com/cli/get-started/).

```bash
npm install -g netlify-cli
cd whiskerlog
netlify dev
```

`netlify dev` runs the Vite dev server and the Netlify Functions together on port 8888. It connects to the real Netlify Blobs store, so local changes read and write live data.

---

## Deploying

Push to the `main` branch on GitHub. Netlify auto-deploys on every push. No manual deploy step needed.

---

## Environment variables

Set these in the Netlify dashboard under **Site settings → Environment variables**. They are also needed locally in a `.env` file at the project root.

| Variable | Where it's used |
|---|---|
| `VITE_BLOB_TOKEN` | Client-side auth header sent with every blob read/write |
| `NETLIFY_SITE_ID` | Netlify Functions — identifies the Blobs store |
| `NETLIFY_TOKEN` | Netlify Functions — authenticates blob operations |

`.env` format:
```
VITE_BLOB_TOKEN=your_token_here
NETLIFY_SITE_ID=your_site_id_here
NETLIFY_TOKEN=your_netlify_token_here
```

---

## Netlify Functions

Two functions handle all data persistence:

| Function | Purpose |
|---|---|
| `netlify/functions/get-cat.js` | GET a blob by ID |
| `netlify/functions/save-cat.js` | POST (upsert) a blob by ID |

Valid blob IDs: `pip`, `parker`, `ollie`, `household`

All requests require the `x-blob-token` header matching `VITE_BLOB_TOKEN`.

---

## Weight import format

To bulk-import historical weight data, prepare an Excel file (`.xlsx`) with this layout:

| Date | Pip | Parker | Ollie |
|---|---|---|---|
| 2024-01-15 | 12.4 | 14.2 | 19.8 |
| 2024-02-01 | | 14.4 | |

- Header row required, column names must match exactly (case-insensitive)
- Date column: any standard date format that Excel recognises
- Weight columns: lbs, one decimal place recommended
- Sparse rows are fine — blank cells are skipped
- Duplicate dates are skipped automatically
- All imported entries default to source `Home`; individual entries can be toggled to `Vet` in the weight history table

Import via **Settings → Import Weight Data**.

---

## Data backup and restore

**Export:** Settings → Export All Data → downloads `whiskerlog-backup-YYYY-MM-DD.json`

**Import:** Settings → Import Data → select a backup file → confirm. Replaces all current data including household.

The JSON structure:
```json
{
  "exportDate": "2026-05-14",
  "appVersion": "1.0",
  "cats": {
    "pip":    { "flea": [], "nails": [], "vet": [], "weight": [], "journal": [], "photo": null },
    "parker": { ... },
    "ollie":  { ... }
  },
  "household": {
    "litter": []
  }
}
```

---

## Home screen icon

The home screen icon is `public/apple-touch-icon.png` — a 512×512 PNG with three walking paw prints on a terracotta background. iOS applies its own rounded corners.

Referenced in `index.html`:
```html
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

To update the icon, replace the PNG and redeploy. Remove and re-add the app from the iPhone home screen to pick up the new icon.

---

## Adding the app to iPhone home screen

1. Open the live Netlify URL in Safari
2. Tap the Share button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**

Both users should do this. The app uses a shared Netlify Blobs store, so both users read and write the same data.
