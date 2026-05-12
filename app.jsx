import { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';

// ─── Constants ────────────────────────────────────────────────────────────────
const APP_VERSION = '0.1';
const BLOB_TOKEN = import.meta.env.VITE_BLOB_TOKEN;

const CATS = [
  { id: 'pip',    name: 'Pip',    breed: 'Brown & White Tabby', size: 'Small'  },
  { id: 'parker', name: 'Parker', breed: 'Brown Tabby',         size: 'Medium' },
  { id: 'ollie',  name: 'Ollie',  breed: 'White Long-hair',     size: 'Large'  },
];

const emptyCatData = (id) => ({
  appVersion: APP_VERSION,
  name: CATS.find((c) => c.id === id)?.name ?? id,
  photo: null,
  flea:    [],
  nails:   [],
  vet:     [],
  weight:  [],
  journal: [],
});

// ─── Care config (flea + nails) ───────────────────────────────────────────────
const CARE_CONFIG = {
  flea: {
    label:     'Flea Medicine',
    icon:      '💊',
    logLabel:  'flea treatment',
    greenDays: 28,
    amberDays: 42,
  },
  nails: {
    label:     'Nail Trim',
    icon:      '✂️',
    logLabel:  'nail trim',
    greenDays: 28,
    amberDays: 35,
  },
};

const VET_VISIT_TYPES = [
  'Annual Checkup',
  'Vaccine',
  'Teeth Cleaning',
  'Sick Visit',
  'Follow-up',
  'Other',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function getDaysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso + 'T12:00:00')) / 86400000);
}

function daysLabel(days) {
  if (days === null) return '';
  if (days === 0)    return 'today';
  if (days === 1)    return 'yesterday';
  return `${days}d ago`;
}

// More readable labels for vet history (weeks/months/years)
function longDaysLabel(days) {
  if (days === null) return '';
  if (days === 0)    return 'today';
  if (days === 1)    return 'yesterday';
  if (days < 7)     return `${days} days ago`;
  if (days < 30)    { const w = Math.floor(days / 7);  return `${w} week${w > 1 ? 's' : ''} ago`; }
  if (days < 365)   { const mo = Math.floor(days / 30); return `${mo} month${mo > 1 ? 's' : ''} ago`; }
  const yr = Math.floor(days / 365);
  const mo = Math.floor((days % 365) / 30);
  return mo > 0 ? `${yr}y ${mo}mo ago` : `${yr} year${yr > 1 ? 's' : ''} ago`;
}

function getStatus(entries, greenDays, amberDays) {
  if (!entries || entries.length === 0) {
    return { color: 'red', label: 'Never logged', lastDate: null, days: null };
  }
  const lastDate = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0].date;
  const days = getDaysSince(lastDate);
  if (days < greenDays) return { color: 'green', label: 'On schedule', lastDate, days };
  if (days < amberDays) return { color: 'amber', label: 'Due now',     lastDate, days };
  return                       { color: 'red',   label: 'Overdue',     lastDate, days };
}

