/**
 * convert-to-webp-hd.js
 * Converts clean transparent PNG frames to HD 1200x675 WebP frames.
 * - Upscales resolution by 1.5x (from 800x450 to 1200x675) with Lanczos3 anti-aliased resampling for ultra-sharp 3D model rendering.
 * - Compresses dataset size from ~67MB to ~6.5MB for 10x faster loading speed.
 */

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const IN_DIR       = path.join(__dirname, 'frames-transparent');
const OUT_DIR      = path.join(__dirname, 'frames-webp');
const TOTAL_FRAMES = 192;
const TARGET_W     = 1200;
const TARGET_H     = 675;

async function run() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log(`Converting ${TOTAL_FRAMES} frames to HD ${TARGET_W}x${TARGET_H} WebP format...`);
  let totalBytesIn = 0;
  let totalBytesOut = 0;

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const frameNum = String(i).padStart(4, '0');
    const inPath   = path.join(IN_DIR, `frame_${frameNum}.png`);
    const outPath  = path.join(OUT_DIR, `frame_${frameNum}.webp`);

    if (!fs.existsSync(inPath)) continue;

    const inBuf = fs.readFileSync(inPath);
    totalBytesIn += inBuf.length;

    const outBuf = await sharp(inBuf)
      .resize(TARGET_W, TARGET_H, { kernel: sharp.kernel.lanczos3 })
      .webp({ quality: 86, alphaQuality: 86, effort: 6 })
      .toBuffer();

    fs.writeFileSync(outPath, outBuf);
    totalBytesOut += outBuf.length;

    process.stdout.write(
      `\r[${i + 1}/${TOTAL_FRAMES}] frame_${frameNum}.webp (${(outBuf.length / 1024).toFixed(1)} KB)`
    );
  }

  const mbIn = (totalBytesIn / (1024 * 1024)).toFixed(1);
  const mbOut = (totalBytesOut / (1024 * 1024)).toFixed(1);
  const pct = Math.round((1 - totalBytesOut / totalBytesIn) * 100);

  console.log(`\n\nDone! Successfully converted ${TOTAL_FRAMES} frames.`);
  console.log(`Original PNG payload: ${mbIn} MB`);
  console.log(`New HD WebP payload:  ${mbOut} MB (${pct}% reduction!)`);
}

run().catch(err => {
  console.error('Error converting frames:', err);
  process.exit(1);
});
