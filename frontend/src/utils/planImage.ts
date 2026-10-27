/** A site plan the user loads as map background: PNG, JPG or the first page of
 *  a PDF, turned into one compressed JPEG data URL in the browser. Nothing is
 *  uploaded; the image is stored with the project. */

export interface PlanImage {
  url: string;
  width: number;
  height: number;
}

// Long side in pixels: sharp enough for a plant layout, small enough to keep
// the project file (and local storage) at a few hundred kB.
const MAX_SIDE = 2000;

const isPdf = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

async function pdfFirstPage(file: File): Promise<HTMLCanvasElement> {
  // Loaded only when someone actually opens a PDF.
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: MAX_SIDE / Math.max(base.width, base.height) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return canvas;
}

export async function fileToPlanImage(file: File): Promise<PlanImage> {
  const source: HTMLCanvasElement | ImageBitmap = isPdf(file)
    ? await pdfFirstPage(file)
    : await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d')!;
  // JPEG has no transparency: a transparent PNG would turn black without this.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return { url: out.toDataURL('image/jpeg', 0.8), width, height };
}
