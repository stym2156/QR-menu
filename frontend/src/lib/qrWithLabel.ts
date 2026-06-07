"use client";

import QRCode from "qrcode";

interface QrWithLabelOptions {
  url: string;
  label: string;
  size: number;
  // Margin around the QR (in QR modules, not pixels). qrcode lib default
  // is 4; we use 2 to keep the printed sticker compact.
  margin?: number;
}

/**
 * Render a QR code with a label (typically a table number) burned into
 * the center. Uses error correction level "H" (~30% recovery) so the
 * center white patch up to ~22% of the QR area stays scannable.
 *
 * Returns a PNG data URL — works for both <img src> previews and
 * download links.
 */
export async function qrWithLabel({
  url,
  label,
  size,
  margin = 2,
}: QrWithLabelOptions): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  await QRCode.toCanvas(canvas, url, {
    width: size,
    margin,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");

  // 22% of QR area — well inside H's 30% recovery budget.
  const boxSize = Math.floor(size * 0.22);
  const cx = size / 2;
  const cy = size / 2;
  const x = cx - boxSize / 2;
  const y = cy - boxSize / 2;
  const radius = Math.floor(boxSize * 0.18);

  // Rounded white box with thin dark border for crisp contrast.
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  drawRoundedRect(ctx, x, y, boxSize, boxSize, radius);
  ctx.fill();

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(2, Math.floor(size / 140));
  ctx.beginPath();
  drawRoundedRect(ctx, x, y, boxSize, boxSize, radius);
  ctx.stroke();

  // Auto-shrink font for multi-digit numbers so "144" still fits.
  const baseFontSize = Math.floor(boxSize * 0.62);
  const fontSize =
    label.length >= 3 ? Math.floor(baseFontSize * 0.7) : baseFontSize;
  ctx.fillStyle = "#000000";
  ctx.font = `800 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", "Sarabun", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy);

  return canvas.toDataURL("image/png");
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
