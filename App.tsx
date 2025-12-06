
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navigation from './components/Navigation';
import PhysicsHero from './components/PhysicsHero';
import Portfolio from './components/Portfolio';
import Biography from './components/Biography';
import Text from './components/Text';
import FontSelector from './components/FontSelector';
import { ViewState, Lang } from './types';
import { TRANSLATIONS, FONTS_EN, FONTS_CN, FONTS_TW } from './constants';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('PORTFOLIO');
  const [lang, setLang] = useState<Lang>('en');

  // Font State - Separate indices for each language
  // Initialize EN font to 0 (Inter) as default per request
  const [fontIndexEn, setFontIndexEn] = useState(0); 
  const [fontIndexCn, setFontIndexCn] = useState(0);
  const [fontIndexTw, setFontIndexTw] = useState(0);

  // Floating UI State
  const [isScrolling, setIsScrolling] = useState(false);
  const [isTextBottomNavVisible, setIsTextBottomNavVisible] = useState(false);
  
  // Mobile Check
  const [isMobileView, setIsMobileView] = useState(false);

  // Font Selector Modal State
  const [showFontSelector, setShowFontSelector] = useState(false);

  // Viewport unit fallback for older webviews (e.g., desktop WeChat)
  const supportsDvh = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('height', '100dvh');
  const viewportUnit = supportsDvh ? 'dvh' : 'vh';
  const viewportHeight = `100${viewportUnit}`;
  const contentMaxHeight = `calc(120${viewportUnit} - ${isMobileView ? 80 : 96}px)`;
  
  // Refs for scroll and long-press logic
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  // Check mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleLang = () => {
    setLang(prev => {
      if (prev === 'en') return 'cn';
      if (prev === 'cn') return 'tw';
      return 'en';
    });
  };

  const toggleFont = () => {
    if (lang === 'en') {
      setFontIndexEn(prev => {
        // Cycle through all available fonts
        return (prev + 1) % FONTS_EN.length;
      });
    } else if (lang === 'cn') {
      setFontIndexCn(prev => (prev + 1) % FONTS_CN.length);
    } else if (lang === 'tw') {
      setFontIndexTw(prev => (prev + 1) % FONTS_TW.length);
    }
  };

  const handleFontButtonDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      // e.preventDefault(); 
    }
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setShowFontSelector(true);
    }, 500); 
  };

  const handleFontButtonUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleFontButtonClick = () => {
    if (!isLongPressRef.current) {
      toggleFont();
    }
    isLongPressRef.current = false;
  };

  useEffect(() => {
    setIsTextBottomNavVisible(false);
  }, [currentView]);

  // Apply Font Strategy
  useEffect(() => {
    let selectedFont = '';
    
    if (lang === 'en') {
      selectedFont = FONTS_EN[fontIndexEn].value;
    } else if (lang === 'cn') {
      selectedFont = FONTS_CN[fontIndexCn].value;
    } else if (lang === 'tw') {
      selectedFont = FONTS_TW[fontIndexTw].value;
    }
    
    // Set the global body font to the selected font
    document.body.style.fontFamily = selectedFont;
    
  }, [lang, fontIndexEn, fontIndexCn, fontIndexTw]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 300);
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case 'ABOUT':
        return <PhysicsHero lang={lang} />;
      case 'PORTFOLIO':
        return <Portfolio lang={lang} toggleLang={toggleLang} />;
      case 'TEXT':
        return (
          <Text 
            lang={lang} 
            isScrolling={isScrolling} 
            setBottomNavVisible={setIsTextBottomNavVisible} 
          />
        );
      case 'BIOGRAPHY':
        return <Biography lang={lang} />;
      default:
        return <PhysicsHero lang={lang} />;
    }
  };

  const showControls = true;
  
  // Logic to hide buttons:
  // 1. Scrolling
  // 2. Text Bottom Nav Visible
  // 3. Mobile View AND Portfolio Page (List view)
  const isMobilePortfolio = isMobileView && currentView === 'PORTFOLIO';
  
  const showFloatingButtons = showControls && !isScrolling && !isTextBottomNavVisible && !isMobilePortfolio;

  return (
    <div 
      className="w-full flex flex-col text-black bg-white overflow-hidden selection:bg-black selection:text-white relative"
      style={{ height: viewportHeight, minHeight: viewportHeight }}
    >
      <Navigation currentView={currentView} onChangeView={setCurrentView} lang={lang} />
      
      <main 
        className="flex-grow relative pt-20 md:pt-24 h-full overflow-hidden"
        style={{ maxHeight: contentMaxHeight }}
      >
        <div 
          className={`w-full h-full ${currentView === 'ABOUT' ? 'overflow-hidden' : 'overflow-y-auto'}`}
          style={{ maxHeight: contentMaxHeight }}
          onScroll={currentView !== 'ABOUT' ? handleScroll : undefined}
        >
          {renderContent()}
        </div>
      </main>

      {/* Floating Action Buttons */}
      {showControls && (
        <div 
          className={`fixed bottom-10 right-6 md:right-12 z-50 flex flex-col gap-3 transition-opacity duration-700 ease-in-out ${showFloatingButtons ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
          {/* Font Toggle Button - Hide on ABOUT because it has its own joystick and English text is fixed */}
          {lang === 'en' && currentView !== 'ABOUT' && (
            <button 
              onPointerDown={handleFontButtonDown}
              onPointerUp={handleFontButtonUp}
              onPointerLeave={handleFontButtonUp}
              onClick={handleFontButtonClick}
              onContextMenu={(e) => e.preventDefault()}
              className="flex items-center justify-center w-9 h-9 bg-white/90 backdrop-blur border border-black rounded-full hover:bg-black hover:text-white transition-all duration-200 shadow-sm group select-none touch-none"
              title="Click to toggle, Long press to select"
            >
              <span className="text-lg font-bold leading-none">T</span>
            </button>
          )}

          {/* Language Toggle Button */}
          <button 
            onClick={toggleLang}
            className="flex items-center justify-center w-9 h-9 bg-white/90 backdrop-blur border border-black rounded-full hover:bg-black hover:text-white transition-all duration-200 text-[10px] shadow-sm select-none"
          >
            {lang === 'en' ? TRANSLATIONS.LANG_LABEL.cn : lang === 'cn' ? TRANSLATIONS.LANG_LABEL.tw : TRANSLATIONS.LANG_LABEL.en}
          </button>
        </div>
      )}

      {/* Full Screen Font Selector Modal */}
      {showFontSelector && (
        <FontSelector 
          onClose={() => setShowFontSelector(false)}
          currentLang={lang}
          indices={{
            en: fontIndexEn,
            cn: fontIndexCn,
            tw: fontIndexTw
          }}
          setIndices={{
            setEn: setFontIndexEn,
            setCn: setFontIndexCn,
            setTw: setFontIndexTw
          }}
        />
      )}
    </div>
  );
};

export default App;
