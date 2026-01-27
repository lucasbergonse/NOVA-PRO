
import { useRef, useCallback, useState, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { ConnectionStatus, Transcription, PersonaKey, ChatContext } from '../types';
import { useAudio } from './useAudio';
import { useScreen } from './useScreen';
import { CONFIG, PERSONAS } from '../utils/constants';
import { processFileForAI, generateFileUrl } from '../utils/file-helpers';
import { memoryDB } from '../utils/memory-db';

const FILE_TOOL_DECLARATION = {
  name: "create_file",
  description: "Create and download a file to the user's computer. USE THIS ONLY IF the user explicitly asks to 'save', 'download' or 'create a file'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filename: { type: Type.STRING, description: "Name of the file (e.g., 'App.tsx', 'script.py')" },
      content: { type: Type.STRING, description: "The COMPLETE content of the file" },
      language: { type: Type.STRING, description: "Programming language or file type (e.g., 'typescript', 'python')" }
    },
    required: ["filename", "content"]
  }
};

const RENDER_CODE_TOOL_DECLARATION = {
  name: "render_code",
  description: "Display a code block in the chat stream. Use this for ALL code examples, snippets, or logic explanations that require formatting.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      code: { type: Type.STRING, description: "The source code to display. RAW STRING ONLY. DO NOT use markdown fences." },
      language: { type: Type.STRING, description: "The programming language (e.g., 'typescript', 'java', 'python')" }
    },
    required: ["code", "language"]
  }
};

