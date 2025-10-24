// ===== script.js (index) =====
// Tournament & matches management (main page)
// Revised 2025-10-17 by EX-RAJU
// Changes: removed inline width/padding styles for table columns and team cell.
// Uses CSS classes (col-rank, col-team, col-wins, col-kills, col-point, col-total, team-cell)
// so layout is controlled entirely from stylesheet.css for cleaner, consistent appearance.

let tournaments = []; // array of { name, dateCreated, teams: [{name, logo /*logoKey*/, slot}], matches: [{name,date,results: [{kills,position}]}] }
let activeTournamentIdx = null;
let currentMatchIdx = null;

const positionPoints = [12,9,8,7,6,5,4,3,2,1,0,0];

// DOM refs (ensure these IDs exist in index.html)
const tournamentSelect = document.getElementById('tournamentSelect');
const newTournamentBtn = document.getElementById('newTournamentBtn');
const deleteTournamentBtn = document.getElementById('deleteTournamentBtn');
const tournamentModal = document.getElementById('tournamentModal');
const closeTournamentModal = document.getElementById('closeTournamentModal');
const tournamentForm = document.getElementById('tournamentForm');
const tournamentNameInput = document.getElementById('tournamentNameInput');
const tournamentTeamInputs = document.getElementById('tournamentTeamInputs');

const newMatchBtn = document.getElementById('newMatchBtn');
const matchModal = document.getElementById('matchModal');
const closeModal = document.getElementById('closeModal');
const matchForm = document.getElementById('matchForm');
const matchNameInput = document.getElementById('matchNameInput');
const teamInputs = document.getElementById('teamInputs');

const teamsTableContainer = document.getElementById('teamsTableContainer');
const saveMatchBtn = document.getElementById('saveMatchBtn');
const exportMatchBtn = document.getElementById('exportMatchBtn');
const matchTitle = document.getElementById('currentMatchName');

// Matches panel DOM refs (may be null if matches panel not present)
const matchesListContainer = document.getElementById('matchesListContainer');
const createSeriesBtn = document.getElementById('createSeriesBtn');
const createSeriesCount = document.getElementById('createSeriesCount');

// ----------------- IndexedDB helper for images -----------------
const ImageDB = (function(){
  const DB_NAME = 'ex_tournaments_images_v1';
  const STORE = 'images';
  let db = null;
  const urlCache = new Map();

  function openDB(){
    return new Promise((resolve, reject) => {
      if(db) return resolve(db);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if(!idb.objectStoreNames.contains(STORE)) {
          idb.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function putBlob(blob){
    const idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const rec = { blob, created: Date.now() };
      const r = store.add(rec);
      r.onsuccess = (ev) => {
        const key = `img:${ev.target.result}`;
        resolve(key);
      };
      r.onerror = (ev) => reject(ev.target.error);
    });
  }

  async function getBlobByKey(key){
    if(!key) return null;
    const id = parseInt(String(key).split(':')[1],10);
    if(isNaN(id)) return null;
    const idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const r = store.get(id);
      r.onsuccess = (ev) => {
        const rec = ev.target.result;
        resolve(rec ? rec.blob : null);
      };
      r.onerror = (ev) => reject(ev.target.error);
    });
  }

  async function deleteByKey(key){
    if(!key) return;
    const id = parseInt(String(key).split(':')[1],10);
    if(isNaN(id)) return;
    const idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const r = store.delete(id);
      r.onsuccess = () => {
        const prevUrl = urlCache.get(key);
        if(prevUrl) {
          URL.revokeObjectURL(prevUrl);
          urlCache.delete(key);
        }
        resolve();
      };
      r.onerror = (ev) => reject(ev.target.error);
    });
  }

  async function saveFileOrData(fileOrDataUrl){
    if(fileOrDataUrl instanceof Blob) return await putBlob(fileOrDataUrl);
    if(typeof fileOrDataUrl === 'string' && fileOrDataUrl.indexOf('data:') === 0){
      const blob = dataURLToBlob(fileOrDataUrl);
      return await putBlob(blob);
    }
    return null;
  }

  function dataURLToBlob(dataurl) {
    const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]); let n = bstr.length; const u8arr = new Uint8Array(n);
    while(n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], {type:mime});
  }

  async function getObjectURL(key){
    if(!key) return '';
    if(urlCache.has(key)) return urlCache.get(key);
    const blob = await getBlobByKey(key);
    if(!blob) return '';
    const obj = URL.createObjectURL(blob);
    urlCache.set(key, obj);
    return obj;
  }

  return { saveFileOrData, getObjectURL, deleteByKey, openDB };
})();

