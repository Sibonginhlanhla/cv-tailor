import { useId, useMemo, useState } from 'react';
import { matchKeywords } from '../lib/match.js';

const MIN_AD = 100;
const MAX_AD = 8000;

function Suggestion({ label, original, suggested, reason, state, stale, onAccept, onDismiss }) {
  const [text, setText] = useState(suggested);
  const id = useId();

  if (state === 'accepted') {
    return (
      <div className="sugg done">
        <p className="sugg-label">{label}</p>
        <p className="sugg-applied">✓ Applied to your CV</p>
      </div>
    );
  }
  if (state === 'dismissed') return null;

  return (
    <div className="sugg">
      <p className="sugg-label">{label}</p>
      {original && (
        <div className="sugg-before">
          <span className="sugg-tag">Now</span>
          <p>{original}</p>
        </div>
      )}
      <div className="sugg-after">
        <label className="sugg-tag" htmlFor={id}>Suggested</label>
        <textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={2} />
      </div>
      {reason && <p className="hint">{reason}</p>}
      {stale ? (
        <p className="sugg-stale">You've changed this point since tailoring, so this suggestion can't be applied. Run tailoring again to get a fresh one.</p>
      ) : (
        <div className="sugg-actions">
          <button type="button" className="primary small" onClick={() => onAccept(text)}>Accept</button>
          <button type="button" className="secondary small" onClick={onDismiss}>Dismiss</button>
        </div>
      )}
    </div>
  );
}

