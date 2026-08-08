const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

const imgPath = path.join(__dirname, 'frames-transparent', 'frame_0000.png');

async function run() {
  console.log('Loading image:', imgPath);
  const img = await Jimp.read(imgPath);
  
  const startX = 550;
  const startY = 300;
  const W = 130;
  const H = 140;
  
  console.log('\n--- Black Pixels Map (40x40 scale) ---');
  const scaleX = W / 40;
  const scaleY = H / 40;
  
  let blackCount = 0;
  
  for (let gy = 0; gy < 40; gy++) {
    let line = '';
    for (let gx = 0; gx < 40; gx++) {
      const px = Math.floor(startX + gx * scaleX);
      const py = Math.floor(startY + gy * scaleY);
      const idx = (py * img.width + px) * 4;
      const r = img.bitmap.data[idx];
      const g = img.bitmap.data[idx+1];
      const b = img.bitmap.data[idx+2];
      const a = img.bitmap.data[idx+3];
      
      // Let's test a very dark threshold
      const isBlack = (a > 0 && r < 18 && g < 18 && b < 18);
      
      if (isBlack) {
        line += '★';
        blackCount++;
      } else {
        line += ' ';
      }
    }
    console.log(line);
  }
  
  console.log(`\nFound ${blackCount} very dark pixels.`);
}

run().catch(console.error);
