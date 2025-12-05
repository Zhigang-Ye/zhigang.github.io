
import { Project, Lang, MultiLangString } from './types';

export const NAV_ITEMS = [
  { label: 'ABOUT', view: 'ABOUT' as const },
  { label: 'PORTFOLIO', view: 'PORTFOLIO' as const },
  { label: 'TEXT', view: 'TEXT' as const },
  { label: 'BIOGRAPHY', view: 'BIOGRAPHY' as const },
];

export const TRANSLATIONS: Record<string, Record<Lang, string>> = {
  // Navigation
  ABOUT: { en: 'ABOUT', cn: '关于', tw: '關於' },
  PORTFOLIO: { en: 'PORTFOLIO', cn: '作品', tw: '作品' },
  TEXT: { en: 'TEXT', cn: '文字', tw: '文字' },
  BIOGRAPHY: { en: 'BIOGRAPHY', cn: '简历', tw: '簡歷' },
  
  // Biography
  SELECTED_EXHIBITIONS: { en: 'Selected Exhibitions', cn: '精选展览', tw: '精選展覽' },
  CONTACT: { en: 'Contact', cn: '联系方式', tw: '聯絡方式' },
  NAME_LABEL: { en: 'Name', cn: '姓名', tw: '姓名' },
  NAME_REQUIRED_HINT: { en: '(required)', cn: '(必填)', tw: '(必填)' },
  FIRST_NAME: { en: 'First Name', cn: '名字', tw: '名字' },
  LAST_NAME: { en: 'Last Name', cn: '姓氏', tw: '姓氏' },
  EMAIL: { en: 'Email', cn: '邮箱', tw: '信箱' },
  SUBJECT: { en: 'Subject', cn: '主题', tw: '主旨' },
  MESSAGE: { en: 'Message', cn: '留言', tw: '留言' },
  SEND: { en: 'Send', cn: '发送', tw: '發送' },
  TEL_LABEL: { en: 'Tel', cn: '电话', tw: '電話' },
  EMAIL_LABEL: { en: 'Email', cn: '邮箱', tw: '郵箱' },
  
  // Text
  BACK: { en: 'BACK', cn: '返回', tw: '返回' },
  PREVIOUS: { en: 'PREVIOUS', cn: '上一篇', tw: '上一篇' },
  NEXT: { en: 'NEXT', cn: '下一篇', tw: '下一篇' },
  LOADING: { en: 'Loading...', cn: '加载中...', tw: '加載中...' },
  WRITTEN_BY_PREFIX: { en: 'Written by', cn: '由', tw: '由' },
  WRITTEN_BY_SUFFIX: { en: '', cn: '撰写', tw: '撰寫' },
  
  // App
  LANG_LABEL: { en: 'EN', cn: '简', tw: '繁' },
};

export interface Quote {
  content: MultiLangString;
  source: string;
}

// Quotes are now loaded from public/quotes.json
export const PHILOSOPHICAL_QUOTES: Quote[] = [];

// --- Font Definitions ---

// Raw font data to be used in lists
const F_INTER = { value: '"Inter", sans-serif', weight: 400 };
const F_MONTSERRAT = { value: '"Montserrat", sans-serif', weight: 400 };
const F_JERSEY10 = { value: '"Jersey 10", sans-serif', weight: 400 };
const F_DOTO = { value: '"Doto", sans-serif', weight: 400 };
const F_TINY5 = { value: '"Tiny5", sans-serif', weight: 400 };
const F_ANTON = { value: '"Anton", sans-serif', weight: 400 };
const F_TENOR_SANS = { value: '"Tenor Sans", sans-serif', weight: 400 };
const F_CINZEL = { value: '"Cinzel", serif', weight: 400 };
const F_SPECIAL_ELITE = { value: '"Special Elite", system-ui', weight: 400 };
const F_ULTRA = { value: '"Ultra", serif', weight: 400 };
const F_CUTIVE_MONO = { value: '"Cutive Mono", monospace', weight: 400 };
const F_LEKTON = { value: '"Lekton", sans-serif', weight: 400 };
const F_VT323 = { value: '"VT323", monospace', weight: 400 };
const F_IM_FELL_ENGLISH = { value: '"IM Fell English", serif', weight: 400 };
const F_PIXELIFY_SANS = { value: '"Pixelify Sans", sans-serif', weight: 400 };
const F_JACQUARD_24 = { value: '"Jacquard 24", system-ui', weight: 400 };
const F_PRESS_START_2P = { value: '"Press Start 2P", system-ui', weight: 400 };
const F_SILKSCREEN = { value: '"Silkscreen", system-ui', weight: 400 };
const F_SPACE_GROTESK = { value: '"Space Grotesk", sans-serif', weight: 400 };
const F_SYNE = { value: '"Syne", sans-serif', weight: 400 };
const F_PLAYFAIR = { value: '"Playfair Display", serif', weight: 400 };
const F_BODONI = { value: '"Bodoni Moda", serif', weight: 400 };
const F_ITALIANA = { value: '"Italiana", serif', weight: 400 };
const F_CORMORANT = { value: '"Cormorant Garamond", serif', weight: 400 };


