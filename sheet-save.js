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

  /* ---------- PDF of the filled form ---------- */
  const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  let jspdfLoad;
  function loadJsPdf() {
    return jspdfLoad || (jspdfLoad = new Promise((ok, fail) => {
      const t = document.createElement('script');
      t.src = JSPDF; t.onload = () => ok(window.jspdf.jsPDF); t.onerror = () => { jspdfLoad = null; fail(new Error('could not load PDF library')); };
      document.head.append(t);
    }));
  }

  // Redraw the preview sheet (form image + every overlay) onto a canvas.
  function drawSheet() {
    const sheet = document.getElementById('sheet'), bg = document.getElementById('bg');
    const S = sheet.getBoundingClientRect();
    const c = document.createElement('canvas');
    c.width = 1821; c.height = 3000;                 // 1.5x the scanned form
    const k = c.width / S.width, u = c.width / W;    // page px -> canvas px, form px -> canvas px
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bg, 0, 0, c.width, c.height);

    const visible = n => n.style.display !== 'none' && getComputedStyle(n).display !== 'none';
    const box = n => { const r = n.getBoundingClientRect(); return { x: (r.left - S.left) * k, y: (r.top - S.top) * k, w: r.width * k, h: r.height * k }; };

    // Branch header (SVG in form coordinates)
    const svg = sheet.querySelector('svg.brand');
    if (svg) svg.querySelectorAll('rect').forEach(r => {
      if (r.closest('g') && !visible(r.closest('g'))) return;
      ctx.fillStyle = '#fff';
      ctx.fillRect(+r.getAttribute('x') * u, +r.getAttribute('y') * u, +r.getAttribute('width') * u, +r.getAttribute('height') * u);
    });
    const title = svg && svg.querySelector('#bTitle');
    if (title && visible(title)) {
      const t = title.querySelector('text');
      const size = +t.getAttribute('font-size') * u, max = 560 * u;
      ctx.font = `800 ${size}px Montserrat, "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = t.getAttribute('fill'); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const x = +t.getAttribute('x') * u, y = +t.getAttribute('y') * u, wd = ctx.measureText(t.textContent).width;
      ctx.save(); ctx.translate(x, y); if (wd > max) ctx.scale(max / wd, 1);
      ctx.fillText(t.textContent, 0, 0); ctx.restore();
    }

    // Typed text
    sheet.querySelectorAll('.f').forEach(n => {
      const txt = n.textContent; if (!txt) return;
      const cs = getComputedStyle(n), b = box(n);
      const out = cs.textTransform === 'uppercase' ? txt.toUpperCase() : txt;
      ctx.font = `${parseFloat(cs.fontSize) * k}px Arial, Helvetica, sans-serif`;
      ctx.fillStyle = cs.color; ctx.textBaseline = 'middle';
      const center = cs.textAlign === 'center';
      ctx.textAlign = center ? 'center' : 'left';
      ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y - b.h, b.w, b.h * 3); ctx.clip();
      ctx.fillText(out, center ? b.x + b.w / 2 : b.x, b.y + b.h / 2);
      ctx.restore();
    });

    // Residence circles
    sheet.querySelectorAll('.mark').forEach(n => {
      if (!visible(n)) return;
      const b = box(n);
      ctx.fillStyle = getComputedStyle(n).backgroundColor;
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2); ctx.fill();
    });

    // Signatures (object-fit: contain, anchored bottom-center)
    sheet.querySelectorAll('img.sig').forEach(n => {
      if (!visible(n) || !n.naturalWidth) return;
      const b = box(n), f = Math.min(b.w / n.naturalWidth, b.h / n.naturalHeight);
      const w = n.naturalWidth * f, h = n.naturalHeight * f;
      ctx.drawImage(n, b.x + (b.w - w) / 2, b.y + b.h - h, w, h);
    });
    return c;
  }

  async function makePdf() {
    const JsPDF = await loadJsPdf();
    const doc = new JsPDF({ unit: 'in', format: 'legal', orientation: 'portrait' });
    doc.addImage(drawSheet().toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, 8.5, 14);
    return doc.output('datauristring').split(',')[1];
  }
  window.makeApplicationPdf = makePdf;   // handy for checking the output

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
    say('Making PDF…');
    try {
      const body = payload();
      body.applicant = (data.a_name || '').trim();
      body.pdf = await makePdf();
      say('Saving…');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // simple request: no CORS preflight
        body: JSON.stringify(body),
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
