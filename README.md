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
