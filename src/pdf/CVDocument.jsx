import { Document, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { SECTION_TITLES, dateRange } from '../lib/model.js';

// Mix a hex colour with white (amount 0 = colour, 1 = white).
function tint(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const INK = '#1d232c';
const MUTED = '#56606d';
const SIDE = 170; // Modern template sidebar width in pt

// Runs of ordinary spaces make the PDF engine add stray hyphens at line breaks,
// so separators use non-breaking spaces with one normal space to allow a break.
const SEP_BAR = '\u00a0\u00a0|\u00a0 ';
const SEP_DOT = '\u00a0\u00a0·\u00a0 ';


function theme(template, accent) {
  const light = tint(accent, 0.8);
  const base = {
    page: { fontSize: 10, lineHeight: 1.4, color: INK, paddingTop: 40, paddingBottom: 40, paddingHorizontal: 48 },
    name: { fontSize: 24, fontWeight: 700, lineHeight: 1.15 },
    title: { fontSize: 12, color: accent, marginTop: 2 },
    contact: { fontSize: 9, color: MUTED, marginTop: 6 },
    link: { color: accent, textDecoration: 'none' },
    section: { marginTop: 14 },
    heading: { fontSize: 11.5, fontWeight: 700, color: accent, paddingBottom: 3, marginBottom: 7, borderBottomWidth: 0.75, borderBottomColor: light },
    entry: { marginBottom: 8 },
    entryHead: { flexDirection: 'row', justifyContent: 'space-between' },
    entryMain: { flex: 1 },
    entryTitle: { fontWeight: 700 },
    entryOrg: { color: MUTED },
    entryMeta: { fontSize: 9, color: MUTED, textAlign: 'right', marginLeft: 12, flexShrink: 0 },
    bulletRow: { flexDirection: 'row', marginTop: 2 },
    bulletDot: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: accent, marginTop: 5, marginRight: 7, marginLeft: 2 },
    bulletText: { flex: 1 },
    details: { marginTop: 2 },
    photo: { width: 64, height: 64, borderRadius: 32, objectFit: 'cover' },
  };

  switch (template) {
    case 'executive':
      return {
        ...base,
        page: { ...base.page, fontFamily: 'Sans', fontSize: 10.5 },
        header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: accent },
        name: { ...base.name, fontFamily: 'Serif', fontSize: 26 },
        heading: { ...base.heading, fontFamily: 'Serif', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: INK, borderBottomWidth: 0 },
        bulletDot: { ...base.bulletDot, backgroundColor: INK },
      };
    case 'modern':
      return {
        ...base,
        page: { ...base.page, fontFamily: 'Plex', paddingHorizontal: 0, paddingTop: 36 },
        header: { flexDirection: 'row', alignItems: 'center', backgroundColor: accent, marginTop: -36, paddingTop: 34, paddingBottom: 26, paddingHorizontal: 40 },
        name: { ...base.name, color: '#ffffff' },
        title: { ...base.title, color: tint(accent, 0.75) },
        heading: { ...base.heading, fontSize: 11, borderBottomWidth: 0, paddingBottom: 0 },
        side: { width: SIDE, paddingLeft: 40, paddingRight: 16, fontSize: 9 },
        main: { flex: 1, paddingLeft: 20, paddingRight: 40 },
        sideBg: { position: 'absolute', top: 0, bottom: 0, left: 0, width: SIDE, backgroundColor: tint(accent, 0.93) },
        entryHead: { flexDirection: 'column' },
        entryMain: {},
        entryMeta: { ...base.entryMeta, textAlign: 'left', marginLeft: 0, fontSize: 8.5 },
        photo: { ...base.photo, borderWidth: 2, borderColor: '#ffffff' },
      };
    case 'minimal':
      return {
        ...base,
        page: { ...base.page, fontFamily: 'Plex', paddingHorizontal: 56, paddingTop: 52 },
        header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
        name: { ...base.name, fontSize: 22, fontWeight: 600 },
        title: { ...base.title, color: MUTED },
        section: { marginTop: 18 },
        heading: { fontSize: 8.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: accent, marginBottom: 8 },
        bulletDot: { ...base.bulletDot, backgroundColor: MUTED, width: 3, height: 3 },
      };
    case 'compact':
      return {
        ...base,
        page: { ...base.page, fontFamily: 'Sans', fontSize: 9.5, lineHeight: 1.35, paddingTop: 34, paddingBottom: 34, paddingHorizontal: 40 },
        header: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: accent, paddingLeft: 10 },
        name: { ...base.name, fontSize: 20 },
        section: { marginTop: 10, flexDirection: 'row' },
        heading: { width: 78, fontSize: 9.5, fontWeight: 700, color: accent, paddingRight: 8 },
        sectionBody: { flex: 1 },
        entry: { marginBottom: 6 },
        photo: { ...base.photo, width: 54, height: 54, borderRadius: 27 },
      };
    default: // classic
      return {
        ...base,
        page: { ...base.page, fontFamily: 'Serif', fontSize: 10.5, paddingTop: 34 },
        header: { alignItems: 'center', textAlign: 'center' },
        section: { marginTop: 12 },
        contact: { ...base.contact, textAlign: 'center' },
        heading: { ...base.heading, fontSize: 12 },
        photo: { ...base.photo, width: 56, height: 56, borderRadius: 28, marginBottom: 6 },
      };
  }
}

