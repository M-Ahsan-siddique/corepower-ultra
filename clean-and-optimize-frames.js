/**
 * clean-and-optimize-frames.js
 * Blackout solution: Erases the blue shadow and watermark star in the bottom-right
 * quadrant of all 192 frames, making them fully transparent so they blend
 * seamlessly with the webpage's black background.
 */

const { Jimp } = require('jimp');
const fs       = require('fs');
const path     = require('path');

const FRAMES_DIR   = path.join(__dirname, 'frames-transparent');
const TOTAL_FRAMES = 192;

// Scan region for the bottom-right blue shadow
const startX = 530;
const startY = 290;

async function run() {
  console.log(`Blacking out shadow region from all ${TOTAL_FRAMES} frames...`);

  let totalBlackedOut = 0;

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const frameNum  = String(i).padStart(4, '0');
    const framePath = path.join(FRAMES_DIR, `frame_${frameNum}.png`);

    if (!fs.existsSync(framePath)) continue;

    const img = await Jimp.read(framePath);
    let frameBlackedOut = 0;

    // Scan bottom-right quadrant
    img.scan(startX, startY, img.width - startX, img.height - startY, function(x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      const a = this.bitmap.data[idx + 3];

      if (a > 0) {
        // If it's in the corner (watermark logo region), make it fully transparent
        if (x >= 700 && y >= 350) {
          this.bitmap.data[idx + 0] = 0;
          this.bitmap.data[idx + 1] = 0;
          this.bitmap.data[idx + 2] = 0;
          this.bitmap.data[idx + 3] = 0; // Alpha = 0 (Transparent)
          frameBlackedOut++;
        } else {
          // If it's blue smudge/glow, desaturate it by setting R, G, B channels to the R channel value.
          // This removes the blue color while preserving the underlying gray spotlight/background intensity.
          if (b > r + 12 && b > g + 4) {
            this.bitmap.data[idx + 0] = r;
            this.bitmap.data[idx + 1] = r;
            this.bitmap.data[idx + 2] = r;
            // keep original alpha
            frameBlackedOut++;
          }
        }
      }
    });

    totalBlackedOut += frameBlackedOut;

    // Overwrite frame with changes
    await img.write(framePath);

    process.stdout.write(`\r[${i + 1}/${TOTAL_FRAMES}] Cleaned frame_${frameNum}.png (${frameBlackedOut} px blacked out)`);
  }

  console.log(`\n\nDone! Blacked out ${totalBlackedOut} shadow pixels across ${TOTAL_FRAMES} frames.`);
}

run().catch(err => {
  console.error('Error blacking out frames:', err);
  process.exit(1);
});
