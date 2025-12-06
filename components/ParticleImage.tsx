import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Particle {
  // Current State (Screen Coords)
  x: number; 
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
  radius?: number;
  radiusVar?: number;
  isMoving?: boolean;
  
  // Target State (Normalized 0-1)
  // We use Normalized coordinates (U, V) so particles are independent of container size changes
  targetU: number;
  targetV: number;
  
  targetR: number;
  targetG: number;
  targetB: number;
  targetA: number; // 0 if dying, 1 if living
  
  // Physics Properties
  vx: number;
  vy: number;
  friction: number;
  ease: number;
}

export interface ParticleImageProps {
  src: string;
  alt: string;
  className?: string;
  gap?: number;
  dotRadius?: number;
  onImageLoaded?: () => void;
}

// Data cache exported for external use if needed, but mostly managed via prefetch function
export interface SampledData {
  width: number; // Original sample width
  height: number; // Original sample height
  points: { u: number, v: number, r: number, g: number, b: number }[];
  error?: boolean; // Flag to indicate sampling failure
}

const sampleCache: Record<string, SampledData> = {};

/**
 * Prefetches and samples particle data for an image.
 * Uses a global cache to avoid re-sampling the same image at the same width.
 * @param src Image URL
 * @param targetDisplayWidth Estimated display width
 * @param gap Particle gap (default 6)
 */
export const prefetchParticleImage = (
  src: string, 
  targetDisplayWidth: number, 
  gap: number = 6
): Promise<SampledData> => {
  return new Promise((resolve) => {
    // Create a cache key that includes the target width to distinguish between sizes
    // We round the width to avoid cache misses on sub-pixel resize differences
    const roundedWidth = Math.round(targetDisplayWidth / 50) * 50;
    const cacheKey = `${src}_w${roundedWidth}_g${gap}`;

    if (sampleCache[cacheKey]) {
      resolve(sampleCache[cacheKey]);
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = src;

    img.onload = () => {
      // Calculate sampling dimensions based on DISPLAY size, not intrinsic size
      let width = targetDisplayWidth;
      const aspectRatio = img.naturalHeight / img.naturalWidth;
      let height = Math.floor(width * aspectRatio);
      
      // Ensure minimums
      width = Math.max(10, width);
      height = Math.max(10, height);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) {
          resolve({ width: 100, height: 100, points: [], error: true });
          return;
      }

      try {
          // Draw image scaled to the display size
          ctx.drawImage(img, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height).data;
          const points = [];

          // Sample center of grid cells
          const offset = gap / 2;

          for (let y = 0; y < height; y += gap) {
            for (let x = 0; x < width; x += gap) {
                if (x >= width || y >= height) continue;

                const index = (Math.floor(y) * width + Math.floor(x)) * 4;
                const a = imageData[index + 3];

                if (a > 100) { 
                  points.push({
                      // Store Normalized Coordinates (0.0 to 1.0)
                      u: (x + offset) / width, 
                      v: (y + offset) / height,
                      r: imageData[index], 
                      g: imageData[index + 1], 
                      b: imageData[index + 2]
                  });
                }
            }
          }
          
          const result = { width, height, points };
          sampleCache[cacheKey] = result;
          resolve(result);
      } catch (e) {
          console.warn("ParticleImage: CORS or draw error, falling back to static image", e);
          resolve({ width: 100, height: 100, points: [], error: true });
      }
    };

    img.onerror = () => {
        console.warn("ParticleImage: Image load failed (404 or Network Error)", src);
        resolve({ width: 100, height: 100, points: [], error: true });
    };
  });
};

