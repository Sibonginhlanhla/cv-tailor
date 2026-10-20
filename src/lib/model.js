export const uid = () => Math.random().toString(36).slice(2, 10);

// Field definitions drive both the editor forms and validation, so a new
// field only needs adding here and in the templates.
export const SECTIONS = {
  experience: {
    title: 'Work experience',
    itemLabel: 'role',
    fields: [
      { key: 'role', label: 'Job title', placeholder: 'Software Engineer' },
      { key: 'company', label: 'Company', placeholder: 'CSIR' },
      { key: 'location', label: 'Location', placeholder: 'Pretoria' },
      { key: 'start', label: 'Start', type: 'month' },
      { key: 'end', label: 'End', type: 'month', disabledBy: 'current' },
      { key: 'current', label: 'I work here now', type: 'checkbox' },
      { key: 'bullets', label: 'What you did and achieved', type: 'bullets',
        placeholder: 'Built a Power Automate flow that cut approval time from 3 days to 4 hours' },
    ],
  },
  education: {
    title: 'Education',
    itemLabel: 'qualification',
    fields: [
      { key: 'qualification', label: 'Qualification', placeholder: 'BSc Computer Science' },
      { key: 'institution', label: 'Institution', placeholder: 'University of Pretoria' },
      { key: 'start', label: 'Start', type: 'month' },
      { key: 'end', label: 'End', type: 'month', disabledBy: 'current' },
      { key: 'current', label: 'Still studying', type: 'checkbox' },
      { key: 'details', label: 'Details (optional)', type: 'textarea',
        placeholder: 'Majors, distinctions, thesis topic' },
    ],
  },
  projects: {
    title: 'Projects',
    itemLabel: 'project',
    fields: [
      { key: 'name', label: 'Project name', placeholder: 'TechPulse' },
      { key: 'link', label: 'Link', placeholder: 'github.com/you/project' },
      { key: 'tech', label: 'Tools used', placeholder: 'Azure Functions, JavaScript' },
      { key: 'description', label: 'What it does', type: 'textarea',
        placeholder: 'An AI news assistant that searches the web and cites sources' },
    ],
  },
  certifications: {
    title: 'Certifications',
    itemLabel: 'certification',
    fields: [
      { key: 'name', label: 'Certification', placeholder: 'Microsoft Azure Fundamentals (AZ-900)' },
      { key: 'issuer', label: 'Issued by', placeholder: 'Microsoft' },
      { key: 'year', label: 'Year', placeholder: '2026' },
    ],
  },
};

export const SECTION_TITLES = {
  summary: 'Profile',
  experience: 'Work experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  languages: 'Languages',
};

export const TEMPLATES = [
  { id: 'classic', name: 'Classic', text: 'One column, serif, centred header. The safest choice for online application systems.' },
  { id: 'executive', name: 'Executive', text: 'Strong left-aligned header with serif headings. Suits senior and corporate roles.' },
  { id: 'modern', name: 'Modern', text: 'Colour header and a sidebar for contact details and skills. Good for emailing to a person.' },
  { id: 'minimal', name: 'Minimal', text: 'Lots of white space and quiet headings. Popular in tech and design.' },
  { id: 'compact', name: 'Compact', text: 'Section labels on the left and tighter spacing, for fitting more on one page.' },
];


export const DEFAULT_ORDER = ['summary', 'experience', 'projects', 'education', 'skills', 'certifications', 'languages'];

export function blankItem(section) {
  const item = { id: uid() };
  for (const f of SECTIONS[section].fields) {
    item[f.key] = f.type === 'bullets' ? [''] : f.type === 'checkbox' ? false : '';
  }
  return item;
}

export const emptyCV = () => ({
  personal: { fullName: '', title: '', email: '', phone: '', location: '', linkedin: '', website: '', photo: '' },
  summary: '',
  experience: [],
  education: [],
  projects: [],
  certifications: [],
  skills: [],
  languages: [],
  settings: { template: 'classic', accent: '#1f4e79', order: DEFAULT_ORDER, hidden: [] },
});

