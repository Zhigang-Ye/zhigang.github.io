
import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { Project, Lang, MultiLangString } from '../types';
import { X, ChevronDown } from 'lucide-react';
import ParticleImage, { prefetchParticleImage } from './ParticleImage';
import { TRANSLATIONS } from '../constants';

interface PortfolioProps {
  lang: Lang;
  toggleLang: () => void;
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

const Portfolio: React.FC<PortfolioProps> = ({ lang, toggleLang }) => {
  const MOBILE_SIDE_PADDING = 12; // px, keep image and nav aligned on mobile

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [displayIndex, setDisplayIndex] = useState(0);
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailContent, setDetailContent] = useState<ProjectDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | undefined>(undefined);
  const [detailImagesReady, setDetailImagesReady] = useState(false);
  const [sliderLoading, setSliderLoading] = useState(true);
  const [lowResAvailable, setLowResAvailable] = useState<Record<string, boolean>>({});
  const [hiResLoadedMap, setHiResLoadedMap] = useState<Record<number, boolean>>({});
  const [mobileSliderIndex, setMobileSliderIndex] = useState(0);

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
  const [lightboxHiResSrc, setLightboxHiResSrc] = useState<string | null>(null);
  const thumbCacheRef = useRef<Record<string, MeasuredImage[]>>({});
  const fpDiscoveryCacheRef = useRef<Record<string, string[]>>({});
  const mobileSlideStartX = useRef<number | null>(null);
  const mobileSlideCurrentX = useRef<number | null>(null);

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

  // Desktop State
  const [desktopSliderIndex, setDesktopSliderIndex] = useState(0);

  // Device Check
  const [isMobile, setIsMobile] = useState(false);