// UTILITY: Function to read file into Base64 data URL (used for small previews before storing)
function readFileAsDataURL(file){
  return new Promise(res=>{
    const r = new FileReader();
    r.onload = e=> res(e.target.result);
    r.readAsDataURL(file);
  });
}

// ----------------- Storage helpers -----------------
function saveMvpData() {
    if (activeTournamentIdx === null || !tournaments[activeTournamentIdx]) {
        localStorage.removeItem('ex_mvp_data');
        return;
    }
    const t = tournaments[activeTournamentIdx];
    const mvpData = {
        name: t.name,
        teams: t.teams.map(team => ({
            name: team.name,
            logoKey: team.logo,
            slot: team.slot
        })),
        matches: t.matches.map(match => ({
            name: match.name,
            results: match.results 
        }))
    };
    try {
        localStorage.setItem('ex_mvp_data', JSON.stringify(mvpData));
    } catch(e) {
        console.error("Error saving MVP data:", e);
    }
}

function saveToStorage(){
  try {
    localStorage.setItem('ex_tournaments', JSON.stringify(tournaments));
    localStorage.setItem('ex_activeTournamentIdx', activeTournamentIdx);
    localStorage.setItem('ex_currentMatchIdx', currentMatchIdx);
    saveMvpData();
  } catch(e) {
      console.error("Error saving to storage:", e);
      alert("CRITICAL WARNING: Storing failed. If this persists, clear old tournaments.");
  }
}

async function loadFromStorage(){
  tournaments = JSON.parse(localStorage.getItem('ex_tournaments') || '[]');

  await ImageDB.openDB().catch(e=>console.warn('ImageDB not available:', e));

  for(const t of tournaments){
    if(!t.teams) continue;
    for(const team of t.teams){
      if(team.logo && typeof team.logo === 'string' && team.logo.indexOf('data:') === 0){
        try{
          const key = await ImageDB.saveFileOrData(team.logo);
          team.logo = key;
        }catch(err){ console.error('Migration logo save err',err); }
      }
    }
  }

  const ai = parseInt(localStorage.getItem('ex_activeTournamentIdx'));
  const mi = parseInt(localStorage.getItem('ex_currentMatchIdx'));
  activeTournamentIdx = isNaN(ai) ? null : ai;
  currentMatchIdx = isNaN(mi) ? null : mi;

  if (activeTournamentIdx === null && tournaments.length > 0) {
    activeTournamentIdx = 0;
    if ((tournaments[0].matches || []).length > 0 && currentMatchIdx === null) {
      currentMatchIdx = tournaments[0].matches.length - 1;
    }
    saveToStorage();
  }
  saveMvpData();
}

// ----------------- Matches Panel & rendering -----------------
function getCumulativeDetails(tournament, uptoMatchIdx){
  const len = tournament.teams.length;
  const totals = Array(len).fill(0);
  const kills = Array(len).fill(0);
  const positionPts = Array(len).fill(0);
  const wins = Array(len).fill(0);
  for(let m=0;m<=uptoMatchIdx;m++){
    const match = tournament.matches[m];
    if(!match) continue;
    match.results.forEach((res, idx)=>{
      const pos = res && res.position ? res.position : 1;
      const k = res && res.kills ? res.kills : 0;
      const posPts = positionPoints[(pos||1)-1] || 0;
      totals[idx] += k + posPts;
      kills[idx] += k;
      positionPts[idx] += posPts;
      if(pos === 1) wins[idx] += 1;
    });
  }
  return { totals, kills, positionPts, wins };
}

async function teamLogoSrc(team){
  if(!team || !team.logo) return '';
  return await ImageDB.getObjectURL(team.logo).catch(()=> '');
}

