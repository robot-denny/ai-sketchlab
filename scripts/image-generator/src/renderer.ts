import { createCanvas } from '@napi-rs/canvas';
import type { Particle, Palette, RGBColor, GeneratorOptions } from './types.js';

/**
 * Render particle trails onto a canvas and return a PNG buffer.
 * Each particle's history is drawn as a polyline that cycles through
 * palette colors with alpha fading along the trail length.
 */
export function renderToBuffer(
  particles: Particle[],
  palette: Palette,
  width: number,
  height: number,
  options?: GeneratorOptions,
): Buffer {
  const lineWidth = options?.lineWidth ?? 2.0;
  const alpha = options?.alpha ?? 160;
  const background: RGBColor = options?.background ?? [15, 20, 30];

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = `rgb(${background[0]},${background[1]},${background[2]})`;
  ctx.fillRect(0, 0, width, height);

  // Draw each particle trail
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const particle of particles) {
    const { history } = particle;
    if (history.length < 2) continue;

    const segmentCount = history.length - 1;

    for (let i = 0; i < segmentCount; i++) {
      // Cycle through palette colors
      const color = palette[i % palette.length];

      // Alpha fades along trail: full at start, fading toward end
      const progress = i / segmentCount;
      const segAlpha = Math.round(alpha * (1 - progress * 0.6));

      ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${segAlpha / 255})`;
      ctx.beginPath();
      ctx.moveTo(history[i][0], history[i][1]);
      ctx.lineTo(history[i + 1][0], history[i + 1][1]);
      ctx.stroke();
    }
  }

  return canvas.toBuffer('image/png');
}