export const useGemini = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<Transcription[]>([]);
  const [inputLevel, setInputLevel] = useState(0);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  
  // State for Context/Memory
  const [currentContext, setCurrentContext] = useState<ChatContext | null>(null);
  const [isIncognito, setIsIncognito] = useState(false);
  const [contextsRefreshTrigger, setContextsRefreshTrigger] = useState(0); // Helper to refresh sidebar

  const sessionRef = useRef<any>(null); 
  const currentOutputTextRef = useRef('');
  const currentInputTextRef = useRef('');
  const streamingMsgIdRef = useRef<string | null>(null);
  const reconnectCountRef = useRef(0);
  const isExplicitlyTerminatedRef = useRef(false);
  const isReconnectingRef = useRef(false);
  const activeSystemInstructionRef = useRef<string>('');
  const stableConnectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial setup: Load default context or create one
  useEffect(() => {
    const init = async () => {
        // Only load if not explicit incognito session
        if (!isIncognito) {
            try {
                const list = await memoryDB.getContexts();
                if (list.length > 0) {
                    // Load most recent
                    const recent = list[0];
                    setCurrentContext(recent);
                    const msgs = await memoryDB.getMessages(recent.id);
                    setMessages(msgs);
                } else {
                    createNewContext(PERSONAS.GENERAL.id);
                }
            } catch(e) { console.error(e); }
        }
    };
    init();
  }, []);

  // Save Messages Effect (Auto-save)
  useEffect(() => {
    if (!currentContext || isIncognito || messages.length === 0) return;

    const timeout = setTimeout(async () => {
        const lastMsg = messages[messages.length - 1];
        
        // Update Context Metadata
        const updatedContext: ChatContext = {
            ...currentContext,
            lastModified: Date.now(),
            preview: lastMsg.text.slice(0, 100) + (lastMsg.text.length > 100 ? '...' : ''),
            title: currentContext.title === 'Nova Conversa' && messages.length > 2 
                   ? messages.find(m => m.role === 'user')?.text.slice(0, 30) || 'Nova Conversa'
                   : currentContext.title
        };
        
        await memoryDB.saveContext(updatedContext);
        await memoryDB.saveMessages(updatedContext.id, messages);
        setCurrentContext(updatedContext);
        setContextsRefreshTrigger(prev => prev + 1); // Notify sidebar
    }, 2000); // Debounce save

    return () => clearTimeout(timeout);
  }, [messages, isIncognito]); // Remove currentContext dependency to avoid loop, handle carefully

  const createNewContext = useCallback((personaId: PersonaKey = 'general') => {
      const newCtx: ChatContext = {
          id: crypto.randomUUID(),
          title: 'Nova Conversa',
          lastModified: Date.now(),
          personaId,
          preview: 'Iniciando nova memória...'
      };
      setCurrentContext(newCtx);
      setMessages([]);
      setContextsRefreshTrigger(p => p + 1);
  }, []);

  const switchContext = useCallback(async (context: ChatContext) => {
      if (status === ConnectionStatus.CONNECTED) {
          // Optional: disconnect or just clear visual state. Keeping connection active is smoother.
          // For true context switch in AI, we might need to send a system instruction update, but Live API keeps history.
          // Best practice: disconnect and reconnect cleanly to clear AI internal context buffer.
          disconnect(); 
      }
      
      setCurrentContext(context);
      const msgs = await memoryDB.getMessages(context.id);
      setMessages(msgs);
      setIsIncognito(false);
  }, [status]); // Added disconnect to deps

  const deleteContext = useCallback(async (id: string) => {
      await memoryDB.deleteContext(id);
      setContextsRefreshTrigger(p => p + 1);
      if (currentContext?.id === id) {
          createNewContext();
      }
  }, [currentContext, createNewContext]);

  const toggleIncognito = useCallback(() => {
      setIsIncognito(prev => {
          if (!prev) {
              // Entering Incognito
              setMessages([]);
              setCurrentContext(null);
          } else {
              // Exiting Incognito -> Create new standard context
              createNewContext();
          }
          return !prev;
      });
  }, [createNewContext]);

  const handleAutoSilence = useCallback(() => {
    setIsMuted(true);
    setMessages(p => [...p, {
        id: `sys-mute-${Date.now()}`,
        role: 'system',
        text: 'Microfone pausado automaticamente devido à inatividade para economizar recursos.',
        timestamp: new Date()
    }]);
  }, []);

  const { startRecording, queueAudio, stopAudio, mixStream } = useAudio(setInputLevel, setIsUserSpeaking, handleAutoSilence);

  const handleReconnect = useCallback((force = false) => {
     if (isExplicitlyTerminatedRef.current && !force) return;
     if (isReconnectingRef.current) return;

     stopAudio();

     if (reconnectCountRef.current > 5) { 
         setStatus(ConnectionStatus.ERROR);
         setMessages(p => [...p, { id: `sys-${Date.now()}`, role: 'system', text: "Erro: Conexão instável. Verifique sua internet ou API Key.", timestamp: new Date() }]);
         return;
     }

     isReconnectingRef.current = true;
     const baseDelay = 1000 * (1.5 ** reconnectCountRef.current);
     const jitter = Math.random() * 500;
     const delay = Math.min(baseDelay + jitter, CONFIG.MAX_BACKOFF_MS);
     
     console.log(`Reconnecting in ${Math.round(delay)}ms... (Attempt ${reconnectCountRef.current + 1})`);
     
     reconnectCountRef.current++;
     setStatus(ConnectionStatus.CONNECTING);
     
     setTimeout(() => {
         isReconnectingRef.current = false;
         if (!isExplicitlyTerminatedRef.current) connect(activeSystemInstructionRef.current, true);
     }, delay);
  }, [stopAudio]);

  const sendRealtimeInput = useCallback((data: any) => {
    if (sessionRef.current && !isExplicitlyTerminatedRef.current) {
        try {
            sessionRef.current.sendRealtimeInput(data);
        } catch (e) {
            console.debug("Failed to send input, attempting fast reconnect:", e);
            handleReconnect(true);
        }
    }
  }, [handleReconnect]);

  const { isScreenSharing, screenStream, startScreenSharing, stopScreenSharing, videoRef, canvasRef } = useScreen(sendRealtimeInput);

  useEffect(() => {
      if (isScreenSharing && screenStream) {
          const audioTracks = screenStream.getAudioTracks();
          if (audioTracks.length > 0) mixStream(screenStream);
      } else {
          mixStream(null);
      }
  }, [isScreenSharing, screenStream, mixStream]);

  const connect = useCallback(async (systemInstruction: string, isReconnect = false) => {
    if (!isReconnect) {
        isExplicitlyTerminatedRef.current = false;
        reconnectCountRef.current = 0;
    }

    if (isExplicitlyTerminatedRef.current) return;
    
    // Inject Memory Context into System Instruction if available
    let finalInstruction = systemInstruction;
    if (currentContext && !isIncognito) {
        // Retrieve last 5 messages for context priming (simulated RAG)
        // Ideally we rely on session history, but on fresh connect we might need to prime.
        finalInstruction += `\n\nCURRENT CONTEXT: User is in session "${currentContext.title}". Persona: ${currentContext.personaId}.`;
    }

    activeSystemInstructionRef.current = finalInstruction;
    setStatus(ConnectionStatus.CONNECTING);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const onOpen = async () => {
        if (isExplicitlyTerminatedRef.current) {
            sessionRef.current?.close();
            return;
        }
        setStatus(ConnectionStatus.CONNECTED);
        
        if (stableConnectionTimerRef.current) clearTimeout(stableConnectionTimerRef.current);
        stableConnectionTimerRef.current = setTimeout(() => {
            reconnectCountRef.current = 0;
        }, 5000);

        try { 
            await startRecording(sendRealtimeInput, isMuted); 
        } catch (e) { 
            console.error("Mic start failed", e);
            setMessages(p => [...p, {id: `err-${Date.now()}`, role: 'system', text: 'Conectado, mas erro ao acessar microfone.', timestamp: new Date()}]);
        }
    };

    const onMessage = async (msg: LiveServerMessage) => {
        if (msg.toolCall) {
            const responses = [];
            for (const fc of msg.toolCall.functionCalls) {
                try {
                    if (fc.name === 'render_code') {
                        const { code, language } = fc.args as any;
                        let cleanCode = (code || '').trim();
                        if (cleanCode.startsWith('```')) {
                            cleanCode = cleanCode.replace(/^```[\w-]*\n?/, '').replace(/\n?```$/, '');
                        }
                        const lang = (language || 'text').toLowerCase();
                        setMessages(p => [...p, { 
                            id: `code-${Date.now()}-${Math.random()}`, 
                            role: 'assistant', 
                            text: `\`\`\`${lang}\n${cleanCode}\n\`\`\``, 
                            timestamp: new Date()
                        }]);
                        streamingMsgIdRef.current = null;
                        currentOutputTextRef.current = '';
                        responses.push({ id: fc.id, name: fc.name, response: { result: "Code block rendered successfully on user screen." } });
                    } else if (fc.name === 'create_file') {
                        const { filename, content, language } = fc.args as any;
                        const url = generateFileUrl(content);
                        setMessages(p => [...p, { 
                            id: `file-${Date.now()}`, 
                            role: 'assistant', 
                            text: `Arquivo gerado: ${filename}`, 
                            timestamp: new Date(),
                            fileAttachment: { name: filename, type: language || 'text', url, content, size: content.length }
                        }]);
                        responses.push({ id: fc.id, name: fc.name, response: { result: "File created and ready for download." } });
                    }
                } catch (err: any) {
                    responses.push({ id: fc.id, name: fc.name, response: { error: err.message } });
                }
            }
            if (responses.length > 0) {
                 sessionRef.current?.sendToolResponse({ functionResponses: responses });
            }
        }

        if (msg.serverContent?.interrupted) {
            stopAudio();
            setIsSpeaking(false);
            currentOutputTextRef.current = '';
            streamingMsgIdRef.current = null; 
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
            currentOutputTextRef.current = ''; 
        }

        const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) queueAudio(audioData, () => setIsSpeaking(true), () => setIsSpeaking(false));
    };

    const onError = (e: any) => {
        console.error("Session error:", e);
        if (!isExplicitlyTerminatedRef.current) handleReconnect(); 
    };

    const onClose = () => {
        console.log("Session closed");
        if (!isExplicitlyTerminatedRef.current) handleReconnect(); 
    };

    try {
        const session = await ai.live.connect({
             model: 'gemini-2.5-flash-native-audio-preview-12-2025',
             config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
                systemInstruction: activeSystemInstructionRef.current,
                tools: [{ functionDeclarations: [FILE_TOOL_DECLARATION, RENDER_CODE_TOOL_DECLARATION] }],
                outputAudioTranscription: {}
            },
            callbacks: { onopen: onOpen, onmessage: onMessage, onerror: onError, onclose: onClose }
        });
        sessionRef.current = session;
    } catch(e) {
        console.error("Connection Failed:", e);
        handleReconnect();
    }

  }, [startRecording, queueAudio, stopAudio, sendRealtimeInput, isMuted, handleReconnect, handleAutoSilence, currentContext, isIncognito]);

  const disconnect = useCallback(() => {
    isExplicitlyTerminatedRef.current = true;
    if (stableConnectionTimerRef.current) clearTimeout(stableConnectionTimerRef.current);
    setStatus(ConnectionStatus.DISCONNECTED);
    stopAudio();
    stopScreenSharing();
    
    if (sessionRef.current) {
        try {
             sessionRef.current.close();
        } catch(e) {
            console.warn("Error closing session:", e);
        }
        sessionRef.current = null;
    }
  }, [stopAudio, stopScreenSharing]);

  const sendText = useCallback((text: string) => {
      setIsThinking(true);
      setMessages(p => [...p, { id: `txt-${Date.now()}`, role: 'user', text, timestamp: new Date() }]);
      sendRealtimeInput({ text });
  }, [sendRealtimeInput]);

  const sendFile = useCallback(async (file: File) => {
      try {
        const { mimeType, data, type } = await processFileForAI(file);
        const url = URL.createObjectURL(file);

        setMessages(p => [...p, { 
            id: `upload-${Date.now()}`, 
            role: 'user', 
            text: `Enviou um arquivo: ${file.name}`, 
            timestamp: new Date(),
            fileAttachment: { name: file.name, type: mimeType, size: file.size, url }
        }]);

        if (type === 'image') {
            sendRealtimeInput({ media: { data, mimeType } });
            sendRealtimeInput({ text: `[SYSTEM: User uploaded an image file named "${file.name}" (Size: ${file.size} bytes). Analyze it.]` });
        } else {
            sendRealtimeInput({ text: `[SYSTEM: User uploaded file "${file.name}" (Size: ${file.size} bytes) with content:]\n\n${data}\n\n[END OF FILE]` });
        }
      } catch (e) {
        console.error("File processing error", e);
        setMessages(p => [...p, { id: `err-${Date.now()}`, role: 'assistant', text: "Erro ao ler arquivo. Tente um arquivo de texto ou imagem.", timestamp: new Date() }]);
      }
  }, [sendRealtimeInput]);

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
    sendText,
    sendFile,
    // Context Exports
    currentContext,
    createNewContext,
    switchContext,
    deleteContext,
    isIncognito,
    toggleIncognito,
    contextsRefreshTrigger
  };
};
