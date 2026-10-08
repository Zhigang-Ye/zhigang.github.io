import React, { useState } from 'react';
import { ImageMetadata } from '../utils/portfolioImages';

interface ResponsiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  image?: ImageMetadata;
  enabled?: boolean;
}

const ResponsiveImage: React.FC<ResponsiveImageProps> = ({ image, enabled = true, src, sizes, fetchPriority, ...props }) => {
  const [failedSource, setFailedSource] = useState<string>();
  const optimized = image && failedSource !== src;
  return (
    <img
      {...props}
      {...{ fetchpriority: fetchPriority }}
      src={enabled ? (optimized ? image.variants[0].src : src) : undefined}
      srcSet={enabled && optimized ? image.variants.map((variant) => `${variant.src} ${variant.width}w`).join(', ') : undefined}
      sizes={sizes}
      width={image?.width}
      height={image?.height}
      decoding="async"
      onError={(event) => {
        if (optimized) setFailedSource(src);
        else props.onError?.(event);
      }}
    />
  );
};

export default ResponsiveImage;
