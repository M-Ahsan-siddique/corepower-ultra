const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

const imgPath1 = path.join(__dirname, 'frames-transparent', 'frame_0134.png');
const imgPath2 = path.join(__dirname, 'frames-transparent', 'frame_0135.png');

async function run() {
  const img1 = await Jimp.read(imgPath1);
  const img2 = await Jimp.read(imgPath2);
  
  const startX = 550;
  const startY = 300;
  const W = 130;
  const H = 140;
  
  console.log('\n--- Precise Star Mask (60x40 grid) ---');
  const scaleX = W / 60;
  const scaleY = H / 40;
  
  for (let gy = 0; gy < 40; gy++) {
    let line = '';
    for (let gx = 0; gx < 60; gx++) {
      const px = Math.floor(startX + gx * scaleX);
      const py = Math.floor(startY + gy * scaleY);
      
      const idx = (py * img1.width + px) * 4;
      
      const r1 = img1.bitmap.data[idx];
      const g1 = img1.bitmap.data[idx+1];
      const b1 = img1.bitmap.data[idx+2];
      const a1 = img1.bitmap.data[idx+3];
      
      const r2 = img2.bitmap.data[idx];
      const g2 = img2.bitmap.data[idx+1];
      const b2 = img2.bitmap.data[idx+2];
      const a2 = img2.bitmap.data[idx+3];
      
      const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) + Math.abs(a1 - a2);
      
      // Let's threshold. If the difference is significant, it's part of the star.
      if (diff > 12) {
        line += '★';
      } else {
        line += ' ';
      }
    }
    console.log(line);
  }
}

run().catch(console.error);
