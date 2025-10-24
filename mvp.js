// ===== EX TOURNAMENT MVP JS (updated to use ImageDB logos and final-MVP behavior) =====

let mvpTournamentData = null;
let customCards = JSON.parse(localStorage.getItem('ex_custom_mvp_cards') || '[]');
const maxMvpCards = 3;
const positionPoints = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0];

// Load matches from localStorage (mvp payload)
function loadMvpData() {
    const data = localStorage.getItem('ex_mvp_data');
    if (data) mvpTournamentData = JSON.parse(data);
}

// Save custom cards
function saveCustomCards() {
    localStorage.setItem('ex_custom_mvp_cards', JSON.stringify(customCards));
}

function getTeamStats() {
    if (!mvpTournamentData || !mvpTournamentData.teams || !mvpTournamentData.matches) return [];

    const teams = mvpTournamentData.teams;
    const teamStats = teams.map(team => ({
        name: team.name,
        logoKey: team.logo,
        slot: team.slot,
        kill: 0,
        positionPoints: 0,
        total: 0
    }));

    mvpTournamentData.matches.forEach(match => {
        match.results.forEach((res, teamIdx) => {
            const stats = teamStats[teamIdx];
            if (!stats) return;
            const kills = res.kills || 0;
            const position = res.position || 1;
            const posPts = positionPoints[position - 1] || 0;
            const total = kills + posPts;
            stats.kill += kills;
            stats.positionPoints += posPts;
            stats.total += total;
        });
    });

    return teamStats;
}

// Render MVP Cards (top 3)
async function renderMVPCards() {
    const container = document.getElementById('mvpCardsContainer');
    if (!container) return;
    container.innerHTML = '';

    let teamStats = getTeamStats().sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        if (b.kill !== a.kill) return b.kill - a.kill;
        return a.slot - b.slot;
    });

    for (let i = 0; i < Math.min(maxMvpCards, teamStats.length); i++) {
        const team = teamStats[i];
        const rank = i + 1;
        const card = document.createElement('div');
        card.className = `mvp-card auto-card top${rank}`;
        card.innerHTML = `
            <div class="card-bg"></div>
            <div class="mvp-rank">#${rank}</div>
            <button class="delete-btn" title="Delete MVP Card" data-slot="${team.slot}">🗑️</button>
            <div class="mvp-title">TOP TEAM MVP</div>
            <div class="mvp-logo-name-wrapper">
                <div class="mvp-team-logo-placeholder"></div>
                <div class="mvp-team-name">${team.name}</div>
            </div>
            <div class="mvp-stats-bar">
                <div class="mvp-stat-item"><span>KILLS</span><span class="stat-value">${team.kill}</span></div>
                <div class="mvp-stat-item"><span>POSITION PTS</span><span class="stat-value">${team.positionPoints}</span></div>
                <div class="mvp-stat-item total-stat"><span>TOTAL PTS</span><span class="stat-value">${team.total}</span></div>
            </div>
        `;
        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.onclick = () => deleteMvpCard(team.slot);
        // logo handling: either dataURL or ImageDB key
        const logoWrapper = card.querySelector('.mvp-team-logo-placeholder');
        if(team.logoKey && typeof ImageDB !== 'undefined'){
            ImageDB.getObjectURL(team.logoKey).then(src=>{
                if(src){
                    const img = document.createElement('img');
                    img.className = 'mvp-team-logo';
                    img.src = src;
                    logoWrapper.replaceWith(img);
                } else {
                    logoWrapper.textContent = team.name.charAt(0);
                    logoWrapper.className = 'mvp-no-logo';
                }
            }).catch(()=>{
                logoWrapper.textContent = team.name.charAt(0);
                logoWrapper.className = 'mvp-no-logo';
            });
        } else if (team.logoKey && typeof team.logoKey === 'string' && team.logoKey.indexOf('data:')===0){
            const img = document.createElement('img');
            img.className = 'mvp-team-logo';
            img.src = team.logoKey;
            logoWrapper.replaceWith(img);
        } else {
            logoWrapper.textContent = team.name.charAt(0);
            logoWrapper.className = 'mvp-no-logo';
        }
        container.appendChild(card);
    }
}

// Delete MVP card (by slot)
function deleteMvpCard(slot) {
    if (!mvpTournamentData || !mvpTournamentData.teams) return;
    if (!confirm('Are you sure you want to remove this MVP card?')) return;
    const idx = mvpTournamentData.teams.findIndex(t => t.slot === slot);
    if (idx === -1) return;
    // remove team and corresponding results
    mvpTournamentData.teams.splice(idx,1);
    mvpTournamentData.matches.forEach(match=>{
      match.results.splice(idx,1);
    });
    localStorage.setItem('ex_mvp_data', JSON.stringify(mvpTournamentData));
    renderMVPCards();
}

