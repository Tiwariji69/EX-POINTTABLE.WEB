// history.js - renders saved tournaments and matches for History page (updated 2025-10-17)
// Expects ImageDB from script.js (if history.html loads separately, include the ImageDB code)

const positionPoints = [12,9,8,7,6,5,4,3,2,1,0,0];



// Render tournaments as cards that expand to show matches
function loadHistory() {
  const data = JSON.parse(localStorage.getItem('ex_tournaments') || '[]');
  const container = document.getElementById('historyContainer');
  container.innerHTML = '';

  if (!data.length) {
    container.innerHTML = '<p style="color:#bbb;">No tournaments saved yet.</p>';
    return;
  }

  data.forEach((t, tIdx) => {
    const tDiv = document.createElement('div');
    tDiv.className = 'history-tournament-card';
    tDiv.style.border = '1px solid rgba(255,255,255,0.06)';
    tDiv.style.borderRadius = '10px';
    tDiv.style.padding = '12px';
    tDiv.style.margin = '8px 0';
    tDiv.style.background = 'linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0.15))';

    const headingRow = document.createElement('div');
    headingRow.style.display = 'flex';
    headingRow.style.justifyContent = 'space-between';
    headingRow.style.alignItems = 'center';

    const heading = document.createElement('div');
    heading.innerHTML = `<strong style="font-size:1.05rem">${t.name}</strong><div style="color:#bbb;font-size:0.85rem">Created: ${new Date(t.dateCreated).toLocaleString()}</div>`;
    headingRow.appendChild(heading);

    const controls = document.createElement('div');

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'primary-btn';
    toggleBtn.textContent = 'Open';
    toggleBtn.style.marginRight = '8px';
    controls.appendChild(toggleBtn);

    const delTBtn = document.createElement('button');
    delTBtn.className = 'danger-btn';
    delTBtn.textContent = 'Delete Tournament';
    delTBtn.style.marginLeft = '8px';
    delTBtn.onclick = async () => {
      if (!confirm(`Delete tournament "${t.name}" and all matches?`)) return;
      const all = JSON.parse(localStorage.getItem('ex_tournaments') || '[]');
      const toDelete = (all[tIdx].teams || []).map(team => team.logo).filter(Boolean);
      all.splice(tIdx, 1);
      localStorage.setItem('ex_tournaments', JSON.stringify(all));
      for (const key of toDelete) {
        try { await ImageDB.deleteByKey(key); } catch (e) { console.warn('delete logo err', e); }
      }
      loadHistory();
    };
    controls.appendChild(delTBtn);

    headingRow.appendChild(controls);
    tDiv.appendChild(headingRow);

    const details = document.createElement('div');
    details.className = 'history-details';
    details.style.marginTop = '12px';
    details.style.display = 'none';

    const teamsRow = document.createElement('div');
    teamsRow.style.display = 'flex';
    teamsRow.style.flexWrap = 'wrap';
    teamsRow.style.gap = '8px';
    (t.teams || []).forEach(team => {
      const chip = document.createElement('div');
      chip.style.display = 'flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '8px';
      chip.style.padding = '6px 8px';
      chip.style.background = 'rgba(255,255,255,0.03)';
      chip.style.borderRadius = '6px';
      const img = document.createElement('img');
      img.style.width = '28px';
      img.style.height = '28px';
      img.style.borderRadius = '6px';
      if (team.logo && typeof ImageDB !== 'undefined') {
        ImageDB.getObjectURL(team.logo).then(src => { if (src) img.src = src; }).catch(() => {});
      } else if (team.logo && team.logo.indexOf && team.logo.indexOf('data:') === 0) {
        img.src = team.logo;
      }
      const span = document.createElement('span');
      span.textContent = team.name;
      chip.appendChild(img);
      chip.appendChild(span);
      teamsRow.appendChild(chip);
    });
    details.appendChild(teamsRow);

    const matchesContainer = document.createElement('div');
    matchesContainer.style.marginTop = '12px';
    if (!t.matches || !t.matches.length) {
      const p = document.createElement('p');
      p.textContent = 'No matches yet.';
      p.style.color = '#bbb';
      matchesContainer.appendChild(p);
    } else {
      t.matches.forEach((m, mIdx) => {
        const box = document.createElement('div');
        box.className = 'history-match-box';
        box.style.borderTop = '1px solid rgba(255,255,255,0.03)';
        box.style.padding = '10px 0';

        const titleRow = document.createElement('div');
        titleRow.style.display = 'flex';
        titleRow.style.justifyContent = 'space-between';
        titleRow.style.alignItems = 'center';

        const title = document.createElement('div');
        title.innerHTML = `<strong>${m.name}</strong><div style="color:#bbb;font-size:0.85rem">${new Date(m.date).toLocaleString()}</div>`;
        titleRow.appendChild(title);

        const ccontrols = document.createElement('div');

        const delBtn = document.createElement('button');
        delBtn.className = 'danger-btn';
        delBtn.textContent = 'Delete Match';
        delBtn.onclick = () => {
          if (!confirm(`Delete match "${m.name}" from tournament "${t.name}"?`)) return;
          const all = JSON.parse(localStorage.getItem('ex_tournaments') || '[]');
          all[tIdx].matches.splice(mIdx, 1);
          localStorage.setItem('ex_tournaments', JSON.stringify(all));
          loadHistory();
        };
        ccontrols.appendChild(delBtn);

        const exportBtn = document.createElement('button');
        exportBtn.className = 'primary-btn';
        exportBtn.textContent = 'Export Match';
        exportBtn.style.marginLeft = '8px';
        exportBtn.onclick = () => exportMatchFromHistory(tIdx, mIdx);
        ccontrols.appendChild(exportBtn);

        titleRow.appendChild(ccontrols);
        box.appendChild(titleRow);

        const cumulative = computeCumulativeForTournament(t, mIdx);
        const rows = (t.teams || []).map((team, idx) => ({
          idx, name: team.name, logoKey: team.logo,
          wins: cumulative.wins[idx] || 0, kills: cumulative.kills[idx] || 0,
          point: cumulative.positionPts[idx] || 0, total: cumulative.totals[idx] || 0
        })).sort((a, b) => {
          if (b.total !== a.total) return b.total - a.total;
          if (b.kills !== a.kills) return b.kills - a.kills;
          return b.wins - a.wins;
        });

        const table = document.createElement('table');
        table.className = 'ex-table point-table';
        const thead = `<thead><tr><th>Rank</th><th>Logo</th><th>Team</th><th>Wins</th><th>Kills</th><th>Point</th><th>Total</th></tr></thead>`;

        const isFinal = (m.name && m.name.toLowerCase().includes('final'));

        // ✅ Only finals get highlight classes
        const tbodyRows = rows.map((r, rankI) => {
          const imgHtml = r.logoKey ? `<img src="" data-logo-key="${r.logoKey}" style="width:40px;height:40px;border-radius:8px;">` : '';
          const trClass = isFinal
            ? (rankI === 0 ? 'top1' : rankI === 1 ? 'top2' : rankI === 2 ? 'top3' : '')
            : '';
          return `<tr class="${trClass}">
            <td>${String(rankI + 1).padStart(2, '0')}</td>
            <td>${imgHtml}</td>
            <td>${r.name}</td>
            <td>${r.wins}</td>
            <td>${r.kills}</td>
            <td>${r.point}</td>
            <td>${r.total}</td>
          </tr>`;
        }).join('');

        table.innerHTML = thead + `<tbody>${tbodyRows}</tbody>`;
        box.appendChild(table);

        setTimeout(() => {
          const imgs = box.querySelectorAll('img[data-logo-key]');
          imgs.forEach(img => {
            const key = img.getAttribute('data-logo-key');
            if (typeof ImageDB !== 'undefined') {
              ImageDB.getObjectURL(key).then(src => {
                if (src) img.src = src;
                else img.remove();
              }).catch(() => img.remove());
            } else img.remove();
          });
        }, 10);

        matchesContainer.appendChild(box);
      });
    }

    details.appendChild(matchesContainer);
    tDiv.appendChild(details);

    toggleBtn.onclick = () => {
      const currentlyOpen = details.style.display !== 'none';
      details.style.display = currentlyOpen ? 'none' : 'block';
      toggleBtn.textContent = currentlyOpen ? 'Open' : 'Close';
    };

    container.appendChild(tDiv);
  });
}


