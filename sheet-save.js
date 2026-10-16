/* Save the current application to the Google Sheet (via the Apps Script web app in config.js). */
(() => {
  const url = (window.APP_CONFIG || {}).sheetUrl;
  const IDKEY = 'bank-app-record-id';
  const newId = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
      }));

  let id = null;
  try { id = localStorage.getItem(IDKEY); } catch (e) {}
  if (!id) setId(newId());

  function setId(v) { id = v; try { localStorage.setItem(IDKEY, v); } catch (e) {} }

  const btn = el('button', { type: 'button', id: 'save', text: 'Save to Sheet' });
  const status = el('span', { id: 'saveStatus' });
  status.style.cssText = 'font-size:12px;color:var(--muted);';
  const clearBtn = document.getElementById('clear');
  clearBtn.before(status, btn);

  function say(t, bad) { status.textContent = t; status.style.color = bad ? 'var(--accent)' : 'var(--muted)'; }

  function payload() {
    readForm();
    const fields = [];
    SECTIONS.forEach(s => s.fields.forEach(f => {
      let v = data[f.k] || '';
      if (f.type === 'date' && v) v = mdy(v);
      fields.push([`${s.title}: ${f.label}`, v]);
    }));
    const signatures = {};
    SIGS.forEach(s => { if (data[s.k]) signatures[`Signature: ${s.label}`] = data[s.k]; });
    return { id, branch: 'Nissan ' + branch.name, fields, signatures };
  }

  btn.addEventListener('click', async () => {
    if (!url) { say('Sheet not connected yet — add the web app URL to config.js', true); return; }
    btn.disabled = true;
    say('Saving…');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // simple request: no CORS preflight
        body: JSON.stringify(payload()),
      });
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || 'Save failed');
      say(`Saved to sheet (row ${out.row}) at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
    } catch (err) {
      say('Save failed: ' + err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  // Clearing the form starts a new application (a new row on the next save).
  window.onFormCleared = () => { setId(newId()); say(''); };
})();