const clean = (list) => list.filter((b) => b.trim());

// Long links and emails have no spaces, so the PDF engine can't wrap them and they
// spill out of narrow columns. We break them ourselves: split after / - . _ @ and pack
// the pieces into lines of at most 22 characters (which fit the sidebar at 9pt).
// Each line is its own Text, stacked like the skills list, with the link inside it,
// so every line gets its own measured height and lines can never overlap.
const LINE_CHARS = 22;

function wrapLines(text) {
  const parts = String(text)
    .split(/(?<=[/\-._@])/)
    .flatMap((p) => (p.length > LINE_CHARS ? p.match(new RegExp(`.{1,${LINE_CHARS}}`, 'g')) : [p]));
  const lines = [];
  for (const part of parts) {
    const last = lines.length - 1;
    if (last >= 0 && (lines[last] + part).length <= LINE_CHARS) lines[last] += part;
    else lines.push(part);
  }
  return lines;
}

function Breakable({ text, src, style }) {
  return wrapLines(text).map((line, i) => (
    <Text key={i}>{src ? <Link src={src} style={style}>{line}</Link> : line}</Text>
  ));
}

const hasContent = (cv, key) => (key === 'summary' ? cv.summary.trim() : cv[key]?.length > 0);
const href = (v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);
const shortUrl = (v) => v.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');

function contactItems(p) {
  return [
    p.email && { text: p.email, src: `mailto:${p.email}` },
    p.phone && { text: p.phone, src: `tel:${p.phone.replace(/[^\d+]/g, '')}` },
    p.location && { text: p.location },
    p.linkedin && { text: shortUrl(p.linkedin), src: href(p.linkedin) },
    p.website && { text: shortUrl(p.website), src: href(p.website) },
  ].filter(Boolean);
}

function ContactLine({ p, s }) {
  const items = contactItems(p);
  if (!items.length) return null;
  return (
    <Text style={s.contact}>
      {items.map((i, n) => (
        <Text key={i.text}>
          {n > 0 && SEP_BAR}
          {i.src ? <Link src={i.src} style={s.link}>{i.text}</Link> : i.text}
        </Text>
      ))}
    </Text>
  );
}

