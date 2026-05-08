import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';

// ─── Constants ────────────────────────────────────────────────────────────────
const APP_VERSION = '0.1';
const BLOB_TOKEN = import.meta.env.VITE_BLOB_TOKEN;

const CATS = [
  { id: 'pip',    name: 'Pip',    breed: 'Brown & White Tabby', size: 'Small'  },
  { id: 'parker', name: 'Parker', breed: 'Brown Tabby',         size: 'Medium' },
  { id: 'ollie',  name: 'Ollie',  breed: 'White Long-hair',     size: 'Large'  },
];

// Empty data scaffold for a cat not yet saved
const emptyCatData = (id) => ({
  appVersion: APP_VERSION,
  name: CATS.find((c) => c.id === id)?.name ?? id,
  photo: null,
  flea:   [],
  nails:  [],
  vet:    [],
  weight: [],
  journal: [],
});

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
    headers: {
      'Content-Type': 'application/json',
      'x-blob-token': BLOB_TOKEN,
    },
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
  }
  button { font-family: inherit; cursor: pointer; }
  input, textarea, select { font-family: inherit; }

  /* ── HEADER ── */
  .wl-header {
    background: linear-gradient(135deg, #C96A3A 0%, #A8532C 100%);
    color: white;
    padding: 14px 16px 12px;
    display: flex; align-items: center; gap: 10px;
    position: sticky; top: 0; z-index: 20;
    box-shadow: 0 2px 8px rgba(0,0,0,.15);
  }
  .wl-header-icon { font-size: 28px; flex-shrink: 0; line-height: 1; }
  .wl-header-title { font-weight: 800; font-size: 17px; line-height: 1.1; }
  .wl-header-sub { font-size: 10px; opacity: .75; margin-top: 1px; }

  /* ── CAT SELECTOR ── */
  .wl-cat-selector {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 8px; padding: 12px 12px 4px;
    background: #FDF8F0;
    position: sticky; top: 56px; z-index: 19;
  }
  .wl-cat-card {
    background: white;
    border: 2.5px solid #EDD9C5;
    border-radius: 14px;
    padding: 10px 6px;
    text-align: center;
    transition: all .12s;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    cursor: pointer;
  }
  .wl-cat-card.active {
    border-color: #C96A3A;
    background: #FFF5EE;
    box-shadow: 0 3px 12px rgba(201,106,58,.2);
  }
  .wl-cat-avatar {
    width: 52px; height: 52px; border-radius: 50%;
    background: #FFF5EE; border: 2px solid #EDD9C5;
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; flex-shrink: 0;
    overflow: hidden; position: relative;
  }
  .wl-cat-avatar img {
    width: 100%; height: 100%; object-fit: cover; border-radius: 50%;
  }
  .wl-cat-photo-btn {
    position: absolute; bottom: -2px; right: -2px;
    width: 20px; height: 20px; border-radius: 50%;
    background: #C96A3A; border: 1.5px solid white;
    color: white; font-size: 11px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; z-index: 2;
  }
  .wl-cat-name { font-weight: 800; font-size: 13px; color: #3D2010; }
  .wl-cat-desc { font-size: 9px; color: #9E8070; }

  /* ── PAGE WRAP ── */
  .wl-page { padding-bottom: 80px; }
  .wl-content { padding: 10px 12px 40px; }

  /* ── LOADING / ERROR ── */
  .wl-state {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 12px;
    padding: 60px 24px; text-align: center; min-height: 40vh;
  }
  .wl-state-icon { font-size: 44px; opacity: .35; }
  .wl-state-title { font-size: 16px; font-weight: 700; color: #3D2010; }
  .wl-state-sub { font-size: 13px; color: #9E8070; line-height: 1.5; max-width: 260px; }
  .wl-spinner {
    width: 32px; height: 32px;
    border: 3px solid #EDD9C5; border-top-color: #C96A3A;
    border-radius: 50%; animation: wl-spin .7s linear infinite;
  }
  @keyframes wl-spin { to { transform: rotate(360deg); } }
  .wl-retry-btn {
    background: #C96A3A; color: white; border: none;
    border-radius: 20px; padding: 10px 22px;
    font-size: 13px; font-weight: 700;
  }

  /* ── PROFILE CARD ── */
  .wl-profile-card {
    background: white; border-radius: 16px; padding: 14px 16px;
    margin-bottom: 10px;
    box-shadow: 0 2px 10px rgba(180,100,40,.08);
    border: 1px solid rgba(220,170,130,.2);
    display: flex; align-items: center; gap: 14px;
  }
  .wl-profile-avatar {
    width: 62px; height: 62px; border-radius: 50%; flex-shrink: 0;
    background: #FFF5EE; border: 2.5px solid #EDD9C5;
    display: flex; align-items: center; justify-content: center; font-size: 32px;
    overflow: hidden;
  }
  .wl-profile-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
  .wl-profile-name { font-size: 20px; font-weight: 800; color: #2D1506; line-height: 1; }
  .wl-profile-breed { font-size: 12px; color: #9E7A60; margin-top: 3px; }

  /* ── PLACEHOLDER SECTIONS ── */
  .wl-placeholder-section {
    background: white; border-radius: 16px; padding: 20px 16px;
    margin-bottom: 10px;
    box-shadow: 0 2px 10px rgba(180,100,40,.07);
    border: 1px solid rgba(220,170,130,.2);
    display: flex; align-items: center; gap: 12px;
    opacity: .55;
  }
  .wl-placeholder-icon { font-size: 28px; flex-shrink: 0; }
  .wl-placeholder-label { font-size: 13px; font-weight: 700; color: #3D2010; }
  .wl-placeholder-sub { font-size: 11px; color: #9E8070; margin-top: 2px; }
  .wl-coming-badge {
    margin-left: auto; flex-shrink: 0;
    background: #FFF5EE; border: 1px solid #EDD9C5;
    border-radius: 20px; padding: 4px 10px;
    font-size: 10px; font-weight: 700; color: #C96A3A;
  }

  /* ── DIARY PLACEHOLDER ── */
  .wl-diary-placeholder {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 60vh;
    gap: 14px; padding: 40px 24px; text-align: center;
  }
  .wl-diary-placeholder-icon { font-size: 56px; opacity: .3; }
  .wl-diary-placeholder-title { font-size: 18px; font-weight: 800; color: #3D2010; }
  .wl-diary-placeholder-sub { font-size: 14px; color: #9E8070; line-height: 1.6; max-width: 280px; }
  .wl-diary-badge {
    background: #FFF5EE; border: 1.5px solid #EDD9C5;
    border-radius: 20px; padding: 6px 18px;
    font-size: 12px; font-weight: 700; color: #C96A3A; margin-top: 4px;
  }

  /* ── BOTTOM NAV ── */
  .wl-bottom-nav {
    position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 100%; max-width: 480px;
    background: white;
    border-top: 1px solid rgba(220,170,130,.3);
    display: flex; z-index: 30;
    padding-bottom: env(safe-area-inset-bottom);
    box-shadow: 0 -2px 12px rgba(180,100,40,.08);
  }
  .wl-nav-tab {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    gap: 3px; padding: 10px 0 11px;
    border: none; background: none;
    color: #BBA090; transition: color .12s;
    font-size: 10px; font-weight: 700; letter-spacing: .04em;
  }
  .wl-nav-tab.active { color: #C96A3A; }
  .wl-nav-tab-icon { font-size: 22px; line-height: 1; }
`;

// ─── Cat Avatar ───────────────────────────────────────────────────────────────
function CatAvatar({ photo, size = 52, fontSize = 26 }) {
  return (
    <div
      className="wl-cat-avatar"
      style={{ width: size, height: size, fontSize }}
    >
      {photo ? <img src={photo} alt="cat" /> : '🐱'}
    </div>
  );
}

// ─── Cat Selector ─────────────────────────────────────────────────────────────
function CatSelector({ activeCatId, onSelect, catData }) {
  return (
    <div className="wl-cat-selector">
      {CATS.map((cat) => {
        const data = catData[cat.id];
        return (
          <div
            key={cat.id}
            className={`wl-cat-card${activeCatId === cat.id ? ' active' : ''}`}
            onClick={() => onSelect(cat.id)}
          >
            <div style={{ position: 'relative' }}>
              <CatAvatar photo={data?.photo ?? null} />
            </div>
            <div className="wl-cat-name">{cat.name}</div>
            <div className="wl-cat-desc">{cat.breed}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Cats Section (placeholder content for now) ───────────────────────────────
function CatsSection({ catId, data }) {
  const cat = CATS.find((c) => c.id === catId);

  return (
    <div className="wl-content">
      {/* Profile card */}
      <div className="wl-profile-card">
        <div className="wl-profile-avatar">
          {data?.photo ? <img src={data.photo} alt={cat.name} /> : '🐱'}
        </div>
        <div>
          <div className="wl-profile-name">{cat.name}</div>
          <div className="wl-profile-breed">{cat.breed} · {cat.size}</div>
        </div>
      </div>

      {/* Placeholder care cards — these become real in Step 2 */}
      {[
        { icon: '💊', label: 'Flea Medicine',  sub: 'Every 4–6 weeks' },
        { icon: '✂️', label: 'Nail Trim',       sub: 'Every 4 weeks'   },
        { icon: '🏥', label: 'Vet Visits',      sub: 'Checkups & vaccines' },
        { icon: '⚖️', label: 'Weight',          sub: 'Track over time' },
        { icon: '📝', label: 'Health Journal',  sub: 'Notes & observations' },
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

// ─── Diary Section ────────────────────────────────────────────────────────────
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
  const [activeTab, setActiveTab]     = useState('cats');   // 'cats' | 'diary'
  const [activeCatId, setActiveCatId] = useState('pip');

  // Per-cat: { status: 'idle'|'loading'|'loaded'|'error', data: object|null }
  const [catState, setCatState] = useState({
    pip:    { status: 'idle', data: null },
    parker: { status: 'idle', data: null },
    ollie:  { status: 'idle', data: null },
  });

  const loadCat = useCallback(async (id) => {
    setCatState((prev) => ({
      ...prev,
      [id]: { ...prev[id], status: 'loading' },
    }));
    try {
      const data = await fetchCat(id);
      setCatState((prev) => ({
        ...prev,
        [id]: { status: 'loaded', data },
      }));
    } catch (err) {
      console.error(err);
      setCatState((prev) => ({
        ...prev,
        [id]: { status: 'error', data: null },
      }));
    }
  }, []);

  // Load a cat when first selected
  useEffect(() => {
    if (catState[activeCatId].status === 'idle') {
      loadCat(activeCatId);
    }
  }, [activeCatId, catState, loadCat]);

  const { status, data } = catState[activeCatId];

  // Map catState to simple { id: data } for the selector avatars
  const catDataMap = Object.fromEntries(
    CATS.map((c) => [c.id, catState[c.id].data])
  );

  return (
    <>
      {/* Inject styles */}
      <style>{styles}</style>

      {/* ── Header ── */}
      <header className="wl-header">
        <span className="wl-header-icon">🐾</span>
        <div>
          <div className="wl-header-title">WhiskerLog</div>
          <div className="wl-header-sub">
            Pip · Parker · Ollie &nbsp;·&nbsp; v{APP_VERSION}
          </div>
        </div>
      </header>

      <div className="wl-page">
        {/* ── Cat Selector (only shown on Cats tab) ── */}
        {activeTab === 'cats' && (
          <CatSelector
            activeCatId={activeCatId}
            onSelect={setActiveCatId}
            catData={catDataMap}
          />
        )}

        {/* ── Main Content ── */}
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
                <button className="wl-retry-btn" onClick={() => loadCat(activeCatId)}>
                  Try again
                </button>
              </div>
            )}
            {status === 'loaded' && (
              <CatsSection catId={activeCatId} data={data} />
            )}
            {status === 'idle' && (
              <div className="wl-state">
                <div className="wl-spinner" />
              </div>
            )}
          </>
        )}

        {activeTab === 'diary' && <DiarySection />}
      </div>

      {/* ── Bottom Nav ── */}
      <nav className="wl-bottom-nav">
        <button
          className={`wl-nav-tab${activeTab === 'cats' ? ' active' : ''}`}
          onClick={() => setActiveTab('cats')}
        >
          <span className="wl-nav-tab-icon">🐾</span>
          CATS
        </button>
        <button
          className={`wl-nav-tab${activeTab === 'diary' ? ' active' : ''}`}
          onClick={() => setActiveTab('diary')}
        >
          <span className="wl-nav-tab-icon">📓</span>
          DIARY
        </button>
      </nav>
    </>
  );
}

// ─── Mount ────────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
