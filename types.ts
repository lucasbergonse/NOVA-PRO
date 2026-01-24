
export interface Transcription {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  imageUrl?: string;
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
