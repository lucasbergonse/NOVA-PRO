
export interface Transcription {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
  fileAttachment?: {
    name: string;
    type: string;
    url?: string; // Para downloads gerados ou prévia local
    content?: string; // Para preview de texto
    size?: number; // Tamanho em bytes
  };
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface PendingAction {
  id: string;
  name: string;
  args: any;
  description: string;
}

export type PersonaKey = 'general' | 'developer' | 'finance' | 'legal' | 'sales' | 'creative';

export interface Persona {
  id: PersonaKey;
  name: string;
  role: string;
  description: string;
  systemInstruction: string;
}

export interface ChatContext {
  id: string;
  title: string;
  lastModified: number;
  personaId: PersonaKey;
  summary?: string;
  preview?: string;
}
