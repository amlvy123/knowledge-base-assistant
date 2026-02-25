export enum AnalysisStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface AnalysisFile {
  id: string;
  file: File;
  type: 'pdf' | 'video' | 'image' | 'web-pdf';
  status: AnalysisStatus;
  result?: string;
  error?: string;
  originalUrl?: string; // For web analyzer
}

export interface SettingsConfig {
  docPrompt: string;
  videoPrompt: string;
  imagePrompt?: string;
}

export const STORAGE_KEYS = {
  SETTINGS: 'kf_settings_v1',
};