
import { useRef, useCallback, useState, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { ConnectionStatus, Transcription } from '../types';
import { useAudio } from './useAudio';
import { useScreen } from './useScreen';
import { CONFIG } from '../utils/constants';
import { processFileForAI, generateFileUrl } from '../utils/file-helpers';

const SYSTEM_INSTRUCTION = `SYSTEM: "NOVA PRO" (Dev Core v5.4 - Proactive).
ROLE: Senior Principal Software Engineer & UX Specialist.

PRIME DIRECTIVE: You are the user's pair programmer. Your goal is not just to answer, but to GUIDE.

ADAPTIVE EXPERTISE PROTOCOL:
[PROFILE A: THE APPRENTICE] -> Detailed, warm, step-by-step.
[PROFILE B: THE ARCHITECT] -> Concise, technical, efficient.

CRITICAL PROTOCOL FOR CODE GENERATION (TOOL MANDATE):
1. **NEVER** TRY TO SPEAK CODE OR RELY ON TRANSCRIPTION FOR CODE BLOCKS.
2. **ALWAYS** USE THE \`render_code\` TOOL to deliver code snippets, scripts, or examples.
   - Speak: "Here is the Java code for the button."
   - Action: Call \`render_code(code="...", language="java")\`.
3. **ONLY** USE \`create_file\` if the user EXPLICITLY asks to "download" or "save" a file.

PROACTIVE ENGAGEMENT (NEXT STEP SUGGESTION):
- **MANDATORY:** At the end of every technical response, suggest a logical "Next Step".
- Context: If you wrote a button, suggest adding functionality. If you fixed a bug, suggest a test.
- Phrasing: "Would you like to [next step]?" or "Shall we proceed to [next step]?"

FLOW CONTROL:
- You can speak and call tools in the same turn.
- If you have multiple code blocks, call \`render_code\` multiple times or combine them if logical.
- Do not wait for user confirmation to show the code.

DEBUGGING:
- You see the user's screen. Use it to diagnose errors.`;

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
      code: { type: Type.STRING, description: "The source code to display" },
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
  
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const currentOutputTextRef = useRef('');
  const currentInputTextRef = useRef('');
  const streamingMsgIdRef = useRef<string | null>(null);
  const reconnectCountRef = useRef(0);
  const isExplicitlyTerminatedRef = useRef(false);
  const isReconnectingRef = useRef(false);

  const { startRecording, queueAudio, stopAudio, mixStream } = useAudio(setInputLevel, setIsUserSpeaking);

  const sendRealtimeInput = useCallback((data: any) => {
    if (isExplicitlyTerminatedRef.current) return;
    sessionPromiseRef.current?.then(session => {
        try { 
            session.sendRealtimeInput(data); 
        } catch(e) {
            console.debug("Send error (likely closed):", e);
        }
    });
  }, []);

  const { isScreenSharing, screenStream, startScreenSharing, stopScreenSharing, videoRef, canvasRef } = useScreen(sendRealtimeInput);

  useEffect(() => {
      if (isScreenSharing && screenStream) {
          const audioTracks = screenStream.getAudioTracks();
          if (audioTracks.length > 0) mixStream(screenStream);
      } else {
          mixStream(null);
      }
  }, [isScreenSharing, screenStream, mixStream]);

  const handleReconnect = useCallback(() => {
     if (isExplicitlyTerminatedRef.current || isReconnectingRef.current) return;
     isReconnectingRef.current = true;
     
     const baseDelay = 1000 * (1.5 ** reconnectCountRef.current);
     const jitter = Math.random() * 500;
     const delay = Math.min(baseDelay + jitter, CONFIG.MAX_BACKOFF_MS);
     
     console.log(`Reconnecting in ${Math.round(delay)}ms... (Attempt ${reconnectCountRef.current + 1})`);
     
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
                tools: [{ functionDeclarations: [FILE_TOOL_DECLARATION, RENDER_CODE_TOOL_DECLARATION] }],
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
                    try { await startRecording(sendRealtimeInput, isMuted); } catch (e) { console.error(e); }
                },
                onmessage: async (msg: LiveServerMessage) => {
                    if (msg.toolCall) {
                        const responses = [];
                        for (const fc of msg.toolCall.functionCalls) {
                            try {
                                if (fc.name === 'render_code') {
                                    const { code, language } = fc.args as any;
                                    
                                    // Inject code block directly into the chat stream as a distinct message
                                    setMessages(p => [...p, { 
                                        id: `code-${Date.now()}-${Math.random()}`, 
                                        role: 'assistant', 
                                        text: `\`\`\`${language || 'text'}\n${code}\n\`\`\``, 
                                        timestamp: new Date()
                                    }]);
                                    
                                    // Reset streaming buffer so next speech starts a new bubble if needed
                                    streamingMsgIdRef.current = null;
                                    currentOutputTextRef.current = '';

                                    responses.push({
                                        id: fc.id,
                                        name: fc.name,
                                        response: { result: "Code rendered successfully to user." }
                                    });
                                } else if (fc.name === 'create_file') {
                                    const { filename, content, language } = fc.args as any;
                                    if (!content || !filename) throw new Error("Incomplete arguments");

                                    const url = generateFileUrl(content);
                                    
                                    setMessages(p => [...p, { 
                                        id: `file-${Date.now()}`, 
                                        role: 'assistant', 
                                        text: `Arquivo gerado: ${filename}`, 
                                        timestamp: new Date(),
                                        fileAttachment: { name: filename, type: language || 'text', url, content }
                                    }]);

                                    responses.push({
                                        id: fc.id,
                                        name: fc.name,
                                        response: { result: "File created successfully." }
                                    });
                                }
                            } catch (err: any) {
                                console.error("Tool execution failed:", err);
                                responses.push({ id: fc.id, name: fc.name, response: { error: err.message } });
                            }
                        }
                        
                        if (responses.length > 0) {
                            sessionPromiseRef.current?.then(s => s.sendToolResponse({ functionResponses: responses }));
                        }
                    }

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
                        currentOutputTextRef.current = ''; 
                    }

                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) queueAudio(audioData, () => setIsSpeaking(true), () => setIsSpeaking(false));
                },
                onclose: () => { 
                    console.log("Session closed");
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
        handleReconnect();
    }
  }, [startRecording, queueAudio, stopAudio, sendRealtimeInput, isMuted, handleReconnect]);

  const disconnect = useCallback(() => {
    isExplicitlyTerminatedRef.current = true;
    setStatus(ConnectionStatus.DISCONNECTED);
    stopAudio();
    stopScreenSharing();
    
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(s => s.close()).catch(e => console.warn("Close error:", e));
        sessionPromiseRef.current = null;
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
        
        setMessages(p => [...p, { 
            id: `upload-${Date.now()}`, 
            role: 'user', 
            text: `Enviou um arquivo: ${file.name}`, 
            timestamp: new Date(),
            fileAttachment: { name: file.name, type: mimeType }
        }]);

        if (type === 'image') {
            sendRealtimeInput({ media: { data, mimeType } });
            sendRealtimeInput({ text: `[SYSTEM: User uploaded an image file named "${file.name}". Analyze it.]` });
        } else {
            sendRealtimeInput({ text: `[SYSTEM: User uploaded file "${file.name}" with content:]\n\n${data}\n\n[END OF FILE]` });
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
    sendFile 
  };
};
