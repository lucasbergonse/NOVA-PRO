
import { useRef, useCallback, useState, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionStatus, Transcription } from '../types';
import { useAudio } from './useAudio';
import { useScreen } from './useScreen';
import { CONFIG } from '../utils/constants';

const SYSTEM_INSTRUCTION = `SYSTEM: "NOVA PRO" (Neural OS v2.1).
                
CONTEXT: You are an advanced AI integrated into the user's computer via Audio and Screen Sharing (Vision).

VISION PROTOCOLS:
1. **Analyze Details:** Read code lines precisely. Analyze UI spacing, colors, and layout.
2. **Error Triaging:** If an error overlay appears, prioritize reading it and cross-referencing with visible code.

AUDIO PROTOCOLS:
1. **Brevity:** The user is speaking in real-time. Keep responses punchy and direct.
2. **Tone:** Professional, slightly futuristic, helpful.`;

export const useGemini = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<Transcription[]>([]);
  const [inputLevel, setInputLevel] = useState(0);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const currentOutputTextRef = useRef('');
  const currentInputTextRef = useRef('');
  const streamingMsgIdRef = useRef<string | null>(null);
  const reconnectCountRef = useRef(0);
  const isExplicitlyTerminatedRef = useRef(false);
  const isReconnectingRef = useRef(false);

  // Hook de Áudio
  const { startRecording, queueAudio, stopAudio, mixStream } = useAudio(setInputLevel, setIsUserSpeaking);

  // Função de envio seguro
  const sendRealtimeInput = useCallback((data: any) => {
    sessionPromiseRef.current?.then(session => {
        try { session.sendRealtimeInput(data); } catch(e) {}
    });
  }, []);

  // Hook de Tela
  const { isScreenSharing, screenStream, startScreenSharing, stopScreenSharing, videoRef, canvasRef } = useScreen(sendRealtimeInput);

  useEffect(() => {
      if (isScreenSharing && screenStream) {
          const audioTracks = screenStream.getAudioTracks();
          if (audioTracks.length > 0) {
              mixStream(screenStream);
          }
      } else {
          mixStream(null);
      }
  }, [isScreenSharing, screenStream, mixStream]);

  const handleReconnect = useCallback(() => {
     if (isExplicitlyTerminatedRef.current || isReconnectingRef.current) return;
     
     isReconnectingRef.current = true;
     const delay = Math.min(1000 * (1.5 ** reconnectCountRef.current), CONFIG.MAX_BACKOFF_MS);
     console.log(`Reconnecting in ${delay}ms... (Attempt ${reconnectCountRef.current + 1})`);
     
     reconnectCountRef.current++;
     setStatus(ConnectionStatus.CONNECTING);
     
     setTimeout(() => {
         isReconnectingRef.current = false;
         if (!isExplicitlyTerminatedRef.current) connect(true);
     }, delay);
  }, []); 

  const connect = useCallback(async (isReconnect = false) => {
    if (!isReconnect) {
        isExplicitlyTerminatedRef.current = false;
        reconnectCountRef.current = 0;
    }
    if (isExplicitlyTerminatedRef.current) return;

    setStatus(ConnectionStatus.CONNECTING);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-12-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
                systemInstruction: SYSTEM_INSTRUCTION,
                outputAudioTranscription: {}
            },
            callbacks: {
                onopen: async () => {
                    if (isExplicitlyTerminatedRef.current) {
                        sessionPromiseRef.current?.then(s => s.close());
                        return;
                    }
                    setStatus(ConnectionStatus.CONNECTED);
                    reconnectCountRef.current = 0;
                    
                    try {
                        await startRecording(sendRealtimeInput, isMuted);
                    } catch (e) {
                        console.error("Mic error:", e);
                        setMessages(p => [...p, { id: Date.now().toString(), role: 'assistant', text: "Erro ao acessar microfone. Verifique permissões.", timestamp: new Date() }]);
                    }
                },
                onmessage: async (msg: LiveServerMessage) => {
                    if (msg.serverContent?.interrupted) {
                        stopAudio();
                        setIsSpeaking(false);
                        currentOutputTextRef.current = '';
                    }

                    if (msg.serverContent?.outputTranscription) {
                        setIsThinking(false);
                        const text = msg.serverContent.outputTranscription.text;
                        if (!streamingMsgIdRef.current) {
                            streamingMsgIdRef.current = `ai-${Date.now()}`;
                            currentOutputTextRef.current = text;
                            setMessages(p => [...p, { id: streamingMsgIdRef.current!, role: 'assistant', text, timestamp: new Date() }]);
                        } else {
                            currentOutputTextRef.current += text;
                            setMessages(p => p.map(m => m.id === streamingMsgIdRef.current ? { ...m, text: currentOutputTextRef.current } : m));
                        }
                    }

                    if (msg.serverContent?.inputTranscription) {
                         currentInputTextRef.current += msg.serverContent.inputTranscription.text;
                    }
                    
                    if (msg.serverContent?.turnComplete) {
                        if (currentInputTextRef.current) {
                             setMessages(p => [...p, { id: `user-${Date.now()}`, role: 'user', text: currentInputTextRef.current, timestamp: new Date() }]);
                        }
                        currentInputTextRef.current = '';
                        streamingMsgIdRef.current = null;
                    }

                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) {
                        queueAudio(audioData, () => setIsSpeaking(true), () => setIsSpeaking(false));
                    }
                },
                onclose: () => {
                    if (!isExplicitlyTerminatedRef.current) handleReconnect();
                },
                onerror: (e) => {
                    console.error("Session error:", e);
                    if (!isExplicitlyTerminatedRef.current) handleReconnect();
                }
            }
        });

        sessionPromise.catch((err) => {
            console.error("Initial connection failed:", err);
            if (!isExplicitlyTerminatedRef.current) handleReconnect();
        });

        sessionPromiseRef.current = sessionPromise;
    } catch (e) {
        console.error("Connect sync error:", e);
        handleReconnect();
    }
  }, [startRecording, queueAudio, stopAudio, sendRealtimeInput, isMuted, handleReconnect]);

  const disconnect = useCallback(() => {
    isExplicitlyTerminatedRef.current = true;
    setStatus(ConnectionStatus.DISCONNECTED);
    stopAudio();
    stopScreenSharing();
    sessionPromiseRef.current?.then(s => s.close()).catch(() => {});
  }, [stopAudio, stopScreenSharing]);

  const sendText = useCallback((text: string) => {
      setIsThinking(true);
      setMessages(p => [...p, { id: `txt-${Date.now()}`, role: 'user', text, timestamp: new Date() }]);
      sendRealtimeInput({ text });
  }, [sendRealtimeInput]);

  useEffect(() => {
      // Logic for mute sync if needed
  }, [isMuted]);

  return {
    status,
    connect,
    disconnect,
    isMuted,
    setIsMuted,
    messages,
    setMessages,
    inputLevel,
    isUserSpeaking,
    isSpeaking,
    isThinking,
    isScreenSharing,
    startScreenSharing,
    stopScreenSharing,
    videoRef,
    canvasRef,
    sendText
  };
};
