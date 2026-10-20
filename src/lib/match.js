// The match score is worked out here in the browser, not by the AI, so it is
// transparent and updates instantly as the CV changes.
const norm = (s) => ` ${String(s ?? '').toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim()} `;

function cvText(cv) {
  const parts = [cv.personal.title, cv.summary, ...cv.skills, ...cv.languages];
  for (const e of cv.experience) parts.push(e.role, e.company, ...e.bullets);
  for (const e of cv.education) parts.push(e.qualification, e.institution, e.details);
  for (const p of cv.projects) parts.push(p.name, p.tech, p.description);
  for (const c of cv.certifications) parts.push(c.name, c.issuer);
  return norm(parts.filter(Boolean).join(' '));
}

export function matchKeywords(cv, keywords = []) {
  const text = cvText(cv);
  const matches = keywords.map((k) => ({ ...k, found: text.includes(norm(k.term)) }));
  const weight = (k) => (k.importance === 'required' ? 2 : 1);
  const total = matches.reduce((n, k) => n + weight(k), 0);
  const got = matches.filter((k) => k.found).reduce((n, k) => n + weight(k), 0);
  return {
    matches,
    score: total ? Math.round((got / total) * 100) : 0,
    found: matches.filter((k) => k.found).length,
  };
}
