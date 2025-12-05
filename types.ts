
export type ViewState = 'ABOUT' | 'PORTFOLIO' | 'TEXT' | 'BIOGRAPHY';

export type Lang = 'en' | 'cn' | 'tw';

export type MultiLangString = {
  cn: string;
  tw: string;
  en: string;
};

export interface Project {
  id: string;
  title: MultiLangString;
  category?: MultiLangString; // Optional now as it's not shown in main view
  year: string;
  description: MultiLangString;
  imageUrl: string;
  fpImages?: string[]; // Images located in FP subfolder for particle covers
  // Path to the specific folder containing detailed assets/layout for this project
  // e.g., "portfolio/1"
  folderPath?: string; 
}

export interface NavItem {
  label: string;
  view: ViewState;
}

export type TextCategory = 'Short Stories' | 'Memo Novels' | 'Essays' | 'Diaries';

export interface TextEntry {
  id: string;
  title: MultiLangString;
  date?: string;
  publication?: string;
  // Content is now an object storing versions
  content: MultiLangString;
  link?: string;
}

export interface TextSection {
  category: MultiLangString; // Display name
  items: TextEntry[];
}

export interface ContactInfo {
  name: MultiLangString;
  location: MultiLangString;
  email: string;
  instagram: string;
  phones: string[];
}

export interface TimelineItem {
  year: string;
  text: MultiLangString;
}

export interface BioData {
  contact: ContactInfo;
  timeline: TimelineItem[];
  exhibitions: TimelineItem[];
}
