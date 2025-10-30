/* players.js — simplified editor (no admin gating) with mapping and live-update broadcasts
   Replace your existing assets/players.js with this file.

   What this does:
   - Removes the client-side "admin/login" gating so editing always works
   - Preserves all features: players list, import (CSV/JSON), export, mapping UI, apply mapping, sort/filter
   - Broadcasts updates via BroadcastChannel and dispatches window events so read-only views update automatically
   - On load it also unhides any elements that were marked `.admin-only` in the HTML so older pages still show controls

   Storage keys:
   - players: "mctiers_players_v1"
   - mapping: "mctiers_tier_mapping_v1"

   NOTE: This is still a purely client-side editor. Anyone with access to the site can edit data.
*/

const STORAGE_KEY = "mctiers_players_v1";
const MAPPING_KEY = "mctiers_tier_mapping_v1";
const CHANNEL_NAME = "mctiers_channel";

// Tier order & default mapping (edit values if desired)
const TIER_ORDER = ["LT5","HT5","LT4","HT4","LT3","HT3","LT2","HT2","LT1","HT1"];
const mappingDefault = {
  LT5: 10, HT5: 20, LT4: 30, HT4: 40, LT3: 50,
  HT3: 60, LT2: 70, HT2: 80, LT1: 90, HT1: 100
};

// Example seed players
const initialData = [
  { rank: 1, name: "XxPvPProxX", tier: "HT1", points: mappingDefault.HT1 },
  { rank: 2, name: "SharpBlade", tier: "LT2", points: mappingDefault.LT2 },
  { rank: 3, name: "NoobSlayer", tier: "LT5", points: mappingDefault.LT5 }
];

// Broadcast channel (if supported)
const bc = (typeof window !== 'undefined' && 'BroadcastChannel' in window) ? new BroadcastChannel(CHANNEL_NAME) : null;

let players = loadPlayers();
let tierMapping = loadMapping();
let sortState = { field: "rank", dir: "asc" };
let editingId = null;

/* ---------------------- storage helpers ---------------------- */

function loadPlayers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
      return [...initialData];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Invalid data");
    return parsed;
  } catch (e) {
    console.error("Failed to load players:", e);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    return [...initialData];
  }
}

function savePlayers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  try { if (bc) bc.postMessage({ type: 'players-updated' }); } catch(e){/*ignore*/ }
  window.dispatchEvent(new Event('mctiers_players_updated'));
}

function loadMapping() {
  try {
    const raw = localStorage.getItem(MAPPING_KEY);
    if (!raw) {
      localStorage.setItem(MAPPING_KEY, JSON.stringify(mappingDefault));
      return { ...mappingDefault };
    }
    const parsed = JSON.parse(raw);
    return { ...mappingDefault, ...parsed };
  } catch (e) {
    console.error("Failed to load mapping:", e);
    localStorage.removeItem(MAPPING_KEY);
    localStorage.setItem(MAPPING_KEY, JSON.stringify(mappingDefault));
    return { ...mappingDefault };
  }
}

function saveMapping() {
  localStorage.setItem(MAPPING_KEY, JSON.stringify(tierMapping));
  try { if (bc) bc.postMessage({ type: 'mapping-updated' }); } catch(e){/*ignore*/ }
  window.dispatchEvent(new Event('mctiers_mapping_updated'));
}

/* ---------------------- utility ---------------------- */

function $(id) { return document.getElementById(id); }
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/* ---------------------- normalization & rendering ---------------------- */

function normalizePlayer(item) {
  const tierVal = (item.tier || item.Tier || item.TIER || "").toString().trim();
  const pointsProvided = (item.points !== undefined && item.points !== null && item.points !== "") ? Number(item.points) : null;
  const points = (pointsProvided === null || Number.isNaN(pointsProvided)) ? (tierMapping[tierVal] ?? 0) : Number(pointsProvided);

  return {
    rank: Number(item.rank) || 0,
    name: String(item.name || item.player || item.username || "Unknown"),
    tier: tierVal || "",
    points: Number(points) || 0
  };
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

function populateMappingUI() {
  const grid = $('mappingGrid');
  if (!grid) return;
  grid.innerHTML = '';
  TIER_ORDER.forEach(t => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '0.25rem';

    const label = document.createElement('label');
    label.className = 'muted';
    label.textContent = t;

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = (tierMapping[t] !== undefined) ? tierMapping[t] : (mappingDefault[t] || 0);
    input.dataset.tier = t;
    input.style.padding = '0.4rem';
    input.style.borderRadius = '8px';
    input.style.background = 'transparent';
    input.style.border = '1px solid rgba(255,255,255,0.03)';
    input.style.color = 'var(--accent-text)';

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    grid.appendChild(wrapper);
  });

  // datalist for add/edit tier input
  const datalist = $('tiersDatalist');
  if (datalist) {
    datalist.innerHTML = '';
    TIER_ORDER.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      datalist.appendChild(opt);
    });
  }
}

