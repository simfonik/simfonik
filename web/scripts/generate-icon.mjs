#!/usr/bin/env node

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const svgPath = join(projectRoot, 'app/icon.svg');
const outputPath = join(projectRoot, 'app/icon.png');

async function generateIcon() {
  try {
    console.log('📱 Generating icon.png from icon.svg...');
    
    const svgBuffer = readFileSync(svgPath);
    
    await sharp(svgBuffer)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath);
    
    console.log('✅ Generated app/icon.png (180x180)');
  } catch (error) {
    console.error('❌ Error generating icon:', error);
    process.exit(1);
  }
}

generateIcon();
