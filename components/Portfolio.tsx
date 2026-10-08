
import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { Project, Lang, MultiLangString } from '../types';
import { X, ChevronDown } from 'lucide-react';
import GaussianCover from './GaussianCover';
import ResponsiveImage from './ResponsiveImage';
import { getImageMetadata, getCoverSource, PortfolioImageManifest, resolveProjectImage } from '../utils/portfolioImages';
import { TRANSLATIONS } from '../constants';

interface PortfolioProps {
  lang: Lang;
  toggleLang: () => void;
  activeSlug?: string | null;
  onSlugChange?: (slug: string | null) => void;
}

interface ProjectDetailData {
  layout?: 'single-column' | 'grid' | 'free'; 
  // Folder A: Slider images (Carousel)
  imagesA?: string[]; 
  // Folder B: Thumbnail images (Gallery)
  imagesB?: string[]; 
  // Fallback for legacy support
  images?: string[]; 
  text?: MultiLangString;
  youtube?: string; // YouTube video link
}

interface MeasuredImage {
  src: string; // thumbnail (may be downscaled)
  fullSrc?: string; // original
  ratio: number;
  originalIndex: number;
}

interface GalleryRow {
  height: number;
  images: MeasuredImage[];
}

type OpenProjectOptions = {
  fromRoute?: boolean;
};

const normalizeSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

const getProjectSlug = (project: Project) => {
  const normalized = normalizeSlug(project.title?.en || project.id || '');
  return normalized || project.id;
};

const matchesSlug = (project: Project, slug: string) => {
  const normalized = normalizeSlug(slug);
  if (!normalized) return false;
  if (normalized === normalizeSlug(project.title?.en || '')) return true;
  return normalized === normalizeSlug(project.id || '');
};

