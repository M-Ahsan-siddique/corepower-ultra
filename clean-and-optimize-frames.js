/**
 * clean-and-optimize-frames.js
 * Surgically erases the Veo watermark (4-pointed star & "Veo" text)
 * across all 192 transparent frames in frames-transparent/
 */

const { Jimp } = require('jimp');
const fs       = require('fs');
const path     = require('path');

const FRAMES_DIR   = path.join(__dirname, 'frames-transparent');
const TOTAL_FRAMES = 192;

async function run() {
  console.log('Reading reference frame_0000.png to build watermark pixel mask...');
  const refPath = path.join(FRAMES_DIR, 'frame_0000.png');
  const refImg  = await Jimp.fromBuffer(fs.readFileSync(refPath));

  // Build dilated watermark pixel mask from reference frame (x >= 700, y >= 350)
  const wmMask = new Set();
  
  refImg.scan(700, 350, 100, 100, function(x, y, idx) {
    if (this.bitmap.data[idx + 3] > 0) {
      // Add pixel and 3px dilation radius for anti-aliasing safety
      for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
          wmMask.add((x + dx) + ',' + (y + dy));
        }
      }
    }
  });

  console.log(`Watermark mask constructed: ${wmMask.size} pixels in dilation set.`);
  console.log(`Cleaning watermark from all ${TOTAL_FRAMES} frames...`);

  let totalCleared = 0;

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const frameNum  = String(i).padStart(4, '0');
    const framePath = path.join(FRAMES_DIR, `frame_${frameNum}.png`);

    if (!fs.existsSync(framePath)) continue;

    const img = await Jimp.fromBuffer(fs.readFileSync(framePath));
    let frameCleared = 0;

    // Erase watermark mask pixels
    wmMask.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      if (x >= 0 && x < img.width && y >= 0 && y < img.height) {
        const idx = (y * img.width + x) * 4;
        if (img.bitmap.data[idx + 3] > 0) {
          img.bitmap.data[idx + 0] = 0;
          img.bitmap.data[idx + 1] = 0;
          img.bitmap.data[idx + 2] = 0;
          img.bitmap.data[idx + 3] = 0; // Alpha = 0 (Transparent)
          frameCleared++;
        }
      }
    });

    // Also sweep bottom-right corner (x >= 768, y >= 428) for any floating watermark text pixels
    img.scan(768, 428, 32, 22, function(x, y, idx) {
      if (this.bitmap.data[idx + 3] > 0) {
        this.bitmap.data[idx + 0] = 0;
        this.bitmap.data[idx + 1] = 0;
        this.bitmap.data[idx + 2] = 0;
        this.bitmap.data[idx + 3] = 0;
        frameCleared++;
      }
    });

    totalCleared += frameCleared;

    // Overwrite frame with watermark removed
    await img.write(framePath);

    process.stdout.write(`\r[${i + 1}/${TOTAL_FRAMES}] Cleaned frame_${frameNum}.png (${frameCleared} px erased)`);
  }

  console.log(`\n\nDone! Erased ${totalCleared} watermark pixels across ${TOTAL_FRAMES} frames.`);
}

run().catch(err => {
  console.error('Error cleaning frames:', err);
  process.exit(1);
});
