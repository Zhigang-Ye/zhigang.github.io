
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Matter from 'matter-js';
import { ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { FALLING_FONTS_EN, FONTS_CN, FONTS_TW, FONTS_EN } from '../constants';
import { Lang, MultiLangString } from '../types';

interface PhysicsHeroProps {
  lang: Lang;
}

const PhysicsHero: React.FC<PhysicsHeroProps> = ({ lang }) => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  
  // Use refs to access physics bodies outside of useEffect
  const groundRef = useRef<Matter.Body | null>(null);
  const rightWallRef = useRef<Matter.Body | null>(null);
  
  const [fontIndex, setFontIndex] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false); 
  
  // Initialize random size multiplier state
  const [initialMult] = useState(() => {
      const isMax = Math.random() < 0.3; // 30% chance for max
      if (isMax) return 3.0;
      // Random between 0.5 and 3.0 for better initial visibility
      return 0.5 + Math.random() * 2.5; 
  });

  // Global Size Multiplier (Linear Slider Value)
  const sizeMultiplierRef = useRef(initialMult);
  const [limitReached, setLimitReached] = useState<'min' | 'max' | null>(null);

  // Interaction State for Button
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // Visual drag offset for Joystick effect
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [axisLock, setAxisLock] = useState<'x' | 'y' | null>(null);
  
  const [buttonScale, setButtonScale] = useState(0.6); // Initial default, updated by effect
  
  const isDraggingRef = useRef(false);
  const dragVectorRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>(0);

  const pointerStartYRef = useRef<number>(0);
  const pointerStartXRef = useRef<number>(0);
  const isMovedRef = useRef(false);
  const [isMobileView, setIsMobileView] = useState(false);

  // --- Logic State Refs ---
  const generationRef = useRef(0);
  const dropsInCurrentCycleRef = useRef(0);
  const usedChineseKeysInCycleRef = useRef<Set<string>>(new Set());
  const charLastGenRef = useRef<Record<string, number>>({});
  const hasLargeChineseRef = useRef(false);

  // Constants for Scaling
  const MIN_MULT = 0.2;
  const MAX_MULT = 5.0;
  const MIN_BTN_SCALE = 0.6;
  // Max visual scale depends on device, handled dynamically

  // Biography Text Data
  const BIO_TEXT_DATA: MultiLangString[] = [
    {
      en: "Zhigang Ye (b. 1997) is an artist and researcher based in London and Hangzhou. He is currently a PhD candidate at the School of Arts & Humanities, Royal College of Art. Previously, he completed an MA in Photography at the Royal College of Art and a BA in New Media Art at Taipei National University of the Arts.",
      cn: "叶智港 (b. 1997) 是一位常驻伦敦与杭州的艺术家和研究者。他目前是英国皇家艺术学院（RCA）艺术与人文学院的博士研究员。此前，他获得了皇家艺术学院的摄影硕士学位，以及国立台北艺术大学，中国的新媒体艺术学士学位。",
      tw: "葉智港 (b. 1997) 是一位常駐倫敦與杭州的藝術家和研究員。他目前是英國皇家藝術學院（RCA）藝術與人文學院的博士研究員。此前，他獲得了皇家藝術學院的攝影碩士學位，以及國立臺北藝術大學，中國的新媒體藝術學士學位。"
    },
    {
      en: "His practice traverses the liminal interstices between the natural and the artificial, the archive and the algorithm. Impelled by a sense of romantic violence, he employs text, images and installation to interrogate how technology mediates our perception of reality, history, and ontological fragility. Through the visualization of speculative fabulation, he destabilizes the anthropocentric scopic regime, attempting to unfold the glitches, voids, and poetic absurdities intrinsic to the contemporary digital condition.",
      cn: "他的艺术实践游走于自然与人造、档案与算法之间日益模糊的界限。在浪漫主义暴力驱使下，他透过文字、图像及装置，质询技术如何中介我们对现实、历史和本体脆弱的感知；试着透过对思辨性虚构的视觉化解构图像的人类中心主义秩序，并敞开当代数字生存状态中固有的故障、虚空与诗意的荒诞。",
      tw: "他的艺术实践游走于自然与人造、档案与算法之间日益模糊的界限。在浪漫主义暴力驱使下，他透过文字、图像及装置，质询技术如何中介我们对现实、历史和本体脆弱的感知；试着透过对思辨性虚构的视觉化解构图像的人类中心主义秩序，并敞开当代数字生存状态中固有的故障、虚空与诗意的荒诞。"
    }
  ];

  // Check mobile view on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update button scale when view changes or initially
  useEffect(() => {
    const currentMult = sizeMultiplierRef.current;
    const maxVisual = isMobileView ? 1.1 : 1.5;
    
    // Linear Mapping for Button UI
    // mult: MIN_MULT -> MAX_MULT
    // btn: MIN_BTN_SCALE -> maxVisual
    const progress = (currentMult - MIN_MULT) / (MAX_MULT - MIN_MULT);
    const clampedProgress = Math.max(0, Math.min(1, progress));
    
    const newScale = MIN_BTN_SCALE + clampedProgress * (maxVisual - MIN_BTN_SCALE);
    setButtonScale(newScale);
    
    // Initial limit check
    if (currentMult <= MIN_MULT + 0.1) setLimitReached('min');
    else if (currentMult >= MAX_MULT - 0.1) setLimitReached('max');
    else setLimitReached(null);
  }, [isMobileView, initialMult]);

  // Helper for Gaussian distribution (Box-Muller transform)
  const gaussianRandom = useCallback(() => {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); 
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
  }, []);

  const addFallingText = useCallback((fontIdx: number) => {
    const engine = engineRef.current;
    const scene = sceneRef.current;
    if (!engine || !scene) return;

    // Use English fonts for letters from the Falling List (Superset)
    const currentEnglishFont = FALLING_FONTS_EN[fontIdx % FALLING_FONTS_EN.length];
    
    // Combine both CN and TW fonts for random Chinese characters to maintain variety
    const ALL_CHINESE_FONTS = [...FONTS_CN, ...FONTS_TW];

    const containerWidth = scene.clientWidth;
    const containerHeight = scene.clientHeight;

    generationRef.current += 1;
    const dropsInCycle = dropsInCurrentCycleRef.current; 
    dropsInCurrentCycleRef.current += 1;

    const gen = generationRef.current;
    const usedKeys = usedChineseKeysInCycleRef.current;
    const lastGen = charLastGenRef.current;

    const PROBABILITY = 0.075; 

    const canUseKey = (key: string) => {
        const last = lastGen[key];
        if (last !== undefined && (gen - last) <= 4) return false;
        return true;
    };

    let useYe = false;
    if (!usedKeys.has('YE') && canUseKey('YE')) {
        if (Math.random() < PROBABILITY) useYe = true;
    }
    const yeChar = Math.random() < 0.5 ? '叶' : '葉'; 

    let useZhi = false;
    if (!usedKeys.has('ZHI') && canUseKey('ZHI')) {
        if (Math.random() < PROBABILITY) useZhi = true;
    }

    let useGang = false;
    if (!usedKeys.has('GANG') && canUseKey('GANG')) {
        if (Math.random() < PROBABILITY) useGang = true;
    }

    const hasChinese = useYe || useZhi || useGang;
    let parts: string[] = [];

    const yePart = useYe ? [yeChar] : ['Y','E'];
    const zhiPart = useZhi ? ['智'] : ['Z','H','I'];
    const gangPart = useGang ? ['港'] : ['G','A','N','G'];

    if (hasChinese) {
        parts = [...yePart, ...zhiPart, ...gangPart];
        if (useYe) { usedKeys.add('YE'); lastGen['YE'] = gen; }
        if (useZhi) { usedKeys.add('ZHI'); lastGen['ZHI'] = gen; }
        if (useGang) { usedKeys.add('GANG'); lastGen['GANG'] = gen; }
    } else {
        parts = ['Z','H','I', 'G','A','N','G', 'Y','E'];
    }

    const letterBodies: Matter.Body[] = [];
    
    // --- Exponential Size Calculation ---
    // User Input (Linear): sizeMultiplierRef.current (0.2 to 5.0)
    // We want fine control at low end, fast growth at high end.
    const linearMult = sizeMultiplierRef.current;
    
    // 1. Normalize linear input to 0 - 1 range
    const t = (linearMult - MIN_MULT) / (MAX_MULT - MIN_MULT);
    
    // 2. Apply Power Curve (e.g. t^2.5) to make start slow and end fast
    const curvedT = Math.pow(t, 2.5);
    
    // 3. Map back to Output Multiplier range
    const curvedMult = MIN_MULT + (curvedT * (MAX_MULT - MIN_MULT));

    const baseFontSize = Math.min(containerWidth, containerHeight) * 0.15 * curvedMult;
    
    parts.forEach((letter, index) => {
      const isChineseChar = /[\u4e00-\u9fa5]/.test(letter);
      let scale: number;

      if (isChineseChar) {
        if (hasLargeChineseRef.current) {
            scale = 1.0 + Math.random(); 
        } else {
            const lambda = 0.7;
            let u = Math.random();
            while (u === 0) u = Math.random(); 
            const addedScale = -Math.log(u) / lambda;
            let rawScale = 1.0 + addedScale;
            rawScale = Math.min(5.0, rawScale);
            scale = rawScale;
        }
        if (scale > 3.0) {
            hasLargeChineseRef.current = true;
        }
      } else {
        const p = Math.random();
        if (p < 0.90) {
            let center = 0.8; 
            if (dropsInCycle >= 1) center = 0.4; 
            const variance = 0.25;
            const rawScale = center + (gaussianRandom() * variance);
            scale = Math.min(1.0, Math.max(0.2, rawScale));
        } else {
            const lambda = 3.22;
            let u = Math.random();
            while (u === 0) u = Math.random(); 
            const addedScale = -Math.log(u) / lambda;
            scale = 1.0 + addedScale;
            scale = Math.min(3.0, scale);
        }
      }

      const effectiveBaseSize = isChineseChar ? (baseFontSize * 0.5) : baseFontSize;
      const fontSize = effectiveBaseSize * scale;

      let selectedFont = currentEnglishFont;
      if (isChineseChar) {
        const randIdx = Math.floor(Math.random() * ALL_CHINESE_FONTS.length);
        selectedFont = ALL_CHINESE_FONTS[randIdx];
      }

      let widthMultiplier = 0.5; 
      if (isChineseChar) widthMultiplier = 0.9; 
      else if (selectedFont.name.includes('Anton')) widthMultiplier = 0.45; 
      else if (selectedFont.name.includes('Inter')) widthMultiplier = 0.55; 
      else if (selectedFont.name.includes('Jersey')) widthMultiplier = 0.5;
      
      const boxWidth = fontSize * widthMultiplier; 
      const boxHeight = fontSize * (isChineseChar ? 0.9 : 0.70); 

      const x = (containerWidth / (parts.length + 2)) * (index + 1);
      const y = -100 - (index * 60) - (Math.random() * 50); 
      
      const body = Matter.Bodies.rectangle(x, y, boxWidth, boxHeight, {
        restitution: 0.05, 
        friction: 0.9,     
        frictionAir: 0.02 - (scale * 0.005), 
        density: 0.01,     
        chamfer: { radius: 2 * scale }, 
        angle: (Math.random() - 0.5) * 0.2, 
        label: letter,
        render: {
          fillStyle: '#000000', 
          opacity: 0 
        },
        plugin: {
          fontFamily: selectedFont.value,
          fontWeight: selectedFont.weight,
          fontSize: fontSize,
          fontName: selectedFont.name,
          interactionTime: 0 
        }
      });
      letterBodies.push(body);
    });

    Matter.Composite.add(engine.world, letterBodies);
  }, [gaussianRandom]);

  useEffect(() => {
    if (!sceneRef.current) return;

    const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      MouseConstraint = Matter.MouseConstraint,
      Mouse = Matter.Mouse,
      Events = Matter.Events,
      World = Matter.World;

    const engine = Engine.create();
    engineRef.current = engine;
    
    const containerWidth = sceneRef.current.clientWidth;
    const containerHeight = sceneRef.current.clientHeight;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: containerWidth,
        height: containerHeight,
        background: 'transparent',
        wireframes: false, 
        pixelRatio: window.devicePixelRatio,
      }
    });
    renderRef.current = render;

    const wallOptions = { 
        isStatic: true, 
        render: { fillStyle: 'transparent' },
        friction: 1, 
        restitution: 0 
    };
    
    const groundHeight = 100;
    const groundY = containerHeight + (groundHeight / 2);

    const ground = Bodies.rectangle(containerWidth / 2, groundY, containerWidth, groundHeight, wallOptions);
    groundRef.current = ground; 

    const leftWall = Bodies.rectangle(-50, containerHeight / 2, 100, containerHeight * 2, wallOptions);
    const rightWall = Bodies.rectangle(containerWidth + 50, containerHeight / 2, 100, containerHeight * 2, wallOptions);
    rightWallRef.current = rightWall; 
    
    Composite.add(engine.world, [ground, leftWall, rightWall]);

    addFallingText(0);

    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false
        }
      }
    });

    Composite.add(engine.world, mouseConstraint);
    render.mouse = mouse;

    const FADE_DURATION = 10000; 

    Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;
        const now = Date.now();
        
        for (let i = 0; i < pairs.length; i++) {
            const bodyA = pairs[i].bodyA;
            const bodyB = pairs[i].bodyB;

            const handleCollision = (body: Matter.Body) => {
                if (body.label && /[\u4e00-\u9fa5]/.test(body.label)) {
                    body.plugin.interactionTime = now;
                }
            };

            handleCollision(bodyA);
            handleCollision(bodyB);
        }
    });

    Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      const bodies = Composite.allBodies(engine.world);
      const currentTime = Date.now();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      bodies.forEach((body) => {
        if (!body.isStatic && body.label && body.label.length >= 1) {
          const fSize = body.plugin.fontSize || 20;
          const fFamily = body.plugin.fontFamily || 'Arial';
          const fWeight = body.plugin.fontWeight || 'normal';
          const fName = body.plugin.fontName || 'Sans';

          ctx.font = `${fWeight} ${fSize}px ${fFamily}`;
          
          if (mouseConstraint.body === body) {
            body.plugin.interactionTime = currentTime;
          }

          const lastInteraction = body.plugin.interactionTime || 0;
          const timeSinceInteraction = currentTime - lastInteraction;

          if (timeSinceInteraction < FADE_DURATION) {
            const linearProgress = timeSinceInteraction / FADE_DURATION;
            const curvedProgress = Math.pow(linearProgress, 4); 

            const r = Math.round(242 * (1 - curvedProgress));
            const g = Math.round(44 * (1 - curvedProgress));
            const b = Math.round(44 * (1 - curvedProgress));
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          } else {
            ctx.fillStyle = '#000000';
          }
          
          ctx.save();
          ctx.translate(body.position.x, body.position.y);
          ctx.rotate(body.angle);
          
          let yOffset = fSize * 0.05; 
          if (/[\u4e00-\u9fa5]/.test(body.label)) {
             yOffset = 0;
          }
          else if (fName.includes('Serif') || fName.includes('Classic')) {
             yOffset = 0;
          }
          
          ctx.fillText(body.label, 0, yOffset); 
          ctx.restore();
        }
      });
    });

    Render.run(render);
    
    const runner = Runner.create();
    runnerRef.current = runner;
    Runner.run(runner, engine);

    const handleResize = () => {
      if (!sceneRef.current || !renderRef.current || !engineRef.current) return;
      const newWidth = sceneRef.current.clientWidth;
      const newHeight = sceneRef.current.clientHeight;
      
      renderRef.current.canvas.width = newWidth;
      renderRef.current.canvas.height = newHeight;
      
      if (groundRef.current) {
        Matter.Body.setPosition(groundRef.current, { 
            x: newWidth / 2, 
            y: newHeight + 50 
        });
      }
      if (rightWallRef.current) {
        Matter.Body.setPosition(rightWallRef.current, { x: newWidth + 50, y: newHeight / 2 });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      Render.stop(render);
      Runner.stop(runner);
      if(render.canvas) render.canvas.remove();
      World.clear(engine.world, false);
      Engine.clear(engine);
    };
  }, [addFallingText]);

  const toggleFont = () => {
    if (isFlushing) return; 

    // Internal toggle logic for falling letters only, using the larger list
    const nextIndex = (fontIndex + 1) % FALLING_FONTS_EN.length;
    setFontIndex(nextIndex);

    const engine = engineRef.current;
    if (!engine) return;

    const allBodies = Matter.Composite.allBodies(engine.world);
    const textBodies = allBodies.filter(b => !b.isStatic && b.label && b.label.length >= 1);
    
    const canvasHeight = renderRef.current?.canvas.height || window.innerHeight;
    
    // On mobile, allow the text to pile up higher (closer to the top edge) before clearing
    // 0.05 means clear when pile reaches top 5% of screen.
    // 0.15 means clear when pile reaches top 15% of screen.
    const topThreshold = canvasHeight * (isMobileView ? 0.05 : 0.15);

    const isFull = textBodies.some(b => {
      return b.bounds.min.y < topThreshold && b.position.y > 0 && b.speed < 1.0;
    });

    if (isFull) {
      setIsFlushing(true);
      
      usedChineseKeysInCycleRef.current.clear(); 
      dropsInCurrentCycleRef.current = 0;
      hasLargeChineseRef.current = false;

      const ground = groundRef.current;

      if (ground) {
        Matter.Composite.remove(engine.world, ground);
        
        const startTime = Date.now();
        const MAX_FLUSH_DURATION = 5000; 

        const checkBodiesCleared = () => {
          if (!engineRef.current) return;

          const currentBodies = Matter.Composite.allBodies(engineRef.current.world);
          const dynamicBodies = currentBodies.filter(b => !b.isStatic);
          const currentHeight = renderRef.current?.canvas.height || window.innerHeight;

          const allCleared = dynamicBodies.every(b => b.position.y > currentHeight + 200);
          const timedOut = Date.now() - startTime > MAX_FLUSH_DURATION;

          if (allCleared || timedOut) {
             // Re-fetch bodies to ensure we remove everything even if some fell late
             const bodiesToRemove = Matter.Composite.allBodies(engineRef.current.world).filter(b => !b.isStatic);
             Matter.Composite.remove(engineRef.current.world, bodiesToRemove);
             
             Matter.Composite.add(engineRef.current.world, ground);
             
             addFallingText(nextIndex);
             setIsFlushing(false);
          } else {
             requestAnimationFrame(checkBodiesCleared);
          }
        };

        requestAnimationFrame(checkBodiesCleared);
      }
    } else {
      addFallingText(nextIndex);
    }
  };

  // --- Scale Interaction Logic (Joystick Mode) ---
  const applyScale = (newMult: number) => {
    if (newMult <= MIN_MULT || newMult >= MAX_MULT) return; 

    // Update limit state for UI
    if (newMult <= MIN_MULT + 0.1) setLimitReached('min');
    else if (newMult >= MAX_MULT - 0.1) setLimitReached('max');
    else setLimitReached(null);

    sizeMultiplierRef.current = newMult;
    
    // VISUAL FEEDBACK with Linear Mapping (Keeps button feeling uniform)
    // Ensure button scale is 1:1 mapped to slider range (linear)
    const maxVisual = isMobileView ? 1.1 : 1.5;
    const progress = (newMult - MIN_MULT) / (MAX_MULT - MIN_MULT);
    const clampedProgress = Math.max(0, Math.min(1, progress));
    
    const newBtnScale = MIN_BTN_SCALE + clampedProgress * (maxVisual - MIN_BTN_SCALE);
    setButtonScale(newBtnScale);
  };

  const startContinuousUpdate = useCallback(() => {
    const loop = () => {
      if (!isDraggingRef.current) return;

      const { x, y } = dragVectorRef.current;
      const MAX_VISUAL_DIST = 40; // Max amplitude
      const SPEED_FACTOR = 0.08; 

      let change = 0;

      if (isMobileView) {
        // Mobile Joystick Logic
        const xRatio = x / MAX_VISUAL_DIST;
        const yRatio = y / MAX_VISUAL_DIST;
        
        if (x > 0) {
           change = xRatio * SPEED_FACTOR;
        } else if (y > 0) {
           change = -yRatio * SPEED_FACTOR;
        }
      } else {
        // Desktop: Vertical Slider
        const ratio = Math.max(-1, Math.min(1, y / MAX_VISUAL_DIST));
        if (Math.abs(ratio) > 0.1) {
            change = ratio * SPEED_FACTOR;
        }
      }

      if (change !== 0) {
          const current = sizeMultiplierRef.current;
          const next = Math.max(MIN_MULT, Math.min(MAX_MULT, current + change));
          applyScale(next);
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };
    
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(loop);
  }, [isMobileView]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    (e.target as Element).setPointerCapture(e.pointerId);
    
    setIsDragging(true);
    isDraggingRef.current = true;
    isMovedRef.current = false;
    setAxisLock(null); 
    
    pointerStartYRef.current = e.clientY;
    pointerStartXRef.current = e.clientX;
    
    startContinuousUpdate();
  };

  const forceRelease = (e: React.PointerEvent) => {
     (e.target as Element).releasePointerCapture(e.pointerId);
    isDraggingRef.current = false;
    setIsDragging(false);
    setIsAdjusting(false);
    setAxisLock(null);
    setDragOffset({ x: 0, y: 0 });
    dragVectorRef.current = { x: 0, y: 0 };
    cancelAnimationFrame(animationFrameRef.current);
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - pointerStartXRef.current;
    const deltaY = e.clientY - pointerStartYRef.current;

    // Auto-release if dragged too far
    const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (dragDistance > 300) {
        forceRelease(e);
        return;
    }

    if (!isMovedRef.current && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
        isMovedRef.current = true;
        setIsAdjusting(true);
    }

    const MAX_VISUAL_DIST = 40;
    let visualX = 0;
    let visualY = 0;

    if (isMobileView) {
        let currentLock = axisLock;
        if (!currentLock && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                currentLock = 'x';
                setAxisLock('x');
            } else {
                currentLock = 'y';
                setAxisLock('y');
            }
        }

        if (currentLock === 'x') {
            visualX = Math.max(0, Math.min(MAX_VISUAL_DIST, deltaX));
            visualY = 0;
        } else if (currentLock === 'y') {
            visualX = 0;
            visualY = Math.max(0, Math.min(MAX_VISUAL_DIST, deltaY));
        } else {
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                visualX = Math.max(0, Math.min(MAX_VISUAL_DIST, deltaX));
                visualY = 0;
            } else {
                visualX = 0;
                visualY = Math.max(0, Math.min(MAX_VISUAL_DIST, deltaY));
            }
        }
    } else {
        visualY = Math.max(-MAX_VISUAL_DIST, Math.min(MAX_VISUAL_DIST, deltaY));
    }
    
    setDragOffset({ x: visualX, y: visualY });
    dragVectorRef.current = { x: visualX, y: visualY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture(e.pointerId);

    isDraggingRef.current = false;
    setIsDragging(false);
    setIsAdjusting(false);
    setAxisLock(null);
    setDragOffset({ x: 0, y: 0 });
    dragVectorRef.current = { x: 0, y: 0 };
    cancelAnimationFrame(animationFrameRef.current);

    if (!isMovedRef.current) {
        toggleFont();
    }
  };

  // --- Dynamic Arrow Positioning ---
  const getArrowStyle = (direction: 'up' | 'down' | 'left' | 'right') => {
    const offset = (23 * buttonScale) + 12; 
    
    const style: React.CSSProperties = {
        position: 'absolute',
        transition: 'transform 0.1s linear, opacity 0.2s ease',
        pointerEvents: 'none',
        zIndex: 20, 
        left: '50%',
        top: '50%', 
        opacity: 0,
    };
    
    let visible = false;

    if (isDragging) {
        if (isMobileView) {
            if (direction === 'right') {
                visible = (!axisLock || axisLock === 'x') && limitReached !== 'max';
            } else if (direction === 'down') {
                visible = (!axisLock || axisLock === 'y') && limitReached !== 'min';
            }
        } else {
            if (direction === 'up') visible = dragOffset.y <= 0 && limitReached !== 'min'; 
            if (direction === 'down') visible = dragOffset.y >= 0 && limitReached !== 'max'; 
        }
    }

    style.opacity = visible ? 1 : 0;

    if (direction === 'right') {
        style.transform = `translate(-50%, -50%) translate(${offset}px, 0)`;
    } else if (direction === 'down') {
        style.transform = `translate(-50%, -50%) translate(0, ${offset}px)`;
    } else if (direction === 'up') {
        style.transform = `translate(-50%, -50%) translate(0, -${offset}px)`;
    }

    return style;
  };

  // Styles based on language
  const isChinese = lang === 'cn' || lang === 'tw';
  const textOpacity = isChinese ? 'opacity-20' : 'opacity-100';
  
  // Font Size Logic:
  // - Chinese Mobile: text-base (Same as body)
  // - English Mobile: text-xs (Smaller, Doto style)
  // - Desktop (All): text-base (Same as body)
  const textSize = isChinese ? 'text-base' : 'text-xs md:text-base';

  // If English, use Doto. If Chinese, inherit the global font (from App.tsx selection) or fallback to sans-serif
  const textFont = isChinese ? {} : { fontFamily: '"Doto", sans-serif' };

  return (
    <div className="w-full h-full relative group touch-none bg-white">
      {/* Centered Static Bio Display */}
      <div className="absolute inset-0 z-0 pointer-events-none flex flex-col items-center justify-start md:justify-center pt-4 md:pt-0 px-8 animate-in fade-in duration-[3000ms]">
         <div className="opacity-100 font-medium flex flex-col items-center max-w-2xl md:-translate-y-16 transition-opacity duration-1000">
            {BIO_TEXT_DATA.map((paragraph, index) => (
                <p 
                    key={index}
                    style={textFont} 
                    className={`text-black text-center mb-4 leading-relaxed whitespace-pre-wrap tracking-wider ${textOpacity} ${textSize}`}
                >
                    {paragraph[lang]}
                </p>
            ))}
         </div>
      </div>
      
       <div 
        ref={sceneRef} 
        className="absolute inset-0 z-10 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden touch-none"
        aria-label="Interactive falling letters spelling ZHIGANGYE"
      />
      
      {/* 
         Font Adjustment Joystick - Visible for all languages
         Ensure Z-Index is high enough and no conditions hide it based on lang
      */}
      <div 
        className={`
          pointer-events-none z-[60] flex items-center justify-center
          ${isMobileView 
            ? 'fixed top-0 left-0 w-20 h-20' 
            : 'absolute top-1/2 right-4 md:right-8 -translate-y-1/2 flex-col'}
        `}
      >
        <div 
           style={{ 
             transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
             transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
           }}
           className={`relative flex items-center justify-center ${isMobileView ? '' : 'flex-col'}`}
        >
            {!isMobileView && (
                <div style={getArrowStyle('up')} className="text-[#F22C2C]">
                    <ChevronUp size={20} strokeWidth={1.25} />
                </div>
            )}

            <button 
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onContextMenu={(e) => e.preventDefault()}
                disabled={isFlushing}
                style={{ 
                    transform: `scale(${buttonScale})`,
                    transition: 'transform 0.1s linear', 
                    touchAction: 'none'
                }}
                className={`
                    pointer-events-auto
                    w-12 h-12 rounded-full shadow-sm
                    flex items-center justify-center relative z-10
                    ${isAdjusting ? 'bg-white text-[#F22C2C] border-2 border-[#F22C2C]' : 'bg-white text-black border border-black hover:text-[#F22C2C]'}
                    ${isFlushing ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title={isMobileView ? "Tap to Change Font, Drag Right (Larger) / Down (Smaller)" : "Tap to Change Font, Drag Up/Down to Resize"}
            >
            <span className="text-xl font-bold leading-none">T</span>
            </button>

            {!isMobileView && (
                <div style={getArrowStyle('down')} className="text-[#F22C2C]">
                    <ChevronDown size={20} strokeWidth={1.25} />
                </div>
            )}

            {isMobileView && (
                <div style={getArrowStyle('right')} className="text-[#F22C2C]">
                    <ChevronRight size={20} strokeWidth={1.25} />
                </div>
            )}
             {isMobileView && (
                <div style={getArrowStyle('down')} className="text-[#F22C2C]">
                    <ChevronDown size={20} strokeWidth={1.25} />
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default PhysicsHero;
