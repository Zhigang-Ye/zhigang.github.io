
import React from 'react';
import { X } from 'lucide-react';
import { FONTS_EN, FONTS_CN, FONTS_TW } from '../constants';

interface FontSelectorProps {
  onClose: () => void;
  indices: {
    en: number;
    cn: number;
    tw: number;
  };
  setIndices: {
    setEn: (idx: number) => void;
    setCn: (idx: number) => void;
    setTw: (idx: number) => void;
  };
  currentLang: 'en' | 'cn' | 'tw';
}

const FontSelector: React.FC<FontSelectorProps> = ({ onClose, indices, setIndices, currentLang }) => {
  
  const getCurrentFontName = () => {
    if (currentLang === 'en') return FONTS_EN[indices.en]?.name;
    if (currentLang === 'cn') return FONTS_CN[indices.cn]?.name;
    if (currentLang === 'tw') return FONTS_TW[indices.tw]?.name;
    return '';
  };

  const renderFontList = () => {
    if (currentLang === 'en') {
      return (
        <div className="flex flex-col space-y-1">
          {FONTS_EN.map((font, idx) => (
            <React.Fragment key={font.name}>
               {/* Separator after the first 3 fonts (Index 2) */}
               {idx === 3 && (
                 <div className="w-full h-px bg-gray-100 my-3" />
               )}
                <button
                onClick={() => setIndices.setEn(idx)}
                className={`text-left text-sm py-1 transition-colors duration-200 hover:text-[#F22C2C] ${
                    indices.en === idx ? 'text-[#F22C2C]' : 'text-black'
                }`}
                style={{ 
                    fontFamily: font.value, 
                    fontWeight: font.weight 
                }}
                >
                A short test for all Font
                </button>
            </React.Fragment>
          ))}
        </div>
      );
    }

    if (currentLang === 'cn') {
      return (
        <div className="flex flex-col space-y-1">
          {FONTS_CN.map((font, idx) => (
            <button
              key={font.name}
              onClick={() => setIndices.setCn(idx)}
              className={`text-left text-sm py-1 transition-colors duration-200 hover:text-[#F22C2C] ${
                indices.cn === idx ? 'text-[#F22C2C]' : 'text-black'
              }`}
              style={{ 
                fontFamily: font.value,
                fontWeight: font.weight
              }}
            >
              用于测试字体的短句
            </button>
          ))}
        </div>
      );
    }

    if (currentLang === 'tw') {
      return (
        <div className="flex flex-col space-y-1">
          {FONTS_TW.map((font, idx) => (
            <button
              key={font.name}
              onClick={() => setIndices.setTw(idx)}
              className={`text-left text-sm py-1 transition-colors duration-200 hover:text-[#F22C2C] ${
                indices.tw === idx ? 'text-[#F22C2C]' : 'text-black'
              }`}
              style={{ 
                fontFamily: font.value,
                fontWeight: font.weight
              }}
            >
              用于测试字体的短句
            </button>
          ))}
        </div>
      );
    }
  };

  const secondaryStyle = { fontFamily: '"Doto", sans-serif' };
  const secondaryClass = "text-[#F22C2C]";

  return (
    <div className="fixed inset-0 z-[60] flex justify-end overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/10 backdrop-blur-[1px] animate-in fade-in duration-300" 
        onClick={onClose}
      />

      {/* Sidebar Panel */}
      <div className="relative w-full max-w-sm h-full bg-white shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col border-l border-gray-100">
        
        {/* Top Bar */}
        <div className="flex-none flex justify-between items-start px-6 pt-8 pb-4 bg-white z-10">
          <div className="flex flex-col">
            <span 
              style={secondaryStyle}
              className={`text-[10px] uppercase tracking-widest mb-1 ${secondaryClass}`}
            >
              Current Font
            </span>
            <h1 className="text-base font-normal text-black leading-tight pr-4">{getCurrentFontName()}</h1>
          </div>
          <button 
            onClick={onClose}
            className="p-1 -mr-2 text-black hover:text-[#F22C2C] transition-colors"
          >
            <X size={24} strokeWidth={1} />
          </button>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gray-50 mb-2"></div>

        {/* Font List */}
        <div className="flex-1 overflow-y-auto px-6 py-2 pb-12">
          {renderFontList()}
        </div>
      </div>
    </div>
  );
};

export default FontSelector;