// Custom cards render
function renderCustomCards() {
    const container = document.getElementById('customCardsContainer');
    if (!container) return;
    container.innerHTML = '';

    customCards.forEach((cardData, idx) => {
        const card = document.createElement('div');
        card.className = `mvp-card custom-card`;

        const bgPath = 'assets/css/images/mvp_card.webp';
        card.style.backgroundImage = `url("${bgPath}")`;
        card.style.backgroundSize = 'cover';
        card.style.backgroundPosition = 'center';
        card.style.backgroundRepeat = 'no-repeat';

        card.innerHTML = `
          <button class="delete-btn" data-idx="${idx}">🗑️</button>
          <div class="card-bg"></div>
          <div class="mvp-custom-title">${cardData.customTitle || 'CUSTOM MVP'}</div>
          <div class="mvp-logo-name-wrapper">
            <div class="mvp-team-logo-placeholder"></div>
            <div class="mvp-team-name">${cardData.teamName}</div>
          </div>
          <div class="mvp-stats-bar">
            <div class="mvp-stat-item total-stat"><span>${cardData.customStat}</span></div>
          </div>
        `;
        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.onclick = () => deleteCustomCard(idx);

        const logoWrapper = card.querySelector('.mvp-team-logo-placeholder');
        if (cardData.logo && cardData.logo.indexOf && cardData.logo.indexOf('data:')===0){
            const img = document.createElement('img');
            img.className = 'mvp-team-logo';
            img.src = cardData.logo;
            logoWrapper.replaceWith(img);
        } else {
            logoWrapper.textContent = (cardData.teamName||'')[0] || '?';
            logoWrapper.className = 'mvp-no-logo';
        }
        container.appendChild(card);
    });
}

// Delete custom card
function deleteCustomCard(idx) {
    if (confirm('Are you sure you want to delete this custom card?')) {
        customCards.splice(idx, 1);
        saveCustomCards();
        renderCustomCards();
    }
}

// custom card form
const customCardForm = document.getElementById('customCardForm');
if (customCardForm) {
    customCardForm.onsubmit = async function(e) {
        e.preventDefault();
        const teamName = document.getElementById('customTeamName').value.trim();
        const customTitle = document.getElementById('customTitle').value.trim();
        const customStat = document.getElementById('customStat').value.trim();
        const logoInput = document.getElementById('customTeamLogo');
        let logoData = '';
        if (logoInput.files && logoInput.files[0]) {
            logoData = await readFileAsDataURL(logoInput.files[0]);
        }
        customCards.push({
            teamName,
            logo: logoData,
            customTitle,
            customStat
        });
        saveCustomCards();
        customCardForm.reset();
        renderCustomCards();
    };
}

// readFile helper
function readFileAsDataURL(file) {
    return new Promise(res => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result);
        reader.readAsDataURL(file);
    });
}

// export all MVP cards as PNG
document.getElementById('exportAllBtn').onclick = async function() {
    const mvpCards = document.querySelectorAll('.mvp-card');
    if (!mvpCards.length) return alert("No MVP cards to export!");

    const exportDiv = document.createElement('div');
    exportDiv.style.display = 'flex';
    exportDiv.style.flexWrap = 'wrap';
    exportDiv.style.gap = '32px';
    exportDiv.style.background = 'linear-gradient(120deg, #101012 0%, #1a1b1d 100%)';
    exportDiv.style.padding = '32px';
    exportDiv.style.borderRadius = '15px';

    mvpCards.forEach(card => {
        const clone = card.cloneNode(true);
        const deleteBtn = clone.querySelector('.delete-btn');
        if (deleteBtn) deleteBtn.remove();
        exportDiv.appendChild(clone);
    });
    document.body.appendChild(exportDiv);

    if (typeof html2canvas === "undefined") {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = () => exportAsImage(exportDiv);
        document.body.appendChild(script);
    } else {
        exportAsImage(exportDiv);
    }
};

function exportAsImage(exportDiv) {
    html2canvas(exportDiv, {scale: 2, backgroundColor: null}).then(canvas => {
        const link = document.createElement('a');
        link.download = `EX_MVP_Cards_${new Date().toISOString().slice(0,16).replace(/[:T]/g,'_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        exportDiv.remove();
    }).catch(err => {
        alert('Export failed: ' + err.message);
        exportDiv.remove();
    });
}

// on page load
window.onload = async function() {
    if (typeof ImageDB !== 'undefined') {
        await ImageDB.openDB().catch(()=>{});
    }
    loadMvpData();
    renderMVPCards();
    renderCustomCards();
};