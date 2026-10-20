import { useEffect, useRef, useState } from 'react';

const loadRenderer = () => import('../pdf/render.js');

export async function downloadPDF(cv) {
  const { makeBlob } = await loadRenderer();
  const blob = await makeBlob(cv);
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `${(cv.personal.fullName || 'My').trim()} CV.pdf`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Shows the real PDF, so what you see is exactly what downloads.
export default function PdfPreview({ cv, onPages }) {
  const outer = useRef(null);
  const pagesEl = useRef(null);
  const [width, setWidth] = useState(0);
  const [state, setState] = useState('loading'); // loading | ready | updating | error
  const run = useRef(0);

  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      setWidth((prev) => (Math.abs(prev - w) > 4 ? w : prev));
    });
    ro.observe(outer.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!width) return undefined; // hidden (for example, the Edit tab on a phone)
    const id = ++run.current;
    setState((s) => (s === 'loading' ? s : 'updating'));
    const timer = setTimeout(async () => {
      try {
        const { makeBlob, renderPages } = await loadRenderer();
        const blob = await makeBlob(cv);
        if (id !== run.current) return; // a newer edit has started
        const holder = document.createElement('div');
        const pages = await renderPages(blob, holder, Math.min(width, 794));
        if (id !== run.current) return;
        pagesEl.current.replaceChildren(...holder.children);
        onPages(pages);
        setState('ready');
      } catch (err) {
        console.error(err);
        if (id === run.current) setState('error');
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [cv, width, onPages]);

  return (
    <div className="preview-outer" ref={outer}>
      {state === 'loading' && <div className="preview-loading">Preparing preview…</div>}
      {state === 'error' && <p className="tailor-error">The preview couldn't be drawn. Your work is saved; try refreshing the page.</p>}
      <div className={`pdf-pages${state === 'updating' ? ' is-updating' : ''}`} ref={pagesEl} />
    </div>
  );
}