  // Particle tweak controls (temporary UI)
  const [particleGap, setParticleGap] = useState(6);
  const [particleDotRadius, setParticleDotRadius] = useState(2.8);
  const [fpIndexMap, setFpIndexMap] = useState<Record<string, number>>({});
  const [showTestPanel, setShowTestPanel] = useState(false);
  const langHoldTimerRef = useRef<number | null>(null);
  const langLongPressRef = useRef(false);
  const COLOR_BOOST = { mult: 1.2, gamma: 1.2 };
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);
  const [particleOffset, setParticleOffset] = useState(0);
  const autoOpenTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Text collapsed by default; will open manually

  // Particle slide-in animation based on direction
  useEffect(() => {
    if (!slideDirection) return;
    const offset = slideDirection === 'next' ? 40 : -40;
    setParticleOffset(offset);
    requestAnimationFrame(() => setParticleOffset(0));
    const timer = setTimeout(() => setSlideDirection(null), 450);
    return () => clearTimeout(timer);
  }, [displayIndex, slideDirection]);

  // Discover FP images named 1.jpg, 2.jpg... inside each project folder (stop at first non-image)
  const discoverFPImages = useCallback(async (folderPath: string, maxScan: number = 1) => {
    const found: string[] = [];
    for (let i = 1; i <= maxScan; i++) {
      const candidateRelative = `FP/${i}.jpg`;
      const candidateUrl = `${folderPath}/${candidateRelative}`;
      try {
        const res = await fetch(candidateUrl, { method: 'HEAD' });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.startsWith('image')) {
          found.push(candidateRelative);
          continue;
        }
      } catch (e) {
        // Ignore network/HEAD errors and stop
      }
      break; // stop scanning on first miss to avoid extra requests
    }
    return found;
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const manifestRes = await fetch('./manifest.json');
        const manifest = await manifestRes.json();
        
        const portfolioRes = await fetch(manifest.portfolio);
        const data = await portfolioRes.json();

        const resolveFPForProject = async (project: Project): Promise<Project> => {
            // Cache discovery per project to avoid repeat HEADs
            if (!fpDiscoveryCacheRef.current[project.id]) {
              fpDiscoveryCacheRef.current[project.id] = project.fpImages || [];
            }

            let fpList = fpDiscoveryCacheRef.current[project.id];

            // If no explicit list, try to discover numbered images in FP folder (1.jpg only)
            if ((!fpList || fpList.length === 0) && project.folderPath) {
                fpList = await discoverFPImages(project.folderPath);
                fpDiscoveryCacheRef.current[project.id] = fpList;
            }

            if (fpList.length > 0) {
                const pick = fpList[Math.floor(Math.random() * fpList.length)];
                const resolved = (project.folderPath && !pick.startsWith('http') && !pick.startsWith('/'))
                    ? `${project.folderPath}/${pick}`
                    : pick;
                return { ...project, fpImages: fpList, imageUrl: resolved };
            }

            return project;
        };

        const enriched = await Promise.all(data.map(resolveFPForProject));
        
        setProjects(enriched);

        // Randomly select starting project for the Carousel View
        if (enriched.length > 0) {
            setDisplayIndex(Math.floor(Math.random() * enriched.length));
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading portfolio:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getProjectParticleSrc = useCallback((project: Project) => {
    if (!project) return '';
    const fpList = project.fpImages || [];
    if (fpList.length > 0 && project.folderPath) {
        const currentIdx = fpIndexMap[project.id] ?? 0;
        const pick = fpList[currentIdx % fpList.length];
        return (pick.startsWith('http') || pick.startsWith('/')) ? pick : `${project.folderPath}/${pick}`;
    }
    return project.imageUrl;
  }, [fpIndexMap]);

  const cycleFpImage = useCallback((projectId: string) => {
    setFpIndexMap(prev => {
      const next = { ...prev };
      next[projectId] = (prev[projectId] ?? 0) + 1;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!loading && projects.length > 0) {
      const preloadParticles = async () => {
        const estimatedWidth = Math.min(window.innerWidth, 2000) * 0.8;
        
        for (let i = 0; i < projects.length; i++) {
            const idx = (displayIndex + 1 + i) % projects.length;
            if (idx === displayIndex) continue;

            const project = projects[idx];
            const src = getProjectParticleSrc(project);
            if (project && src) {
                try {
                    await prefetchParticleImage(src, estimatedWidth, particleGap, COLOR_BOOST);
                    await new Promise(resolve => setTimeout(resolve, 200));
                } catch (e) {
                    console.warn(`Failed to preload particles for ${project.id}`, e);
                }
            }
        }
      };

      const timer = setTimeout(() => {
          preloadParticles();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [loading, projects, displayIndex, particleGap, COLOR_BOOST, getProjectParticleSrc]);

  const getLangString = (obj: MultiLangString) => {
    return obj[lang] || obj['en'];
  };

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // --- Mobile slide helpers (low-res -> hi-res) ---
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
    const sliderImages = detailContent?.imagesA || detailContent?.images || [];
    const totalSlides = sliderImages.length;
    if (delta > threshold && totalSlides > 1) {
      setSliderLoading(true);
      setMobileSliderIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
    } else if (delta < -threshold && totalSlides > 1) {
      setSliderLoading(true);
      setMobileSliderIndex((prev) => (prev + 1) % totalSlides);
    }
    mobileSlideStartX.current = null;
    mobileSlideCurrentX.current = null;
  };

  // Build low-res paths from generated C folder
  const getLowResAUrl = (project: Project | null, img: string) => {
    if (!project?.folderPath) return img;
    if (img.startsWith('http') || img.startsWith('/')) return img;
    const base = img.split('/').pop()?.split('.').slice(0, -1).join('.') || 'image';
    return `${project.folderPath}/C/${base}.jpg`;
  };

  const getLowResBUrl = (project: Project | null, img: string) => {
    if (!project?.folderPath) return img;
    if (img.startsWith('http') || img.startsWith('/')) return img;
    const base = img.split('/').pop()?.split('.').slice(0, -1).join('.') || 'image';
    return `${project.folderPath}/C/B/${base}.jpg`;
  };

  const handleNext = () => {
    setSlideDirection('next');
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
    setSlideDirection('prev');
    setDisplayIndex((prev) => {
      const nextIdx = (prev - 1 + projects.length) % projects.length;
      const nextProject = projects[nextIdx];
      if (nextProject?.id) {
        cycleFpImage(nextProject.id);
      }
      return nextIdx;
    });
  };

  const scrollDesktopToIndex = (idx: number) => {
      if (!detailContent) return;
      const images = detailContent.imagesA || detailContent.images || [];
      if (images.length === 0) return;
      const nextIdx = ((idx % images.length) + images.length) % images.length;
      setDesktopSliderIndex(nextIdx);
      const container = imageScrollRef.current;
      if (container && container.children[nextIdx]) {
          const child = container.children[nextIdx] as HTMLElement;
          child.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
  };

  const handleDesktopNextImage = () => {
      if (!detailContent) return;
      const images = detailContent.imagesA || detailContent.images || [];
      if (images.length === 0) return;
      scrollDesktopToIndex(desktopSliderIndex + 1);
  };

  const handleDesktopPrevImage = () => {
      if (!detailContent) return;
      const images = detailContent.imagesA || detailContent.images || [];
      if (images.length === 0) return;
      scrollDesktopToIndex(desktopSliderIndex - 1);
  };

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

  // Long press to toggle test panel via language button (desktop/mobile)
  const LONG_PRESS_MS = 2000;
  const handleLangPointerDown = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    langLongPressRef.current = false;
    if (langHoldTimerRef.current) clearTimeout(langHoldTimerRef.current);
    langHoldTimerRef.current = window.setTimeout(() => {
      langLongPressRef.current = true;
      setShowTestPanel(true);
    }, LONG_PRESS_MS);
  };
  const handleLangTouchStart = (e: React.TouchEvent) => handleLangPointerDown(e);
  const clearLangHold = () => {
    if (langHoldTimerRef.current) {
      clearTimeout(langHoldTimerRef.current);
      langHoldTimerRef.current = null;
    }
  };
  const handleLangPointerUp = () => {
    clearLangHold();
    if (!langLongPressRef.current) {
      toggleLang();
    }
  };
  const handleLangTouchEnd = () => {
    clearLangHold();
    if (!langLongPressRef.current) {
      toggleLang();
    }
  };

  // Keyboard combo A+B to open test panel
  useEffect(() => {
    const pressed = new Set<string>();
    const down = (e: KeyboardEvent) => {
      pressed.add(e.key.toLowerCase());
      if (pressed.has('a') && pressed.has('b')) {
        setShowTestPanel(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      pressed.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const langButtonProps = {
    onPointerDown: handleLangPointerDown,
    onPointerUp: handleLangPointerUp,
    onPointerLeave: clearLangHold,
    onPointerCancel: clearLangHold,
    onTouchStart: handleLangTouchStart,
    onTouchEnd: handleLangTouchEnd,
    onTouchCancel: clearLangHold,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: (e: React.MouseEvent) => {
      if (langLongPressRef.current) { 
        e.preventDefault(); 
        return; 
      }
      toggleLang();
    }
  };

  // --- Project Open Logic ---
  const handleProjectClick = async (project: Project) => {
    if (isDraggingRef.current) return;

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
    setDetailImagesReady(false);
    setSliderLoading(true);
    setLowResAvailable((prev) => {
      const next = { ...prev };
      if (project?.id) delete next[project.id];
      return next;
    });
    setHiResLoadedMap({});
    setMobileSliderIndex(0);
    mobileSlideStartX.current = null;
    mobileSlideCurrentX.current = null;
    // Always start closed on both desktop and mobile
    setIsTextOpen(false); 
    
    setLightboxIndex(null);
    setDesktopSliderIndex(0); // Reset desktop slider

    const discoverImages = async (folderPath: string, sub: 'A' | 'B', maxScan: number = 30) => {
        const exts = ['jpg', 'jpeg', 'png', 'webp'];
        const found: string[] = [];
        for (let i = 1; i <= maxScan; i++) {
            let matched = false;
            for (const ext of exts) {
                const candidate = `${folderPath}/${sub}/${i}.${ext}`;
                try {
                    const res = await fetch(candidate, { method: 'HEAD' });
                    const ct = res.headers.get('content-type') || '';
                    if (res.ok && ct.startsWith('image')) {
                        found.push(`${sub}/${i}.${ext}`);
                        matched = true;
                        break;
                    }
                } catch (e) {
                    // ignore
                }
            }
            if (!matched) break; // stop scanning on first miss
        }
        return found;
    };

    // Helper to get full URL
    const getFullUrl = (img: string) => {
        const currentFolderPath = project.folderPath || '';
        return (img.startsWith('http') || img.startsWith('/')) 
            ? img 
            : `${currentFolderPath}/${img}`;
    };

    try {
        let content: ProjectDetailData;

        if (project.folderPath) {
            const res = await fetch(`${project.folderPath}/data.json`);
            if (res.ok) {
                content = await res.json();
            } else {
                content = {
                    images: [project.imageUrl],
                    text: project.description
                };
            }
        } else {
            content = {
                images: [project.imageUrl],
                text: project.description
            };
        }

        // Auto-discover A/B if missing or empty
        if (project.folderPath) {
            if (!content.imagesA || content.imagesA.length === 0) {
                content.imagesA = await discoverImages(project.folderPath, 'A');
            }
            if (!content.imagesB || content.imagesB.length === 0) {
                content.imagesB = await discoverImages(project.folderPath, 'B');
            }
        }

        // --- ASPECT RATIO LOGIC (Folder A - Carousel) ---
        // Priority: imagesA -> images (fallback)
            const sliderImages = content.imagesA || content.images || [];
        if (sliderImages.length > 0) {
            const firstImgSrc = getFullUrl(sliderImages[0]);
            const img = new Image();
            img.src = firstImgSrc;
            img.onload = () => {
                const ratio = img.naturalWidth / img.naturalHeight;
                setImageAspectRatio(ratio);
                setSliderLoading(true); // will clear once low-res loads
                setDetailImagesReady(true);
                setSliderLoading(true);
            };
            img.onerror = () => {
                setImageAspectRatio(16/9); 
                setSliderLoading(true);
                setDetailImagesReady(true);
            };
        } else {
            setImageAspectRatio(16/9);
        }

        // --- PRELOAD THUMBNAILS RATIOS (Folder B - Thumbnails) ---
        // Priority: imagesB -> empty (Strict separation as requested)
        // If imagesB is missing, we do not show thumbnails in the gallery section
        const thumbs = content.imagesB || [];
        if (thumbs.length > 0) {
             // If cached, use directly
             const cached = thumbCacheRef.current[project.id];
             if (cached && cached.length > 0) {
                setThumbDims(cached);
             } else {
                // Immediate placeholder to render gallery alongside text
             const placeholderDims: MeasuredImage[] = thumbs.map((srcRaw, idx) => {
                    const src = getLowResBUrl(project, srcRaw);
                   return { src, fullSrc: getFullUrl(srcRaw), ratio: 1, originalIndex: idx };
                });
                setThumbDims(placeholderDims);

                const dimsPromise = thumbs.map((srcRaw, idx) => {
                  return new Promise<MeasuredImage | null>((resolve) => {
                    const src = getFullUrl(srcRaw);
                    const img = new Image();
                    img.src = src;
                    img.onload = () => {
                      const ratio = img.naturalWidth && img.naturalHeight ? (img.naturalWidth / img.naturalHeight) : 1;
                      resolve({ src: getLowResBUrl(project, srcRaw), fullSrc: src, ratio, originalIndex: idx });
                    };
                    img.onerror = () => resolve(null);
                  });
                });
                Promise.all(dimsPromise).then(loadedDims => {
                    const finalDims = loadedDims.filter((d): d is MeasuredImage => Boolean(d));
                    setThumbDims(finalDims);
                    thumbCacheRef.current[project.id] = finalDims;
                });
             }
        }

        setDetailContent(content);
    } catch (e) {
        console.warn("Could not load detail data, using fallback", e);
        setDetailContent({
            images: [project.imageUrl],
            text: project.description
        });
        setImageAspectRatio(16/9);
    } finally {
        setDetailLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedProject(null);
    setDetailContent(null);
    setThumbDims([]);
    setGalleryRows([]);
  };

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
  }, [selectedProject, isMobile, isGalleryOpen, detailContent]);

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
          setLightboxHiResSrc(null);
      }, 500);
  };

  // Preload hi-res when lightbox index changes
  useEffect(() => {
      if (lightboxIndex === null || !thumbDims[lightboxIndex]) {
        setLightboxHiResSrc(null);
        return;
      }
      const entry = thumbDims[lightboxIndex];
      setLightboxHiResSrc(entry.src); // start with thumb/placeholder
      if (entry.fullSrc && entry.fullSrc !== entry.src) {
        const img = new Image();
        img.src = entry.fullSrc;
        img.onload = () => setLightboxHiResSrc(entry.fullSrc!);
      }
  }, [lightboxIndex, thumbDims]);

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
  
  if (loading) {
     return <div className="w-full min-h-screen bg-white" />;
  }

  // --- DETAIL VIEW RENDER ---
  if (selectedProject) {
    const getFullImageUrl = (img: string) => {
        const currentFolderPath = selectedProject?.folderPath || '';
        return (img.startsWith('http') || img.startsWith('/')) 
            ? img 
            : `${currentFolderPath}/${img}`;
    };
    
    // Use imagesA for slider, fallback to images (legacy support if A missing)
    const sliderImages = detailContent?.imagesA || detailContent?.images || [];
    const youtubeId = detailContent?.youtube ? getYouTubeId(detailContent.youtube) : null;

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
                <img 
                    src={lightboxHiResSrc || thumbDims[lightboxIndex].src}
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
        const sliderImages = detailContent?.imagesA || detailContent?.images || [];
        const totalSlides = sliderImages.length;
        const currentMobileImage = sliderImages[mobileSliderIndex] || sliderImages[0] || '';
        const allowLowRes = selectedProject?.id ? lowResAvailable[selectedProject.id] !== false : true;
        const currentLowRes = currentMobileImage ? getLowResAUrl(selectedProject, currentMobileImage) : '';
        const currentHighRes = currentMobileImage ? getFullImageUrl(currentMobileImage) : '';
        const showHiRes = hiResLoadedMap[mobileSliderIndex];

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
                                 {/* 1. Slider (mobile virtualized with low-res first) */}
                                 {sliderImages.length > 0 && (
                                     <div className="relative mb-2 w-full group">
                                        <div 
                                            style={{ aspectRatio: imageAspectRatio ? imageAspectRatio : 'auto' }}
                                            className={`w-full relative bg-white ${!imageAspectRatio ? 'min-h-[50vh]' : ''}`}
                                            onTouchStart={(e) => handleMobileSlideStart(e.touches[0].clientX)}
                                            onTouchMove={(e) => handleMobileSlideMove(e.touches[0].clientX)}
                                            onTouchEnd={handleMobileSlideEnd}
                                        >
                                          {sliderLoading && (
                                            <div className="absolute inset-0 flex items-center justify-center text-[#F22C2C] text-sm bg-white" style={{ fontFamily: '"Doto", sans-serif' }}>
                                              Loading...
                                            </div>
                                          )}
                                          {currentMobileImage && (
                                            <div className="w-full h-full flex items-center justify-center">
                                              <img 
                                                src={showHiRes || !allowLowRes ? getFullImageUrl(currentMobileImage) : getLowResAUrl(selectedProject, currentMobileImage)} 
                                                alt="" 
                                                className="w-full h-full object-contain"
                                                loading="eager"
                                                decoding="async"
                                                onLoad={(e) => {
                                                  const isHi = e.currentTarget.src === getFullImageUrl(currentMobileImage);
                                                  if (!isHi) {
                                                    setSliderLoading(false);
                                                    const hi = new Image();
                                                    hi.src = getFullImageUrl(currentMobileImage);
                                                    hi.onload = () => setHiResLoadedMap((prev) => ({ ...prev, [mobileSliderIndex]: true }));
                                                  } else {
                                                    setSliderLoading(false);
                                                    setHiResLoadedMap((prev) => ({ ...prev, [mobileSliderIndex]: true }));
                                                  }
                                                }}
                                                onError={(e) => {
                                                  const hi = getFullImageUrl(currentMobileImage);
                                                  if (e.currentTarget.src !== hi) {
                                                    if (selectedProject?.id) {
                                                      setLowResAvailable((prev) => ({ ...prev, [selectedProject.id]: false }));
                                                    }
                                                    e.currentTarget.src = hi;
                                                    return;
                                                  }
                                                  setSliderLoading(false);
                                                  setHiResLoadedMap((prev) => ({ ...prev, [mobileSliderIndex]: true }));
                                                }}
                                              />
                                            </div>
                                          )}
                                          {sliderImages.length > 1 && !sliderLoading && (
                                            <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 text-[#F22C2C] text-xl font-light pointer-events-none">
                                              <span className="pointer-events-auto px-2" onClick={() => { setSliderLoading(true); setMobileSliderIndex((prev) => (prev - 1 + totalSlides) % totalSlides); }}>&lt;</span>
                                              <span className="pointer-events-auto px-2" onClick={() => { setSliderLoading(true); setMobileSliderIndex((prev) => (prev + 1) % totalSlides); }}>&gt;</span>
                                            </div>
                                          )}
                                          {sliderImages.length > 1 && (
                                            <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-[#F22C2C]" style={{ fontFamily: '"Doto", sans-serif' }}>
                                              {mobileSliderIndex + 1} / {totalSlides}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                  )}

                                 {/* 2. Header */}
                                 <div 
                                    onClick={() => setIsTextOpen(!isTextOpen)}
                                    className={`mb-4 w-full cursor-pointer group select-none transition-opacity duration-300 ${sliderLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
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
                                    <article className={`${youtubeId ? 'mb-12' : 'mb-32'} w-full max-w-4xl mx-auto px-6 animate-in fade-in duration-700 slide-in-from-top-2`}>
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

                                     {youtubeId && (
                                       <div className="w-full max-w-4xl px-6 mb-32">
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
                                                                    <img 
                                                                      src={img.src} 
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
                                     <article className="text-base leading-relaxed text-left md:text-left md:text-balance mb-10">
                                        {detailContent?.text && getLangString(detailContent.text)
                                            .split('\n')
                                            .filter(p => p.trim() !== '') 
                                            .map((p, i) => (
                                            <p key={i} className="mb-6 last:mb-0">{p}</p>
                                        ))}
                                     </article>
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
                style={{ padding: '1.5vh' }}
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
                                                        <img 
                                                          src={img.src} 
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
                        <div className="relative h-full w-full flex justify-center items-center group/image">
                            {sliderLoading && (
                              <div className="absolute inset-0 flex items-center justify-center text-[#F22C2C] text-sm bg-white/80 z-20" style={{ fontFamily: '"Doto", sans-serif' }}>
                                Loading...
                              </div>
                            )}
                            <div 
                              ref={imageScrollRef}
                              className="flex h-full w-full max-w-[85vw] max-h-[85vh] overflow-x-auto snap-x snap-mandatory gap-4 px-6 scrollbar-hide"
                              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                              {sliderImages.map((img, idx) => {
                                const hi = getFullImageUrl(img);
                                const low = getLowResAUrl(selectedProject, img);
                                const showHi = hiResLoadedMap[idx];
                                const allowLowRes = selectedProject?.id ? lowResAvailable[selectedProject.id] !== false : true;
                                const displaySrc = (showHi || !allowLowRes) ? hi : low;
                                return (
                                  <div 
                                    key={idx} 
                                    className="flex-shrink-0 w-full h-full flex items-center justify-center snap-center bg-white"
                                    style={{ minWidth: '65vw' }}
                                  >
                                    <img 
                                      src={displaySrc} 
                                      alt="" 
                                      className="max-h-[85vh] max-w-full object-contain select-none block"
                                      draggable={false}
                                      loading={idx === 0 ? 'eager' : 'lazy'}
                                      decoding="async"
                                      onLoad={() => {
                                        if (!showHi) {
                                          setSliderLoading(false);
                                          const pre = new Image();
                                          pre.src = hi;
                                          pre.onload = () => setHiResLoadedMap((prev) => ({ ...prev, [idx]: true }));
                                        } else {
                                          setSliderLoading(false);
                                          setHiResLoadedMap((prev) => ({ ...prev, [idx]: true }));
                                        }
                                      }}
                                      onError={(e) => {
                                        if (e.currentTarget.src !== hi) {
                                          if (selectedProject?.id) {
                                            setLowResAvailable((prev) => ({ ...prev, [selectedProject.id]: false }));
                                          }
                                          e.currentTarget.src = hi;
                                          return;
                                        }
                                        setSliderLoading(false);
                                        setHiResLoadedMap((prev) => ({ ...prev, [idx]: true }));
                                      }}
                                    />
                                  </div>
                                );
                              })}
                            </div>

                            {sliderImages.length > 1 && (
                              <>
                                <button 
                                  onClick={handleDesktopPrevImage}
                                  className="absolute left-2 top-1/2 -translate-y-1/2 p-3 text-[#F22C2C] hover:opacity-70 transition-opacity z-30 text-3xl font-light select-none bg-white/70 backdrop-blur rounded-full"
                                  style={{ fontFamily: '"Doto", sans-serif' }}
                                >
                                  &lt;
                                </button>
                                <button 
                                  onClick={handleDesktopNextImage}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 text-[#F22C2C] hover:opacity-70 transition-opacity z-30 text-3xl font-light select-none bg-white/70 backdrop-blur rounded-full"
                                  style={{ fontFamily: '"Doto", sans-serif' }}
                                >
                                  &gt;
                                </button>
                              </>
                            )}
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
  const currentSrc = currentProject ? getProjectParticleSrc(currentProject) : '';
  const nextIndex = (displayIndex + 1) % projects.length;
  const prevIndex = (displayIndex - 1 + projects.length) % projects.length;
  const nextSrc = projects[nextIndex].imageUrl;
  const prevSrc = projects[prevIndex].imageUrl;
  const mobileImageWidth = `calc(100vw - ${MOBILE_SIDE_PADDING * 2}px)`;

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
      <div className="hidden">
        <img src={nextSrc} alt="preload next" />
        <img src={prevSrc} alt="preload prev" />
      </div>

      <button 
        onClick={handlePrev}
        className="hidden md:flex absolute left-2 md:left-6 top-1/2 -translate-y-1/2 p-4 text-[#F22C2C] hover:opacity-70 transition-opacity z-30 text-5xl font-light select-none"
        style={{ fontFamily: '"Doto", sans-serif' }}
      >
        &lt;
      </button>

      <button 
        onClick={handleNext}
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
        {!isMobile && (
          <button
            onClick={() => setShowTestPanel((prev) => !prev)}
            title={lang === 'en' ? 'Particle settings' : '粒子设置'}
            className="absolute bottom-4 left-4 z-30 w-9 h-9 flex items-center justify-center text-xs border border-black bg-white/90 backdrop-blur hover:bg-black hover:text-white transition-colors rounded-full shadow-sm"
          >
            ⚙
          </button>
        )}
        {/* TEMP Controls (hidden by default) */}
        {showTestPanel && (
          <div className="absolute bottom-4 left-4 z-30 bg-white/90 backdrop-blur shadow-md border border-black/10 rounded-lg p-3 flex flex-col gap-2 text-xs max-w-[240px]">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-[11px]">
                  {lang === 'en' ? 'Particle Panel' : '粒子测试面板'}
                </div>
                <button className="text-[11px] px-1" onClick={() => setShowTestPanel(false)}>
                  {lang === 'en' ? 'Close' : '关闭'}
                </button>
              </div>
              <label className="flex items-center gap-2">
                <span className="w-14">
                  {lang === 'en' ? 'Density' : '密度'}
                </span>
                <input 
                  type="range" 
                  min={2} max={10} step={0.5} 
                  value={particleGap} 
                  onChange={(e) => setParticleGap(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="w-8 text-right">{particleGap}</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-14">
                  {lang === 'en' ? 'Size' : '大小'}
                </span>
                <input 
                  type="range" 
                  min={0.5} max={4} step={0.1} 
                  value={particleDotRadius} 
                  onChange={(e) => setParticleDotRadius(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="w-8 text-right">{particleDotRadius.toFixed(1)}</span>
              </label>
              {currentProject?.fpImages?.length ? (
                <button 
                  onClick={() => {
                    cycleFpImage(currentProject.id);
                  }}
                  className="mt-1 w-full px-2 py-1 border border-black text-black hover:bg-black hover:text-white transition-colors text-[11px] rounded"
                >
                  {lang === 'en' ? 'Next Cover' : '下一张封面'}
                </button>
              ) : null}
          </div>
        )}
        <div 
            className={`flex flex-col gap-2 cursor-pointer group w-min relative transition-all duration-300
              ${isMobile ? 'items-center w-full' : 'items-center'}
            `}
            onClick={() => handleProjectClick(currentProject)}
        >
            <ParticleImage 
                src={currentSrc} 
                alt={currentProject.title['en']} 
                gap={particleGap}
                dotRadius={particleDotRadius}
                slideDirection={slideDirection}
                colorBoost={COLOR_BOOST}
                className={`
                  block h-auto object-contain select-none
                  ${isMobile 
                    ? 'max-h-[82vh] min-w-[260px] mx-auto w-full' 
                    : 'w-auto max-h-[85vh] max-w-[85vw] min-w-[450px] mx-auto'
                  }
                `}
                style={isMobile ? { width: mobileImageWidth, maxWidth: mobileImageWidth } : undefined}
            />

            <div 
                className={`flex flex-row justify-between items-baseline relative z-20 animate-in fade-in duration-500 gap-8 w-full 
                  ${isMobile ? 'w-full' : 'max-w-[85vw] min-w-[450px]'}
                `}
                style={isMobile ? { maxWidth: mobileImageWidth } : undefined}
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