function renderTable(list) {
  const tbody = $('playersBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  list.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.style.borderTop = "1px solid rgba(255,255,255,0.02)";
    tr.innerHTML = `
      <td style="padding:0.6rem 0.8rem;white-space:nowrap">${escapeHtml(p.rank)}</td>
      <td style="padding:0.6rem 0.8rem">${escapeHtml(p.name)}</td>
      <td style="padding:0.6rem 0.8rem">${escapeHtml(p.tier)}</td>
      <td style="padding:0.6rem 0.8rem">${escapeHtml(p.points)}</td>
      <td style="padding:0.6rem 0.8rem;white-space:nowrap">
        <button class="btn" data-action="edit" data-idx="${idx}">Edit</button>
        <button class="btn" data-action="delete" data-idx="${idx}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // wire actions
  tbody.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = btn.getAttribute('data-action');
      const idx = Number(btn.getAttribute('data-idx'));
      // we rendered from a filtered/sorted list, so we should map back to players by content match
      const row = Array.from(tbody.children)[idx];
      const rank = Number(row.children[0].textContent);
      const name = row.children[1].textContent;
      const tier = row.children[2].textContent;
      const points = Number(row.children[3].textContent);
      const realIndex = players.findIndex(p => p.rank === rank && p.name === name && p.tier === tier && p.points === points);
      if (action === 'edit') startEdit(realIndex);
      if (action === 'delete') doDelete(realIndex);
    });
  });
}

function applyFiltersAndRender() {
  const q = ($('searchInput') && $('searchInput').value || '').trim().toLowerCase();
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

/* ---------------------- edit / add / delete ---------------------- */

function startEdit(index) {
  if (index === -1 || index === undefined || index === null) return;
  editingId = index;
  const p = players[index];
  if (!p) return;
  if ($('pRank')) $('pRank').value = p.rank;
  if ($('pName')) $('pName').value = p.name;
  if ($('pTier')) $('pTier').value = p.tier;
  if ($('pPoints')) $('pPoints').value = (p.points !== undefined && p.points !== null) ? p.points : '';
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

function doDelete(index) {
  if (index === -1 || index === undefined || index === null) return;
  if (!confirm("Delete this player?")) return;
  players.splice(index, 1);
  savePlayers();
  populateTierFilter();
  applyFiltersAndRender();
}

function resetForm() {
  editingId = null;
  const form = $('playerForm');
  if (form) form.reset();
}

/* ---------------------- CSV import / export ---------------------- */

function splitCSVLine(line) {
  const res = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      res.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  res.push(cur);
  return res;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows = lines.slice(1).map(line => {
    const vals = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] ?? "");
    return obj;
  });
  return rows;
}

function importDataFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const txt = e.target.result;
      if (file.name.toLowerCase().endsWith('.json')) {
        const data = JSON.parse(txt);
        if (!Array.isArray(data)) throw new Error("JSON must be an array");
        players = data.map(normalizePlayer);
      } else {
        const rows = parseCSV(txt);
        const normalized = rows.map(r => normalizePlayer({
          rank: r.rank ?? r.Rank ?? r.RANK,
          name: r.name ?? r.Name ?? r.NAME ?? r.player,
          tier: r.tier ?? r.Tier ?? r.TIER,
          points: r.points ?? r.Points ?? r.POINTS ?? r.score
        }));
        players = normalized;
      }
      savePlayers();
      populateTierFilter();
      applyFiltersAndRender();
      alert("Import successful. The list was replaced with the imported data.");
    } catch (err) {
      console.error("Import error:", err);
      alert("Failed to import file. See console for details.");
    }
  };
  reader.readAsText(file);
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

/* ---------------------- mapping actions ---------------------- */

function applyMappingToAllPlayers() {
  if (!confirm("Apply tier mapping to ALL players, overwriting their current points?")) return;
  players = players.map(p => ({ ...p, points: Number(tierMapping[p.tier] ?? 0) }));
  savePlayers();
  applyFiltersAndRender();
  alert("Applied mapping to all players.");
}

function applyMappingToEmptyPlayers() {
  players = players.map(p => {
    if (!p.points) return { ...p, points: Number(tierMapping[p.tier] ?? 0) };
    return p;
  });
  savePlayers();
  applyFiltersAndRender();
  alert("Applied mapping to players with empty/zero points.");
}

function resetMappingToDefault() {
  if (!confirm("Reset mapping to default values? This will overwrite saved mapping values.")) return;
  tierMapping = { ...mappingDefault };
  saveMapping();
  populateMappingUI();
  alert("Mapping reset to defaults.");
}

function readMappingFromUI() {
  const inputs = document.querySelectorAll('#mappingGrid input[data-tier]');
  inputs.forEach(inp => {
    const t = inp.dataset.tier;
    const v = Number(inp.value) || 0;
    tierMapping[t] = v;
  });
  saveMapping();
}

/* ---------------------- mapping UI wiring ---------------------- */

function initMappingButtons() {
  const applyAll = $('applyMappingBtn');
  const applyEmpty = $('applyMappingIfEmptyBtn');
  const resetBtn = $('resetMappingBtn');
  const saveBtn = $('saveMappingBtn');

  applyAll && applyAll.addEventListener('click', () => { readMappingFromUI(); applyMappingToAllPlayers(); });
  applyEmpty && applyEmpty.addEventListener('click', () => { readMappingFromUI(); applyMappingToEmptyPlayers(); });
  resetBtn && resetBtn.addEventListener('click', () => resetMappingToDefault());
  saveBtn && saveBtn.addEventListener('click', () => { readMappingFromUI(); alert("Mapping saved."); });
}

/* ---------------------- initialization & event wiring ---------------------- */

function unhideAdminOnlyElements() {
  // In case your HTML still marks inputs as admin-only, reveal them
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.remove('hidden');
    // enable any inputs inside
    el.querySelectorAll && el.querySelectorAll('input,button,select,textarea').forEach(i => i.removeAttribute('disabled'));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Ensure editing UI is visible even if HTML used .admin-only
  unhideAdminOnlyElements();

  // Load/prepare data and UI
  players = loadPlayers();
  tierMapping = loadMapping();
  populateMappingUI();
  initMappingButtons();
  populateTierFilter();
  applyFiltersAndRender();

  // wire search/filter
  const searchEl = $('searchInput');
  const tierFilter = $('tierFilter');
  if (searchEl) searchEl.addEventListener('input', () => applyFiltersAndRender());
  if (tierFilter) tierFilter.addEventListener('change', () => applyFiltersAndRender());

  // sorting header clicks
  document.querySelectorAll('#playersTable thead th[data-sort]').forEach(h => {
    h.addEventListener('click', () => {
      const field = h.getAttribute('data-sort');
      if (sortState.field === field) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      else { sortState.field = field; sortState.dir = 'asc'; }
      applyFiltersAndRender();
    });
  });

  // file import
  const importFile = $('importFile');
  if (importFile) importFile.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) importDataFromFile(f);
    e.target.value = '';
  });

  // export
  const exportBtn = $('exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', () => downloadJSON());

  // clear
  const clearBtn = $('clearBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (!confirm("Clear the entire players list from local storage? This cannot be undone.")) return;
    players = [];
    savePlayers();
    populateTierFilter();
    applyFiltersAndRender();
  });

  // form submit
  const form = $('playerForm');
  if (form) {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const tierInput = ($('pTier').value || "").trim();
      const pointsInputRaw = $('pPoints').value;
      const pointsInput = (pointsInputRaw === '' || pointsInputRaw === null) ? null : Number(pointsInputRaw);
      const raw = {
        rank: Number($('pRank').value) || 0,
        name: ($('pName').value || "").trim(),
        tier: tierInput,
        points: (pointsInput === null) ? (tierMapping[tierInput] ?? 0) : pointsInput
      };
      if (!raw.name) { alert("Player name is required."); return; }

      if (editingId === null) players.push(normalizePlayer(raw));
      else { players[editingId] = normalizePlayer(raw); editingId = null; }

      players.sort((a,b) => (a.rank || 0) - (b.rank || 0));
      savePlayers();
      populateTierFilter();
      applyFiltersAndRender();
      form.reset();
    });
  }

  const cancelBtn = $('cancelEdit');
  if (cancelBtn) cancelBtn.addEventListener('click', () => resetForm());
});

/* ---------------------- Broadcast listener for same-tab updates (optional) ---------------------- */

// Listen for broadcast messages from other tabs
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    const listener = new BroadcastChannel(CHANNEL_NAME);
    listener.onmessage = (ev) => {
      if (!ev || !ev.data) return;
      if (ev.data.type === 'players-updated' || ev.data.type === 'mapping-updated') {
        // reload and re-render
        players = loadPlayers();
        tierMapping = loadMapping();
        populateMappingUI();
        populateTierFilter();
        applyFiltersAndRender();
      }
    };
  } catch (err) { console.warn("BroadcastChannel listen error:", err); }
}

// Also respond to storage events (older browsers / fallback)
window.addEventListener('storage', (e) => {
  if (!e) return;
  if (e.key === STORAGE_KEY || e.key === MAPPING_KEY) {
    players = loadPlayers();
    tierMapping = loadMapping();
    populateMappingUI();
    populateTierFilter();
    applyFiltersAndRender();
  }
});