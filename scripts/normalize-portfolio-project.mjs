import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PORTFOLIO_DIR = path.join(ROOT, 'public', 'portfolio');
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp)$/i;
const NORMALIZED_QUALITY = 90;
const LOWRES_WIDTH = 1200;
const LOWRES_QUALITY = 65;

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

const listImages = async (dir) => {
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    return files
      .filter((entry) => entry.isFile() && IMAGE_EXT_RE.test(entry.name))
      .map((entry) => entry.name)
      .sort(naturalSort);
  } catch {
    return [];
  }
};

const clearDirectory = async (dir) => {
  await fs.rm(dir, { recursive: true, force: true });
  await ensureDir(dir);
};

const normalizeSubfolder = async (projectDir, subfolder) => {
  const srcDir = path.join(projectDir, subfolder);
  const files = await listImages(srcDir);

  if (files.length === 0) {
    await clearDirectory(srcDir);
    return [];
  }

  const tempDir = path.join(projectDir, `.tmp-${subfolder}`);
  await clearDirectory(tempDir);

  for (const [index, file] of files.entries()) {
    const srcPath = path.join(srcDir, file);
    const outPath = path.join(tempDir, `${index + 1}.jpg`);

    await sharp(srcPath)
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: NORMALIZED_QUALITY, mozjpeg: true })
      .toFile(outPath);
  }

  await clearDirectory(srcDir);

  const normalizedFiles = await listImages(tempDir);
  for (const file of normalizedFiles) {
    await fs.rename(path.join(tempDir, file), path.join(srcDir, file));
  }

  await fs.rm(tempDir, { recursive: true, force: true });
  return normalizedFiles;
};

const generateLowRes = async (projectDir, sourceSubfolder, targetSubfolder) => {
  const srcDir = path.join(projectDir, sourceSubfolder);
  const outDir = path.join(projectDir, targetSubfolder);
  const files = await listImages(srcDir);

  await clearDirectory(outDir);

  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const outPath = path.join(outDir, `${path.parse(file).name}.jpg`);

    await sharp(srcPath)
      .resize({ width: LOWRES_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: LOWRES_QUALITY, mozjpeg: true })
      .toFile(outPath);
  }
};

const projectId = process.argv[2];

if (!projectId) {
  console.error('Usage: npm run normalize:portfolio -- <projectId>');
  process.exit(1);
}

const projectDir = path.join(PORTFOLIO_DIR, projectId);

try {
  await fs.access(projectDir);
} catch {
  console.error(`Project not found: ${projectId}`);
  process.exit(1);
}

const run = async () => {
  const normalizedA = await normalizeSubfolder(projectDir, 'A');
  const normalizedB = await normalizeSubfolder(projectDir, 'B');

  await generateLowRes(projectDir, 'A', 'C');
  await generateLowRes(projectDir, 'B', path.join('C', 'B'));

  console.log(`Normalized project ${projectId}`);
  console.log(`A: ${normalizedA.length} file(s)`);
  console.log(`B: ${normalizedB.length} file(s)`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
