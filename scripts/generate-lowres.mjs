// Generate low-resolution copies of images in each project's A (full) and B (thumb) folders.
// Output:
//   - A => public/portfolio/<project>/C/<basename>.jpg
//   - B => public/portfolio/<project>/C/B/<basename>.jpg
// Usage: npm run lowres

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PORTFOLIO_DIR = path.join(ROOT, 'public', 'portfolio');
const TARGET_WIDTH = 1200;
const QUALITY = 65;
const envMax = process.env.MAX_COUNT;
const MAX_COUNT = envMax ? Number(envMax) : Infinity; // apply per subfolder
const FORCE = process.env.FORCE === 'true';
const OUTPUT_DIR_NAME = 'C';

const isImage = (file) => /\.(jpg|jpeg|png|webp)$/i.test(file);

const naturalSort = (a, b) => {
  const ax = [];
  const bx = [];

  a.replace(/(\d+)|(\D+)/g, (_, $1, $2) => {
    ax.push([$1 || Infinity, $2 || '']);
  });
  b.replace(/(\d+)|(\D+)/g, (_, $1, $2) => {
    bx.push([$1 || Infinity, $2 || '']);
  });

  while (ax.length && bx.length) {
    const an = ax.shift();
    const bn = bx.shift();
    const diff = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
    if (diff) return diff;
  }
  return ax.length - bx.length;
};

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const processSubfolder = async (projectId, projectDir, subDir, targetDir) => {
  const srcDir = path.join(projectDir, subDir);
  try {
    await fs.access(srcDir);
  } catch {
    return; // missing folder
  }

  const files = (await fs.readdir(srcDir)).filter(isImage).sort(naturalSort);
  const picks = files.slice(0, MAX_COUNT);
  if (picks.length === 0) return;

  await ensureDir(targetDir);

  for (const file of picks) {
    const src = path.join(srcDir, file);
    const base = path.parse(file).name;
    const outPath = path.join(targetDir, `${base}.jpg`);

    try {
      if (!FORCE) {
        await fs.access(outPath);
        console.log(`[skip] ${projectId}/${path.relative(projectDir, outPath)} exists`);
        continue;
      }
    } catch {
      // not exists, proceed
    }

    try {
      await sharp(src)
        .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toFile(outPath);
      console.log(`[ok] ${projectId}/${path.relative(projectDir, outPath)}`);
    } catch (e) {
      console.warn(`[fail] ${projectId} ${subDir} -> ${file}:`, e.message);
    }
  }
};

const generate = async () => {
  const projects = await fs.readdir(PORTFOLIO_DIR, { withFileTypes: true });

  for (const dirent of projects) {
    if (!dirent.isDirectory()) continue;
    const projectDir = path.join(PORTFOLIO_DIR, dirent.name);
    const cDir = path.join(projectDir, OUTPUT_DIR_NAME);

    // A: output directly in C
    await processSubfolder(dirent.name, projectDir, 'A', cDir);
    // B: output in C/B to avoid name clashes
    await processSubfolder(dirent.name, projectDir, 'B', path.join(cDir, 'B'));
  }
};

generate().catch((e) => {
  console.error(e);
  process.exit(1);
});