function renderMatchesList() {
  if (!matchesListContainer) return;
  matchesListContainer.innerHTML = '';
  if (activeTournamentIdx === null || !tournaments[activeTournamentIdx]) {
    matchesListContainer.innerHTML = `<div style="padding:12px;color:#bbb">No tournament selected</div>`;
    return;
  }
  const t = tournaments[activeTournamentIdx];
  if (!t.matches || !t.matches.length) {
    matchesListContainer.innerHTML = `<div style="padding:12px;color:#bbb">No matches yet. Create one using + New Match or create a series.</div>`;
    return;
  }

  t.matches.forEach((m, mIdx) => {
    const card = document.createElement('div');
    card.className = 'match-card';
    // card visuals controlled by CSS
    const header = document.createElement('div');
    header.className = 'match-card-header';

    const title = document.createElement('div');
    title.textContent = m.name;
    title.className = 'match-card-title';
    header.appendChild(title);

    const meta = document.createElement('div');
    meta.textContent = new Date(m.date).toLocaleString();
    meta.className = 'match-card-meta';
    header.appendChild(meta);

    card.appendChild(header);

    const cumulative = getCumulativeDetails(t, mIdx);
    const rows = t.teams.map((team, idx) => {
      return {
        team: team.name,
        total: cumulative.totals[idx] || 0,
        kills: cumulative.kills[idx] || 0,
        wins: cumulative.wins[idx] || 0,
        idx
      };
    }).sort((a,b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.kills !== a.kills) return b.kills - a.kills;
      return b.wins - a.wins;
    });

    const top3 = rows.slice(0,3);
    const topContainer = document.createElement('div');
    topContainer.className = 'match-card-top3';
    topContainer.innerHTML = top3.map((r, i) => `<div>${i+1}. ${r.team} — ${r.total}</div>`).join('');
    card.appendChild(topContainer);

    const actions = document.createElement('div');
    actions.className = 'match-card-actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'primary-btn';
    openBtn.textContent = 'Open';
    openBtn.onclick = () => {
      currentMatchIdx = mIdx;
      saveToStorage();
      renderTournament();
      const sec = document.getElementById('matchSection');
      if (sec) sec.scrollIntoView({ behavior: 'smooth' });
    };
    actions.appendChild(openBtn);

    const renameBtn = document.createElement('button');
    renameBtn.className = 'primary-btn';
    renameBtn.textContent = 'Rename';
    renameBtn.onclick = () => {
      const input = document.createElement('input');
      input.value = m.name;
      input.className = 'inline-rename';
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const newName = input.value.trim();
          if (!newName) return alert('Name required');
          t.matches[mIdx].name = newName;
          saveToStorage();
          renderMatchesList();
        } else if (e.key === 'Escape') {
          renderMatchesList();
        }
      };
      title.replaceWith(input);
      input.focus();
    };
    actions.appendChild(renameBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'danger-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => {
      if (!confirm(`Delete match "${m.name}" ?`)) return;
      t.matches.splice(mIdx, 1);
      if (currentMatchIdx === mIdx) currentMatchIdx = null;
      else if (currentMatchIdx > mIdx) currentMatchIdx--;
      saveToStorage();
      renderTournament();
      renderMatchesList();
    };
    actions.appendChild(deleteBtn);

    const exportBtn = document.createElement('button');
    exportBtn.className = 'primary-btn';
    exportBtn.textContent = 'Export';
    exportBtn.onclick = async () => {
      const tableEl = document.createElement('table');
      const isFinalMatch = (m.name && m.name.toLowerCase().includes('final'));
      tableEl.className = isFinalMatch ? 'ex-table point-table final-table' : 'ex-table point-table';
      const thead = `<thead><tr>
        <th class="col-rank">Rank</th>
        <th class="col-team">Team</th>
        <th class="col-wins">Wins</th>
        <th class="col-kills">Kills</th>
        <th class="col-point">Point</th>
        <th class="col-total">Total</th>
      </tr></thead>`;

      const cumulativeUpTo = getCumulativeDetails(t, mIdx); // inclusive
      const rowsSorted = t.teams.map((team, idx) => ({
        idx, name: team.name, logoKey: team.logo, wins: cumulativeUpTo.wins[idx]||0, kills: cumulativeUpTo.kills[idx]||0,
        point: cumulativeUpTo.positionPts[idx]||0, total: cumulativeUpTo.totals[idx]||0
      })).sort((a,b) => {
        if(b.total !== a.total) return b.total - a.total;
        if(b.kills !== a.kills) return b.kills - a.kills;
        return b.wins - a.wins;
      });

      const rowsHtmlPromises = rowsSorted.map(async (r, rankI) => {
        const team = t.teams[r.idx];
        const src = team.logo ? await ImageDB.getObjectURL(team.logo).catch(()=>'') : '';
        const imgHtml = src ? `<img src="${src}" class="export-team-logo">` : '';
        const trClass = rankI === 0 ? (isFinalMatch ? 'final-top1' : 'top1') :
                        rankI === 1 ? (isFinalMatch ? 'final-top2' : 'top2') :
                        rankI === 2 ? (isFinalMatch ? 'final-top3' : 'top3') : '';
        return `<tr class="${trClass}">
          <td class="numeric-cell">${String(rankI+1).padStart(2,'0')}</td>
          <td class="team-cell"><span class="export-logo">${imgHtml}</span><span class="team-name">${escapeHtml(r.name)}</span></td>
          <td class="numeric-cell">${r.wins}</td>
          <td class="numeric-cell">${r.kills}</td>
          <td class="numeric-cell">${r.point}</td>
          <td class="numeric-cell">${r.total}</td>
        </tr>`;
      });

      const rowsHtml = (await Promise.all(rowsHtmlPromises)).join('');
      tableEl.innerHTML = thead + `<tbody>${rowsHtml}</tbody>`;
      exportElementAsImage(tableEl, `${t.name}_${m.name}`, isFinalMatch);
    };
    actions.appendChild(exportBtn);

    card.appendChild(actions);
    matchesListContainer.appendChild(card);
  });
}

