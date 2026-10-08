<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1nhKB12_QiOYkffrmfQ1NbY4ITAqw-DOF

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Portfolio Asset Convention

- `public/portfolio/<id>/A/`: primary project images, numbered in order as `1.jpg`, `2.jpg`, `3.jpg`...
- `public/portfolio/<id>/B/`: gallery images, also numbered in order as `1.jpg`, `2.jpg`, `3.jpg`...
- `public/portfolio/<id>/C/`: low-resolution derivatives for `A`, used for fast initial loading
- `public/portfolio/<id>/C/B/`: low-resolution derivatives for `B`
- `public/portfolio/<id>/FP/1.jpg`: cover image for the portfolio index
- `public/portfolio/<id>/data.json`: keep `imagesA` / `imagesB` empty to use auto-discovery when files follow the numbered convention

Useful commands:

- `npm run normalize:portfolio -- <projectId>`: convert mixed source formats in `A` and `B` into sequential `.jpg` files and rebuild `C` / `C/B`
- `npm run lowres`: regenerate low-resolution files for every project

Image delivery is prepared automatically before `npm run dev` and `npm run build`.
`npm run images:optimize` generates WebP variants at 640, 1280, and 1920 pixels
without enlarging small images, plus a manifest containing dimensions and the
existing A/B/FP image order. Originals are preserved. Generated files under
`public/portfolio/optimized/` and `public/portfolio/image-manifest.json` are
ignored by Git and included in the production build. Content hashes invalidate
changed images; unchanged derivatives are reused on subsequent builds.

## 3D cover preview

Five project covers use real Gaussian scenes inferred offline with
[Apple SHARP](https://github.com/apple/ml-sharp) and rendered with
[Spark for Three.js](https://sparkjs.dev/). Desktop and mobile both load 3D
directly, with a progress indicator and no photograph placeholder. Mobile uses
the smaller scene in `scene.json`; rendering stops when the camera is idle or
the cover is off screen. `As If a Cut of Light` and `The Last Talk` retain their
photograph covers while further conversion is paused. Mobile gyroscope control
has not been added yet; the existing pointer and touch interaction remains.

Generated scenes live in `public/portfolio/<id>/GS/`. The project's
`gaussianCover.image` identifies its original FP image, and `gaussianCover.scene`
points to the scene manifest. Python and model weights are only needed to
regenerate scenes, not to run or build the website.

`scripts/generate-cover-3dgs.py` accepts `--input`, `--checkpoint`, `--sharp-root`,
`--output`, and `--device cpu|mps|cuda`. It writes compressed SPZ files and a
manifest for both full and mobile quality. A separate Python 3.11 environment
was used on Intel macOS with torch 2.2.2, torchvision 0.17.2, numpy < 2,
timm 1.0.20, scipy, plyfile, pillow-heif, imageio, click, and matplotlib.
SHARP's code and model are governed by its
[code license](https://github.com/apple/ml-sharp/blob/main/LICENSE) and
[research model license](https://github.com/apple/ml-sharp/blob/main/LICENSE_MODEL).