const Portfolio: React.FC<PortfolioProps> = ({ lang, toggleLang, activeSlug = null, onSlugChange }) => {
  const MOBILE_SIDE_PADDING = 12; // px, keep image and nav aligned on mobile

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageManifest, setImageManifest] = useState<PortfolioImageManifest | null>(null);
  const [coverReadySrc, setCoverReadySrc] = useState('');
  
  const [displayIndex, setDisplayIndex] = useState(0);
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailContent, setDetailContent] = useState<ProjectDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | undefined>(undefined);
  const [requestedSlides, setRequestedSlides] = useState<Set<number>>(() => new Set([0, 1]));
  const [sliderIndex, setSliderIndex] = useState(0);

  // Index Overlay State
  const [showIndex, setShowIndex] = useState(false);
  
  // Navigation Visibility State (Mobile Only)
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);

  // Gallery Layout State
  const [thumbDims, setThumbDims] = useState<MeasuredImage[]>([]);
  const galleryContainerRef = useRef<HTMLDivElement>(null);
  const [galleryWidth, setGalleryWidth] = useState(0);
  const [galleryRows, setGalleryRows] = useState<GalleryRow[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false); // Default collapsed
  const detailRequestRef = useRef<AbortController | null>(null);
  const mobileSlideStartX = useRef<number | null>(null);
  const mobileSlideCurrentX = useRef<number | null>(null);
  const isProgrammaticScroll = useRef(false);
  const scrollSyncTimerRef = useRef<number | null>(null);

  // Text Expansion State
  const [isTextOpen, setIsTextOpen] = useState(false); // Default collapsed

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isLightboxExpanded, setIsLightboxExpanded] = useState(false);
  
  // Lightbox Drag State
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingLightbox, setIsDraggingLightbox] = useState(false);
  const lightboxDragStartX = useRef<number | null>(null);

  // Main Slider Drag State
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const imageScrollRef = useRef<HTMLDivElement>(null);

  // Device Check
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  const [fpIndexMap, setFpIndexMap] = useState<Record<string, number>>({});
  const autoOpenTimerRef = useRef<number | null>(null);
  const DEFAULT_SLIDER_RATIO = 3 / 2;
  const SLIDE_GAP_VAR = 'clamp(10px, 2.2vw, 18px)';
  const sliderContainerStyle = {
    '--slide-gap': SLIDE_GAP_VAR,
    gap: 'var(--slide-gap)',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none'
  } as React.CSSProperties;
  const sliderItemStyle = {
    width: 'calc(100% - var(--slide-gap))',
    minWidth: 'calc(100% - var(--slide-gap))'
  } as React.CSSProperties;

  useEffect(() => {
    const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Text collapsed by default; will open manually

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        const [manifestRes, imagesRes] = await Promise.all([
          fetch('./manifest.json', { signal: controller.signal }),
          fetch('./portfolio/image-manifest.json', { signal: controller.signal })
        ]);
        if (!imagesRes.ok) throw new Error('Image manifest unavailable; run npm run images:optimize.');
        const manifest = await manifestRes.json();
        const images: PortfolioImageManifest = await imagesRes.json();
        const portfolioRes = await fetch(manifest.portfolio, { signal: controller.signal });
        const data: Project[] = await portfolioRes.json();
        const enriched = data.filter((project) => !project.hidden).sort((a, b) =>
          b.year.localeCompare(a.year, undefined, { numeric: true })
        ).map((project) => {
          const fpImages = project.fpImages?.length
            ? project.fpImages : images.projects[project.folderPath || '']?.fpImages || [];
          return { ...project, fpImages };
        });
        if (controller.signal.aborted) return;
        setImageManifest(images);
        setProjects(enriched);
        setDisplayIndex(0);
      } catch (error) {
        if (!controller.signal.aborted) console.error('Error loading portfolio:', error);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, []);

  useEffect(() => () => detailRequestRef.current?.abort(), []);

  const getProjectCoverOriginalSrc = useCallback((project: Project) => {
    const fpList = project.fpImages || [];
    const pick = fpList.length ? fpList[(fpIndexMap[project.id] ?? 0) % fpList.length] : null;
    return pick ? resolveProjectImage(project.folderPath, pick) : project.imageUrl;
  }, [fpIndexMap]);

  const getProjectCoverSrc = useCallback((project: Project) =>
    getCoverSource(imageManifest, getProjectCoverOriginalSrc(project)),
  [getProjectCoverOriginalSrc, imageManifest]);

  const activeCoverSrc = projects[displayIndex] ? getProjectCoverSrc(projects[displayIndex]) : '';
  const handleCoverLoaded = useCallback(() => setCoverReadySrc(activeCoverSrc), [activeCoverSrc]);

  const cycleFpImage = useCallback((projectId: string) => {
    setFpIndexMap(prev => {
      const next = { ...prev };
      next[projectId] = (prev[projectId] ?? 0) + 1;
      return next;
    });
  }, []);

  useEffect(() => {
    // Wait for the visible cover before warming just the next cover. Avoid
    // background traffic on constrained connections and while a project is open.
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string; downlink?: number };
    }).connection;
    if (loading || selectedProject || activeSlug || projects.length < 2 || coverReadySrc !== activeCoverSrc || projects[displayIndex]?.gaussianCover) return;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '') || (connection?.downlink ?? 10) < 1.5) return;
    const next = projects[(displayIndex + 1) % projects.length];
    const timer = window.setTimeout(() => {
      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = 'low';
      image.src = getProjectCoverSrc(next);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [loading, projects, displayIndex, selectedProject, activeSlug, coverReadySrc, activeCoverSrc, getProjectCoverSrc]);

  useEffect(() => {
    setRequestedSlides((previous) => {
      const next = new Set(previous);
      for (const index of [sliderIndex - 1, sliderIndex, sliderIndex + 1]) {
        if (index >= 0) next.add(index);
      }
      return next.size === previous.size ? previous : next;
    });
  }, [sliderIndex]);

  const getLangString = (obj: MultiLangString) => {
    return obj[lang] || obj['en'];
  };

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // --- Mobile slide helpers ---
  const handleMobileSlideStart = (x: number) => {
    mobileSlideStartX.current = x;
    mobileSlideCurrentX.current = x;
  };

  const handleMobileSlideMove = (x: number) => {
    if (mobileSlideStartX.current === null) return;
    mobileSlideCurrentX.current = x;
  };

  const handleMobileSlideEnd = () => {
    if (mobileSlideStartX.current === null || mobileSlideCurrentX.current === null) {
      mobileSlideStartX.current = null;
      mobileSlideCurrentX.current = null;
      return;
    }
    const delta = mobileSlideCurrentX.current - mobileSlideStartX.current;
    const threshold = 40;
    const sliderImages = (detailContent?.imagesA?.length ? detailContent.imagesA : detailContent?.images) || [];
    const totalSlides = sliderImages.length;
    if (delta > threshold && totalSlides > 1) {
      setSliderIndex((prev) => (
        isMobile ? Math.max(0, prev - 1) : (prev - 1 + totalSlides) % totalSlides
      ));
    } else if (delta < -threshold && totalSlides > 1) {
      setSliderIndex((prev) => (
        isMobile ? Math.min(totalSlides - 1, prev + 1) : (prev + 1) % totalSlides
      ));
    }
    mobileSlideStartX.current = null;
    mobileSlideCurrentX.current = null;
  };

  const handleSliderScroll = () => {
    if (isProgrammaticScroll.current) return;
    if (scrollSyncTimerRef.current) {
      clearTimeout(scrollSyncTimerRef.current);
    }
    const container = imageScrollRef.current;
    if (!container) return;
    scrollSyncTimerRef.current = window.setTimeout(() => {
      const width = container.clientWidth || 1;
      const idx = Math.round(container.scrollLeft / width);
      const images = (detailContent?.imagesA?.length ? detailContent.imagesA : detailContent?.images) || [];
      const clamped = Math.max(0, Math.min(images.length - 1, idx));
      if (clamped !== sliderIndex) {
        setSliderIndex(clamped);
      }
    }, 80);
  };

  const handleNext = () => {
    setDisplayIndex((prev) => {
      const nextIdx = (prev + 1) % projects.length;
      const nextProject = projects[nextIdx];
      if (nextProject?.id) {
        cycleFpImage(nextProject.id);
      }
      return nextIdx;
    });
  };

  const handlePrev = () => {
    setDisplayIndex((prev) => {
      const nextIdx = (prev - 1 + projects.length) % projects.length;
      const nextProject = projects[nextIdx];
      if (nextProject?.id) {
        cycleFpImage(nextProject.id);
      }
      return nextIdx;
    });
  };

  const changeSlide = (nextIdx: number) => {
      if (!detailContent) return;
      const images = (detailContent.imagesA?.length ? detailContent.imagesA : detailContent.images) || [];
      if (images.length === 0) return;
      const total = images.length;
      const target = ((nextIdx % total) + total) % total;
      setSliderIndex(target);
  };

  const handleDesktopNextImage = () => changeSlide(sliderIndex + 1);
  const handleDesktopPrevImage = () => changeSlide(sliderIndex - 1);

  // --- Main Page Swipe Logic ---
  const handleSwipeStart = (clientX: number) => {
    touchStartX.current = clientX;
    touchEndX.current = null;
    isDraggingRef.current = false;
  };

  const handleSwipeMove = (clientX: number) => {
    touchEndX.current = clientX;
    if (touchStartX.current && Math.abs(clientX - touchStartX.current) > 10) {
      isDraggingRef.current = true;
    }
  };

  const handleSwipeEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const onTouchStart = (e: React.TouchEvent) => handleSwipeStart(e.targetTouches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => handleSwipeMove(e.targetTouches[0].clientX);
  const onTouchEnd = () => handleSwipeEnd();

  const onMouseDown = (e: React.MouseEvent) => handleSwipeStart(e.clientX);
  const onMouseMove = (e: React.MouseEvent) => {
    if (e.buttons === 1) {
      handleSwipeMove(e.clientX);
    }
  };
  const onMouseUp = () => handleSwipeEnd();
  const onMouseLeave = () => handleSwipeEnd();

  // Keyboard navigation for desktop: left/right arrows to switch projects
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') {
            handleNext();
        } else if (e.key === 'ArrowLeft') {
            handlePrev();
        }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [projects.length]);

  const langButtonProps = { onClick: toggleLang };

  // --- Project Open Logic ---
  const handleProjectClick = useCallback(async (project: Project, options?: OpenProjectOptions) => {
    if (!options?.fromRoute && isDraggingRef.current) return;
    if (!options?.fromRoute) {
      onSlugChange?.(getProjectSlug(project));
    }

    setSelectedProject(project);
    setDetailLoading(true);
    setDetailContent(null);
    setIsAtTop(true); 
    setIsAtBottom(false);
    setImageAspectRatio(undefined); 
    setThumbDims([]); 
    setGalleryRows([]);
    setShowIndex(false); 
    setIsGalleryOpen(false); // Reset gallery state
    setRequestedSlides(new Set([0, 1]));
    setSliderIndex(0);
    mobileSlideStartX.current = null;
    mobileSlideCurrentX.current = null;
    // Always start closed on both desktop and mobile
    setIsTextOpen(false); 
    
    setLightboxIndex(null);

    detailRequestRef.current?.abort();
    const controller = new AbortController();
    detailRequestRef.current = controller;
    const getFullUrl = (image: string) => resolveProjectImage(project.folderPath, image);

    try {
      let content: ProjectDetailData = { images: [project.imageUrl], text: project.description };
      if (project.folderPath) {
        const response = await fetch(`${project.folderPath}/data.json`, { signal: controller.signal });
        if (response.ok) content = await response.json();
        const discovered = imageManifest?.projects[project.folderPath];
        if (!content.imagesA?.length) content.imagesA = discovered?.imagesA || [];
        if (!content.imagesB?.length) content.imagesB = discovered?.imagesB || [];
      }
      if (controller.signal.aborted) return;
      const slides = content.imagesA?.length ? content.imagesA : content.images || [];
      const first = slides[0] && getImageMetadata(imageManifest, getFullUrl(slides[0]));
      setImageAspectRatio(first ? first.width / first.height : DEFAULT_SLIDER_RATIO);
      // Dimensions come from the build manifest. Measuring the gallery no
      // longer downloads every original before the user even opens it.
      setThumbDims((content.imagesB || []).map((image, index) => {
        const src = getFullUrl(image);
        const metadata = getImageMetadata(imageManifest, src);
        return { src, fullSrc: src, ratio: metadata ? metadata.width / metadata.height : 1, originalIndex: index };
      }));
      setDetailContent(content);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.warn('Could not load detail data, using fallback', error);
      setDetailContent({ images: [project.imageUrl], text: project.description });
      setImageAspectRatio(DEFAULT_SLIDER_RATIO);
    } finally {
      if (!controller.signal.aborted) setDetailLoading(false);
    }
  }, [imageManifest, onSlugChange]);

  const closeProject = useCallback(() => {
    detailRequestRef.current?.abort();
    setSelectedProject(null);
    setDetailContent(null);
    setThumbDims([]);
    setGalleryRows([]);
  }, []);

  const handleBack = () => {
    closeProject();
    onSlugChange?.(null);
  };

  useEffect(() => {
    if (!activeSlug) {
      if (selectedProject) {
        closeProject();
      }
      return;
    }
    if (projects.length === 0) return;
    const match = projects.find((project) => matchesSlug(project, activeSlug));
    if (!match) {
      if (selectedProject) {
        closeProject();
      }
      return;
    }
    if (!selectedProject || selectedProject.id !== match.id) {
      handleProjectClick(match, { fromRoute: true });
    }
  }, [activeSlug, projects, selectedProject, closeProject, handleProjectClick]);

  const scrollImages = (direction: 'left' | 'right') => {
    if (imageScrollRef.current) {
      const container = imageScrollRef.current;
      const scrollAmount = container.clientWidth;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleDetailScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    // Check if at top
    setIsAtTop(scrollTop < 50);

    // Check if at bottom (with a small threshold, e.g. 5px or 20px)
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setIsAtBottom(distanceToBottom < 20);
  }, []);

  // Sync scroll position to current index
  useEffect(() => {
    if (!detailContent) return;
    const images = (detailContent.imagesA?.length ? detailContent.imagesA : detailContent.images) || [];
    if (images.length === 0) return;
    const container = imageScrollRef.current;
    if (!container) return;
    const width = container.clientWidth || 1;
    const targetLeft = sliderIndex * width;
    isProgrammaticScroll.current = true;
    container.scrollTo({ left: targetLeft, behavior: 'smooth' });
    window.setTimeout(() => { isProgrammaticScroll.current = false; }, 200);
  }, [sliderIndex, detailContent]);

  // Keyboard navigation for desktop detail view
  useEffect(() => {
    if (!selectedProject || isMobile) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if gallery is open (to avoid conflict with scroll)
      if (isGalleryOpen) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleDesktopPrevImage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleDesktopNextImage();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedProject, isMobile, isGalleryOpen, detailContent, sliderIndex]);

  // --- Justified Gallery Layout Calculation ---
  useLayoutEffect(() => {
    if (!selectedProject || !galleryContainerRef.current) return;

    const measure = () => {
        if (galleryContainerRef.current) {
            const width = galleryContainerRef.current.getBoundingClientRect().width;
            if (width > 0) {
                setGalleryWidth(width);
            }
        }
    };
    
    // Initial measure
    measure();

    // Observe changes
    const ro = new ResizeObserver(measure);
    ro.observe(galleryContainerRef.current);

    // Backup measure in case initial render was hidden/zero
    const timer = setTimeout(measure, 100);

    return () => {
        ro.disconnect();
        clearTimeout(timer);
    };
  }, [selectedProject, detailLoading, isGalleryOpen, isMobile]); // Re-measure when resized


  useEffect(() => {
    if (galleryWidth <= 0 || thumbDims.length === 0) return;

    // Algorithm Config
    const BASE_ROW_HEIGHT = isMobile ? 120 : 150; 
    const GAP = 4; // Tiny gap (approx 4px) to look like "almost no gap"
    const MIN_HEIGHT = BASE_ROW_HEIGHT * 0.6; 
    const MAX_HEIGHT = BASE_ROW_HEIGHT * 1.6;

    const rows: GalleryRow[] = [];
    let currentRow: MeasuredImage[] = [];
    let currentRowWidth = 0; // accumulated width at BASE_ROW_HEIGHT

    for (let i = 0; i < thumbDims.length; i++) {
        const img = thumbDims[i];
        const imgWidthAtTarget = BASE_ROW_HEIGHT * img.ratio;
        
        currentRow.push(img);
        currentRowWidth += imgWidthAtTarget;
        
        // Check if we have enough content to fill the width
        const totalGap = (currentRow.length - 1) * GAP;
        const widthWithGaps = currentRowWidth + totalGap;

        if (widthWithGaps >= galleryWidth) {
            // Row is full or overflowing.
            // Calculate scale factor needed to make this row exactly fit galleryWidth
            const totalRatio = currentRow.reduce((acc, im) => acc + im.ratio, 0);
            const desiredHeight = (galleryWidth - totalGap) / totalRatio;
            const finalHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, desiredHeight));
            
            rows.push({
                height: Math.max(MIN_HEIGHT, finalHeight),
                images: [...currentRow]
            });
            currentRow = [];
            currentRowWidth = 0;
        }
    }

    // Handle last row - make it fill if it's substantial, otherwise normal height
    if (currentRow.length > 0) {
        const totalRatio = currentRow.reduce((acc, im) => acc + im.ratio, 0);
        const totalGap = (currentRow.length - 1) * GAP;
        const computedHeight = (galleryWidth - totalGap) / totalRatio;
        const finalHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, computedHeight));
        rows.push({
            height: finalHeight, 
            images: [...currentRow]
        });
    }

    setGalleryRows(rows);

  }, [galleryWidth, thumbDims, isMobile]);

  // Auto-open text panel on desktop after entering detail (0.5s delay)
  useEffect(() => {
    if (autoOpenTimerRef.current) {
      clearTimeout(autoOpenTimerRef.current);
      autoOpenTimerRef.current = null;
    }
    if (selectedProject && !isMobile) {
      autoOpenTimerRef.current = window.setTimeout(() => {
        setIsTextOpen(true);
      }, 1000);
    }
    return () => {
      if (autoOpenTimerRef.current) {
        clearTimeout(autoOpenTimerRef.current);
        autoOpenTimerRef.current = null;
      }
    };
  }, [selectedProject, isMobile]);


  // --- Lightbox Drag Logic ---
  const handleLightboxDragStart = (clientX: number) => {
    lightboxDragStartX.current = clientX;
    setIsDraggingLightbox(true);
  };

  const handleLightboxDragMove = (clientX: number) => {
    if (lightboxDragStartX.current !== null) {
      const diff = clientX - lightboxDragStartX.current;
      setDragOffset(diff);
    }
  };

  const handleLightboxDragEnd = () => {
    if (lightboxIndex !== null && thumbDims.length > 0) {
        if (dragOffset > 50) {
            // Swipe Right -> Prev
            const newIndex = (lightboxIndex - 1 + thumbDims.length) % thumbDims.length;
            setLightboxIndex(newIndex);
        } else if (dragOffset < -50) {
            // Swipe Left -> Next
            const newIndex = (lightboxIndex + 1) % thumbDims.length;
            setLightboxIndex(newIndex);
        }
    }
    
    setIsDraggingLightbox(false);
    setDragOffset(0);
    lightboxDragStartX.current = null;
  };

  const handleThumbClick = (index: number) => {
      // Set the index first, but keep expansion false initially
      setLightboxIndex(index);
      setIsLightboxExpanded(false);
      
      // Trigger expansion animation in next frame to ensure start position is rendered
      requestAnimationFrame(() => {
          requestAnimationFrame(() => {
             setIsLightboxExpanded(true);
          });
      });
  };

  const handleLightboxClose = () => {
      setIsLightboxExpanded(false);
      // Wait for animation to finish before removing from DOM
      setTimeout(() => {
          setLightboxIndex(null);
      }, 500);
  };

  // Calculate position/size for the lightbox image
  const getLightboxStyle = () => {
      if (lightboxIndex === null || !thumbDims[lightboxIndex]) return {};
      
      const imgData = thumbDims[lightboxIndex];
      const windowW = window.innerWidth;
      const windowH = window.innerHeight;

      // 1. Calculate Center Target State
      const padding = 20; // 20px gap from edges
      const availW = windowW - (padding * 2);
      const availH = windowH - (padding * 2);

      let targetW = availW;
      let targetH = targetW / imgData.ratio;

      if (targetH > availH) {
          targetH = availH;
          targetW = targetH * imgData.ratio;
      }
      
      const targetTop = (windowH - targetH) / 2;
      const targetLeft = (windowW - targetW) / 2;

      // 2. Calculate Thumbnail Origin State
      let originRect = { top: targetTop, left: targetLeft, width: targetW, height: targetH, opacity: 0 };
      
      const thumbEl = document.getElementById(`gallery-thumb-${imgData.originalIndex}`);
      if (thumbEl) {
          const r = thumbEl.getBoundingClientRect();
          originRect = { top: r.top, left: r.left, width: r.width, height: r.height, opacity: 1 };
      }

      // 3. Return style based on state
      // If expanded, go to target. If not expanded (opening or closing), go to origin.
      if (isLightboxExpanded) {
          return {
              top: targetTop,
              left: targetLeft,
              width: targetW,
              height: targetH,
              opacity: 1
          };
      } else {
          return {
              top: originRect.top,
              left: originRect.left,
              width: originRect.width,
              height: originRect.height,
              // If we couldn't find the thumb (scrolled away?), fade out
              opacity: thumbEl ? 1 : 0 
          };
      }
  };

  const secondaryStyle = { fontFamily: '"Doto", sans-serif' };
  
  if (loading || projects.length === 0) {
    return <div className="w-full min-h-screen bg-white">{!loading && <p className="p-6">Unable to load projects. Please refresh.</p>}</div>;
  }

  // --- DETAIL VIEW RENDER ---
  if (selectedProject) {
    const getFullImageUrl = (image: string) => resolveProjectImage(selectedProject.folderPath, image);
    
    // Use imagesA for slider, fallback to images (legacy support if A missing)
    const sliderImages = (detailContent?.imagesA?.length ? detailContent.imagesA : detailContent?.images) || [];
    const youtubeId = detailContent?.youtube ? getYouTubeId(detailContent.youtube) : null;

    const renderSlide = (image: string, index: number) => {
      const src = getFullImageUrl(image);
      return (
        <div
          key={index}
          className="h-full flex-shrink-0 snap-start flex items-center justify-center bg-white"
          style={sliderItemStyle}
        >
          <div className="relative w-full h-full">
            {requestedSlides.has(index) && (
              <ResponsiveImage
                src={src}
                image={getImageMetadata(imageManifest, src)}
                sizes={isMobile ? 'calc(100vw - 48px)' : '70vw'}
                alt={`${selectedProject.title.en} — ${index + 1}`}
                className="absolute inset-0 w-full h-full object-contain select-none block"
                loading={index === sliderIndex ? 'eager' : 'lazy'}
                fetchPriority={index === sliderIndex ? 'high' : 'low'}
                draggable={false}
                onLoad={(event) => {
                  if (index === 0 && !getImageMetadata(imageManifest, src)) {
                    const { naturalWidth, naturalHeight } = event.currentTarget;
                    if (naturalWidth && naturalHeight) setImageAspectRatio(naturalWidth / naturalHeight);
                  }
                }}
              />
            )}
          </div>
        </div>
      );
    };

    // Pointer event logic for Index/Back buttons (Mobile)
    const navPointerEvents = (visible: boolean) => visible ? 'pointer-events-auto' : 'pointer-events-none';

    // RENDER: INDEX OVERLAY (Shared)
    const indexOverlay = showIndex && (
        <div className="fixed inset-0 bg-white z-[130] flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
            <button 
                onClick={() => setShowIndex(false)}
                className="absolute top-6 right-6 p-2 text-black hover:text-[#F22C2C]"
            >
                <X size={32} strokeWidth={1} />
            </button>
            
            <div className="flex flex-col gap-6 text-center max-h-full overflow-y-auto py-10">
                {projects.map((p) => (
                    <button
                        key={p.id}
                        onClick={() => handleProjectClick(p)}
                        className={`text-xl md:text-3xl transition-colors ${selectedProject.id === p.id ? 'text-[#F22C2C]' : 'text-black hover:text-[#F22C2C]'}`}
                        style={{ fontFamily: '"Doto", sans-serif' }}
                    >
                        {p.title['en']}
                    </button>
                ))}
            </div>
        </div>
    );

    // RENDER: LIGHTBOX (Shared)
    const lightbox = lightboxIndex !== null && thumbDims[lightboxIndex] && (
        <div 
            className="fixed inset-0 z-[150] bg-white/10 backdrop-blur-sm text-black touch-none select-none overflow-hidden animate-in fade-in duration-300"
        >
            <div 
                className="w-full h-full relative"
                onMouseDown={(e) => handleLightboxDragStart(e.clientX)}
                onMouseMove={(e) => isDraggingLightbox && handleLightboxDragMove(e.clientX)}
                onMouseUp={handleLightboxDragEnd}
                onMouseLeave={handleLightboxDragEnd}
                onTouchStart={(e) => handleLightboxDragStart(e.touches[0].clientX)}
                onTouchMove={(e) => handleLightboxDragMove(e.touches[0].clientX)}
                onTouchEnd={handleLightboxDragEnd}
            >
                 {/* Animated Image */}
                <ResponsiveImage
                    key={thumbDims[lightboxIndex].src}
                    src={thumbDims[lightboxIndex].fullSrc || thumbDims[lightboxIndex].src}
                    image={getImageMetadata(imageManifest, thumbDims[lightboxIndex].fullSrc || thumbDims[lightboxIndex].src)}
                    sizes={`${Math.ceil(Math.min(window.innerWidth - 40, (window.innerHeight - 40) * thumbDims[lightboxIndex].ratio))}px`}
                    loading="eager"
                    fetchPriority="high"
                    alt="Full View"
                    className="absolute object-contain shadow-xl block"
                    style={{ 
                        ...getLightboxStyle(),
                        transition: isDraggingLightbox 
                          ? 'none' 
                          : 'top 0.5s cubic-bezier(0.19, 1, 0.22, 1), left 0.5s cubic-bezier(0.19, 1, 0.22, 1), width 0.5s cubic-bezier(0.19, 1, 0.22, 1), height 0.5s cubic-bezier(0.19, 1, 0.22, 1)',
                        transform: `translateX(${dragOffset}px)`,
                    }}
                />
                
                <button 
                    onClick={handleLightboxClose}
                    className="absolute top-6 right-6 p-2 bg-black/5 hover:bg-black/10 backdrop-blur rounded-full text-black hover:text-[#F22C2C] transition-colors z-20"
                >
                    <X size={24} />
                </button>
                
                <div 
                    className="absolute bottom-6 left-6 text-xs font-bold text-[#F22C2C] z-20"
                    style={secondaryStyle}
                >
                    {lightboxIndex + 1} / {thumbDims.length}
                </div>
            </div>
        </div>
    );

    // MOBILE LAYOUT (Vertical Scroll)
    if (isMobile) {
        // Logic to hide bottom controls if top controls are visible
        const showBottomControls = isAtBottom && !isAtTop;
        const sliderImages = (detailContent?.imagesA?.length ? detailContent.imagesA : detailContent?.images) || [];
        const totalSlides = sliderImages.length;

        return (
            <div 
                className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in fade-in duration-500"
                onScroll={handleDetailScroll}
            >
                {/* TOP CONTROLS */}
                <div 
                  className={`fixed top-0 left-0 w-full z-[110] flex justify-between px-6 pt-6 transition-opacity duration-300 ${isAtTop ? 'opacity-100' : 'opacity-0'}`}
                >
                    <button
                        onClick={() => setShowIndex(true)}
                        className={`text-[#F22C2C] text-lg hover:opacity-70 transition-opacity ${navPointerEvents(isAtTop)}`}
                        style={{ fontFamily: '"Doto", sans-serif' }}
                    >
                        INDEX
                    </button>

                    <button
                        onClick={handleBack}
                        className={`text-black text-lg hover:opacity-70 transition-opacity ${navPointerEvents(isAtTop)}`}
                        style={{ fontFamily: '"Doto", sans-serif' }}
                    >
                        BACK
                    </button>
                </div>

                {/* BOTTOM CONTROLS (Only visible if not at top) */}
                <div 
                  className={`fixed bottom-0 left-0 w-full z-[120] flex justify-between ${isMobile ? 'px-3 pb-4' : 'px-6 pb-6'} transition-opacity duration-300 ${showBottomControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                >
                    <button
                        onClick={() => setShowIndex(true)}
                        className={`text-[#F22C2C] text-lg hover:opacity-70 transition-opacity ${navPointerEvents(showBottomControls)}`}
                        style={{ fontFamily: '"Doto", sans-serif' }}
                    >
                        INDEX
                    </button>

                    <button
                        onClick={handleBack}
                        className={`text-black text-lg hover:opacity-70 transition-opacity ${navPointerEvents(showBottomControls)}`}
                        style={{ fontFamily: '"Doto", sans-serif' }}
                    >
                        BACK
                    </button>
                </div>

                {/* LANGUAGE TOGGLE */}
                <div className={`fixed bottom-6 right-6 z-[110] transition-opacity duration-300 ${isAtBottom ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <button 
                      {...langButtonProps}
                      className="flex items-center justify-center w-9 h-9 bg-white/90 backdrop-blur border border-black rounded-full hover:bg-black hover:text-white transition-all duration-300 text-[10px] shadow-sm select-none"
                    >
                      {lang === 'en' ? TRANSLATIONS.LANG_LABEL.cn : lang === 'cn' ? TRANSLATIONS.LANG_LABEL.tw : TRANSLATIONS.LANG_LABEL.en}
                    </button>
                </div>

                {indexOverlay}

                {/* MAIN CONTENT */}
                <div className="w-full pt-24 pb-10 relative flex flex-col items-center">
                    {detailLoading ? (
                        <div className="animate-pulse text-[#F22C2C] px-4" style={secondaryStyle}>Loading content...</div>
                    ) : (
                        <>
                             {/* Content Wrapper */}
                             <div className="w-full max-w-4xl flex flex-col px-6">
                                 {/* 1. Slider (horizontal strip, shared mobile/desktop) */}
                                 {sliderImages.length > 0 && (
                                     <div className="relative mb-2 w-full group">
                                        <div 
                                            style={{ aspectRatio: imageAspectRatio ?? DEFAULT_SLIDER_RATIO }}
                                            className="w-full relative bg-white"
                                            onTouchStart={(e) => handleMobileSlideStart(e.touches[0].clientX)}
                                            onTouchMove={(e) => handleMobileSlideMove(e.touches[0].clientX)}
                                            onTouchEnd={handleMobileSlideEnd}
                                            onMouseDown={(e) => handleMobileSlideStart(e.clientX)}
                                            onMouseMove={(e) => { if (e.buttons === 1) handleMobileSlideMove(e.clientX); }}
                                            onMouseUp={handleMobileSlideEnd}
                                            onMouseLeave={() => { if (mobileSlideStartX.current !== null) handleMobileSlideEnd(); }}
                                        >
                                          <div 
                                            ref={imageScrollRef}
                                            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth w-full h-full"
                                            style={sliderContainerStyle}
                                            onScroll={handleSliderScroll}
                                            onTouchStart={(e) => handleMobileSlideStart(e.touches[0].clientX)}
                                            onTouchMove={(e) => handleMobileSlideMove(e.touches[0].clientX)}
                                            onTouchEnd={handleMobileSlideEnd}
                                            onMouseDown={(e) => handleMobileSlideStart(e.clientX)}
                                            onMouseMove={(e) => { if (e.buttons === 1) handleMobileSlideMove(e.clientX); }}
                                            onMouseUp={handleMobileSlideEnd}
                                            onMouseLeave={() => { if (mobileSlideStartX.current !== null) handleMobileSlideEnd(); }}
                                          >
                                            {sliderImages.map(renderSlide)}
                                          </div>
                                        </div>
                                      </div>
                                  )}

                                 {/* 2. Header */}
                                 <div 
                                    onClick={() => setIsTextOpen(!isTextOpen)}
                                    className="mb-4 w-full cursor-pointer group select-none transition-opacity duration-300"
                                 >
                                   <div className="flex flex-row justify-between items-baseline">
                                     <div 
                                       style={secondaryStyle}
                                       className="text-[#F22C2C] text-xs leading-tight transition-colors group-hover:text-black"
                                     >
                                       {selectedProject.title['en']} {selectedProject.year}
                                     </div>
                                     <div className={`transition-transform duration-300 ${isTextOpen ? 'rotate-180' : ''}`}>
                                        <ChevronDown size={16} className="text-[#F22C2C] group-hover:text-black transition-colors" />
                                     </div>
                                   </div>
                                   <div className="w-full h-px bg-black mt-2" />
                                 </div>
                             </div>

                             {/* 3. Text & Video */}
                             <div 
                               className={`w-full grid transition-[grid-template-rows] duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${isTextOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                             >
                                <div className="overflow-hidden">
                                    {youtubeId && (
                                      <div className="w-full max-w-4xl px-6 mb-12">
                                        <div className="relative w-full pt-[56.25%] bg-black">
                                          <iframe 
                                            className="absolute top-0 left-0 w-full h-full"
                                            src={`https://www.youtube.com/embed/${youtubeId}`} 
                                            title="YouTube" 
                                            frameBorder="0" 
                                            allowFullScreen
                                          />
                                        </div>
                                      </div>
                                    )}
                                    <article className="mb-32 w-full max-w-4xl mx-auto px-6 animate-in fade-in duration-700 slide-in-from-top-2">
                                        <div className="text-base leading-7 text-left md:text-left md:text-balance">
                                        {detailContent?.text && getLangString(detailContent.text)
                                            .split('\n')
                                            .filter(paragraph => paragraph.trim() !== '') 
                                            .map((paragraph, index) => (
                                            <p key={index} className="mb-6 last:mb-0">
                                                {paragraph}
                                            </p>
                                        ))}
                                        </div>
                                    </article>
                                </div>
                             </div>

                             {/* 4. Gallery Accordion (Shown only if thumbDims exist) */}
                             {thumbDims.length > 0 && (
                                 <div className="w-full max-w-[98vw] relative pb-20 mt-10">
                                    <div 
                                        onClick={() => setIsGalleryOpen(!isGalleryOpen)}
                                        className="cursor-pointer group flex flex-col items-center justify-center mb-8 select-none"
                                    >
                                        <span 
                                            className="text-base group-hover:text-[#F22C2C] transition-colors"
                                            style={secondaryStyle}
                                        >
                                            GALLERY
                                        </span>
                                        <div className={`transition-transform duration-300 ${isGalleryOpen ? 'rotate-180' : ''}`}>
                                            <ChevronDown size={20} className="text-gray-400 group-hover:text-[#F22C2C]" strokeWidth={1}/>
                                        </div>
                                    </div>

                                    <div 
                                        ref={galleryContainerRef}
                                        className={`w-full relative transition-[grid-template-rows] duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] grid ${isGalleryOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                                    >
                                        <div className="overflow-hidden">
                                            <div className="flex flex-col gap-1 w-full animate-in fade-in duration-700 pb-10">
                                                {galleryRows.map((row, rowIdx) => {
                                                    const totalRatio = row.images.reduce((acc, im) => acc + im.ratio, 0);
                                                    return (
                                                        <div key={rowIdx} className="flex w-full gap-1" style={{ height: row.height }}>
                                                            {row.images.map((img) => (
                                                                <div 
                                                                    key={img.originalIndex} 
                                                                    id={`gallery-thumb-${img.originalIndex}`}
                                                                    className="relative cursor-pointer group/thumb hover:opacity-90 transition-opacity overflow-hidden"
                                                                    style={{ width: `${(img.ratio / totalRatio) * 100}%`, height: '100%' }}
                                                                    onClick={() => handleThumbClick(img.originalIndex)}
                                                                >
                                                                    <ResponsiveImage
                                                                      src={img.src}
                                                                      image={getImageMetadata(imageManifest, img.src)}
                                                                      sizes={`${Math.ceil(galleryWidth * img.ratio / totalRatio)}px`}
                                                                      enabled={isGalleryOpen}
                                                                      alt="" 
                                                                      className="w-full h-full object-contain block bg-white" 
                                                                      loading="lazy"
                                                                      decoding="async"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                 </div>
                             )}
                        </>
                    )}
                </div>
                {lightbox}
            </div>
        );
    } 
    
    // DESKTOP LAYOUT (Split Screen)
    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-row overflow-hidden">
            
            {/* LEFT PANEL: Fixed width content */}
            <div 
              className={`flex flex-col h-full bg-white z-20 relative transition-all duration-300
                 ${isGalleryOpen ? 'w-[500px] shrink-0' : 'w-[420px] min-w-[220px] shrink-0'}
              `}
            >
                
                {/* Fixed Top Nav */}
                <div className="flex justify-between items-center px-10 pt-10 pb-6 bg-white shrink-0">
                    <button
                        onClick={() => setShowIndex(true)}
                        className="text-[#F22C2C] text-xl hover:opacity-70 transition-opacity"
                        style={{ fontFamily: '"Doto", sans-serif' }}
                    >
                        INDEX
                    </button>
                    <button
                        onClick={handleBack}
                        className="text-black text-xl hover:opacity-70 transition-opacity"
                        style={{ fontFamily: '"Doto", sans-serif' }}
                    >
                        BACK
                    </button>
                </div>

                {/* Scrollable Area */}
                <div className="flex-1 overflow-y-auto px-10 pb-20 scrollbar-hide">
                    {detailLoading ? (
                        <div className="animate-pulse text-[#F22C2C] mt-10" style={secondaryStyle}>Loading content...</div>
                    ) : (
                        <div className="mt-4">
                            {/* Title Block */}
                            <div 
                                onClick={() => setIsTextOpen(!isTextOpen)}
                                className="mb-6 cursor-pointer group select-none"
                            >
                                <div className="flex justify-between items-baseline mb-2 gap-4">
                                    <h1 
                                        className="text-sm text-[#F22C2C] leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
                                        style={{ fontFamily: '"Doto", sans-serif' }}
                                    >
                                        {selectedProject.title['en']}
                                    </h1>
                                    <span 
                                        className="text-[#F22C2C] text-sm shrink-0"
                                        style={{ fontFamily: '"Doto", sans-serif' }}
                                    >
                                        {selectedProject.year}
                                    </span>
                                </div>
                                <div className="h-px bg-black w-full" />
                                <div className={`mt-2 transition-transform duration-300 ${isTextOpen ? 'rotate-180' : ''}`}>
                                    <ChevronDown 
                                        size={20} 
                                        strokeWidth={1} 
                                        className="text-gray-400 group-hover:text-[#F22C2C] transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Collapsible Text */}
                            <div 
                                className={`grid transition-[grid-template-rows] duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${isTextOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                            >
                                <div className="overflow-hidden">
                                     {youtubeId && (
                                       <div className="relative w-full pt-[56.25%] bg-black mb-10">
                                           <iframe 
                                             className="absolute top-0 left-0 w-full h-full"
                                             src={`https://www.youtube.com/embed/${youtubeId}`} 
                                             title="YouTube" 
                                             frameBorder="0" 
                                             allowFullScreen
                                           />
                                       </div>
                                     )}
                                     <article className="text-base leading-relaxed text-left md:text-left md:text-balance mb-10">
                                        {detailContent?.text && getLangString(detailContent.text)
                                            .split('\n')
                                            .filter(p => p.trim() !== '') 
                                            .map((p, i) => (
                                            <p key={i} className="mb-6 last:mb-0">{p}</p>
                                        ))}
                                     </article>
                                </div>
                            </div>

                            {/* Gallery Switch - Show if thumbDims exists, regardless of rows calculated yet */}
                            {thumbDims.length > 0 && (
                                <div className="mt-12">
                                    <button 
                                        onClick={() => setIsGalleryOpen(!isGalleryOpen)}
                                        className="flex items-center gap-2 group select-none"
                                    >
                                         <span 
                                             className="text-base group-hover:text-[#F22C2C] transition-colors"
                                             style={secondaryStyle}
                                         >
                                             GALLERY
                                         </span>
                                         <ChevronDown 
                                            size={20} 
                                            className={`text-gray-400 group-hover:text-[#F22C2C] transition-transform duration-300 ${isGalleryOpen ? 'rotate-180' : ''}`}
                                            strokeWidth={1}
                                         />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: Visuals (Auto Width based on image aspect ratio) */}
            <div 
                className={`h-full relative bg-white overflow-hidden flex flex-col justify-center items-center
                    flex-1
                `}
                style={{ padding: '1vh' }}
            >
                
                {/* Language Toggle fixed to screen bottom right */}
                <div className="absolute bottom-10 right-10 z-30">
                     <button 
                      {...langButtonProps}
                      className="flex items-center justify-center w-9 h-9 bg-white/90 backdrop-blur border border-black rounded-full hover:bg-black hover:text-white transition-all duration-300 text-[10px] shadow-sm select-none"
                    >
                      {lang === 'en' ? TRANSLATIONS.LANG_LABEL.cn : lang === 'cn' ? TRANSLATIONS.LANG_LABEL.tw : TRANSLATIONS.LANG_LABEL.en}
                    </button>
                </div>

                {isGalleryOpen ? (
                    /* GALLERY GRID */
                    <div 
                        className="w-full h-full overflow-y-auto scrollbar-hide animate-in fade-in duration-500"
                    >
                        <div ref={galleryContainerRef} className="w-full">
                            {galleryRows.length > 0 && (
                                <div className="flex flex-col gap-1 w-full">
                                    {galleryRows.map((row, rowIdx) => {
                                        const totalRatio = row.images.reduce((acc, im) => acc + im.ratio, 0);
                                        return (
                                            <div key={rowIdx} className="flex w-full gap-1" style={{ height: row.height }}>
                                                {row.images.map((img) => (
                                                    <div 
                                                        key={img.originalIndex} 
                                                        id={`gallery-thumb-${img.originalIndex}`}
                                                        className="relative cursor-pointer group/thumb hover:opacity-90 transition-opacity overflow-hidden"
                                                        style={{ width: `${(img.ratio / totalRatio) * 100}%`, height: '100%' }}
                                                        onClick={() => handleThumbClick(img.originalIndex)}
                                                    >
                                                        <ResponsiveImage
                                                          src={img.src}
                                                          image={getImageMetadata(imageManifest, img.src)}
                                                          sizes={`${Math.ceil(galleryWidth * img.ratio / totalRatio)}px`}
                                                          alt="" 
                                                          className="w-full h-full object-contain block bg-white" 
                                                          loading="lazy"
                                                          decoding="async"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* HORIZONTAL STRIP (Desktop scroll like mobile) */
                    sliderImages.length > 0 && (
        <div 
          className="relative h-full w-full flex justify-center items-center group/image"
          onMouseDown={(e) => handleMobileSlideStart(e.clientX)}
          onMouseMove={(e) => { if (e.buttons === 1) handleMobileSlideMove(e.clientX); }}
          onMouseUp={handleMobileSlideEnd}
          onMouseLeave={() => { if (mobileSlideStartX.current !== null) handleMobileSlideEnd(); }}
          onTouchStart={(e) => handleMobileSlideStart(e.touches[0].clientX)}
          onTouchMove={(e) => handleMobileSlideMove(e.touches[0].clientX)}
          onTouchEnd={handleMobileSlideEnd}
        >
            <div 
              ref={imageScrollRef}
              className="flex h-full w-full max-w-[92vw] max-h-[92vh] overflow-x-auto snap-x snap-mandatory scrollbar-hide"
              style={sliderContainerStyle}
              onScroll={handleSliderScroll}
            >
              {sliderImages.map(renderSlide)}
            </div>
        </div>
                    )
                )}
            </div>

            {indexOverlay}
            {lightbox}
        </div>
    );
  }

  // --- CAROUSEL VIEW RENDER (Main Menu) ---
  const currentProject = projects[displayIndex];
  const currentSrc = currentProject ? getProjectCoverSrc(currentProject) : '';
  const coverImage = getImageMetadata(imageManifest, getProjectCoverOriginalSrc(currentProject));
  const coverRatio = coverImage ? coverImage.width / coverImage.height : DEFAULT_SLIDER_RATIO;
  const coverWidth = `min(calc(100vw - ${isMobile ? MOBILE_SIDE_PADDING * 2 : 160}px), calc((100dvh - ${isMobile ? 200 : 190}px) * ${coverRatio}))`;
  const gaussianCover = currentProject.gaussianCover;
  const hasGaussianCover = gaussianCover && resolveProjectImage(currentProject.folderPath, gaussianCover.image) === getProjectCoverOriginalSrc(currentProject);

  return (
    <div 
        className={`fixed inset-0 ${isMobile ? 'pt-8 items-center' : 'pt-20 md:pt-24 items-center'} ${isMobile ? 'pb-4' : 'pb-4'} bg-white z-0 flex justify-center overflow-hidden touch-pan-y`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        style={isMobile ? { paddingLeft: MOBILE_SIDE_PADDING, paddingRight: MOBILE_SIDE_PADDING } : undefined}
    >

      <button 
        onClick={handlePrev}
        aria-label="Previous project"
        className="hidden md:flex absolute left-2 md:left-6 top-1/2 -translate-y-1/2 p-4 text-[#F22C2C] hover:opacity-70 transition-opacity z-30 text-5xl font-light select-none"
        style={{ fontFamily: '"Doto", sans-serif' }}
      >
        &lt;
      </button>

      <button 
        onClick={handleNext}
        aria-label="Next project"
        className="hidden md:flex absolute right-2 md:right-6 top-1/2 -translate-y-1/2 p-4 text-[#F22C2C] hover:opacity-70 transition-opacity z-30 text-5xl font-light select-none"
        style={{ fontFamily: '"Doto", sans-serif' }}
      >
        &gt;
      </button>

      {/* Main Content Area */}
        <div 
            className="
            relative w-full h-full 
            flex items-center justify-center 
        "
      >
        <div className="absolute inset-0 pointer-events-none" />
        <div
            className="flex flex-col items-center gap-2 cursor-pointer group relative"
            style={{ width: coverWidth }}
            onClick={() => handleProjectClick(currentProject)}
        >
            {hasGaussianCover ? <GaussianCover
                key={`gaussian-${currentProject.id}`}
                sceneUrl={resolveProjectImage(currentProject.folderPath, gaussianCover.scene)}
                width={coverImage?.width || 3}
                height={coverImage?.height || 2}
                mobile={isMobile || window.matchMedia('(pointer: coarse)').matches}
                lang={lang}
                alt={currentProject.title.en}
            /> : <ResponsiveImage
                src={currentSrc}
                image={coverImage}
                onLoad={handleCoverLoaded}
                alt={currentProject.title.en}
                sizes={coverWidth}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="block w-full h-auto select-none"
                style={{ width: '100%' }}
            />}

            <div
                className="flex flex-row justify-between items-baseline relative z-20 gap-6 w-full"
                key={currentProject.id}
            >
                {/* Rule: Title ALWAYS English */}
                <h2 className="text-base font-normal text-left leading-tight break-words">
                    {currentProject.title['en']}
                </h2>
                
                <span 
                    className="text-[#F22C2C] text-xs md:text-sm text-right leading-none whitespace-nowrap flex-shrink-0"
                    style={{ fontFamily: '"Doto", sans-serif' }}
                >
                    {currentProject.year}
                </span>
            </div>
        </div>
      </div>
      
      {/* Mobile Swipe Hint */}
      <div 
        className="md:hidden absolute bottom-6 text-[10px] text-[#F22C2C] pointer-events-none uppercase tracking-widest z-20 opacity-60"
        style={{ fontFamily: '"Doto", sans-serif' }}
      >
         &lt; Swipe &gt;
      </div>
    </div>
  );
};

export default Portfolio;
