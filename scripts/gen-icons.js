const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function drawIcon(ctx, s) {
  const r = s * 0.18;

  const grad = ctx.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, '#00897b');
  grad.addColorStop(1, '#0097a7');

  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(s - r, 0);
  ctx.quadraticCurveTo(s, 0, s, r);
  ctx.lineTo(s, s - r);
  ctx.quadraticCurveTo(s, s, s - r, s);
  ctx.lineTo(r, s);
  ctx.quadraticCurveTo(0, s, 0, s - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, s * 0.7, s, s * 0.3);
  ctx.restore();

  ctx.fillStyle = 'white';
  ctx.textBaseline = 'middle';

  if (s >= 48) {
    const letterSize = s * 0.32;
    const arrowY = s * 0.5;

    ctx.font = `bold ${letterSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.65;
    ctx.fillText('A', s * 0.22, arrowY);

    ctx.strokeStyle = 'white';
    ctx.lineWidth = Math.max(1.5, s * 0.02);
    ctx.globalAlpha = 0.7;
    const aMetrics = ctx.measureText('A');
    const aLeft = s * 0.22 - aMetrics.width / 2 - s * 0.01;
    const aRight = s * 0.22 + aMetrics.width / 2 + s * 0.01;
    ctx.beginPath();
    ctx.moveTo(aLeft, arrowY);
    ctx.lineTo(aRight, arrowY);
    ctx.stroke();

    ctx.globalAlpha = 0.9;
    const arrowLeft = s * 0.38;
    const arrowRight = s * 0.62;
    const arrowHeadSize = s * 0.06;
    ctx.lineWidth = Math.max(2, s * 0.025);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(arrowLeft, arrowY);
    ctx.lineTo(arrowRight, arrowY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(arrowRight - arrowHeadSize, arrowY - arrowHeadSize);
    ctx.lineTo(arrowRight, arrowY);
    ctx.lineTo(arrowRight - arrowHeadSize, arrowY + arrowHeadSize);
    ctx.stroke();

    ctx.globalAlpha = 1.0;
    ctx.font = `bold ${letterSize}px Arial`;
    ctx.fillText('B', s * 0.78, arrowY);
  } else {
    ctx.globalAlpha = 1.0;
    const cy = s / 2;
    const arrowLeft = s * 0.2;
    const arrowRight = s * 0.8;
    const headSize = s * 0.2;
    ctx.lineWidth = Math.max(1.5, s * 0.1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(arrowLeft, cy);
    ctx.lineTo(arrowRight, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(arrowRight - headSize, cy - headSize);
    ctx.lineTo(arrowRight, cy);
    ctx.lineTo(arrowRight - headSize, cy + headSize);
    ctx.stroke();
    ctx.font = `bold ${s * 0.35}px Arial`;
    ctx.textAlign = 'left';
    ctx.globalAlpha = 0.6;
    ctx.fillText('A', s * 0.02, s * 0.28);
    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'right';
    ctx.fillText('B', s * 0.98, s * 0.82);
  }
}

const outDir = path.join(__dirname, '..');
[16, 48, 128].forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  drawIcon(ctx, size);
  const buf = canvas.toBuffer('image/png');
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`Generated ${outPath} (${buf.length} bytes)`);
});