// compute cumulative for a tournament up to given index
function computeCumulativeForTournament(tournament, uptoIdx){
  const len = (tournament.teams || []).length;
  const totals = Array(len).fill(0);
  const kills = Array(len).fill(0);
  const positionPts = Array(len).fill(0);
  const wins = Array(len).fill(0);
  for(let m=0;m<=uptoIdx;m++){
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

function exportMatchFromHistory(tIdx, mIdx){
  const data = JSON.parse(localStorage.getItem('ex_tournaments') || '[]');
  const tournament = data[tIdx];
  if(!tournament) return alert('Tournament not found');
  const match = tournament.matches[mIdx];
  if(!match) return alert('Match not found');

  const table = document.createElement('table');
  table.className = 'ex-table point-table';
  const thead = `<thead><tr><th>Rank</th><th>Logo</th><th>Team</th><th>Wins</th><th>Kills</th><th>Point</th><th>Total</th></tr></thead>`;
  const cumulative = computeCumulativeForTournament(tournament, mIdx);
  const rows = tournament.teams.map((team, idx)=>({
    idx, team, wins: cumulative.wins[idx]||0, kills: cumulative.kills[idx]||0,
    point: cumulative.positionPts[idx]||0, total: cumulative.totals[idx]||0
  })).sort((a,b)=> {
    if(b.total !== a.total) return b.total - a.total;
    if(b.kills !== a.kills) return b.kills - a.kills;
    return b.wins - a.wins;
  });

  const tbody = rows.map((r, i)=> {
    const imgHtml = r.team.logo ? `<img src="" data-logo-key="${r.team.logo}" style="width:40px;height:40px;border-radius:8px;">` : '';
    const isFinal = (match.name && match.name.toLowerCase().includes('final'));
    const trClass = i === 0 ? (isFinal ? 'final-top1' : 'top1') :
                    i === 1 ? (isFinal ? 'final-top2' : 'top2') :
                    i === 2 ? (isFinal ? 'final-top3' : 'top3') : '';
    return `<tr class="${trClass}">
      <td>${String(i+1).padStart(2,'0')}</td>
      <td>${imgHtml}</td>
      <td>${r.team.name}</td>
      <td>${r.wins}</td>
      <td>${r.kills}</td>
      <td>${r.point}</td>
      <td>${r.total}</td>
    </tr>`;
  }).join('');

  table.innerHTML = thead + `<tbody>${tbody}</tbody>`;

  const imgs = table.querySelectorAll('img[data-logo-key]');
  const promises = Array.from(imgs).map(async img => {
    const key = img.getAttribute('data-logo-key');
    const src = await ImageDB.getObjectURL(key).catch(()=> '');
    if(src) img.src = src;
    else img.remove();
  });

  Promise.all(promises).then(()=>{
    exportElementAsImage(table, `${tournament.name}_${match.name}`, (match.name && match.name.toLowerCase().includes('final')));
  }).catch(err=>{
    console.warn('export history images err', err);
    exportElementAsImage(table, `${tournament.name}_${match.name}`, (match.name && match.name.toLowerCase().includes('final')));
  });
}

function exportElementAsImage(el, nameBase, isFinal=false){
  if(typeof html2canvas === 'undefined'){
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => doExport(el, nameBase, isFinal);
    document.body.appendChild(script);
  } else doExport(el, nameBase, isFinal);
}
function doExport(el, nameBase, isFinal){
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.display = 'inline-block';
  const cloned = el.cloneNode(true);

  if(isFinal){
    cloned.classList.add('final-table-export');
    const trs = cloned.querySelectorAll('tbody tr');
    trs.forEach((tr, i)=>{
      if(i === 0) tr.classList.add('final-top1');
      else if(i === 1) tr.classList.add('final-top2');
      else if(i === 2) tr.classList.add('final-top3');
    });
  }

  const imgs = cloned.querySelectorAll('img[data-logo-key]');
  const promises = Array.from(imgs).map(async img=>{
    const key = img.getAttribute('data-logo-key');
    const src = await ImageDB.getObjectURL(key).catch(()=> '');
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
    watermark.style.color = 'rgba(255,255,255,0.1)';
    watermark.style.pointerEvents = 'none';
    wrapper.appendChild(cloned);
    wrapper.appendChild(watermark);
    document.body.appendChild(wrapper);

    html2canvas(wrapper, {backgroundColor: null, scale: 2}).then(canvas=>{
      const link = document.createElement('a');
      link.download = `${nameBase}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      document.body.removeChild(wrapper);
    }).catch(err=>{
      document.body.removeChild(wrapper);
      alert('Export failed: '+err.message);
    });
  }).catch(err=>{
    console.warn('Error preparing images for export', err);
  });
}

window.onload = async function(){
  if(typeof ImageDB !== 'undefined'){
    await ImageDB.openDB().catch(()=>{});
  } else {
    console.warn('ImageDB helper not found - logos will be missing if stored in IDB.');
  }
  loadHistory();
};