function Entry({ s, title, org, meta, children }) {
  return (
    <View style={s.entry} wrap={false}>
      <View style={s.entryHead}>
        <View style={s.entryMain}>
          {title ? <Text style={s.entryTitle}>{title}</Text> : null}
          {org ? <Text style={s.entryOrg}>{org}</Text> : null}
        </View>
        {meta ? <Text style={s.entryMeta}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Bullets({ items, s }) {
  return clean(items).map((b, i) => (
    <View key={i} style={s.bulletRow}>
      <View style={s.bulletDot} />
      <Text style={s.bulletText}>{b}</Text>
    </View>
  ));
}

function SectionBody({ cv, id, s, stacked }) {
  switch (id) {
    case 'summary':
      return <Text>{cv.summary}</Text>;
    case 'experience':
      return cv.experience.map((e) => (
        <Entry key={e.id} s={s} title={e.role} org={[e.company, e.location].filter(Boolean).join(', ')} meta={dateRange(e)}>
          <Bullets items={e.bullets} s={s} />
        </Entry>
      ));
    case 'education':
      return cv.education.map((e) => (
        <Entry key={e.id} s={s} title={e.qualification} org={e.institution} meta={dateRange(e)}>
          {e.details ? <Text style={s.details}>{e.details}</Text> : null}
        </Entry>
      ));
    case 'projects':
      return cv.projects.map((p) => (
        <Entry key={p.id} s={s} title={p.name} org={p.tech}
          meta={p.link ? <Link src={href(p.link)} style={s.link}>{shortUrl(p.link)}</Link> : null}>
          {p.description ? <Text style={s.details}>{p.description}</Text> : null}
        </Entry>
      ));
    case 'certifications':
      return cv.certifications.map((c) => (
        <Text key={c.id} style={{ marginBottom: 3 }}>
          {c.name}
          {(c.issuer || c.year) ? <Text style={{ color: MUTED }}>{`, ${[c.issuer, c.year].filter(Boolean).join(' ')}`}</Text> : null}
        </Text>
      ));
    case 'skills':
    case 'languages':
      return stacked
        ? cv[id].map((t) => <Text key={t} style={{ marginBottom: 2 }}>{t}</Text>)
        : <Text>{cv[id].join(SEP_DOT)}</Text>;
    default:
      return null;
  }
}

// Long sections keep their heading with the first entry, and short sections stay
// together, so a heading is never left alone at the bottom of a page.
const LISTS = new Set(['experience', 'education', 'projects']);

function Section({ cv, id, s, stacked }) {
  const heading = <Text style={s.heading}>{SECTION_TITLES[id]}</Text>;
  const wrapBody = (body) => (s.sectionBody ? <View style={s.sectionBody}>{body}</View> : body);

  if (!LISTS.has(id)) {
    return (
      <View style={s.section} wrap={false}>
        {heading}
        {wrapBody(<SectionBody cv={cv} id={id} s={s} stacked={stacked} />)}
      </View>
    );
  }
  const [first, ...rest] = cv[id];
  return (
    <View style={s.section}>
      {s.sectionBody ? (
        <>
          {heading}
          <View style={s.sectionBody}><SectionBody cv={cv} id={id} s={s} /></View>
        </>
      ) : (
        <>
          <View wrap={false}>
            {heading}
            <SectionBody cv={{ ...cv, [id]: [first] }} id={id} s={s} />
          </View>
          <SectionBody cv={{ ...cv, [id]: rest }} id={id} s={s} />
        </>
      )}
    </View>
  );
}

const SIDEBAR = new Set(['skills', 'languages', 'certifications']);

export default function CVDocument({ cv }) {
  const { template, accent, order, hidden } = cv.settings;
  const p = cv.personal;
  const s = StyleSheet.create(theme(template, accent));
  const visible = order.filter((id) => !hidden.includes(id) && hasContent(cv, id));
  const photo = p.photo ? <Image src={p.photo} style={s.photo} /> : null;
  const centred = template === 'classic';
  const leftPhoto = template === 'modern';

  const nameBlock = (
    <View style={centred ? { alignItems: 'center' } : { flex: 1 }}>
      <Text style={s.name}>{p.fullName || 'Your name'}</Text>
      {p.title ? <Text style={s.title}>{p.title}</Text> : null}
      {template !== 'modern' && <ContactLine p={p} s={s} />}
    </View>
  );

  return (
    <Document title={`${p.fullName || 'My'} CV`} author={p.fullName} creator="CV Tailor" producer="CV Tailor">
      <Page size="A4" style={s.page}>
        {template === 'modern' && <View fixed style={s.sideBg} />}

        <View style={s.header}>
          {centred && photo}
          {leftPhoto && photo && <View style={{ marginRight: 16 }}>{photo}</View>}
          {nameBlock}
          {!centred && !leftPhoto && photo && <View style={{ marginLeft: 16 }}>{photo}</View>}
        </View>

        {template === 'modern' ? (
          <View style={{ flexDirection: 'row' }}>
            <View style={s.side}>
              <View style={s.section}>
                <Text style={s.heading}>Contact</Text>
                {contactItems(p).map((i) => (
                  <View key={i.text} style={{ marginBottom: 3 }}>
                    <Breakable text={i.text} src={i.src} style={i.src ? s.link : null} />
                  </View>
                ))}
              </View>
              {visible.filter((id) => SIDEBAR.has(id)).map((id) => <Section key={id} cv={cv} id={id} s={s} stacked />)}
            </View>
            <View style={s.main}>
              {visible.filter((id) => !SIDEBAR.has(id)).map((id) => <Section key={id} cv={cv} id={id} s={s} />)}
            </View>
          </View>
        ) : (
          visible.map((id) => <Section key={id} cv={cv} id={id} s={s} />)
        )}
      </Page>
    </Document>
  );
}