import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PdfPreview, { downloadPDF } from './components/PdfPreview.jsx';
import { Field, ListEditor, TagEditor } from './components/Editors.jsx';
import Tailor from './components/Tailor.jsx';
import { SECTION_TITLES, TEMPLATES, emptyCV, emptyTailor, normalise, sampleCV, storage, tailorStorage } from './lib/model.js';
import { runChecks } from './lib/checks.js';

const STEPS = [
  { id: 'personal', label: 'Personal details' },
  { id: 'summary', label: 'Profile' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills & extras' },
  { id: 'tailor', label: 'Tailor to a job' },
  { id: 'design', label: 'Design' },
  { id: 'review', label: 'Review & download' },
];


const ACCENTS = ['#1f4e79', '#0f6b5c', '#7a2e4a', '#8a5a00', '#2f2f2f'];

const SKILL_SUGGESTIONS = [
  'Communication', 'Problem solving', 'Teamwork', 'Project management', 'Microsoft Excel',
  'Power Apps', 'Power Automate', 'SharePoint', 'Power BI', 'Azure', 'JavaScript', 'React', 'Python', 'SQL', 'Git',
];

// Crops to a centred square and shrinks to 400px, so the photo stays small in storage.
function squarePhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const canvas = Object.assign(document.createElement('canvas'), { width: 400, height: 400 });
      canvas.getContext('2d').drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 400, 400);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

