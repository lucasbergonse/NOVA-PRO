
import { useRef, useCallback, useEffect } from 'react';
import { CONFIG, WORKLET_CODE } from '../utils/constants';
import { decodeAudioData, decode, createPcmBlob } from '../utils/audio-utils';

export const useAudio = (
  onInputVolume: (level: number) => void,
  onVADStateChange: (isSpeaking: boolean) => void,
  onSilenceDetected?: () => void // Callback opcional para auto-mute
) => {
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const externalSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const audioProcessingChain = useRef<Promise<void>>(Promise.resolve());
  
  // VAD Refs
  const vadHoldFramesRef = useRef(0);
  const vadAttackFramesRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());

  // Function to ensure AudioContext is running (fix for autoplay policies)
  const ensureContexts = useCallback(async () => {
    if (audioContextInRef.current?.state === 'suspended') {
        try { await audioContextInRef.current.resume(); } catch(e) { console.debug("InCtx resume fail", e); }
    }
    if (audioContextOutRef.current?.state === 'suspended') {
        try { await audioContextOutRef.current.resume(); } catch(e) { console.debug("OutCtx resume fail", e); }
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    lastActivityTimeRef.current = Date.now();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    // Inicia contagem regressiva para desligar microfone
    silenceTimerRef.current = setTimeout(() => {
        console.log("Auto-muting microphone due to inactivity.");
        if (onSilenceDetected) onSilenceDetected();
    }, CONFIG.SILENCE_TIMEOUT_MS);
  }, [onSilenceDetected]);

  const initializeAudio = useCallback(async () => {
    if (!audioContextInRef.current) {
        audioContextInRef.current = new AudioContext({ 
          sampleRate: CONFIG.SAMPLE_RATE_IN, 
          latencyHint: CONFIG.AUDIO_LATENCY_HINT 
        });
    }
    if (!audioContextOutRef.current) {
        audioContextOutRef.current = new AudioContext({ 
          sampleRate: CONFIG.SAMPLE_RATE_OUT, 
          latencyHint: CONFIG.AUDIO_LATENCY_HINT 
        });
    }

    await ensureContexts();

    try {
        // Safe module loading
        try {
           const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
           const workletUrl = URL.createObjectURL(blob);
           await audioContextInRef.current.audioWorklet.addModule(workletUrl);
        } catch (e) {
             // Module likely already added, proceed
        }
    } catch (e) {
         console.warn("Worklet setup warning:", e);
    }
  }, [ensureContexts]);

  const mixStream = useCallback((externalStream: MediaStream | null) => {
    if (!audioContextInRef.current || !workletNodeRef.current) return;

    // Disconnect old source
    if (externalSourceRef.current) {
        try { externalSourceRef.current.disconnect(); } catch(e){}
        externalSourceRef.current = null;
    }

    // Connect new source
    if (externalStream && externalStream.getAudioTracks().length > 0) {
        try {
            const source = audioContextInRef.current.createMediaStreamSource(externalStream);
            source.connect(workletNodeRef.current);
            externalSourceRef.current = source;
        } catch (e) {
            console.error("Error mixing system audio:", e);
        }
    }
  }, []);

  const startRecording = useCallback(async (sendCallback: (blob: any) => void, isMuted: boolean) => {
    await initializeAudio();
    if (!audioContextInRef.current) return;

    // Reinicia o timer de silêncio ao iniciar gravação
    resetSilenceTimer();

    try {
        // Reuse stream if active to prevent permission prompt spam
        if (!micStreamRef.current || !micStreamRef.current.active) {
            micStreamRef.current = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: { ideal: true },
                    noiseSuppression: { ideal: true },
                    autoGainControl: { ideal: true },
                    sampleRate: CONFIG.SAMPLE_RATE_IN,
                    channelCount: 1,
                }
            });
        }

        if (workletNodeRef.current) {
            workletNodeRef.current.port.onmessage = null;
            workletNodeRef.current.disconnect();
        }

        const source = audioContextInRef.current.createMediaStreamSource(micStreamRef.current);
        const workletNode = new AudioWorkletNode(audioContextInRef.current, 'recorder-worklet');

        workletNode.port.onmessage = (event) => {
            const inputData = event.data;
            
            // RMS Calculation
            let sum = 0;
            for (let i = 0; i < inputData.length; i += 4) sum += inputData[i] * inputData[i];
            const rms = Math.sqrt(sum / (inputData.length / 4));
            onInputVolume(rms);

            // Robust VAD Logic (Attack & Decay)
            if (rms > CONFIG.VAD_THRESHOLD) {
                // Audio detected
                vadAttackFramesRef.current++;
                
                // Only trigger if we have consecutive loud frames (avoids clicks/pops)
                if (vadAttackFramesRef.current >= CONFIG.VAD_ATTACK_FRAMES) {
                    vadHoldFramesRef.current = CONFIG.VAD_HYSTERESIS_FRAMES;
                    resetSilenceTimer(); // Reset auto-off timer on verified speech
                    
                    if (!isSpeakingRef.current) {
                        isSpeakingRef.current = true;
                        onVADStateChange(true);
                    }
                }
            } else {
                // Silence detected
                vadAttackFramesRef.current = 0; // Reset attack counter
                
                if (vadHoldFramesRef.current > 0) {
                    vadHoldFramesRef.current--; // Hold state (Hysteresis)
                } else {
                    if (isSpeakingRef.current) {
                        isSpeakingRef.current = false;
                        onVADStateChange(false);
                    }
                }
            }

            if (!isMuted) {
                const pcmBlob = createPcmBlob(inputData);
                sendCallback({ media: { data: pcmBlob, mimeType: 'audio/pcm;rate=16000' } });
            }
        };

        source.connect(workletNode);
        workletNode.connect(audioContextInRef.current.destination);
        workletNodeRef.current = workletNode;

    } catch (err) {
        console.error("Audio Start Error:", err);
        throw err;
    }
  }, [initializeAudio, onInputVolume, onVADStateChange, resetSilenceTimer]);

  const queueAudio = useCallback((base64Audio: string, onStartSpeaking: () => void, onStopSpeaking: () => void) => {
    if (!base64Audio || !audioContextOutRef.current) return;

    audioProcessingChain.current = audioProcessingChain.current.then(async () => {
        if (!audioContextOutRef.current || (audioContextOutRef.current.state as string) === 'closed') return;
        
        await ensureContexts();

        try {
            const buffer = await decodeAudioData(decode(base64Audio), audioContextOutRef.current, CONFIG.SAMPLE_RATE_OUT, 1);
            
            // Check context again after async decode
            if (!audioContextOutRef.current || (audioContextOutRef.current.state as string) === 'closed') return;

            const ctx = audioContextOutRef.current;
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);

            const now = ctx.currentTime;
            let start = Math.max(now, nextStartTimeRef.current);
            if (start === now) start += 0.01; 

            source.start(start);
            nextStartTimeRef.current = start + buffer.duration;
            
            sourcesRef.current.add(source);
            onStartSpeaking();

            source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) {
                     onStopSpeaking();
                     if (ctx.state === 'running' && ctx.currentTime > nextStartTimeRef.current + 0.5) {
                        nextStartTimeRef.current = ctx.currentTime;
                     }
                }
            };
        } catch (e) {
            console.error("Audio Playback Error:", e);
        }
    });
  }, [ensureContexts]);

  const stopAudio = useCallback(() => {
    // Clear auto-mute timer
    if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
    }

    // Stop all playing sources
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
    sourcesRef.current.clear();
    
    // Reset chain
    audioProcessingChain.current = Promise.resolve();
    nextStartTimeRef.current = 0;
    
    // Stop input processing
    if (workletNodeRef.current) {
        workletNodeRef.current.port.onmessage = null;
        try { workletNodeRef.current.disconnect(); } catch(e) {}
        workletNodeRef.current = null;
    }
    
    if (externalSourceRef.current) {
        try { externalSourceRef.current.disconnect(); } catch(e) {}
        externalSourceRef.current = null;
    }

    // Stop Microphone Stream Completely (Definitive cleanup)
    if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
    }
    
    // Suspend contexts to save battery/cpu
    if (audioContextInRef.current?.state === 'running') audioContextInRef.current.suspend();
    if (audioContextOutRef.current?.state === 'running') audioContextOutRef.current.suspend();
    
    // Reset VAD state
    isSpeakingRef.current = false;
    vadHoldFramesRef.current = 0;
    vadAttackFramesRef.current = 0;

  }, []);

  // Global unlock for user interaction
  useEffect(() => {
      const unlock = () => ensureContexts();
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
      return () => {
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('keydown', unlock);
      }
  }, [ensureContexts]);

  return { startRecording, queueAudio, stopAudio, mixStream };
};
