export enum AppMode {
  MULTI_IMAGE = 'MULTI_IMAGE',
  SPRITE_SHEET = 'SPRITE_SHEET'
}

export interface FrameData {
  id: string;
  url: string; // Blob URL or Data URL
  file: File;
  width: number;
  height: number;
}

export interface SpriteSheetConfig {
  rows: number;
  cols: number;
  totalFrames: number;
  originalImage: FrameData | null;
}

export interface PlayerState {
  isPlaying: boolean;
  currentFrameIndex: number;
  fps: number;
  scale: number;
  backgroundColor: string;
}