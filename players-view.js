// Read-only players & tiers viewer.
// - Reads the same storage keys as the editor: "mctiers_players_v1" and "mctiers_tier_mapping_v1"
// - Listens for BroadcastChannel messages, storage events and custom events so it updates immediately when the editable page saves players/mapping.
// - No import, no mapping-edit UI, no add/edit controls — purely read-only.

const STORAGE_KEY = "mctiers_players_v1";
const MAPPING_KEY = "mctiers_tier_mapping_v1";
const CHANNEL_NAME = "mctiers_channel";
const TIER_ORDER = ["LT5","HT5","LT4","HT4","LT3","HT3","LT2","HT2","LT1","HT1"];

let players = [];
let tierMapping = {};
let sortState = { field: "rank", dir: "asc" };

// BroadcastChannel (if available)
const bc = (typeof window !== 'undefined' && 'BroadcastChannel' in window) ? new BroadcastChannel(CHANNEL_NAME) : null;

function $(id) { return document.getElementById(id); }
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function setYear() {
  const y = new Date().getFullYear();
  if ($('yearView')) $('yearView').textContent = y;
}

function loadPlayers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.error("players-view: failed reading players:", e);
    return [];
  }
}

function loadMapping() {
  try {
    const raw = localStorage.getItem(MAPPING_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.error("players-view: failed reading mapping:", e);
    return {};
  }
}

function getUniqueTiers() {
  const s = new Set(players.map(p => (p.tier || "").trim()).filter(Boolean));
  TIER_ORDER.forEach(t => s.add(t));
  return Array.from(s).filter(Boolean).sort((a,b)=>{
    const ia = TIER_ORDER.indexOf(a);
    const ib = TIER_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

function populateTierFilter() {
  const sel = $('tierFilter');
  if (!sel) return;
  sel.innerHTML = '<option value="">All tiers</option>';
  const tiers = getUniqueTiers();
  tiers.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });
}

function renderMappingPreview() {
  const container = $('mappingPreview');
  if (!container) return;
  container.innerHTML = '';
  TIER_ORDER.forEach(t => {
    const box = document.createElement('div');
    box.className = 'tier-card';
    box.style.padding = '0.6rem';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.innerHTML = `<div style="font-weight:800">${escapeHtml(t)}</div>
                     <div class="muted small">${escapeHtml(String(tierMapping[t] ?? '—'))} pts</div>`;
    container.appendChild(box);
  });
}

function renderTable(list) {
  const tbody = $('playersBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  list.forEach(p => {
    const tr = document.createElement('tr');
    tr.style.borderTop = "1px solid rgba(255,255,255,0.02)";
    tr.innerHTML = `
      <td style="padding:0.6rem 0.8rem;white-space:nowrap">${escapeHtml(p.rank)}</td>
      <td style="padding:0.6rem 0.8rem">${escapeHtml(p.name)}</td>
      <td style="padding:0.6rem 0.8rem">${escapeHtml(p.tier)}</td>
      <td style="padding:0.6rem 0.8rem">${escapeHtml(p.points)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function applyFiltersAndRender() {
  const qEl = $('searchInput');
  const q = (qEl && qEl.value || '').trim().toLowerCase();
  const tier = ($('tierFilter') && $('tierFilter').value) || '';
  let list = players.slice();

  if (q) {
    list = list.filter(p =>
      String(p.name).toLowerCase().includes(q) ||
      String(p.tier).toLowerCase().includes(q) ||
      String(p.points).includes(q) ||
      String(p.rank).includes(q)
    );
  }
  if (tier) list = list.filter(p => (p.tier || "") === tier);

  list.sort((a, b) => {
    const f = sortState.field;
    const dir = sortState.dir === 'asc' ? 1 : -1;
    if (a[f] < b[f]) return -1 * dir;
    if (a[f] > b[f]) return 1 * dir;
    return 0;
  });

  renderTable(list);
}

function downloadJSON(filename = 'players.json') {
  const data = JSON.stringify(players, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// reload everything from storage and re-render
function reloadFromStorage() {
  players = loadPlayers();
  tierMapping = loadMapping();
  populateTierFilter();
  renderMappingPreview();
  applyFiltersAndRender();
  console.info("players-view: reloaded data from storage");
}

// BroadcastChannel listener (fast cross-tab)
if (bc) {
  bc.onmessage = (ev) => {
    if (!ev || !ev.data) return;
    if (ev.data.type === 'players-updated' || ev.data.type === 'mapping-updated') {
      console.info("players-view: received bc message:", ev.data.type);
      reloadFromStorage();
    }
  };
} else {
  console.info("players-view: BroadcastChannel not available.");
}

// storage event (fires in other tabs)
window.addEventListener('storage', (e) => {
  if (!e) return;
  if (e.key === STORAGE_KEY || e.key === MAPPING_KEY) {
    console.info("players-view: storage event for key:", e.key);
    reloadFromStorage();
  }
});

// custom events (editor may dispatch these in same tab)
window.addEventListener('mctiers_players_updated', () => {
  console.info("players-view: received mctiers_players_updated event");
  reloadFromStorage();
});
window.addEventListener('mctiers_mapping_updated', () => {
  console.info("players-view: received mctiers_mapping_updated event");
  reloadFromStorage();
});

document.addEventListener('DOMContentLoaded', () => {
  setYear();
  players = loadPlayers();
  tierMapping = loadMapping();
  populateTierFilter();
  renderMappingPreview();
  applyFiltersAndRender();

  const searchEl = $('searchInput');
  const tierEl = $('tierFilter');
  if (searchEl) searchEl.addEventListener('input', () => applyFiltersAndRender());
  if (tierEl) tierEl.addEventListener('change', () => applyFiltersAndRender());

  // sorting header clicks
  document.querySelectorAll('#playersTable thead th[data-sort]').forEach(h => {
    h.addEventListener('click', () => {
      const field = h.getAttribute('data-sort');
      if (sortState.field === field) {
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.field = field;
        sortState.dir = 'asc';
      }
      applyFiltersAndRender();
    });
  });

  const exportBtn = $('exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', () => downloadJSON());
});