const ParticleImage: React.FC<ParticleImageProps> = ({ 
  src, 
  alt, 
  className, 
  gap = 6, // Default gap set to 6px for the specific dense grid look
  dotRadius = 2.8,
  onImageLoaded
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  
  // Fallback state: if true, show the static img tag instead of canvas
  const [useFallback, setUseFallback] = useState(false);
  
  // Track if the image has loaded and the container has valid dimensions
  const [layoutReady, setLayoutReady] = useState(false);

  // Update viewport size
  useEffect(() => {
    const updateSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Reset state when src changes
  useEffect(() => {
    setLayoutReady(false);
    setUseFallback(false);
  }, [src]);

  const handleImgLoad = useCallback(() => {
    // Only set ready if we actually have dimensions
    if (containerRef.current && containerRef.current.clientWidth > 0) {
      setLayoutReady(true);
    }
  }, []);

  // Check if image is already complete (cached) on mount or src change
  useEffect(() => {
    if (imgRef.current?.complete) {
        handleImgLoad();
    }
  }, [src, handleImgLoad]);

  // --- Transition Logic ---
  useEffect(() => {
    // Wait until layout is ready (image loaded and container has size)
    if (!layoutReady) return;

    let isMounted = true;

    const processTransition = async () => {
      // Determine the visual width this image will occupy.
      let displayWidth = containerRef.current?.clientWidth || 0;
      
      // Fallback only if absolutely necessary (shouldn't happen if layoutReady is true)
      if (displayWidth === 0) {
        if (window.innerWidth > 0) displayWidth = window.innerWidth;
        else displayWidth = 800;
      }

      // Cap extreme sizes for performance, but keep it high enough for "Hero" quality
      displayWidth = Math.min(displayWidth, 2000);

      // Use the shared prefetch function
      const data = await prefetchParticleImage(src, displayWidth, gap);
      
      if (!isMounted) return;
      
      // If sampling failed (CORS or Load Error) or no points, enable fallback
      if (data.error || data.points.length === 0) {
        setUseFallback(true);
        particlesRef.current = []; // Clear particles
        if (onImageLoaded) onImageLoaded();
        return;
      }
      
      const targetPoints = data.points;
      const currentParticles = particlesRef.current;
      const nextParticles: Particle[] = [];
      
      const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          
          const maxLen = Math.max(currentParticles.length, targetPoints.length);

          for (let i = 0; i < maxLen; i++) {
              const target = targetPoints[i]; 
              const existing = currentParticles[i]; 

          // Physics Tuning
          const friction = 0.50 + Math.random() * 0.10; 
          const ease = 0.20 + Math.random() * 0.10;
          const randRadius = Math.random() < 0.25 ? Math.random() * 4 : dotRadius;

          if (existing && target) {
              // Morph existing
              existing.targetU = target.u;
              existing.targetV = target.v;
              existing.targetR = target.r;
              existing.targetG = target.g;
              existing.targetB = target.b;
              existing.targetA = 1; 
              existing.friction = friction;
              existing.ease = ease;
              existing.radiusVar = randRadius;
              existing.isMoving = true;
              
              const impulseX = (Math.random() - 0.5) * 5;
              const impulseY = (Math.random() - 0.5) * 5;
              existing.vx += impulseX;
              existing.vy += impulseY;

              nextParticles.push(existing);

          } else if (target && !existing) {
              // Spawn new
              const spawnAngle = Math.random() * Math.PI * 2;
              const spawnDist = 10 + Math.random() * 40; 
              
              nextParticles.push({
                  x: centerX + Math.cos(spawnAngle) * spawnDist,
                  y: centerY + Math.sin(spawnAngle) * spawnDist,
                  vx: (Math.random() - 0.5) * 2, 
                  vy: (Math.random() - 0.5) * 2,
                  r: target.r, g: target.g, b: target.b, a: 0, 
                  targetU: target.u,
                  targetV: target.v,
                  targetR: target.r,
                  targetG: target.g,
                  targetB: target.b,
                  targetA: 1,
                  radiusVar: randRadius,
                  isMoving: true,
                  friction,
                  ease
              });
          } else if (existing && !target) {
              // Kill old
              existing.targetA = 0;
              existing.vx += (Math.random() - 0.5) * 5;
              existing.vy += (Math.random() - 0.5) * 5;
              nextParticles.push(existing);
          }
      }

      particlesRef.current = nextParticles;
      if (onImageLoaded) onImageLoaded();
    };

    processTransition();

    return () => { isMounted = false; };
  }, [src, layoutReady, gap, onImageLoaded]);


  // --- Animation Loop ---
  const animate = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    // Skip rendering canvas if using fallback
    if (useFallback) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get live Layout container bounds
    const rect = containerRef.current.getBoundingClientRect();
    const cWidth = rect.width;
    const cHeight = rect.height;
    const cLeft = rect.left;
    const cTop = rect.top;

    const particles = particlesRef.current;
    const mouse = mouseRef.current;
    
    const mouseRadiusSq = 6400;   // 80px radius
    const mouseForce = 15; 

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      
      // Color & Alpha Lerp
      p.r += (p.targetR - p.r) * 0.25; 
      p.g += (p.targetG - p.g) * 0.25;
      p.b += (p.targetB - p.b) * 0.25;
      p.a += (p.targetA - p.a) * 0.2; 

      if (p.a < 0.01 && p.targetA === 0) continue;

      // Calculate Target Screen Position using UV coordinates
      const targetX = cLeft + p.targetU * cWidth;
      const targetY = cTop + p.targetV * cHeight;

      // Mouse Interaction
      if (p.targetA > 0) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        
        if (Math.abs(dx) < 80 && Math.abs(dy) < 80) {
            const distSq = dx*dx + dy*dy;
            if (distSq < mouseRadiusSq) {
                const dist = Math.sqrt(distSq);
                const force = (80 - dist) / 80; 
                const angle = Math.atan2(dy, dx);
                const push = force * mouseForce;
                
                p.vx -= Math.cos(angle) * push;
                p.vy -= Math.sin(angle) * push;
            }
        }
      }

      // Physics Integration
      const ax = (targetX - p.x) * p.ease;
      const ay = (targetY - p.y) * p.ease;

      p.vx += ax;
      p.vy += ay;

      p.vx *= p.friction;
      p.vy *= p.friction;

      p.x += p.vx;
      p.y += p.vy;

      // Rendering
      if (p.a < 0.05) continue;

      // Size modulation during movement; settle to base size near target
      const targetRadius = p.isMoving ? (p.radiusVar ?? dotRadius) : dotRadius;
      const dist = Math.hypot(targetX - p.x, targetY - p.y);
      const mix = Math.max(0, Math.min(1, dist / Math.max(1, Math.max(cWidth, cHeight) * 0.3)));
      const renderRadius = dotRadius + (targetRadius - dotRadius) * mix;

      if (dist < 0.3) {
        p.isMoving = false;
        p.radiusVar = undefined;
      }

      ctx.fillStyle = `rgba(${p.r | 0}, ${p.g | 0}, ${p.b | 0}, ${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, renderRadius, 0, 6.28);
      ctx.fill();
    }
    
    animationRef.current = requestAnimationFrame(animate);
  }, [useFallback, dotRadius]);

  useEffect(() => {
    if (viewportSize.width > 0) {
        animationRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [viewportSize, animate]);

  const handleMouseMove = (e: MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <>
        {/* Layout Container: Controls size. Image is visible ONLY if fallback is active. */}
        <div 
            ref={containerRef}
            className={`relative block ${className}`}
        >
            <img 
                ref={imgRef}
                src={src} 
                alt={alt} 
                onLoad={handleImgLoad}
                className={`w-full h-auto block transition-opacity duration-500 ${useFallback ? 'opacity-100' : 'opacity-0'}`} 
                draggable={false}
                // Ensure image isn't hidden by browser logic if broken, though alt text will show
            />
        </div>

        {/* Canvas: Visuals (Particles). Hidden if using fallback. */}
        {!useFallback && (
            <canvas
                ref={canvasRef}
                width={viewportSize.width}
                height={viewportSize.height}
                className="fixed inset-0 pointer-events-none z-10"
            />
        )}
    </>
  );
};

export default ParticleImage;