function downloadJSON(cv) {
  const name = (cv.personal.fullName || 'my-cv').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const blob = new Blob([JSON.stringify(cv, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}-cv.json` });
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [cv, setCv] = useState(() => storage.load() ?? emptyCV());
  const [step, setStep] = useState('personal');
  const [view, setView] = useState('edit'); // small screens show one panel at a time
  const [pages, setPages] = useState(1);
  const [notice, setNotice] = useState('');
  const [tailor, setTailor] = useState(() => tailorStorage.load());
  const fileInput = useRef(null);

  useEffect(() => { storage.save(cv); }, [cv]);
  useEffect(() => { tailorStorage.save(tailor); }, [tailor]);
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const set = (key, value) => setCv((c) => ({ ...c, [key]: value }));
  const setPersonal = (key, value) => setCv((c) => ({ ...c, personal: { ...c.personal, [key]: value } }));
  const setSettings = (patch) => setCv((c) => ({ ...c, settings: { ...c.settings, ...patch } }));
  const onPages = useCallback((n) => setPages(n), []);

  const checks = useMemo(() => runChecks(cv, pages), [cv, pages]);
  const toFix = checks.filter((c) => !c.ok).length;
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const goTo = (id) => {
    setStep(id);
    setView('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadExample = () => {
    if (cv.personal.fullName && !window.confirm('Replace your current CV with the example?')) return;
    setCv(sampleCV());
    setNotice('Example CV loaded. Edit it or start over any time.');
  };

  const startOver = () => {
    if (!window.confirm('Clear everything and start a new CV? Use Save file first if you want to keep this one.')) return;
    setCv(emptyCV());
    setTailor(emptyTailor());
    goTo('personal');
  };

  const importFile = async (file) => {
    if (!file) return;
    try {
      setCv(normalise(JSON.parse(await file.text())));
      setNotice('CV opened.');
    } catch {
      setNotice("That isn't a saved CV file. Choose a .json file you saved from this app.");
    } finally {
      fileInput.current.value = '';
    }
  };

  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    setDownloading(true);
    try {
      await downloadPDF(cv);
    } catch (err) {
      console.error(err);
      setNotice('The PDF could not be created. Try again.');
    } finally {
      setDownloading(false);
    }
  };

  const addPhoto = async (file) => {
    if (!file) return;
    try {
      setPersonal('photo', await squarePhoto(file));
    } catch {
      setNotice('That image could not be read. Try a JPG or PNG.');
    }
  };

  const moveSection = (index, dir) => {
    const order = [...cv.settings.order];
    const [s] = order.splice(index, 1);
    order.splice(index + dir, 0, s);
    setSettings({ order });
  };
  const toggleSection = (id) => {
    const hidden = cv.settings.hidden.includes(id)
      ? cv.settings.hidden.filter((h) => h !== id)
      : [...cv.settings.hidden, id];
    setSettings({ hidden });
  };

  const p = cv.personal;

  return (
    <>
      <div className="app">
        <header className="topbar">
          <p className="logo">CV Tailor</p>
          <div className="topbar-actions">
            <button type="button" className="text-btn" onClick={loadExample}>Load example</button>
            <button type="button" className="text-btn" onClick={() => fileInput.current.click()}>Open file</button>
            <button type="button" className="text-btn" onClick={() => downloadJSON(cv)}>Save file</button>
            <button type="button" className="text-btn" onClick={startOver}>Start over</button>
            <button type="button" className="primary" onClick={download} disabled={downloading}
              >{downloading ? 'Preparing…' : 'Download PDF'}</button>
            <input ref={fileInput} type="file" accept="application/json,.json" hidden
              onChange={(e) => importFile(e.target.files[0])} />
          </div>
        </header>

        <div className="view-toggle" role="tablist" aria-label="Panel">
          <button type="button" role="tab" aria-selected={view === 'edit'} onClick={() => setView('edit')}>Edit</button>
          <button type="button" role="tab" aria-selected={view === 'preview'} onClick={() => setView('preview')}>Preview</button>
        </div>

        <div className="layout" data-view={view}>
          <nav className="steps" aria-label="CV sections">
            <ol>
              {STEPS.map((s, i) => (
                <li key={s.id}>
                  <button type="button" aria-current={step === s.id ? 'step' : undefined} onClick={() => goTo(s.id)}>
                    <span className="step-num">{i + 1}</span>
                    {s.label}
                    {s.id === 'review' && toFix > 0 && <span className="badge" aria-label={`${toFix} suggestions`}>{toFix}</span>}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <main className="editor">
            <h1 className="step-title">{STEPS[stepIndex].label}</h1>

            {step === 'personal' && (
              <>
                <p className="lead">How employers will see and contact you.</p>
                <div className="grid">
                  <Field label="Full name" value={p.fullName} onChange={(v) => setPersonal('fullName', v)} placeholder="Thandiwe Nkosi" />
                  <Field label="Job title you're going for" value={p.title} onChange={(v) => setPersonal('title', v)} placeholder="Software Engineer" />
                  <Field label="Email" type="email" value={p.email} onChange={(v) => setPersonal('email', v)} placeholder="you@example.com" />
                  <Field label="Phone" type="tel" value={p.phone} onChange={(v) => setPersonal('phone', v)} placeholder="+27 71 234 5678" />
                  <Field label="Location" value={p.location} onChange={(v) => setPersonal('location', v)} placeholder="Pretoria, South Africa"
                    hint="City and country is enough. Leave out your street address." />
                  <Field label="LinkedIn (optional)" value={p.linkedin} onChange={(v) => setPersonal('linkedin', v)} placeholder="linkedin.com/in/your-name" />
                  <Field label="Website or GitHub (optional)" value={p.website} onChange={(v) => setPersonal('website', v)} placeholder="github.com/your-name" />
                </div>
                <div className="photo-field">
                  <p className="photo-label">Photo (optional)</p>
                  <div className="photo-row">
                    {p.photo ? <img src={p.photo} alt="Your CV photo" className="photo-thumb" /> : <span className="photo-thumb empty" aria-hidden="true">👤</span>}
                    <div className="photo-actions">
                      <label className="secondary small file-btn">
                        {p.photo ? 'Change photo' : 'Add photo'}
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { addPhoto(e.target.files[0]); e.target.value = ''; }} />
                      </label>
                      {p.photo && <button type="button" className="text-btn" onClick={() => setPersonal('photo', '')}>Remove</button>}
                    </div>
                  </div>
                  <p className="hint">Common in South Africa, much of Europe and the Middle East. Leave it out when applying in the US, UK or Canada, where photos are discouraged. Use a clear, professional head-and-shoulders shot.</p>
                </div>
              </>
            )}

            {step === 'summary' && (
              <>
                <p className="lead">Two or three sentences at the top of your CV: who you are, what you're good at, and what you want next.</p>
                <Field label="Profile" type="textarea" wide value={cv.summary} onChange={(v) => set('summary', v)}
                  placeholder="Software engineer who builds business apps on Power Platform and web apps with React…"
                  hint={`${cv.summary.trim().split(/\s+/).filter(Boolean).length} words. Aim for 40–80.`} />
              </>
            )}

            {step === 'experience' && (
              <>
                <p className="lead">Most recent first. Internships, part-time work and volunteering all count.</p>
                <ListEditor section="experience" items={cv.experience} onChange={(v) => set('experience', v)} />
              </>
            )}

            {step === 'education' && (
              <>
                <p className="lead">Your highest qualification first.</p>
                <ListEditor section="education" items={cv.education} onChange={(v) => set('education', v)} />
              </>
            )}

            {step === 'projects' && (
              <>
                <p className="lead">Things you built on your own or at work. Great if you're early in your career.</p>
                <ListEditor section="projects" items={cv.projects} onChange={(v) => set('projects', v)} />
              </>
            )}

            {step === 'skills' && (
              <>
                <TagEditor label="Skills" value={cv.skills} onChange={(v) => set('skills', v)}
                  placeholder="e.g. Power Automate" suggestions={SKILL_SUGGESTIONS} />
                <TagEditor label="Languages" value={cv.languages} onChange={(v) => set('languages', v)}
                  placeholder="e.g. isiZulu (native)" />
                <h2 className="sub-title">Certifications</h2>
                <ListEditor section="certifications" items={cv.certifications} onChange={(v) => set('certifications', v)} />
              </>
            )}

            {step === 'tailor' && <Tailor cv={cv} setCv={setCv} tailor={tailor} setTailor={setTailor} />}

            {step === 'design' && (
              <>
                <fieldset className="templates">
                  <legend>Template</legend>
                  {TEMPLATES.map((t) => (
                    <label key={t.id} className={`template-card${cv.settings.template === t.id ? ' selected' : ''}`}>
                      <input type="radio" name="template" value={t.id} checked={cv.settings.template === t.id}
                        onChange={() => setSettings({ template: t.id })} />
                      <span className={`thumb thumb-${t.id}`} aria-hidden="true"><i /><i /><i /><i /></span>
                      <strong>{t.name}</strong>
                      <span>{t.text}</span>
                    </label>
                  ))}
                </fieldset>

                <fieldset className="accents">
                  <legend>Accent colour</legend>
                  {ACCENTS.map((c) => (
                    <label key={c} className="swatch" style={{ '--c': c }}>
                      <input type="radio" name="accent" checked={cv.settings.accent === c}
                        onChange={() => setSettings({ accent: c })} aria-label={c} />
                    </label>
                  ))}
                  <label className="custom-colour">
                    Custom
                    <input type="color" value={cv.settings.accent} onChange={(e) => setSettings({ accent: e.target.value })} />
                  </label>
                </fieldset>

                <fieldset className="order">
                  <legend>Sections</legend>
                  <p className="hint">Put your strongest section near the top. Untick a section to leave it out.</p>
                  <ol>
                    {cv.settings.order.map((id, i) => (
                      <li key={id}>
                        <label className="check">
                          <input type="checkbox" checked={!cv.settings.hidden.includes(id)} onChange={() => toggleSection(id)} />
                          {SECTION_TITLES[id]}
                        </label>
                        <span className="item-actions">
                          <button type="button" className="icon-btn" disabled={i === 0} onClick={() => moveSection(i, -1)} aria-label={`Move ${SECTION_TITLES[id]} up`}>↑</button>
                          <button type="button" className="icon-btn" disabled={i === cv.settings.order.length - 1} onClick={() => moveSection(i, 1)} aria-label={`Move ${SECTION_TITLES[id]} down`}>↓</button>
                        </span>
                      </li>
                    ))}
                  </ol>
                </fieldset>
              </>
            )}

            {step === 'review' && (
              <>
                <p className="lead">
                  {toFix === 0 ? 'Your CV passes every check. Download it when you are ready.' : `${toFix} suggestion${toFix > 1 ? 's' : ''} to make your CV stronger. Select one to jump to that section.`}
                </p>
                <ul className="checks">
                  {checks.map((c, i) => (
                    <li key={i} className={c.ok ? 'ok' : 'todo'}>
                      <span className="check-mark" aria-hidden="true">{c.ok ? '✓' : '!'}</span>
                      {c.ok ? c.text : <button type="button" className="link-btn" onClick={() => goTo(c.step)}>{c.text}</button>}
                    </li>
                  ))}
                </ul>
                <div className="download-box">
                  <button type="button" className="primary" onClick={download} disabled={downloading}
              >{downloading ? 'Preparing…' : 'Download PDF'}</button>
                  <p className="hint">You get an A4 PDF with real, selectable text, so applicant tracking systems can read it. The preview shows exactly what downloads.</p>
                </div>
              </>
            )}

            <div className="step-nav">
              {stepIndex > 0 && <button type="button" className="secondary" onClick={() => goTo(STEPS[stepIndex - 1].id)}>Back</button>}
              {stepIndex < STEPS.length - 1 && <button type="button" className="primary" onClick={() => goTo(STEPS[stepIndex + 1].id)}>Next: {STEPS[stepIndex + 1].label}</button>}
            </div>
            <p className="saved">Saved automatically on this device.</p>
          </main>

          <section className="preview" aria-label="CV preview">
            <p className="preview-meta">{pages} page{pages > 1 ? 's' : ''} · A4</p>
            <PdfPreview cv={cv} onPages={onPages} />
          </section>
        </div>

        {notice && <p className="toast" role="status">{notice}</p>}
      </div>

    </>
  );
}