// create a series of matches (unchanged)
if (createSeriesBtn) {
  createSeriesBtn.onclick = function() {
    if (activeTournamentIdx === null) return alert('Select or create a tournament first.');
    let n = parseInt(createSeriesCount.value) || 0;
    if (n < 1) return alert('Enter number of matches.');
    const t = tournaments[activeTournamentIdx];
    for (let i = 1; i <= n; i++) {
      const name = (i === n) ? 'Final' : `Match ${i}`;
      const results = t.teams.map(()=>({ kills: 0, position: 1 }));
      t.matches.push({ name, date: new Date().toISOString(), results });
    }
    currentMatchIdx = t.matches.length - 1;
    saveToStorage();
    renderTournament();
    renderMatchesList();
  };
}

// --- Render tournament select (unchanged) ---
function renderTournamentSelect(){
  const seen = new Set();
  const unique = [];
  tournaments.forEach(t => {
    const key = (t.name || '').trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  });

  if (unique.length !== tournaments.length) {
    tournaments = unique;
    if (activeTournamentIdx !== null && activeTournamentIdx >= tournaments.length) {
      activeTournamentIdx = tournaments.length ? 0 : null;
    }
    saveToStorage();
  }

  if (!tournaments.length) {
    if (tournamentSelect) tournamentSelect.innerHTML = '<option value="">Select Tournament</option>';
    if (tournamentSelect) tournamentSelect.style.display = 'none';
    if (deleteTournamentBtn) deleteTournamentBtn.style.display = 'none';
    return;
  }

  if (tournaments.length === 1) {
    if (tournamentSelect) tournamentSelect.innerHTML = `<option value="0">${tournaments[0].name}</option>`;
    if (tournamentSelect) tournamentSelect.style.display = 'inline-block';
    if (deleteTournamentBtn) deleteTournamentBtn.style.display = 'inline-block';
    return;
  }

  if (tournamentSelect) tournamentSelect.innerHTML = '<option value="">Select Tournament</option>';
  tournaments.forEach((t, idx) => {
    const selected = (idx === activeTournamentIdx) ? 'selected' : '';
    const opt = `<option value="${idx}" ${selected}>${t.name}</option>`;
    if (tournamentSelect) tournamentSelect.innerHTML += opt;
  });
  if (tournamentSelect) tournamentSelect.style.display = 'inline-block';
  if (deleteTournamentBtn) deleteTournamentBtn.style.display = 'inline-block';
}
if (tournamentSelect) {
  tournamentSelect.onchange = function() {
    const idx = parseInt(this.value);
    activeTournamentIdx = isNaN(idx) ? null : idx;
    currentMatchIdx = null;
    saveToStorage();
    renderTournament();
    renderMatchesList();
  };
}

