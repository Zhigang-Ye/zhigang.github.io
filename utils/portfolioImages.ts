export interface ImageMetadata {
  width: number;
  height: number;
  variants: { src: string; width: number }[];
}

export interface PortfolioImageManifest {
  projects: Record<string, { imagesA: string[]; imagesB: string[]; fpImages: string[] }>;
  images: Record<string, ImageMetadata>;
}

export const resolveProjectImage = (folder: string | undefined, image: string) =>
  /^(?:[a-z]+:|\/)/i.test(image) || !folder ? image : `${folder}/${image}`;

export const getImageMetadata = (manifest: PortfolioImageManifest | null, src: string) =>
  manifest?.images[src.replace(/^\.\//, '').replace(/^\//, '')];

// Covers only need enough source pixels for their on-screen rendering.
export const getCoverSource = (manifest: PortfolioImageManifest | null, src: string) => {
  const image = getImageMetadata(manifest, src);
  const targetWidth = Math.min(window.innerWidth, 1280);
  return image?.variants.find((variant) => variant.width >= targetWidth)?.src
    || image?.variants.at(-1)?.src || src;
};
