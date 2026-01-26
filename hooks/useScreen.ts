
import { useRef, useCallback, useEffect, useState } from 'react';
import { CONFIG } from '../utils/constants';

export const useScreen = (sendInput: (data: any) => void) => {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const screenStreamRef = useRef<MediaStream | null>(null);
  const previousFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  const stopScreenSharing = useCallback(() => {
    setIsScreenSharing(false);
    if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
    }
    screenStreamRef.current = null;
    setScreenStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    previousFrameDataRef.current = null;
  }, []);

  const startScreenSharing = useCallback(async () => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { 
                cursor: "always", 
                displaySurface: "monitor",
                width: { ideal: 1920, max: 3840 }, 
                height: { ideal: 1080, max: 2160 },
                frameRate: { ideal: CONFIG.FRAME_RATE }
            } as any, 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            } 
        });
        screenStreamRef.current = stream;
        setScreenStream(stream); 
        
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
        }

        stream.getVideoTracks()[0].onended = stopScreenSharing;
        setIsScreenSharing(true);
    } catch (e) {
        console.error("Screen Share Error:", e);
        stopScreenSharing();
    }
  }, [stopScreenSharing]);

  useEffect(() => {
    let intervalId: any;
    if (isScreenSharing) {
        // Reduzido para 30fps no processamento para economizar CPU enquanto captura a 60
        // O envio real só ocorre se houver mudanças.
        const PROCESSING_FPS = 10; 
        
        intervalId = setInterval(() => {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video && canvas && video.readyState >= 2) {
                const vw = video.videoWidth;
                const vh = video.videoHeight;
                
                let targetW = vw;
                let targetH = vh;
                
                // Redimensionamento Inteligente
                if (vw > CONFIG.VISUAL_MAX_DIMENSION || vh > CONFIG.VISUAL_MAX_DIMENSION) {
                     const ratio = vw / vh;
                     if (ratio > 1) {
                         targetW = CONFIG.VISUAL_MAX_DIMENSION;
                         targetH = targetW / ratio;
                     } else {
                         targetH = CONFIG.VISUAL_MAX_DIMENSION;
                         targetW = targetH * ratio;
                     }
                }

                if (canvas.width !== targetW || canvas.height !== targetH) {
                    canvas.width = targetW;
                    canvas.height = targetH;
                    previousFrameDataRef.current = null;
                }

                const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
                if (ctx) {
                    ctx.drawImage(video, 0, 0, targetW, targetH);
                    const imageData = ctx.getImageData(0, 0, targetW, targetH);
                    const currentData = imageData.data;
                    const now = Date.now();

                    let hasChange = false;
                    
                    if (!previousFrameDataRef.current) {
                        hasChange = true;
                    } else if (now - lastFrameTimeRef.current > 3000) {
                        hasChange = true; // Heartbeat a cada 3s
                    } else {
                        // OTIMIZAÇÃO PARA CÓDIGO:
                        // Aumentamos a precisão (sampleStep menor) e diminuímos o threshold
                        // para detectar pequenas mudanças de texto ou cursor.
                        let diffCount = 0;
                        const threshold = 15; // Mais sensível (era 35)
                        const totalPixels = currentData.length;
                        const sampleStep = 32; // Checa 1 a cada 32 pixels (era 64)
                        
                        for (let i = 0; i < totalPixels; i += sampleStep) {
                            // Compara apenas Canal Verde (G) para velocidade (o olho humano e código costumam ter bom contraste no verde)
                            // ou compare a soma média se preferir, mas absoluto no array direto é mais rápido.
                            if (Math.abs(currentData[i] - previousFrameDataRef.current[i]) > threshold) {
                                diffCount++;
                            }
                        }
                        
                        // Se 1% dos pixels mudaram (mais sensível)
                        if (diffCount > (totalPixels / sampleStep) * 0.01) {
                            hasChange = true;
                        }
                    }

                    if (hasChange) {
                        const base64 = canvas.toDataURL('image/jpeg', CONFIG.JPEG_QUALITY).split(',')[1];
                        sendInput({ media: { data: base64, mimeType: 'image/jpeg' } });
                        previousFrameDataRef.current = new Uint8ClampedArray(currentData);
                        lastFrameTimeRef.current = now;
                    }
                }
            }
        }, 1000 / PROCESSING_FPS);
    }
    return () => clearInterval(intervalId);
  }, [isScreenSharing, sendInput]);

  return { isScreenSharing, screenStream, startScreenSharing, stopScreenSharing, videoRef, canvasRef };
};
