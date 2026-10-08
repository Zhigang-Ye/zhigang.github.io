import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const publicDir = path.join(process.cwd(), 'public');
const portfolioDir = path.join(publicDir, 'portfolio');
const outputDir = path.join(portfolioDir, 'optimized');
const widths = [640, 1280, 1920];
// Change this when encoding settings change so cached derivatives are rebuilt.
const encodingVersion = 'webp-q80-auto-orient-v1';
const manifest = { projects: {}, images: {} };
let originalBytes = 0;
let displayBytes = 0;
let generated = 0;

const exists = async (file) => fs.access(file).then(() => true, () => false);
const discover = async (dir, subfolder, limit) => {
  const images = [];
  for (let index = 1; index <= limit; index++) {
    let match;
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
      const candidate = `${subfolder}/${index}.${ext}`;
      if (await exists(path.join(dir, candidate))) {
        match = candidate;
        break;
      }
    }
    if (!match) break;
    images.push(match);
  }
  return images;
};

const writeIfChanged = async (file, contents) => {
  const previous = await fs.readFile(file, 'utf8').catch(() => '');
  if (previous !== contents) await fs.writeFile(file, contents);
};

for (const entry of (await fs.readdir(portfolioDir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isDirectory() || entry.name === 'optimized') continue;
  const projectDir = path.join(portfolioDir, entry.name);
  if (!await exists(path.join(projectDir, 'data.json'))) continue;
  const data = JSON.parse(await fs.readFile(path.join(projectDir, 'data.json'), 'utf8'));
  const projectPath = `portfolio/${entry.name}`;
  const imagesA = data.imagesA?.length ? data.imagesA : await discover(projectDir, 'A', 30);
  const imagesB = data.imagesB?.length ? data.imagesB : await discover(projectDir, 'B', 30);
  const fpImages = data.fpImages?.length ? data.fpImages : await discover(projectDir, 'FP', 1);
  manifest.projects[projectPath] = { imagesA, imagesB, fpImages };

  for (const relative of new Set([...imagesA, ...imagesB, ...fpImages, ...(data.images || [])])) {
    if (/^(?:https?:|\/|data:)/.test(relative)) continue;
    const sourcePath = path.join(projectDir, relative);
    const source = await fs.readFile(sourcePath);
    const metadata = await sharp(source).metadata();
    const rotated = (metadata.orientation || 1) >= 5;
    const width = rotated ? metadata.height : metadata.width;
    const height = rotated ? metadata.width : metadata.height;
    if (!width || !height) throw new Error(`Missing image dimensions: ${sourcePath}`);
    const hash = createHash('sha256').update(encodingVersion).update(source).digest('hex').slice(0, 12);
    const targetDir = path.join(outputDir, entry.name, relative);
    await fs.mkdir(targetDir, { recursive: true });
    const variants = [];
    for (const targetWidth of widths) {
      const file = path.join(targetDir, `${hash}-${targetWidth}.webp`);
      if (!await exists(file)) {
        await sharp(source).rotate()
          .resize({ width: targetWidth, withoutEnlargement: true })
          .webp({ quality: 80, effort: 4 })
          .toFile(file);
        generated++;
      }
      const result = await sharp(file).metadata();
      if (!variants.some((variant) => variant.width === result.width)) {
        variants.push({ src: path.relative(publicDir, file).split(path.sep).join('/'), width: result.width });
      }
      if (targetWidth === 1280) displayBytes += (await fs.stat(file)).size;
      if (result.width >= width) break;
    }
    // Small originals may only need one derivative.
    if (variants.length === 1) displayBytes += (await fs.stat(path.join(publicDir, variants[0].src))).size;
    originalBytes += source.length;
    manifest.images[`${projectPath}/${relative}`] = { width, height, variants };
  }
}

await writeIfChanged(path.join(portfolioDir, 'image-manifest.json'), JSON.stringify(manifest));
console.log(`Responsive images: ${Object.keys(manifest.images).length} originals, ${generated} new derivatives.`);
console.log(`Originals ${(originalBytes / 1048576).toFixed(1)} MB; display versions ${(displayBytes / 1048576).toFixed(1)} MB.`);
