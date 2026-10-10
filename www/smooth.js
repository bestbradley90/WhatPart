// Smooth client enhancements for WhatPart
(function () {
  const apiBase = (window.WHATPART_API_URL || '').replace(/\/$/, '');

  // Persist vehicle fields
  const fields = ['vehicle-year', 'vehicle-make', 'vehicle-model', 'vehicle-engine'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const saved = localStorage.getItem('whatpart_' + id);
    if (saved) el.value = saved;
    el.addEventListener('change', () => localStorage.setItem('whatpart_' + id, el.value));
  });

  // Inject feedback UI after results appear
  const observer = new MutationObserver(() => {
    const content = document.getElementById('result-content');
    if (!content || content.hidden) return;
    if (document.getElementById('feedback-row')) return;

    const row = document.createElement('div');
    row.id = 'feedback-row';
    row.style.cssText = 'margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;';
    row.innerHTML = `
      <button id="fb-yes" style="padding:8px 14px;border-radius:999px;background:#8ef2a4;color:#07141f;border:0;font-weight:800;cursor:pointer;">Correct</button>
      <button id="fb-no" style="padding:8px 14px;border-radius:999px;background:#ff6b57;color:white;border:0;font-weight:800;cursor:pointer;">Wrong</button>
      <span id="scans-left" style="margin-left:auto;color:#9bb6c9;font-size:0.85rem;"></span>
    `;
    content.appendChild(row);

    document.getElementById('fb-yes').onclick = () => sendFeedback(true);
    document.getElementById('fb-no').onclick = () => sendFeedback(false);
  });

  const resultsPanel = document.querySelector('.results-panel') || document.body;
  observer.observe(resultsPanel, { childList: true, subtree: true, attributes: true });

  async function sendFeedback(correct) {
    const partName = document.getElementById('result-name')?.textContent || '';
    const partNumber = document.getElementById('result-part-number')?.textContent || '';
    const vehicle = {
      year: document.getElementById('vehicle-year')?.value || '',
      make: document.getElementById('vehicle-make')?.value || '',
      model: document.getElementById('vehicle-model')?.value || '',
      engine: document.getElementById('vehicle-engine')?.value || ''
    };
    try {
      await fetch(apiBase + '/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correct, partName, partNumber, vehicle, notes: '' })
      });
      const row = document.getElementById('feedback-row');
      if (row) row.innerHTML = '<span style="color:#8ef2a4;font-weight:800;">Thanks — logged.</span>';
    } catch (e) {
      console.error(e);
    }
  }

  // Show scans remaining when present in last response (simple global)
  window.showScans = function (n) {
    const el = document.getElementById('scans-left');
    if (el && typeof n === 'number') el.textContent = n + ' free scans left';
  };
})();