export default function Tailor({ cv, setCv, tailor, setTailor }) {
  const adId = useId();
  const { jobAd, result, decisions, snapshot, status, error, runId } = tailor;
  const match = useMemo(() => matchKeywords(cv, result?.keywords), [cv, result]);
  const patch = (p) => setTailor((t) => ({ ...t, ...p }));
  const decide = (key, value) => setTailor((t) => ({ ...t, decisions: { ...t.decisions, [key]: value } }));

  const run = async () => {
    patch({ status: 'loading', error: '' });
    try {
      const res = await fetch('/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobAd, cv: { ...cv, personal: { ...cv.personal, photo: '' } } }), // the photo never leaves the browser
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Tailoring failed. Try again in a minute.');
      setTailor((t) => ({ ...t, status: 'idle', result: data, decisions: {}, snapshot: cv, runId: Date.now() }));
    } catch (err) {
      const offline = err instanceof TypeError;
      patch({ status: 'error', error: offline ? "Can't reach the tailoring service. Check your connection and try again." : err.message });
    }
  };

  const applySummary = (text) => {
    setCv((c) => ({ ...c, summary: text }));
    decide('summary', 'accepted');
  };

  const bulletKey = (b) => `b:${b.experienceId}:${b.index}`;
  const currentBullet = (b) => cv.experience.find((e) => e.id === b.experienceId)?.bullets[b.index];
  const isStale = (b) => currentBullet(b) !== b.original;
  const applyBullet = (b, text) => {
    setCv((c) => ({
      ...c,
      experience: c.experience.map((e) => (e.id !== b.experienceId ? e : {
        ...e, bullets: e.bullets.map((x, i) => (i === b.index ? text : x)),
      })),
    }));
    decide(bulletKey(b), 'accepted');
  };

  const applySkills = () => {
    const lower = new Map(cv.skills.map((s) => [s.toLowerCase(), s]));
    const ordered = result.skillOrder.map((s) => lower.get(s.toLowerCase())).filter(Boolean);
    setCv((c) => ({ ...c, skills: [...new Set([...ordered, ...c.skills])] }));
    decide('skills', 'accepted');
  };

  const addSkill = (term) => setCv((c) => ({ ...c, skills: [...c.skills, term] }));

  const acceptAll = () => {
    if (result.summary && !decisions.summary) applySummary(result.summary.suggested);
    result.bullets.forEach((b) => { if (!decisions[bulletKey(b)] && !isStale(b)) applyBullet(b, b.suggested); });
    if (!decisions.skills) applySkills();
  };

  const undoAll = () => {
    if (!window.confirm('Put your CV back the way it was before tailoring? Any edits you made since then will be lost.')) return;
    setCv(snapshot);
    patch({ decisions: {} });
  };

  const anyAccepted = Object.values(decisions || {}).includes('accepted');
  const roleLabel = (b) => {
    const e = cv.experience.find((x) => x.id === b.experienceId);
    return e ? `${e.role}${e.company ? `, ${e.company}` : ''}` : 'Work experience';
  };
  const pending = result ? [
    result.summary && !decisions.summary,
    ...result.bullets.map((b) => !decisions[bulletKey(b)] && !isStale(b)),
    !decisions.skills,
  ].filter(Boolean).length : 0;

  return (
    <div className="tailor">
      <p className="lead">Paste a job advert and get suggestions that line your CV up with what the employer is asking for. Nothing changes until you accept it.</p>

      <div className="field field-wide">
        <label htmlFor={adId}>Job advert</label>
        <textarea id={adId} className="job-ad" value={jobAd} maxLength={MAX_AD}
          placeholder="Paste the whole advert: the role, responsibilities and requirements."
          onChange={(e) => patch({ jobAd: e.target.value })} />
        <p className="hint">{jobAd.length.toLocaleString()} / {MAX_AD.toLocaleString()} characters</p>
      </div>

      <div className="tailor-run">
        <button type="button" className="primary" onClick={run}
          disabled={status === 'loading' || jobAd.trim().length < MIN_AD}>
          {status === 'loading' ? 'Tailoring…' : result ? 'Tailor again' : 'Tailor my CV'}
        </button>
        <p className="hint">Your CV and this advert are sent to an AI model on Microsoft Azure to make the suggestions. Neither is stored.</p>
      </div>
      {status === 'loading' && <p className="tailor-status" role="status">Reading the advert and your CV. This takes about 15 seconds.</p>}
      {status === 'error' && <p className="tailor-error" role="alert">{error}</p>}

      {result && (
        <>
          <section className="match" aria-label="Keyword match">
            <div className="score">
              <span className="score-num">{match.score}%</span>
              <span className="score-text">
                keyword match{result.jobTitle ? ` for ${result.jobTitle}` : ''}<br />
                {match.found} of {match.matches.length} key terms appear in your CV
              </span>
            </div>
            <div className="meter" aria-hidden="true"><span style={{ width: `${match.score}%` }} /></div>

            <ul className="kw">
              {match.matches.map((k) => (
                <li key={k.term} className={k.found ? 'found' : 'missing'}>
                  <span>{k.found ? '✓' : '–'} {k.term}{k.importance === 'required' && <em> required</em>}</span>
                  {!k.found && !cv.skills.some((s) => s.toLowerCase() === k.term.toLowerCase()) && (
                    <button type="button" onClick={() => addSkill(k.term)} aria-label={`Add ${k.term} to skills`}>+ Add</button>
                  )}
                </li>
              ))}
            </ul>
            <p className="hint">Only add skills you really have. A missing term is often better covered by rewording an achievement that shows it.</p>
          </section>

          <div className="tailor-head">
            <h2 className="sub-title">Suggestions</h2>
            <div className="tailor-head-actions">
              {anyAccepted && snapshot && <button type="button" className="text-btn" onClick={undoAll}>Undo all</button>}
              {pending > 0 && <button type="button" className="secondary small" onClick={acceptAll}>Accept all ({pending})</button>}
            </div>
          </div>

          <div className="suggs">
            {result.summary && (
              <Suggestion key={`${runId}-summary`} label="Profile"
                original={result.summary.original} suggested={result.summary.suggested} reason={result.summary.reason}
                state={decisions.summary} stale={false}
                onAccept={applySummary} onDismiss={() => decide('summary', 'dismissed')} />
            )}
            {result.bullets.map((b) => (
              <Suggestion key={`${runId}-${bulletKey(b)}`} label={roleLabel(b)} original={b.original}
                suggested={b.suggested} reason={b.reason} state={decisions[bulletKey(b)]}
                stale={!decisions[bulletKey(b)] && isStale(b)}
                onAccept={(text) => applyBullet(b, text)} onDismiss={() => decide(bulletKey(b), 'dismissed')} />
            ))}
            {result.skillOrder.length > 1 && decisions.skills !== 'dismissed' && (
              <div className={`sugg${decisions.skills === 'accepted' ? ' done' : ''}`}>
                <p className="sugg-label">Skills order</p>
                {decisions.skills === 'accepted' ? (
                  <p className="sugg-applied">✓ Most relevant skills now come first</p>
                ) : (
                  <>
                    <p>Put the skills this job cares about most at the front:</p>
                    <ul className="tags">{result.skillOrder.slice(0, 8).map((s) => <li key={s}>{s}</li>)}</ul>
                    <div className="sugg-actions">
                      <button type="button" className="primary small" onClick={applySkills}>Accept</button>
                      <button type="button" className="secondary small" onClick={() => decide('skills', 'dismissed')}>Dismiss</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <p className="hint tailor-tip">Tip: use Save file in the top bar before tailoring, so you keep a general version as well as a tailored one for each application.</p>
        </>
      )}
    </div>
  );
}
