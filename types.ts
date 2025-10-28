export type Feature = 'chat' | 'image' | 'video' | 'audio' | 'search' | 'tasks';

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
  timestamp: string; // ISO 8601 string
  status?: 'sent' | 'delivered' | 'read';
}

export type GroundingSource = {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
      reviewSnippets?: {
        uri: string;
        title: string;
        snippet: string;
      }[];
    };
  };
};

export type ImageTool = 'generate' | 'edit' | 'analyze';
export type VideoTool = 'generate' | 'analyze';
export type AudioTool = 'live' | 'tts';