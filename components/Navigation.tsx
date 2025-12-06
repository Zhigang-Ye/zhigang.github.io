
import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ViewState, Lang } from '../types';
import { NAV_ITEMS, TRANSLATIONS } from '../constants';

interface NavigationProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  lang: Lang;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, onChangeView, lang }) => {
  const [isOpen, setIsOpen] = useState(false);
  const MOBILE_SIDE_PADDING = 12;

  const handleNavClick = (view: ViewState) => {
    onChangeView(view);
    setIsOpen(false);
  };

  // Uniform font class for all languages to ensure titles are normal weight
  const fontClass = 'font-normal';

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white h-20 md:h-24 select-none">
      {/* Desktop Navigation */}
      <div className="hidden md:grid grid-cols-4 h-full w-full">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => handleNavClick(item.view)}
            className={`h-full flex items-center justify-center text-xl ${fontClass} transition-colors duration-200 text-black hover:text-[#F22C2C]`}
          >
            {TRANSLATIONS[item.view][lang]}
          </button>
        ))}
      </div>

      {/* Mobile Navigation Header */}
      <div 
        className="md:hidden flex items-center justify-end h-full w-full"
        style={{ paddingLeft: MOBILE_SIDE_PADDING, paddingRight: MOBILE_SIDE_PADDING }}
      >
        {/* Strictly no title on the left, only menu button on the right */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 focus:outline-none text-black hover:text-[#F22C2C]"
        >
          {isOpen ? <X size={24} strokeWidth={1} /> : <Menu size={24} strokeWidth={1} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden fixed top-20 left-0 right-0 bottom-0 bg-white flex flex-col border-t border-gray-100 z-40 overflow-hidden">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavClick(item.view)}
              className={`w-full py-8 text-center text-xl ${fontClass} text-black hover:text-[#F22C2C]`}
            >
              {TRANSLATIONS[item.view][lang]}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navigation;