// Checks last Annual Checkup and last Vaccine independently.
// Flags red if either > 12 months or never logged.
// Flags amber if either is 10–12 months.
function getVetStatus(vetEntries) {
  const entries = vetEntries || [];
  const last = (type) => entries
    .filter((e) => e.type === type)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const lastCheckup = last('Annual Checkup');
  const lastVaccine = last('Vaccine');
  const checkupDays = lastCheckup ? getDaysSince(lastCheckup.date) : null;
  const vaccineDays = lastVaccine ? getDaysSince(lastVaccine.date) : null;

  const redItems = [];
  const amberItems = [];

  if (checkupDays === null || checkupDays > 365) {
    redItems.push({ label: 'Annual Checkup', days: checkupDays });
  } else if (checkupDays > 304) {
    amberItems.push({ label: 'Annual Checkup', days: checkupDays });
  }

  if (vaccineDays === null || vaccineDays > 365) {
    redItems.push({ label: 'Vaccine', days: vaccineDays });
  } else if (vaccineDays > 304) {
    amberItems.push({ label: 'Vaccine', days: vaccineDays });
  }

  if (redItems.length > 0)   return { color: 'red',   label: 'Overdue',    flagged: redItems };
  if (amberItems.length > 0) return { color: 'amber', label: 'Due soon',   flagged: amberItems };
  return                            { color: 'green', label: 'Up to date', flagged: [] };
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function fetchCat(id) {
  const res = await fetch(`/api/get-cat?id=${id}`, {
    headers: { 'x-blob-token': BLOB_TOKEN },
  });
  if (!res.ok) throw new Error(`get-cat ${id} failed: ${res.status}`);
  const json = await res.json();
  return json ?? emptyCatData(id);
}

async function saveCat(id, data) {
  const res = await fetch('/api/save-cat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-blob-token': BLOB_TOKEN },
    body: JSON.stringify({ id, data }),
  });
  if (!res.ok) throw new Error(`save-cat ${id} failed: ${res.status}`);
  return res.json();
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

  body {
    font-family: 'Nunito', sans-serif;
    background: #FDF8F0;
    min-height: 100vh;
    max-width: 480px;
    margin: 0 auto;
    color: #2D1506;
    font-size: 16px;
  }
  button { font-family: inherit; cursor: pointer; }
  input, textarea, select { font-family: inherit; }

  /* ── HEADER ── */
  .wl-header {
    background: linear-gradient(135deg, #C96A3A 0%, #A8532C 100%);
    color: white; padding: 14px 16px 12px;
    display: flex; align-items: center; gap: 10px;
    position: sticky; top: 0; z-index: 20;
    box-shadow: 0 2px 8px rgba(0,0,0,.15);
  }
  .wl-header-icon  { font-size: 28px; flex-shrink: 0; line-height: 1; }
  .wl-header-title { font-weight: 800; font-size: 17px; line-height: 1.1; }
  .wl-header-sub   { font-size: 12px; opacity: .85; margin-top: 1px; }

  /* ── CAT SELECTOR ── */
  .wl-cat-selector {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 8px; padding: 12px 12px 4px;
    background: #FDF8F0;
    position: sticky; top: 56px; z-index: 19;
  }
  .wl-cat-card {
    background: white; border: 2.5px solid #EDD9C5;
    border-radius: 14px; padding: 10px 6px;
    text-align: center; transition: all .12s;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    cursor: pointer;
  }
  .wl-cat-card.active {
    border-color: #C96A3A; background: #FFF5EE;
    box-shadow: 0 3px 12px rgba(201,106,58,.2);
  }
  .wl-cat-avatar {
    width: 52px; height: 52px; border-radius: 50%;
    background: #FFF5EE; border: 2px solid #EDD9C5;
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; flex-shrink: 0; overflow: hidden;
  }
  .wl-cat-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
  .wl-cat-name { font-weight: 800; font-size: 15px; color: #3D2010; }
  .wl-cat-desc { font-size: 11px; color: #6B4E38; }

  /* ── PAGE WRAP ── */
  .wl-page    { padding-bottom: 80px; }
  .wl-content { padding: 10px 12px 40px; }

  /* ── LOADING / ERROR ── */
  .wl-state {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 12px;
    padding: 60px 24px; text-align: center; min-height: 40vh;
  }
  .wl-state-icon  { font-size: 44px; opacity: .35; }
  .wl-state-title { font-size: 16px; font-weight: 700; color: #3D2010; }
  .wl-state-sub   { font-size: 13px; color: #9E8070; line-height: 1.5; max-width: 260px; }
  .wl-spinner {
    width: 32px; height: 32px;
    border: 3px solid #EDD9C5; border-top-color: #C96A3A;
    border-radius: 50%; animation: wl-spin .7s linear infinite;
  }
  @keyframes wl-spin { to { transform: rotate(360deg); } }
  .wl-retry-btn {
    background: #C96A3A; color: white; border: none;
    border-radius: 20px; padding: 10px 22px; font-size: 13px; font-weight: 700;
  }

  /* ── PROFILE CARD ── */
  .wl-profile-card {
    background: white; border-radius: 16px; padding: 14px 16px; margin-bottom: 10px;
    box-shadow: 0 2px 10px rgba(180,100,40,.08); border: 1px solid rgba(220,170,130,.2);
    display: flex; align-items: center; gap: 14px;
  }
  .wl-profile-avatar {
    width: 62px; height: 62px; border-radius: 50%; flex-shrink: 0;
    background: #FFF5EE; border: 2.5px solid #EDD9C5;
    display: flex; align-items: center; justify-content: center; font-size: 32px; overflow: hidden;
  }
  .wl-profile-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
  .wl-profile-name  { font-size: 20px; font-weight: 800; color: #2D1506; line-height: 1; }
  .wl-profile-breed { font-size: 13px; color: #6B4E38; margin-top: 3px; }

  /* ── CARE CARDS ── */
  .wl-care-card {
    background: white; border-radius: 16px; padding: 14px 16px; margin-bottom: 10px;
    box-shadow: 0 2px 10px rgba(180,100,40,.08); border: 1px solid rgba(220,170,130,.2);
    display: flex; align-items: center; gap: 12px;
    cursor: pointer; user-select: none; transition: transform .1s, background .1s;
  }
  .wl-care-card:active { transform: scale(.98); background: #FFFBF7; }
  .wl-care-icon  { font-size: 28px; flex-shrink: 0; line-height: 1; }
  .wl-care-body  { flex: 1; min-width: 0; }
  .wl-care-label { font-size: 15px; font-weight: 700; color: #3D2010; }
  .wl-care-last  { font-size: 12px; color: #9E8070; margin-top: 2px; }
  .wl-care-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
  .wl-status-badge {
    display: inline-flex; align-items: center; gap: 5px;
    border-radius: 20px; padding: 4px 10px;
    font-size: 11px; font-weight: 700; letter-spacing: .02em; white-space: nowrap;
  }
  .wl-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .wl-status-green { background: #EDFAF1; color: #186F3C; }
  .wl-status-green .wl-status-dot { background: #2AB25B; }
  .wl-status-amber { background: #FFF8E6; color: #8C6200; }
  .wl-status-amber .wl-status-dot { background: #F0A500; }
  .wl-status-red   { background: #FFF0EE; color: #B03020; }
  .wl-status-red   .wl-status-dot { background: #D94030; }
  .wl-care-chevron { font-size: 18px; color: #C0A898; line-height: 1; }

  /* ── PLACEHOLDER SECTIONS ── */
  .wl-placeholder-section {
    background: white; border-radius: 16px; padding: 20px 16px; margin-bottom: 10px;
    box-shadow: 0 2px 10px rgba(180,100,40,.07); border: 1px solid rgba(220,170,130,.2);
    display: flex; align-items: center; gap: 12px; opacity: .5;
  }
  .wl-placeholder-icon  { font-size: 28px; flex-shrink: 0; }
  .wl-placeholder-label { font-size: 15px; font-weight: 700; color: #3D2010; }
  .wl-placeholder-sub   { font-size: 13px; color: #6B4E38; margin-top: 2px; }
  .wl-coming-badge {
    margin-left: auto; flex-shrink: 0;
    background: #FFF5EE; border: 1px solid #EDD9C5;
    border-radius: 20px; padding: 4px 10px; font-size: 10px; font-weight: 700; color: #C96A3A;
  }

  /* ── BOTTOM SHEET ── */
  .wl-sheet-backdrop {
    position: fixed; inset: 0; z-index: 40;
    background: rgba(45, 21, 6, 0.45);
    display: flex; flex-direction: column; justify-content: flex-end; align-items: center;
  }
  .wl-sheet {
    background: white; border-radius: 24px 24px 0 0;
    width: 100%; max-width: 480px; max-height: 78vh;
    display: flex; flex-direction: column;
    box-shadow: 0 -4px 28px rgba(45,21,6,.18);
    animation: wl-sheet-up .22s cubic-bezier(0.34, 1.2, 0.64, 1);
  }
  @keyframes wl-sheet-up {
    from { transform: translateY(80px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  .wl-sheet-handle-wrap { padding: 12px 0 6px; display: flex; justify-content: center; flex-shrink: 0; }
  .wl-sheet-handle { width: 36px; height: 4px; border-radius: 2px; background: #DDD3CB; }
  .wl-sheet-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 2px 16px 14px; flex-shrink: 0; border-bottom: 1px solid rgba(220,170,130,.25);
  }
  .wl-sheet-title { font-size: 16px; font-weight: 800; color: #2D1506; }
  .wl-sheet-close {
    width: 30px; height: 30px; border-radius: 50%;
    background: #F0EAE4; border: none; color: #6B4E38;
    font-size: 15px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .wl-sheet-body {
    overflow-y: auto; flex: 1; padding: 18px 16px;
    padding-bottom: calc(18px + env(safe-area-inset-bottom));
  }

  /* ── SHARED FORM ELEMENTS ── */
  .wl-log-section { margin-bottom: 22px; }
  .wl-section-label {
    font-size: 11px; font-weight: 700; color: #9E8070;
    letter-spacing: .08em; text-transform: uppercase; margin-bottom: 10px;
  }
  .wl-optional { font-weight: 400; text-transform: none; letter-spacing: 0; }
  .wl-date-input {
    width: 100%; border: 1.5px solid #EDD9C5; border-radius: 12px;
    padding: 11px 12px; font-size: 15px; color: #2D1506;
    background: #FFFBF7; outline: none; margin-bottom: 14px; -webkit-appearance: none;
  }
  .wl-date-input:focus { border-color: #C96A3A; box-shadow: 0 0 0 3px rgba(201,106,58,.12); }

  /* ── SELECT DROPDOWN ── */
  .wl-select-wrapper { position: relative; margin-bottom: 14px; }
  .wl-select-wrapper::after {
    content: '▾'; position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
    font-size: 14px; color: #9E8070; pointer-events: none;
  }
  .wl-select-input {
    width: 100%; appearance: none; -webkit-appearance: none;
    border: 1.5px solid #EDD9C5; border-radius: 12px;
    padding: 11px 36px 11px 12px; font-size: 15px; color: #2D1506;
    background: #FFFBF7; outline: none;
  }
  .wl-select-input:focus { border-color: #C96A3A; box-shadow: 0 0 0 3px rgba(201,106,58,.12); }

  /* ── NOTES TEXTAREA (auto-expand) ── */
  .wl-notes-input {
    width: 100%; border: 1.5px solid #EDD9C5; border-radius: 12px;
    padding: 11px 12px; font-size: 15px; color: #2D1506; line-height: 1.55;
    background: #FFFBF7; outline: none; resize: none; overflow: hidden;
    min-height: 80px; margin-bottom: 0;
  }
  .wl-notes-input:focus { border-color: #C96A3A; box-shadow: 0 0 0 3px rgba(201,106,58,.12); }
  .wl-notes-input::placeholder { color: #BBA090; }

  /* ── CAT TOGGLE BUTTONS ── */
  .wl-cat-toggles { display: flex; gap: 8px; }
  .wl-cat-toggle {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
    border: 2px solid #EDD9C5; border-radius: 12px;
    padding: 11px 6px; background: white;
    font-size: 14px; font-weight: 700; color: #9E8070;
    cursor: pointer; user-select: none; transition: all .12s;
  }
  .wl-cat-toggle.on { border-color: #C96A3A; background: #FFF5EE; color: #C96A3A; }
  .wl-cat-toggle:disabled { opacity: .4; cursor: default; }
  .wl-toggle-check { font-size: 12px; }

  .wl-log-row-end { display: flex; justify-content: flex-end; margin-top: 12px; }
  .wl-log-btn {
    background: #C96A3A; color: white; border: none;
    border-radius: 12px; padding: 11px 28px; font-size: 14px; font-weight: 700; transition: opacity .1s;
  }
  .wl-log-btn:disabled { opacity: .45; cursor: not-allowed; }
  .wl-log-feedback { margin-top: 8px; font-size: 12px; color: #9E8070; min-height: 18px; }
  .wl-log-feedback.error { color: #B03020; }

  /* ── FLEA/NAILS HISTORY TABLE ── */
  .wl-history-empty { font-size: 14px; color: #BBA090; padding: 10px 0; font-style: italic; }
  .wl-hist-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .wl-hist-table thead th {
    font-size: 11px; font-weight: 800; color: #9E8070;
    letter-spacing: .07em; text-transform: uppercase; padding-bottom: 10px; text-align: center;
  }
  .wl-hist-table thead th:first-child { text-align: left; }
  .wl-hist-table tbody tr { border-top: 1px solid rgba(220,170,130,.2); }
  .wl-hist-date-cell { padding: 9px 0; vertical-align: middle; width: 45%; }
  .wl-hist-date-main { font-size: 13px; font-weight: 700; color: #3D2010; }
  .wl-hist-date-sub  { font-size: 11px; color: #9E8070; margin-top: 2px; }
  .wl-hist-cat-cell  { text-align: center; vertical-align: middle; width: 18.33%; }
  .wl-hist-check-btn {
    background: none; border: none; color: #2AB25B; font-size: 17px; font-weight: 700;
    padding: 8px 6px; cursor: pointer; border-radius: 8px; line-height: 1;
    transition: background .12s; display: inline-block;
  }
  .wl-hist-check-btn:active { background: #EDFAF1; }
  .wl-hist-dash {
    display: block; text-align: center; color: #DDD3CB;
    font-size: 14px; padding: 8px 0; line-height: 1; user-select: none;
  }

  /* ── VET OVERDUE BANNER ── */
  .wl-vet-overdue {
    background: #FFF8E6; border: 1px solid #F0D488;
    border-radius: 12px; padding: 10px 14px; margin-bottom: 18px;
    display: flex; flex-direction: column; gap: 5px;
  }
  .wl-vet-overdue-item { font-size: 13px; color: #7A5500; font-weight: 600; display: flex; gap: 7px; }

  /* ── VET HISTORY CARDS ── */
  .wl-vet-card {
    background: #FDF8F0; border-radius: 12px;
    border: 1px solid rgba(220,170,130,.25);
    padding: 12px 14px; margin-bottom: 8px;
  }
  .wl-vet-card-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
  }
  .wl-vet-card-date  { font-size: 14px; font-weight: 700; color: #3D2010; }
  .wl-vet-card-ago   { font-size: 11px; color: #9E8070; margin-top: 2px; }
  .wl-vet-card-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .wl-vet-type-badge {
    display: inline-block; background: #FFF5EE; border: 1px solid #EDD9C5;
    border-radius: 10px; padding: 3px 10px;
    font-size: 11px; font-weight: 700; color: #C96A3A; white-space: nowrap;
  }
  .wl-vet-delete-btn {
    background: none; border: none; color: #C0A898;
    font-size: 12px; font-weight: 700; padding: 4px 8px; border-radius: 8px;
    white-space: nowrap; transition: color .12s;
  }
  .wl-vet-delete-btn:active { color: #D94030; }
  .wl-vet-card-notes {
    font-size: 13px; color: #5C3D28; margin-top: 9px;
    line-height: 1.55; white-space: pre-wrap;
  }
  .wl-vet-confirm-row {
    margin-top: 10px; padding-top: 10px;
    border-top: 1px solid rgba(220,170,130,.2);
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .wl-vet-confirm-text { font-size: 13px; color: #6B4E38; font-weight: 600; }
  .wl-vet-confirm-btns { display: flex; gap: 8px; }
  .wl-vet-confirm-yes {
    background: #D94030; color: white; border: none;
    border-radius: 10px; padding: 6px 14px; font-size: 12px; font-weight: 700;
  }
  .wl-vet-confirm-no {
    background: #F0EAE4; color: #6B4E38; border: none;
    border-radius: 10px; padding: 6px 14px; font-size: 12px; font-weight: 700;
  }

  /* ── CLEAR ALL HISTORY ── */
  .wl-clear-section {
    margin-top: 28px; padding-top: 18px;
    border-top: 1px solid rgba(220,170,130,.2);
    display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .wl-clear-btn {
    background: none; border: 1.5px solid #DDD3CB; border-radius: 20px; padding: 8px 22px;
    font-size: 13px; font-weight: 700; color: #B0A090; transition: all .12s;
  }
  .wl-clear-btn:active { border-color: #D94030; color: #D94030; }
  .wl-clear-confirm {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center;
  }
  .wl-clear-confirm-text { font-size: 13px; color: #6B4E38; font-weight: 600; }
  .wl-clear-yes {
    background: #D94030; color: white; border: none;
    border-radius: 16px; padding: 7px 18px; font-size: 13px; font-weight: 700;
  }
  .wl-clear-no {
    background: #F0EAE4; color: #6B4E38; border: none;
    border-radius: 16px; padding: 7px 18px; font-size: 13px; font-weight: 700;
  }

  /* ── DIARY PLACEHOLDER ── */
  .wl-diary-placeholder {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 60vh;
    gap: 14px; padding: 40px 24px; text-align: center;
  }
  .wl-diary-placeholder-icon  { font-size: 56px; opacity: .3; }
  .wl-diary-placeholder-title { font-size: 18px; font-weight: 800; color: #3D2010; }
  .wl-diary-placeholder-sub   { font-size: 14px; color: #9E8070; line-height: 1.6; max-width: 280px; }
  .wl-diary-badge {
    background: #FFF5EE; border: 1.5px solid #EDD9C5; border-radius: 20px; padding: 6px 18px;
    font-size: 12px; font-weight: 700; color: #C96A3A; margin-top: 4px;
  }

  /* ── BOTTOM NAV ── */
  .wl-bottom-nav {
    position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 100%; max-width: 480px; background: white;
    border-top: 1px solid rgba(220,170,130,.3); display: flex; z-index: 30;
    padding-bottom: env(safe-area-inset-bottom); box-shadow: 0 -2px 12px rgba(180,100,40,.08);
  }
  .wl-nav-tab {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    gap: 3px; padding: 10px 0 11px; border: none; background: none;
    color: #BBA090; transition: color .12s; font-size: 12px; font-weight: 700; letter-spacing: .04em;
  }
  .wl-nav-tab.active { color: #C96A3A; }
  .wl-nav-tab-icon { font-size: 22px; line-height: 1; }
`;

// ─── CatAvatar ────────────────────────────────────────────────────────────────
function CatAvatar({ photo, size = 52, fontSize = 26 }) {
  return (
    <div className="wl-cat-avatar" style={{ width: size, height: size, fontSize }}>
      {photo ? <img src={photo} alt="cat" /> : '🐱'}
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ color, label }) {
  return (
    <span className={`wl-status-badge wl-status-${color}`}>
      <span className="wl-status-dot" />
      {label}
    </span>
  );
}

// ─── CareCard (flea / nails) ──────────────────────────────────────────────────
function CareCard({ type, entries, onTap }) {
  const cfg = CARE_CONFIG[type];
  const { color, label, lastDate, days } = getStatus(entries, cfg.greenDays, cfg.amberDays);
  let lastText;
  if (!lastDate)       lastText = 'No record yet — tap to log';
  else if (days === 0) lastText = 'Last: today';
  else if (days === 1) lastText = 'Last: yesterday';
  else                 lastText = `Last: ${formatDate(lastDate)} · ${days}d ago`;
  return (
    <div className="wl-care-card" onClick={onTap}>
      <div className="wl-care-icon">{cfg.icon}</div>
      <div className="wl-care-body">
        <div className="wl-care-label">{cfg.label}</div>
        <div className="wl-care-last">{lastText}</div>
      </div>
      <div className="wl-care-right">
        <StatusBadge color={color} label={label} />
        <div className="wl-care-chevron">›</div>
      </div>
    </div>
  );
}

// ─── VetCareCard ──────────────────────────────────────────────────────────────
function VetCareCard({ entries, onTap }) {
  const sorted = [...(entries || [])].sort((a, b) => b.date.localeCompare(a.date));
  const last   = sorted[0];
  const status = getVetStatus(entries);

  let lastText;
  if (!last) {
    lastText = 'No visits logged — tap to add';
  } else {
    const days = getDaysSince(last.date);
    const ago  = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
    lastText = `Last: ${formatDate(last.date)} · ${last.type} · ${ago}`;
  }

  return (
    <div className="wl-care-card" onClick={onTap}>
      <div className="wl-care-icon">🏥</div>
      <div className="wl-care-body">
        <div className="wl-care-label">Vet Visits</div>
        <div className="wl-care-last">{lastText}</div>
      </div>
      <div className="wl-care-right">
        {status.flagged.length > 0 && <StatusBadge color={status.color} label={status.label} />}
        <div className="wl-care-chevron">›</div>
      </div>
    </div>
  );
}

// ─── BottomSheet ──────────────────────────────────────────────────────────────
function BottomSheet({ title, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  return (
    <div className="wl-sheet-backdrop" onClick={onClose}>
      <div className="wl-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="wl-sheet-handle-wrap"><div className="wl-sheet-handle" /></div>
        <div className="wl-sheet-header">
          <div className="wl-sheet-title">{title}</div>
          <button className="wl-sheet-close" onClick={onClose}>✕</button>
        </div>
        <div className="wl-sheet-body">{children}</div>
      </div>
    </div>
  );
}

// ─── MultiCareSheet (flea / nails) ────────────────────────────────────────────
function MultiCareSheet({ type, defaultCatId, catState, onLog, onDelete, onClearAll, saving }) {
  const cfg = CARE_CONFIG[type];
  const [dateVal,      setDateVal]      = useState(todayISO());
  const [selected,     setSelected]     = useState([defaultCatId]);
  const [feedback,     setFeedback]     = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  function toggleCat(id) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setFeedback('');
  }

  function handleLog() {
    if (!dateVal || selected.length === 0) return;
    const alreadyLogged = selected.filter((id) =>
      (catState[id]?.data?.[type] || []).some((e) => e.date === dateVal)
    );
    const toLog = selected.filter((id) => !alreadyLogged.includes(id));
    if (toLog.length === 0) {
      const names = alreadyLogged.map((id) => CATS.find((c) => c.id === id).name).join(', ');
      setFeedback(`Already logged for ${names} on this date.`);
      return;
    }
    if (alreadyLogged.length > 0) {
      const names = alreadyLogged.map((id) => CATS.find((c) => c.id === id).name).join(', ');
      setFeedback(`Skipped ${names} — already logged for this date.`);
    } else {
      setFeedback('');
    }
    onLog(type, dateVal, toLog);
  }

  const byDate = {};
  for (const cat of CATS) {
    for (const e of (catState[cat.id]?.data?.[type] || [])) {
      if (!byDate[e.date]) byDate[e.date] = new Set();
      byDate[e.date].add(cat.id);
    }
  }
  const grouped = Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, catIdSet]) => ({ date, catIds: catIdSet }));
  const totalEntries = grouped.reduce((sum, g) => sum + g.catIds.size, 0);

  return (
    <>
      <div className="wl-log-section">
        <div className="wl-section-label">Date</div>
        <input type="date" className="wl-date-input" value={dateVal} max={todayISO()}
          onChange={(e) => { setDateVal(e.target.value); setFeedback(''); }} />
        <div className="wl-section-label">Apply to</div>
        <div className="wl-cat-toggles">
          {CATS.map((cat) => {
            const on     = selected.includes(cat.id);
            const loaded = catState[cat.id]?.status === 'loaded';
            return (
              <button key={cat.id} className={`wl-cat-toggle${on ? ' on' : ''}`}
                onClick={() => toggleCat(cat.id)} disabled={!loaded}>
                {on && <span className="wl-toggle-check">✓</span>}{cat.name}
              </button>
            );
          })}
        </div>
        <div className="wl-log-row-end">
          <button className="wl-log-btn" onClick={handleLog}
            disabled={!dateVal || selected.length === 0 || saving}>
            {saving ? '…' : 'Log'}
          </button>
        </div>
        <div className={`wl-log-feedback${feedback ? ' error' : ''}`}>
          {saving ? 'Saving…' : feedback}
        </div>
      </div>

      <div className="wl-section-label">History ({totalEntries} entries)</div>
      {grouped.length === 0 ? (
        <div className="wl-history-empty">No entries yet — log the first one above!</div>
      ) : (
        <table className="wl-hist-table">
          <thead>
            <tr>
              <th style={{ width: '45%', textAlign: 'left' }}>Date</th>
              {CATS.map((c) => <th key={c.id} style={{ width: '18.33%' }}>{c.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ date, catIds }) => {
              const days = getDaysSince(date);
              return (
                <tr key={date}>
                  <td className="wl-hist-date-cell">
                    <div className="wl-hist-date-main">{formatDate(date)}</div>
                    <div className="wl-hist-date-sub">{daysLabel(days)}</div>
                  </td>
                  {CATS.map((cat) =>
                    catIds.has(cat.id) ? (
                      <td key={cat.id} className="wl-hist-cat-cell">
                        <button className="wl-hist-check-btn"
                          onClick={() => onDelete(type, date, cat.id)}
                          title={`Remove ${cat.name} on ${formatDate(date)}`}>✓</button>
                      </td>
                    ) : (
                      <td key={cat.id} className="wl-hist-cat-cell">
                        <span className="wl-hist-dash">—</span>
                      </td>
                    )
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {totalEntries > 0 && (
        <div className="wl-clear-section">
          {confirmClear ? (
            <div className="wl-clear-confirm">
              <span className="wl-clear-confirm-text">Remove all {totalEntries} entries?</span>
              <button className="wl-clear-yes" onClick={() => { onClearAll(type); setConfirmClear(false); }}>Yes, clear</button>
              <button className="wl-clear-no"  onClick={() => setConfirmClear(false)}>Cancel</button>
            </div>
          ) : (
            <button className="wl-clear-btn" onClick={() => setConfirmClear(true)}>Clear all history</button>
          )}
        </div>
      )}
    </>
  );
}

// ─── VetSheet ─────────────────────────────────────────────────────────────────
function VetSheet({ catId, catData, onAdd, onDelete, onClearAll, saving }) {
  const entries = catData?.vet || [];
  const status  = getVetStatus(entries);

  const [dateVal,        setDateVal]        = useState(todayISO());
  const [visitType,      setVisitType]      = useState('Annual Checkup');
  const [notes,          setNotes]          = useState('');
  const [confirmDelete,  setConfirmDelete]  = useState(null); // entry id | null
  const [confirmClear,   setConfirmClear]   = useState(false);

  const notesRef = useRef(null);

  // Auto-expand textarea as user types
  useEffect(() => {
    if (notesRef.current) {
      notesRef.current.style.height = 'auto';
      notesRef.current.style.height = notesRef.current.scrollHeight + 'px';
    }
  }, [notes]);

  function handleLog() {
    if (!dateVal) return;
    onAdd({
      id:    Date.now().toString(),
      date:  dateVal,
      type:  visitType,
      notes: notes.trim(),
    });
    // Reset form
    setDateVal(todayISO());
    setVisitType('Annual Checkup');
    setNotes('');
  }

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      {/* ── Overdue banner ── */}
      {status.flagged.length > 0 && (
        <div className="wl-vet-overdue">
          {status.flagged.map((item) => (
            <div key={item.label} className="wl-vet-overdue-item">
              <span>⚠️</span>
              <span>
                {item.label}: {item.days === null
                  ? 'never logged'
                  : `${Math.floor(item.days / 30)} months ago — ${status.color === 'amber' ? 'due soon' : 'overdue'}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Log form ── */}
      <div className="wl-log-section">
        <div className="wl-section-label">Date</div>
        <input type="date" className="wl-date-input" value={dateVal} max={todayISO()}
          onChange={(e) => setDateVal(e.target.value)} />

        <div className="wl-section-label">Visit Type</div>
        <div className="wl-select-wrapper">
          <select className="wl-select-input" value={visitType}
            onChange={(e) => setVisitType(e.target.value)}>
            {VET_VISIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="wl-section-label">
          Notes <span className="wl-optional">(optional)</span>
        </div>
        <textarea
          ref={notesRef}
          className="wl-notes-input"
          value={notes}
          rows={3}
          placeholder="Weight, observations, follow-up reminders…"
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="wl-log-row-end">
          <button className="wl-log-btn" onClick={handleLog} disabled={!dateVal || saving}>
            {saving ? '…' : 'Log Visit'}
          </button>
        </div>
        {saving && <div className="wl-log-feedback">Saving…</div>}
      </div>

      {/* ── History ── */}
      <div className="wl-section-label">History ({sorted.length} visit{sorted.length !== 1 ? 's' : ''})</div>

      {sorted.length === 0 ? (
        <div className="wl-history-empty">No visits logged yet — add the first one above!</div>
      ) : (
        sorted.map((entry) => {
          const days         = getDaysSince(entry.date);
          const isConfirming = confirmDelete === entry.id;
          return (
            <div key={entry.id ?? entry.date} className="wl-vet-card">
              <div className="wl-vet-card-header">
                <div>
                  <div className="wl-vet-card-date">{formatDate(entry.date)}</div>
                  <div className="wl-vet-card-ago">{longDaysLabel(days)}</div>
                </div>
                <div className="wl-vet-card-right">
                  <span className="wl-vet-type-badge">{entry.type}</span>
                  {!isConfirming && (
                    <button className="wl-vet-delete-btn"
                      onClick={() => setConfirmDelete(entry.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {entry.notes && (
                <div className="wl-vet-card-notes">{entry.notes}</div>
              )}
              {isConfirming && (
                <div className="wl-vet-confirm-row">
                  <span className="wl-vet-confirm-text">Remove this visit?</span>
                  <div className="wl-vet-confirm-btns">
                    <button className="wl-vet-confirm-no"
                      onClick={() => setConfirmDelete(null)}>Cancel</button>
                    <button className="wl-vet-confirm-yes"
                      onClick={() => { onDelete(entry.id); setConfirmDelete(null); }}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ── Clear all ── */}
      {sorted.length > 0 && (
        <div className="wl-clear-section">
          {confirmClear ? (
            <div className="wl-clear-confirm">
              <span className="wl-clear-confirm-text">
                Remove all {sorted.length} visit{sorted.length !== 1 ? 's' : ''}?
              </span>
              <button className="wl-clear-yes"
                onClick={() => { onClearAll(); setConfirmClear(false); }}>Yes, clear</button>
              <button className="wl-clear-no"
                onClick={() => setConfirmClear(false)}>Cancel</button>
            </div>
          ) : (
            <button className="wl-clear-btn" onClick={() => setConfirmClear(true)}>
              Clear all history
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ─── CatSelector ──────────────────────────────────────────────────────────────
function CatSelector({ activeCatId, onSelect, catData }) {
  return (
    <div className="wl-cat-selector">
      {CATS.map((cat) => (
        <div key={cat.id}
          className={`wl-cat-card${activeCatId === cat.id ? ' active' : ''}`}
          onClick={() => onSelect(cat.id)}>
          <CatAvatar photo={catData[cat.id]?.photo ?? null} />
          <div className="wl-cat-name">{cat.name}</div>
          <div className="wl-cat-desc">{cat.breed}</div>
        </div>
      ))}
    </div>
  );
}

// ─── CatsSection ──────────────────────────────────────────────────────────────
function CatsSection({ catId, data, onOpenSheet }) {
  const cat = CATS.find((c) => c.id === catId);
  return (
    <div className="wl-content">
      <div className="wl-profile-card">
        <div className="wl-profile-avatar">
          {data?.photo ? <img src={data.photo} alt={cat.name} /> : '🐱'}
        </div>
        <div>
          <div className="wl-profile-name">{cat.name}</div>
          <div className="wl-profile-breed">{cat.breed} · {cat.size}</div>
        </div>
      </div>

      <CareCard    type="flea"  entries={data?.flea  ?? []} onTap={() => onOpenSheet('flea',  catId)} />
      <CareCard    type="nails" entries={data?.nails ?? []} onTap={() => onOpenSheet('nails', catId)} />
      <VetCareCard              entries={data?.vet   ?? []} onTap={() => onOpenSheet('vet',   catId)} />

      {[
        { icon: '⚖️', label: 'Weight',         sub: 'Track over time'      },
        { icon: '📝', label: 'Health Journal', sub: 'Notes & observations' },
      ].map(({ icon, label, sub }) => (
        <div key={label} className="wl-placeholder-section">
          <div className="wl-placeholder-icon">{icon}</div>
          <div>
            <div className="wl-placeholder-label">{label}</div>
            <div className="wl-placeholder-sub">{sub}</div>
          </div>
          <div className="wl-coming-badge">Coming soon</div>
        </div>
      ))}
    </div>
  );
}

// ─── DiarySection ─────────────────────────────────────────────────────────────
function DiarySection() {
  return (
    <div className="wl-content">
      <div className="wl-diary-placeholder">
        <div className="wl-diary-placeholder-icon">📓</div>
        <div className="wl-diary-placeholder-title">Household Diary</div>
        <div className="wl-diary-placeholder-sub">
          A shared journal for all three cats — notes, observations, and daily life.
        </div>
        <div className="wl-diary-badge">Coming in v2.0</div>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
function App() {
  const [activeTab,    setActiveTab]   = useState('cats');
  const [activeCatId, setActiveCatId] = useState('pip');
  const [openSheet,   setOpenSheet]   = useState(null); // { type, catId } | null
  const [saving,      setSaving]      = useState(false);

  const [catState, setCatState] = useState({
    pip:    { status: 'idle', data: null },
    parker: { status: 'idle', data: null },
    ollie:  { status: 'idle', data: null },
  });

  const catStateRef = useRef(catState);
  useEffect(() => { catStateRef.current = catState; });

  const loadCat = useCallback(async (id) => {
    setCatState((prev) => ({ ...prev, [id]: { ...prev[id], status: 'loading' } }));
    try {
      const data = await fetchCat(id);
      setCatState((prev) => ({ ...prev, [id]: { status: 'loaded', data } }));
    } catch (err) {
      console.error(err);
      setCatState((prev) => ({ ...prev, [id]: { status: 'error', data: null } }));
    }
  }, []);

  useEffect(() => {
    CATS.forEach((cat) => loadCat(cat.id));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flea / nails: multi-cat log ───────────────────────────────────────────
  const handleMultiLog = useCallback(async (type, date, catIds) => {
    const cs = catStateRef.current;
    const updates = catIds
      .map((id) => {
        const data = cs[id]?.data;
        if (!data) return null;
        return { id, data: { ...data, [type]: [...(data[type] || []), { date }] } };
      })
      .filter(Boolean);
    if (updates.length === 0) return;
    setCatState((prev) => {
      const next = { ...prev };
      for (const { id, data } of updates) next[id] = { ...next[id], data };
      return next;
    });
    setSaving(true);
    try { await Promise.all(updates.map(({ id, data }) => saveCat(id, data))); }
    catch (err) { console.error('Multi-save failed:', err); }
    finally { setSaving(false); }
  }, []);

  // ── Flea / nails: delete by date ──────────────────────────────────────────
  const handleDelete = useCallback(async (type, date, catId) => {
    const data = catStateRef.current[catId]?.data;
    if (!data) return;
    const updated = { ...data, [type]: (data[type] || []).filter((e) => e.date !== date) };
    setCatState((prev) => ({ ...prev, [catId]: { ...prev[catId], data: updated } }));
    setSaving(true);
    try { await saveCat(catId, updated); }
    catch (err) { console.error('Delete failed:', err); }
    finally { setSaving(false); }
  }, []);

  // ── Flea / nails: clear all ───────────────────────────────────────────────
  const handleClearAll = useCallback(async (type) => {
    const cs = catStateRef.current;
    const updates = CATS
      .map((cat) => {
        const data = cs[cat.id]?.data;
        if (!data) return null;
        return { id: cat.id, data: { ...data, [type]: [] } };
      })
      .filter(Boolean);
    if (updates.length === 0) return;
    setCatState((prev) => {
      const next = { ...prev };
      for (const { id, data } of updates) next[id] = { ...next[id], data };
      return next;
    });
    setSaving(true);
    try { await Promise.all(updates.map(({ id, data }) => saveCat(id, data))); }
    catch (err) { console.error('Clear failed:', err); }
    finally { setSaving(false); }
  }, []);

  // ── Generic per-cat handlers (vet, weight, journal) ───────────────────────
  const handleAddEntry = useCallback(async (catId, field, entry) => {
    const data = catStateRef.current[catId]?.data;
    if (!data) return;
    const updated = { ...data, [field]: [...(data[field] || []), entry] };
    setCatState((prev) => ({ ...prev, [catId]: { ...prev[catId], data: updated } }));
    setSaving(true);
    try { await saveCat(catId, updated); }
    catch (err) { console.error('Add entry failed:', err); }
    finally { setSaving(false); }
  }, []);

  const handleDeleteEntry = useCallback(async (catId, field, entryId) => {
    const data = catStateRef.current[catId]?.data;
    if (!data) return;
    const updated = { ...data, [field]: (data[field] || []).filter((e) => e.id !== entryId) };
    setCatState((prev) => ({ ...prev, [catId]: { ...prev[catId], data: updated } }));
    setSaving(true);
    try { await saveCat(catId, updated); }
    catch (err) { console.error('Delete entry failed:', err); }
    finally { setSaving(false); }
  }, []);

  const handleClearField = useCallback(async (catId, field) => {
    const data = catStateRef.current[catId]?.data;
    if (!data) return;
    const updated = { ...data, [field]: [] };
    setCatState((prev) => ({ ...prev, [catId]: { ...prev[catId], data: updated } }));
    setSaving(true);
    try { await saveCat(catId, updated); }
    catch (err) { console.error('Clear field failed:', err); }
    finally { setSaving(false); }
  }, []);

  const { status, data } = catState[activeCatId];
  const catDataMap = Object.fromEntries(CATS.map((c) => [c.id, catState[c.id].data]));

  // Sheet title
  const sheetTitle = openSheet
    ? openSheet.type === 'vet'
      ? `🏥 Vet Visits — ${CATS.find((c) => c.id === openSheet.catId)?.name}`
      : `${CARE_CONFIG[openSheet.type].icon} ${CARE_CONFIG[openSheet.type].label}`
    : '';

  return (
    <>
      <style>{styles}</style>

      <header className="wl-header">
        <span className="wl-header-icon">🐾</span>
        <div>
          <div className="wl-header-title">WhiskerLog</div>
          <div className="wl-header-sub">Pip · Parker · Ollie &nbsp;·&nbsp; v{APP_VERSION}</div>
        </div>
      </header>

      <div className="wl-page">
        {activeTab === 'cats' && (
          <CatSelector activeCatId={activeCatId} onSelect={setActiveCatId} catData={catDataMap} />
        )}

        {activeTab === 'cats' && (
          <>
            {status === 'loading' && (
              <div className="wl-state">
                <div className="wl-spinner" />
                <div className="wl-state-sub">Loading {CATS.find((c) => c.id === activeCatId)?.name}…</div>
              </div>
            )}
            {status === 'error' && (
              <div className="wl-state">
                <div className="wl-state-icon">😿</div>
                <div className="wl-state-title">Couldn't load cat data</div>
                <div className="wl-state-sub">Check your connection and try again.</div>
                <button className="wl-retry-btn" onClick={() => loadCat(activeCatId)}>Try again</button>
              </div>
            )}
            {status === 'loaded' && (
              <CatsSection catId={activeCatId} data={data}
                onOpenSheet={(type, catId) => setOpenSheet({ type, catId })} />
            )}
            {status === 'idle' && (
              <div className="wl-state"><div className="wl-spinner" /></div>
            )}
          </>
        )}

        {activeTab === 'diary' && <DiarySection />}
      </div>

      <nav className="wl-bottom-nav">
        <button className={`wl-nav-tab${activeTab === 'cats' ? ' active' : ''}`}
          onClick={() => setActiveTab('cats')}>
          <span className="wl-nav-tab-icon">🐾</span>CATS
        </button>
        <button className={`wl-nav-tab${activeTab === 'diary' ? ' active' : ''}`}
          onClick={() => setActiveTab('diary')}>
          <span className="wl-nav-tab-icon">📓</span>DIARY
        </button>
      </nav>

      {openSheet && (
        <BottomSheet title={sheetTitle} onClose={() => setOpenSheet(null)}>
          {openSheet.type === 'vet' ? (
            <VetSheet
              catId={openSheet.catId}
              catData={catState[openSheet.catId]?.data}
              onAdd={(entry)   => handleAddEntry(openSheet.catId, 'vet', entry)}
              onDelete={(id)   => handleDeleteEntry(openSheet.catId, 'vet', id)}
              onClearAll={()   => handleClearField(openSheet.catId, 'vet')}
              saving={saving}
            />
          ) : (
            <MultiCareSheet
              type={openSheet.type}
              defaultCatId={openSheet.catId}
              catState={catState}
              onLog={handleMultiLog}
              onDelete={handleDelete}
              onClearAll={handleClearAll}
              saving={saving}
            />
          )}
        </BottomSheet>
      )}
    </>
  );
}

// ─── Mount ────────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
