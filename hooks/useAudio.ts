
import { useRef, useCallback, useEffect } from 'react';
import { CONFIG, WORKLET_CODE } from '../utils/constants';
import { decodeAudioData, decode, createPcmBlob } from '../utils/audio-utils';

export const useAudio = (
  onInputVolume: (level: number) => void,
  onVADStateChange: (isSpeaking: boolean) => void
) => {
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const externalSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const vadActiveRef = useRef(0);
  const audioProcessingChain = useRef<Promise<void>>(Promise.resolve());

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

    if (audioContextInRef.current.state === 'suspended') await audioContextInRef.current.resume();
    if (audioContextOutRef.current.state === 'suspended') await audioContextOutRef.current.resume();

    try {
        // Prevent adding module multiple times
        try {
           // We use a blob URL, but audioWorklet.addModule doesn't throw if added twice with same URL usually,
           // but to be safe we can wrap. However, simple error suppression is enough here.
           const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
           const workletUrl = URL.createObjectURL(blob);
           await audioContextInRef.current.audioWorklet.addModule(workletUrl);
        } catch (e) {
             // Ignore if module already exists or other non-critical loading errors
        }
    } catch (e) {
         console.warn("Worklet setup warning:", e);
    }
  }, []);

  const mixStream = useCallback((externalStream: MediaStream | null) => {
    if (!audioContextInRef.current || !workletNodeRef.current) return;

    if (externalSourceRef.current) {
        try { externalSourceRef.current.disconnect(); } catch(e){}
        externalSourceRef.current = null;
    }

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

    try {
        if (!micStreamRef.current) {
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

        // Clean up existing worklet if present
        if (workletNodeRef.current) {
            workletNodeRef.current.port.onmessage = null;
            workletNodeRef.current.disconnect();
        }

        const source = audioContextInRef.current.createMediaStreamSource(micStreamRef.current);
        const workletNode = new AudioWorkletNode(audioContextInRef.current, 'recorder-worklet');

        workletNode.port.onmessage = (event) => {
            const inputData = event.data;
            
            let sum = 0;
            // Simple RMS calculation
            for (let i = 0; i < inputData.length; i += 4) sum += inputData[i] * inputData[i];
            const rms = Math.sqrt(sum / (inputData.length / 4));
            onInputVolume(rms);

            if (rms > CONFIG.VAD_THRESHOLD) {
                vadActiveRef.current = CONFIG.VAD_HYSTERESIS_FRAMES;
                onVADStateChange(true);
            } else if (vadActiveRef.current > 0) {
                vadActiveRef.current--;
            } else {
                onVADStateChange(false);
            }

            if (!isMuted) {
                const pcmBlob = createPcmBlob(inputData);
                // Send data
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
  }, [initializeAudio, onInputVolume, onVADStateChange]);

  const queueAudio = useCallback((base64Audio: string, onStartSpeaking: () => void, onStopSpeaking: () => void) => {
    if (!audioContextOutRef.current) return;

    audioProcessingChain.current = audioProcessingChain.current.then(async () => {
        if (!audioContextOutRef.current) return;
        const buffer = await decodeAudioData(decode(base64Audio), audioContextOutRef.current, CONFIG.SAMPLE_RATE_OUT, 1);
        
        const ctx = audioContextOutRef.current;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        const now = ctx.currentTime;
        let start = nextStartTimeRef.current;
        if (start < now) start = now + 0.02;

        source.start(start);
        nextStartTimeRef.current = start + buffer.duration;
        
        sourcesRef.current.add(source);
        onStartSpeaking();

        source.onended = () => {
            sourcesRef.current.delete(source);
            if (sourcesRef.current.size === 0) onStopSpeaking();
        };
    }).catch(e => console.error("Audio Decode Error:", e));
  }, []);

  const stopAudio = useCallback(() => {
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
    sourcesRef.current.clear();
    audioProcessingChain.current = Promise.resolve();
    nextStartTimeRef.current = 0;
    
    if (workletNodeRef.current) {
        workletNodeRef.current.port.onmessage = null; // Important: Stop receiving data immediately
        try { workletNodeRef.current.disconnect(); } catch(e) {}
        workletNodeRef.current = null;
    }
    
    if (externalSourceRef.current) {
        try { externalSourceRef.current.disconnect(); } catch(e) {}
        externalSourceRef.current = null;
    }
    
    // We do NOT stop micStreamRef here to keep permissions alive, but we could if we wanted full shutdown.
    // keeping it allows fast restart.
  }, []);

  const unlockContexts = useCallback(() => {
    if (audioContextInRef.current?.state === 'suspended') audioContextInRef.current.resume().catch(() => {});
    if (audioContextOutRef.current?.state === 'suspended') audioContextOutRef.current.resume().catch(() => {});
  }, []);

  useEffect(() => {
      window.addEventListener('pointerdown', unlockContexts);
      window.addEventListener('keydown', unlockContexts);
      return () => {
          window.removeEventListener('pointerdown', unlockContexts);
          window.removeEventListener('keydown', unlockContexts);
      }
  }, [unlockContexts]);

  return { startRecording, queueAudio, stopAudio, mixStream };
};
