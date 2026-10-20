const test = require('node:test');
const assert = require('node:assert');
const { prepare, validate, parseJSON } = require('../src/lib/tailor');

const cv = {
  personal: { title: 'Software Engineer' },
  summary: 'Builds Power Platform apps.',
  experience: [{ id: 'x1', role: 'Engineer', company: 'Acme', bullets: ['Built 6 apps for 300 staff', ''] }],
  skills: ['React', 'Power Apps', 'SQL'],
};
const jobAd = 'We need a Power Platform developer with Power Apps, Power Automate and SQL experience. '.repeat(3);

test('rejects a short job advert', () => {
  assert.ok(prepare({ cv, jobAd: 'too short' }).error);
});

test('builds refs only for non-empty points', () => {
  const p = prepare({ cv, jobAd });
  assert.deepStrictEqual([...p.refs.keys()], ['e1.b1']);
  assert.match(p.input, /\[e1\.b1\] Built 6 apps/);
});

test('drops suggestions for unknown refs and invented skills', () => {
  const p = prepare({ cv, jobAd });
  const out = validate({
    jobTitle: 'Dev',
    keywords: [{ term: 'Power Apps', importance: 'required' }, { term: 'power apps', importance: 'required' }],
    summary: { suggested: 'New summary', reason: 'r' },
    bullets: [
      { ref: 'e1.b1', suggested: 'Delivered 6 apps for 300 staff', reason: 'r' },
      { ref: 'e9.b9', suggested: 'Invented', reason: 'r' },
    ],
    skillOrder: ['Power Apps', 'Kubernetes', 'SQL'],
  }, p);
  assert.strictEqual(out.keywords.length, 1);
  assert.strictEqual(out.bullets.length, 1);
  assert.strictEqual(out.bullets[0].experienceId, 'x1');
  assert.strictEqual(out.bullets[0].original, 'Built 6 apps for 300 staff');
  assert.deepStrictEqual(out.skillOrder, ['Power Apps', 'SQL', 'React']);
});

test('parses JSON wrapped in code fences', () => {
  assert.deepStrictEqual(parseJSON('```json\n{"a":1}\n```'), { a: 1 });
});
