
export type NodeType = 'novel' | 'part' | 'chapter' | 'act' | 'section' | 'beat';

export type GeminiVoice = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface Character {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'extra';
  description: string;
  personality: string;
  goal: string;
  voiceName?: GeminiVoice;
}

export interface NodeMetadata {
  objective?: string;
  conflict?: string;
  pacing?: 'slow' | 'moderate' | 'fast' | 'climax';
  location?: string;
}

export interface NovelNode {
  id: string;
  type: NodeType;
  title: string;
  content: string;
  summary: string;
  metadata?: NodeMetadata;
  children: NovelNode[];
  isExpanded?: boolean;
}

export interface SavedNovel {
  id: string;
  title: string;
  lastUpdated: string;
  coverColor: string;
  tree: NovelNode;
  setting: string;
  characters: Character[];
}

export enum AIActionType {
  WRITE_CONTINUE = 'WRITE_CONTINUE',
  SUMMARIZE = 'SUMMARIZE',
  GENERATE_TITLE = 'GENERATE_TITLE',
  GENERATE_FULL_STRUCTURE = 'GENERATE_FULL_STRUCTURE',
  ARCHITECT_DEEPEN = 'ARCHITECT_DEEPEN',
}

export type WritingStyle = 'classic' | 'modern' | 'wuxia' | 'horror' | 'philosophical' | 'romantic';

export interface BackgroundMood {
  id: string;
  name: string;
  description: string;
  visualPrompt: string;
  icon: string;
}

export interface ComicPanel {
  id: string;
  description: string;
  dialogue: string;
  visualPrompt: string;
  imageUrl?: string;
  isLoading?: boolean;
}
