

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { TextEntry, MultiLangString, TextSection, Lang } from '../types';
import { TRANSLATIONS, Quote } from '../constants';

interface TextProps {
  lang: Lang;
  isScrolling: boolean;
  setBottomNavVisible: (visible: boolean) => void;
}

interface Manifest {
  text: {
    shortStories: string[];
    memoNovels: string[];
    writing: string[];
    diary: string[];
  };
}

const Text: React.FC<TextProps> = ({ lang, isScrolling, setBottomNavVisible }) => {
  const [sections, setSections] = useState<TextSection[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<TextEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [randomQuote, setRandomQuote] = useState<Quote | null>(null);
  
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({});
  
  const [titleWidths, setTitleWidths] = useState<Record<number, number>>({});
  const titleRefs = useRef<(HTMLHeadingElement | null)[]>([]);

  const bottomNavRef = useRef<HTMLDivElement>(null);

  // Fetch Quotes on Mount
  useEffect(() => {
    const fetchQuotes = async () => {
        try {
            const res = await fetch('./quotes.json');
            const data: Quote[] = await res.json();
            setAllQuotes(data);
            if (data.length > 0) {
                const randomIndex = Math.floor(Math.random() * data.length);
                setRandomQuote(data[randomIndex]);
            }
        } catch (e) {
            console.warn("Failed to load quotes for Text page", e);
        }
    };
    fetchQuotes();
  }, []); // Empty dependency array ensures it runs once when component mounts (entering page)

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const manifestRes = await fetch('./manifest.json');
        const manifest: Manifest = await manifestRes.json();

        const shortStories = await Promise.all(
          (manifest.text.shortStories || []).map(url => fetch(url).then(res => res.json()))
        );

        const memoNovels = await Promise.all(
          (manifest.text.memoNovels || []).map(url => fetch(url).then(res => res.json()))
        );

        const articles = await Promise.all(
          (manifest.text.writing || []).map(url => fetch(url).then(res => res.json()))
        );

        const diaries = await Promise.all(
          (manifest.text.diary || []).map(url => fetch(url).then(res => res.json()))
        );

        const allSections: TextSection[] = [
          {
            category: { cn: "短篇", tw: "短篇", en: "Short Story" },
            items: shortStories
          },
          {
            category: { cn: "备忘录小说", tw: "備忘錄小說", en: "Memo Novel" },
            items: memoNovels
          },
          {
            category: { cn: "写作", tw: "寫作", en: "Writing" },
            items: articles
          },
          {
            category: { cn: "日记", tw: "日記", en: "Diaries" },
            items: diaries
          }
        ];

        setSections(allSections);
        setLoading(false);
      } catch (error) {
        console.error('Error loading content:', error);
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

  useEffect(() => {
    titleRefs.current = titleRefs.current.slice(0, sections.length);

    const measureWidths = () => {
      const newWidths: Record<number, number> = {};
      titleRefs.current.forEach((el, index) => {
        if (el) {
          newWidths[index] = el.getBoundingClientRect().width;
        }
      });
      setTitleWidths(newWidths);
    };

    measureWidths();
    const timer = setTimeout(measureWidths, 100);
    
    window.addEventListener('resize', measureWidths);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measureWidths);
    };
  }, [sections, lang]);

  useEffect(() => {
    const scrollContainer = document.querySelector('main > div');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'instant' });
    }
    setBottomNavVisible(false);
  }, [selectedEntry, setBottomNavVisible]);

  useEffect(() => {
    if (!selectedEntry || !bottomNavRef.current) {
        return;
    }

    const observer = new IntersectionObserver(([entry]) => {
        setBottomNavVisible(entry.isIntersecting);
    }, {
        threshold: 0.1
    });

    observer.observe(bottomNavRef.current);

    return () => observer.disconnect();
  }, [selectedEntry, setBottomNavVisible, loading]);

  useEffect(() => {
    return () => setBottomNavVisible(false);
  }, [setBottomNavVisible]);

  const toggleSection = (index: number) => {
    setOpenSections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleNextQuote = () => {
      if (allQuotes.length > 0) {
          const randomIndex = Math.floor(Math.random() * allQuotes.length);
          setRandomQuote(allQuotes[randomIndex]);
      }
  };

  const getLangString = (obj: MultiLangString | string) => {
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj['cn'] || '';
  };

  const getEmptyMessage = () => 'No content yet';

  const formatListDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return dateStr.substring(0, 7).replace(/-/g, '.');
  };

  const formatDetailDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return dateStr.replace(/-/g, '.');
  };

  const secondaryStyle = { fontFamily: '"Doto", sans-serif' };
  const secondaryClass = "text-[#F22C2C]";

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-white flex items-center justify-center">
        <div 
          style={secondaryStyle} 
          className={`animate-pulse ${secondaryClass}`}
        >
          {TRANSLATIONS.LOADING['en']}
        </div>
      </div>
    );
  }

  const allEntries = sections.flatMap(section => section.items);
  const currentIndex = selectedEntry ? allEntries.findIndex(e => e.id === selectedEntry.id) : -1;
  const prevEntry = currentIndex > 0 ? allEntries[currentIndex - 1] : null;
  const nextEntry = currentIndex !== -1 && currentIndex < allEntries.length - 1 ? allEntries[currentIndex + 1] : null;

  return (
    <div className="w-full min-h-screen bg-white px-6 md:px-12 py-10 md:py-10 text-black relative">
      
      {selectedEntry ? (
        // DETAIL VIEW
        <div className="max-w-3xl mx-auto animate-in fade-in duration-300 pb-20 pt-32 md:pt-48">
          <div 
            className={`fixed top-24 left-6 md:top-32 md:left-12 z-40 transition-opacity duration-700 ease-in-out ${!isScrolling ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
             <button 
              onClick={() => setSelectedEntry(null)}
              className="flex items-center text-sm bg-white/90 backdrop-blur px-3 py-1 border border-black hover:bg-black hover:text-white transition-colors"
            >
              <ArrowLeft size={16} className="mr-2" />
              {TRANSLATIONS.BACK[lang]}
            </button>
          </div>

          <article className="min-h-[60vh]">
            <h1 className="text-xl mb-2 font-normal pr-20">{getLangString(selectedEntry.title)}</h1>
            
            <div 
              style={secondaryStyle}
              className={`text-xs md:text-sm mb-12 flex items-center gap-2 ${secondaryClass}`}
            >
              <span>{formatDetailDate(selectedEntry.date)}</span>
              <span className="opacity-60">|</span>
              <span>
                {TRANSLATIONS.WRITTEN_BY_PREFIX['en']} Zhigang Ye {TRANSLATIONS.WRITTEN_BY_SUFFIX['en']}
              </span>
            </div>

            {/* Content Body - Inherits Global Font */}
            <div 
              className="text-base leading-7 md:leading-relaxed text-justify"
            >
              {getLangString(selectedEntry.content)
                .split('\n')
                .filter(paragraph => paragraph.trim() !== '') 
                .map((paragraph, index) => (
                  <p key={index} className="mb-6 last:mb-0">
                    {paragraph}
                  </p>
              ))}
            </div>
          </article>

          <div 
            ref={bottomNavRef}
            className="mt-24 pt-8 border-t border-gray-100 flex flex-row justify-between items-center gap-4 text-sm"
          >
            {prevEntry ? (
              <button 
                onClick={() => setSelectedEntry(prevEntry)}
                className="group flex items-center text-black hover:text-[#F22C2C] transition-colors"
              >
                <ArrowLeft size={16} className="mr-2 transition-transform group-hover:-translate-x-1 flex-shrink-0" />
                <div className="flex flex-col items-start min-w-0">
                  <span className="font-medium">{TRANSLATIONS.PREVIOUS[lang]}</span>
                  <span className="text-xs text-gray-400 mt-1 max-w-[110px] md:max-w-[200px] truncate">{getLangString(prevEntry.title)}</span>
                </div>
              </button>
            ) : (
              <div /> 
            )}

            {nextEntry && (
              <button 
                onClick={() => setSelectedEntry(nextEntry)}
                className="group flex items-center text-black hover:text-[#F22C2C] transition-colors text-right"
              >
                <div className="flex flex-col items-end mr-2 min-w-0">
                  <span className="font-medium">{TRANSLATIONS.NEXT[lang]}</span>
                  <span className="text-xs text-gray-400 mt-1 max-w-[110px] md:max-w-[200px] truncate">{getLangString(nextEntry.title)}</span>
                </div>
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1 flex-shrink-0" />
              </button>
            )}
          </div>
        </div>
      ) : (
        // LIST VIEW
        <div className="max-w-5xl mx-auto pt-4">
          
          {/* Quote Section at Top of List */}
          {randomQuote && (
              <div 
                className="mb-8 max-w-2xl animate-in fade-in duration-700 cursor-pointer select-none group"
                onClick={handleNextQuote}
                title="Click for random quote"
              >
                  <p 
                    style={secondaryStyle}
                    className="text-black text-sm md:text-base mb-2 leading-relaxed"
                  >
                      {getLangString(randomQuote.content)}
                  </p>
                  <p 
                    style={secondaryStyle}
                    className="text-[#F22C2C] text-xs md:text-sm"
                  >
                      — {randomQuote.source}
                  </p>
              </div>
          )}

          {sections.map((section, idx) => {
            const isOpen = openSections[idx];
            return (
              <div key={idx} className="mb-8">
                <div 
                  onClick={() => toggleSection(idx)}
                  className="cursor-pointer group select-none flex flex-col items-start"
                >
                  <h2 
                    ref={(el) => { titleRefs.current[idx] = el; }}
                    className="text-base font-normal inline-block group-hover:text-[#F22C2C] transition-colors duration-300"
                  >
                    {getLangString(section.category)}
                  </h2>
                  <div 
                    className="h-[1px] bg-black mt-1 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
                    style={{ 
                      width: isOpen ? '100%' : `${titleWidths[idx] || 0}px`,
                      opacity: titleWidths[idx] ? 1 : 0 
                    }}
                  />
                </div>
                
                <div 
                   className={`grid transition-[grid-template-rows] duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden">
                    <div className="flex flex-col gap-y-3 pt-6 pb-2 pl-1 animate-in fade-in duration-700 slide-in-from-top-2">
                      {section.items.length === 0 ? (
                        <div 
                          style={secondaryStyle}
                          className={`text-sm italic ${secondaryClass}`}
                        >
                          {getEmptyMessage()}
                        </div>
                      ) : (
                        section.items.map((entry) => (
                          <div 
                            key={entry.id}
                            onClick={() => setSelectedEntry(entry)}
                            className="cursor-pointer group/item flex items-baseline justify-between hover:text-[#F22C2C] transition-colors duration-200"
                          >
                            <span className="text-base">{getLangString(entry.title)}</span>
                            <span 
                              style={secondaryStyle}
                              className={`text-sm ml-4 flex-shrink-0 ${secondaryClass}`}
                            >
                              {formatListDate(entry.date)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Text;
