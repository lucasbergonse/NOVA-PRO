
export interface Transcription {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
  fileAttachment?: {
    name: string;
    type: string;
    url?: string; // Para downloads gerados
    content?: string; // Para preview
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