// UI Fonts List (Switchable by user)
export const FONTS_EN = [
  // Primary Fonts (Toggleable via button)
  { name: '01. Inter (Default)', ...F_INTER },
  { name: '02. Special Elite', ...F_SPECIAL_ELITE },
  { name: '03. Cutive Mono', ...F_CUTIVE_MONO },
  
  // Secondary Fonts (Sidebar Selection Only)
  { name: '04. Jersey 10', ...F_JERSEY10 },
  { name: '05. Doto', ...F_DOTO },
  { name: '06. Tiny5', ...F_TINY5 },
  { name: '07. Lekton', ...F_LEKTON },
  { name: '08. VT323', ...F_VT323 },
  { name: '09. IM Fell English', ...F_IM_FELL_ENGLISH },
  { name: '10. Ultra', ...F_ULTRA },
  { name: '11. Anton', ...F_ANTON },
  { name: '12. Pixelify Sans', ...F_PIXELIFY_SANS },
  { name: '13. Jacquard 24', ...F_JACQUARD_24 },
  { name: '14. Press Start 2P', ...F_PRESS_START_2P },
  { name: '15. Silkscreen', ...F_SILKSCREEN },
  { name: '16. Syne', ...F_SYNE },
  { name: '17. Space Grotesk', ...F_SPACE_GROTESK },
];

// Falling Fonts List (Includes everything for PhysicsHero)
export const FALLING_FONTS_EN = [
  { name: 'Inter', ...F_INTER },
  { name: 'Montserrat', ...F_MONTSERRAT },
  { name: 'Jersey 10', ...F_JERSEY10 },
  { name: 'Doto', ...F_DOTO },
  { name: 'Tiny5', ...F_TINY5 },
  { name: 'Anton', ...F_ANTON },
  { name: 'Tenor Sans', ...F_TENOR_SANS },
  { name: 'Cinzel', ...F_CINZEL },
  { name: 'Special Elite', ...F_SPECIAL_ELITE },
  { name: 'Ultra', ...F_ULTRA },
  { name: 'Cutive Mono', ...F_CUTIVE_MONO },
  { name: 'Lekton', ...F_LEKTON },
  { name: 'VT323', ...F_VT323 },
  { name: 'IM Fell English', ...F_IM_FELL_ENGLISH },
  { name: 'Pixelify Sans', ...F_PIXELIFY_SANS },
  { name: 'Jacquard 24', ...F_JACQUARD_24 },
  { name: 'Press Start 2P', ...F_PRESS_START_2P },
  { name: 'Silkscreen', ...F_SILKSCREEN },
  { name: 'Space Grotesk', ...F_SPACE_GROTESK },
  { name: 'Syne', ...F_SYNE },
  { name: 'Playfair Display', ...F_PLAYFAIR },
  { name: 'Bodoni Moda', ...F_BODONI },
  { name: 'Italiana', ...F_ITALIANA },
  { name: 'Cormorant Garamond', ...F_CORMORANT },
];

// Simplified Chinese Fonts
export const FONTS_CN = [
  { name: '01. Noto Sans SC (Default)', value: '"Noto Sans SC", sans-serif', weight: 400 },
  { name: '02. Noto Serif SC', value: '"Noto Serif SC", serif', weight: 400 },
];

// Traditional Chinese Fonts
export const FONTS_TW = [
  { name: '01. Noto Sans TC (Default)', value: '"Noto Sans TC", sans-serif', weight: 400 },
  { name: '02. Noto Serif TC', value: '"Noto Serif TC", serif', weight: 400 },
];