// --- Tournament modal and form (unchanged) ---
if (newTournamentBtn) {
  newTournamentBtn.onclick = function(){
    if (!tournamentModal || !tournamentTeamInputs) return;
    tournamentModal.classList.remove('hidden');
    tournamentNameInput.value = '';
    tournamentTeamInputs.innerHTML = '';
    for(let i=0;i<12;i++){
      const row = document.createElement('div');
      row.className = 'team-input-row';
      row.innerHTML = `
        <input type="text" placeholder="Team ${i+1} name" required class="team-name-input"/>
        <input type="file" accept="image/*" class="team-logo-input"/>
      `;
      tournamentTeamInputs.appendChild(row);
    }
  };
}
if (closeTournamentModal) closeTournamentModal.onclick = ()=> tournamentModal.classList.add('hidden');
window.addEventListener('click', e => { if(e.target === tournamentModal) tournamentModal.classList.add('hidden'); });

if (tournamentForm) {
  tournamentForm.onsubmit = async function(e){
    e.preventDefault();
    const name = tournamentNameInput.value.trim();
    if(!name) return alert('Enter a tournament name.');
    if(tournaments.some(t => t.name.toLowerCase() === name.toLowerCase())){
      return alert('A tournament with this name already exists. Choose a different name or delete the existing one.');
    }
    const rows = tournamentTeamInputs.querySelectorAll('.team-input-row');
    const teams = [];
    for(let i=0;i<rows.length;i++){
      const nameInput = rows[i].querySelector('.team-name-input');
      const logoInput = rows[i].querySelector('.team-logo-input'); 
      const teamName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : `Team ${i+1}`;

      let logoKey = '';
      if(logoInput && logoInput.files && logoInput.files[0]){
        try{
          const file = logoInput.files[0];
          logoKey = await ImageDB.saveFileOrData(file);
        }catch(err){
          console.error('Logo save error', err);
          logoKey = '';
        }
      }
      teams.push({ name: teamName, logo: logoKey, slot: i+1 });
    }
    tournaments.push({ name, dateCreated: new Date().toISOString(), teams, matches: [] });
    activeTournamentIdx = tournaments.length - 1;
    currentMatchIdx = null;
    saveToStorage();
    renderTournamentSelect();
    renderTournament();
    renderMatchesList();
    if (tournamentModal) tournamentModal.classList.add('hidden');
  };
}

// delete tournament (unchanged)
if (deleteTournamentBtn) {
  deleteTournamentBtn.onclick = async function(){
    if(activeTournamentIdx === null) return;
    const conf = confirm(`Delete tournament "${tournaments[activeTournamentIdx].name}" ? This will remove all its matches.`);
    if(!conf) return;
    const toDelete = tournaments[activeTournamentIdx].teams.map(t=>t.logo).filter(Boolean);
    tournaments.splice(activeTournamentIdx,1);
    for(const key of toDelete){
      try{ await ImageDB.deleteByKey(key); }catch(e){console.warn('delete logo err',e);}
    }
    activeTournamentIdx = tournaments.length ? Math.max(0, activeTournamentIdx-1) : null;
    currentMatchIdx = null;
    saveToStorage();
    renderTournamentSelect();
    renderTournament();
    renderMatchesList();
  };
}

// --- Match modal (unchanged) ---
if (newMatchBtn) {
  newMatchBtn.onclick = function(){
    if(activeTournamentIdx === null){
      alert('Please create/select a tournament first.');
      return;
    }
    if(!matchModal || !teamInputs) return;
    matchModal.classList.remove('hidden');
    matchNameInput.value = '';
    teamInputs.innerHTML = '';
    const t = tournaments[activeTournamentIdx];
    for(let i=0;i<t.teams.length;i++){
      const r = document.createElement('div');
      r.className = 'team-input-row';
      r.textContent = `Slot ${i+1} - ${t.teams[i].name}`;
      teamInputs.appendChild(r);
    }
  };
}
if (closeModal) closeModal.onclick = ()=> matchModal.classList.add('hidden');
window.addEventListener('click', e => { if(e.target === matchModal) matchModal.classList.add('hidden'); });

