// Plain rules recruiters commonly give. Each check returns a status and a
// message that says what to do, so the user can act on it.
const WEAK_STARTS = [
  'responsible for', 'duties included', 'helped', 'worked on', 'assisted with',
  'tasked with', 'involved in', 'in charge of',
];

const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;

export function runChecks(cv, pages) {
  const out = [];
  const add = (ok, text, step) => out.push({ ok, text, step });
  const p = cv.personal;

  const missing = [
    !p.fullName && 'name', !p.email && 'email', !p.phone && 'phone number', !p.location && 'location',
  ].filter(Boolean);
  add(!missing.length,
    missing.length ? `Add your ${missing.join(', ')} so employers can reach you.` : 'Contact details are complete.',
    'personal');

  const sw = words(cv.summary);
  if (!sw) add(false, 'Add a short profile. Two or three sentences on who you are and what you do best.', 'summary');
  else if (sw < 25) add(false, `Your profile is ${sw} words. Aim for 40–80 so it says what makes you stand out.`, 'summary');
  else if (sw > 100) add(false, `Your profile is ${sw} words. Trim it to under 100; recruiters skim this part.`, 'summary');
  else add(true, 'Profile length is good.', 'summary');

  const bullets = cv.experience.flatMap((e) => e.bullets.filter((b) => b.trim()));
  if (!cv.experience.length) {
    add(false, 'Add your work experience, including internships, part-time jobs or volunteering.', 'experience');
  } else {
    const thin = cv.experience.filter((e) => e.bullets.filter((b) => b.trim()).length < 2);
    add(!thin.length,
      thin.length
        ? `Add at least two achievements for: ${thin.map((e) => e.role || 'untitled role').join(', ')}.`
        : 'Every role has at least two achievements.',
      'experience');

    const weak = bullets.filter((b) => WEAK_STARTS.some((w) => b.toLowerCase().startsWith(w)));
    add(!weak.length,
      weak.length
        ? `${weak.length} point${weak.length > 1 ? 's start' : ' starts'} with a phrase like "Responsible for". Start with an action verb instead: built, led, reduced, launched.`
        : 'Achievements start with strong action verbs.',
      'experience');

    const numbered = bullets.filter((b) => /\d/.test(b)).length;
    if (bullets.length) {
      add(numbered / bullets.length >= 0.4,
        numbered / bullets.length >= 0.4
          ? `${numbered} of ${bullets.length} achievements include numbers. Nice.`
          : `Only ${numbered} of ${bullets.length} achievements include a number. Add results like time saved, users or percentages where you can.`,
        'experience');
    }
  }

  const undated = [...cv.experience, ...cv.education].filter((i) => !i.start);
  if (undated.length) add(false, `${undated.length} entr${undated.length > 1 ? 'ies are' : 'y is'} missing a start date.`, 'experience');

  if (cv.skills.length < 5) add(false, 'List at least 5 skills that match the jobs you want.', 'skills');
  else if (cv.skills.length > 20) add(false, `You have ${cv.skills.length} skills. Keep the 12–15 most relevant ones.`, 'skills');
  else add(true, `${cv.skills.length} skills listed.`, 'skills');

  if (pages > 2) add(false, `Your CV is about ${pages} pages. Two pages is the usual maximum; cut older or less relevant detail.`, 'design');
  else if (pages) add(true, `Length is about ${pages} page${pages > 1 ? 's' : ''}.`, 'design');

  return out;
}
