// Client-side image compression via canvas.
// Resizes to fit within maxDimension, encodes as JPEG/WebP, drops EXIF.
// Returns a new File ready for storage.upload().

interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: "image/jpeg" | "image/webp";
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1200,
  quality: 0.82,
  mimeType: "image/jpeg",
};

export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const { maxDimension, quality, mimeType } = { ...DEFAULTS, ...opts };

  // Skip very small files — not worth re-encoding.
  if (file.size < 100 * 1024 && file.type === mimeType) {
    return file;
  }

  // SVG and GIF: skip (animated / vector).
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }

  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  const { width, height } = scaleDown(img.naturalWidth, img.naturalHeight, maxDimension);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, mimeType, quality);
  if (!blob) return file;

  // If compressed is bigger than original, keep original.
  if (blob.size >= file.size) {
    return file;
  }

  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  const base = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.${ext}`, { type: mimeType });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function scaleDown(
  w: number,
  h: number,
  max: number,
): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}
