// Loaded on demand: the PDF libraries are large, so the editor appears first.
import { createElement } from 'react';
import { Font, pdf } from '@react-pdf/renderer';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.min.mjs'; // legacy build: works on older phones and browsers
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import CVDocument from './CVDocument.jsx';

import serif400 from '@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff?url';
import serif600 from '@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff?url';
import serif700 from '@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff?url';
import sans400 from '@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff?url';
import sans600 from '@fontsource/source-sans-3/files/source-sans-3-latin-600-normal.woff?url';
import sans700 from '@fontsource/source-sans-3/files/source-sans-3-latin-700-normal.woff?url';
import plex400 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff?url';
import plex600 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff?url';
import plex700 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const family = (name, [w400, w600, w700]) => Font.register({
  family: name,
  fonts: [{ src: w400, fontWeight: 400 }, { src: w600, fontWeight: 600 }, { src: w700, fontWeight: 700 }],
});
family('Serif', [serif400, serif600, serif700]);
family('Sans', [sans400, sans600, sans700]);
family('Plex', [plex400, plex600, plex700]);
Font.registerHyphenationCallback((word) => [word]); // never split words across lines

export function makeBlob(cv) {
  return pdf(createElement(CVDocument, { cv })).toBlob();
}

// Draws every page of the PDF as a canvas, then swaps them in at once to avoid flicker.
export async function renderPages(blob, container, cssWidth) {
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  const doc = await task.promise;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const canvases = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.className = 'pdf-page';
    canvas.setAttribute('aria-label', `Page ${n} of ${doc.numPages}`);
    await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
    canvases.push(canvas);
  }
  container.replaceChildren(...canvases);
  const pages = doc.numPages;
  task.destroy();
  return pages;
}