if (matchForm) {
  matchForm.onsubmit = function(e){
    e.preventDefault();
    const tournament = tournaments[activeTournamentIdx];
    const matchName = matchNameInput.value.trim();
    if(!matchName) return alert('Enter a match name.');
    const results = tournament.teams.map(()=>({ kills: 0, position: 1 }));
    tournament.matches.push({ name: matchName, date: new Date().toISOString(), results });
    currentMatchIdx = tournament.matches.length - 1;
    saveToStorage();
    matchModal.classList.add('hidden');
    renderTournament();
    renderMatchesList();
  };
}

// --- Main rendering (current match only) ---
function renderTournament(){
  if (!teamsTableContainer) return;
  teamsTableContainer.innerHTML = '';
  if (saveMatchBtn) saveMatchBtn.style.display = 'none';
  if (exportMatchBtn) exportMatchBtn.style.display = 'none';
  if(activeTournamentIdx === null || !tournaments[activeTournamentIdx]){
    if (matchTitle) matchTitle.textContent = 'Not Started';
    teamsTableContainer.innerHTML = '<p style="color:#bbb;">Please create or select a tournament.</p>';
    renderMatchesList();
    return;
  }
  const tournament = tournaments[activeTournamentIdx];
  renderTournamentSelect(); // update select visuals
  if(currentMatchIdx === null || !tournament.matches[currentMatchIdx]){
    if (matchTitle) matchTitle.textContent = 'No Match Selected';
    teamsTableContainer.innerHTML = `<p style="color:#bbb;">No match selected. Click 'New Match' to add one.</p>`;
    renderMatchesList();
    return;
  }
  const match = tournament.matches[currentMatchIdx];
  if (matchTitle) matchTitle.textContent = match.name;

  const cumulative = getCumulativeDetails(tournament, currentMatchIdx);

  const teamsWithPoints = tournament.teams.map((team, idx) => {
    const res = match.results[idx] || {kills:0,position:1};
    const posPts = positionPoints[(res.position||1)-1] || 0;
    const matchTotal = (res.kills||0) + posPts;
    const seriesTotal = cumulative.totals[idx] || 0;

    return {
      team,
      originalIndex: idx,
      kills: cumulative.kills[idx] || 0,
      matchKills: res.kills || 0,
      position: res.position||1,
      posPts: posPts,
      wins: cumulative.wins[idx] || 0,
      matchTotal,
      seriesTotal
    };
  });

  teamsWithPoints.sort((a, b) => {
    if (b.seriesTotal !== a.seriesTotal) return b.seriesTotal - a.seriesTotal;
    if (b.kills !== a.kills) return b.kills - a.kills;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.team.slot - b.team.slot;
  });

  const isFinal = match.name && match.name.toLowerCase().includes('final');
  const tableClass = isFinal ? 'ex-table point-table final-table' : 'ex-table point-table';

  // Table header: combine logo+team into single Team column (class col-team)
  let html = `<table class="${tableClass}"><thead><tr>
    <th class="col-rank">Rank</th>
    <th class="col-team">Team</th>
    <th class="col-wins">Wins</th>
    <th class="col-kills">Kills</th>
    <th class="col-point">Point</th>
    <th class="col-total">Total</th>
  </tr></thead><tbody>`;

  teamsWithPoints.forEach((data, displayIndex)=>{
    const originalIdx = data.originalIndex;
    const logoPlaceholder = data.team.logo ? `<img src="#" data-logo-key="${data.team.logo}" class="team-logo">` : `<div class="team-no-logo">${escapeHtml(data.team.name.charAt(0))}</div>`;
    const trClass = displayIndex === 0 ? (isFinal ? 'final-top1' : 'top1') :
                    displayIndex === 1 ? (isFinal ? 'final-top2' : 'top2') :
                    displayIndex === 2 ? (isFinal ? 'final-top3' : 'top3') : '';
    html += `<tr class="${trClass}" data-original-idx="${originalIdx}">
      <td class="numeric-cell">${String(displayIndex+1).padStart(2,'0')}</td>
      <td class="team-cell">${logoPlaceholder}<span class="team-name">${escapeHtml(data.team.name)}</span></td>
      <td class="numeric-cell">${data.wins}</td>
      <td class="numeric-cell">${data.kills}</td>
      <td class="numeric-cell">${data.posPts}</td>
      <td class="numeric-cell">${data.seriesTotal}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  teamsTableContainer.innerHTML = html;

  // populate logos after insert
  const imgEls = teamsTableContainer.querySelectorAll('img[data-logo-key]');
  imgEls.forEach(async img => {
    const key = img.getAttribute('data-logo-key');
    const src = await ImageDB.getObjectURL(key).catch(()=>'');
    if(src) img.src = src;
    else img.remove();
  });

  // double-click to open inline editor for per-match kills/position
  teamsTableContainer.querySelectorAll('tbody tr').forEach(tr=>{
    tr.addEventListener('dblclick', (e)=>{
      const origIdx = parseInt(tr.getAttribute('data-original-idx'),10);
      if(isNaN(origIdx)) return;
      openInlineEditor(origIdx);
    });
  });

  if (saveMatchBtn) saveMatchBtn.style.display = 'inline-block';
  if (exportMatchBtn) exportMatchBtn.style.display = 'inline-block';

  renderMatchesList();
}

// inline editor unchanged
function openInlineEditor(teamIdx){
  const t = tournaments[activeTournamentIdx];
  const m = t.matches[currentMatchIdx];
  const res = m.results[teamIdx] || {kills:0,position:1};
  const newKills = prompt('Kills for ' + t.teams[teamIdx].name, String(res.kills || 0));
  if(newKills === null) return;
  const newPos = prompt('Position (1..12) for ' + t.teams[teamIdx].name, String(res.position || 1));
  if(newPos === null) return;
  m.results[teamIdx].kills = parseInt(newKills) || 0;
  m.results[teamIdx].position = Math.min(12, Math.max(1, parseInt(newPos) || 1));
  saveToStorage();
  renderTournament();
  renderMatchesList();
}

function getCumulativeTotals(tournament, uptoMatchIdx){
  return getCumulativeDetails(tournament, uptoMatchIdx).totals;
}

// save match button
if (saveMatchBtn) {
  saveMatchBtn.onclick = function(){
    saveToStorage();
    alert('Match saved.');
  };
}

// export current match as PNG using html2canvas (with watermark)
if (exportMatchBtn) {
  exportMatchBtn.onclick = function(){
    const el = teamsTableContainer;
    if(!el) return;
    if(typeof html2canvas === 'undefined'){
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = () => doExport(el);
      document.body.appendChild(script);
    } else doExport(el);
  };
}

function doExport(el){
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    const cloned = el.cloneNode(true);

    // convert any data-logo-key to actual inline URLs (clone won't have already loaded src)
    const imgs = cloned.querySelectorAll('img[data-logo-key]');
    const promises = Array.from(imgs).map(async img=>{
      const key = img.getAttribute('data-logo-key');
      const src = await ImageDB.getObjectURL(key).catch(()=>'');
      if(src) img.src = src;
      else img.remove();
    });

    Promise.all(promises).then(()=>{
      const watermark = document.createElement('div');
      watermark.textContent = 'EX ESPORTS';
      watermark.style.position = 'absolute';
      watermark.style.top = '50%';
      watermark.style.left = '50%';
      watermark.style.transform = 'translate(-50%, -50%) rotate(-45deg)';
      watermark.style.fontSize = '3em';
      watermark.style.fontWeight = 'bold';
      watermark.style.color = 'rgba(255, 255, 255, 0.08)';
      watermark.style.pointerEvents = 'none';
      wrapper.appendChild(cloned);
      wrapper.appendChild(watermark);
      document.body.appendChild(wrapper);

      html2canvas(wrapper, {backgroundColor: null, scale: 2}).then(canvas=>{
        const link = document.createElement('a');
        link.download = `match_${(tournaments[activeTournamentIdx]?.matches[currentMatchIdx]?.name||'match')}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        document.body.removeChild(wrapper);
      }).catch(err=>{
        document.body.removeChild(wrapper);
        alert('Export failed: '+err.message);
      });
    }).catch(err=>{
      console.warn('Error loading images for export', err);
    });
}

// helper to escape html in team names
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// load & init
window.onload = async function(){
  await loadFromStorage();
  renderTournamentSelect();
  renderTournament();
  renderMatchesList();
};