// Fill in anything missing so older saved CVs and imported files still load.
export function normalise(data) {
  const base = emptyCV();
  const cv = { ...base, ...data, personal: { ...base.personal, ...data?.personal } };
  cv.settings = { ...base.settings, ...data?.settings };
  if (!TEMPLATES.some((t) => t.id === cv.settings.template)) cv.settings.template = 'classic';
  const known = new Set(DEFAULT_ORDER);
  const order = (cv.settings.order || []).filter((s) => known.has(s));
  cv.settings.order = [...order, ...DEFAULT_ORDER.filter((s) => !order.includes(s))];
  for (const key of ['experience', 'education', 'projects', 'certifications', 'skills', 'languages']) {
    if (!Array.isArray(cv[key])) cv[key] = [];
  }
  return cv;
}

export const sampleCV = () => normalise({
  personal: {
    fullName: 'Thandiwe Nkosi',
    title: 'Software Engineer',
    email: 'thandiwe.nkosi@example.com',
    phone: '+27 71 234 5678',
    location: 'Pretoria, South Africa',
    linkedin: 'linkedin.com/in/thandiwe-nkosi',
    website: 'github.com/thandiwe-dev',
  },
  summary:
    'Software engineer who builds business apps on Microsoft Power Platform and SharePoint, and full-stack web apps with React and Node.js. AZ-900 certified and growing into Azure cloud development. I like turning slow manual processes into simple tools people actually use.',
  experience: [
    {
      id: uid(), role: 'Software Engineer', company: 'Example Research Council', location: 'Pretoria',
      start: '2024-02', end: '', current: true,
      bullets: [
        'Built 6 Power Apps and Power Automate solutions used by 300+ staff, replacing paper and email approvals',
        'Cut leave-approval turnaround from 3 days to under 4 hours with an automated SharePoint workflow',
        'Created Power BI dashboards that gave managers a weekly view of project spend for the first time',
      ],
    },
    {
      id: uid(), role: 'Junior Developer (Internship)', company: 'Acme Digital', location: 'Johannesburg',
      start: '2023-01', end: '2023-12', current: false,
      bullets: [
        'Developed React front-end features for a client booking platform with 10,000 monthly users',
        'Wrote integration tests that caught 12 regressions before release',
      ],
    },
  ],
  education: [
    { id: uid(), qualification: 'BSc Computer Science', institution: 'University of Pretoria',
      start: '2019-02', end: '2022-11', current: false, details: 'Majors in Computer Science and Informatics' },
  ],
  projects: [
    { id: uid(), name: 'News assistant on Azure', link: 'github.com/thandiwe-dev/news-assistant',
      tech: 'Azure Static Web Apps, Azure Functions, Entra ID',
      description: 'AI chat app that searches the web and cites sources, with keys kept server-side and per-user rate limits.' },
  ],
  certifications: [
    { id: uid(), name: 'Microsoft Azure Fundamentals (AZ-900)', issuer: 'Microsoft', year: '2026' },
  ],
  skills: ['Power Apps', 'Power Automate', 'SharePoint', 'Power BI', 'React', 'JavaScript', 'Node.js', 'Python', 'SQL', 'Azure', 'Git'],
  languages: ['English (fluent)', 'isiZulu (native)'],
});

const KEY = 'cv-builder:v1';
const TAILOR_KEY = 'cv-builder:tailor:v1';

export const emptyTailor = () => ({ jobAd: '', result: null, decisions: {}, snapshot: null, status: 'idle', error: '', runId: 0 });
export const tailorStorage = {
  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(TAILOR_KEY));
      return raw ? { ...emptyTailor(), ...raw, snapshot: raw.snapshot ? normalise(raw.snapshot) : null, status: 'idle', error: '' } : emptyTailor();
    } catch {
      return emptyTailor();
    }
  },
  save({ status, error, ...rest }) { // eslint-disable-line no-unused-vars
    try { localStorage.setItem(TAILOR_KEY, JSON.stringify(rest)); } catch { /* ignore */ }
  },
};
export const storage = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? normalise(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  },
  save(cv) {
    try { localStorage.setItem(KEY, JSON.stringify(cv)); } catch { /* storage full or blocked */ }
  },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatMonth(value) {
  if (!value) return '';
  const [y, m] = value.split('-');
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : y;
}
export function dateRange(item) {
  const start = formatMonth(item.start);
  const end = item.current ? 'Present' : formatMonth(item.end);
  if (start && end) return `${start} – ${end}`;
  return start || end;
}
