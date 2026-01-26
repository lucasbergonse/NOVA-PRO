
import React, { useMemo } from 'react';
import { ConnectionStatus } from '../types';

interface VoiceOrbProps {
  isSpeaking: boolean;
  isUserSpeaking: boolean;
  isThinking: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  status: ConnectionStatus;
  inputLevel: number;
}

const VoiceOrb: React.FC<VoiceOrbProps> = ({ isSpeaking, isUserSpeaking, isThinking, isConnecting, isMuted, status, inputLevel }) => {
  const theme = useMemo(() => {
    if (status === ConnectionStatus.ERROR || status === ConnectionStatus.DISCONNECTED) return { color: 'red', label: 'OFFLINE' };
    if (isConnecting) return { color: 'amber', label: 'SINCRONIZANDO' };
    if (isMuted) return { color: 'rose', label: 'MICROFONE OFF' };
    if (isThinking) return { color: 'indigo', label: 'PROCESSANDO' };
    if (isSpeaking) return { color: 'cyan', label: 'EMISSÃO NEURAL' };
    if (isUserSpeaking) return { color: 'emerald', label: 'MODO ESCUTA' };
    return { color: 'slate', label: 'AGUARDANDO' };
  }, [isConnecting, isThinking, isSpeaking, isUserSpeaking, isMuted, status]);

  const colorMap: Record<string, string> = {
    amber: 'from-amber-400 via-orange-500 to-amber-600',
    indigo: 'from-indigo-500 via-purple-500 to-violet-600',
    cyan: 'from-cyan-400 via-sky-500 to-blue-600',
    emerald: 'from-emerald-400 via-teal-500 to-cyan-500',
    slate: 'from-slate-700 to-slate-900',
    rose: 'from-rose-500 via-red-600 to-rose-900',
    red: 'from-red-900 to-slate-950',
  };

  const glowMap: Record<string, string> = {
    amber: 'shadow-amber-500/40',
    indigo: 'shadow-indigo-500/40',
    cyan: 'shadow-cyan-500/40',
    emerald: 'shadow-emerald-500/40',
    slate: 'shadow-transparent',
    rose: 'shadow-rose-500/20',
    red: 'shadow-none',
  };

  // Safety checks for NaN or Infinity
  const safeInputLevel = isNaN(inputLevel) || !isFinite(inputLevel) ? 0 : inputLevel;
  
  const pulseScale = 1 + (isUserSpeaking && !isMuted ? safeInputLevel * 1.5 : isSpeaking ? 0.15 : isThinking ? 0.05 : 0);
  const opacity = isUserSpeaking ? 0.8 : isSpeaking ? 0.9 : 0.4;

  return (
    <div className="relative flex flex-col items-center justify-center transition-all duration-500 h-full w-full">
      <div className={`
        absolute w-[40rem] h-[40rem] rounded-full blur-[100px] transition-all duration-1000
        ${isMuted ? 'bg-rose-900/5' : isUserSpeaking ? 'bg-emerald-500/10' : isSpeaking ? 'bg-cyan-500/10' : isThinking ? 'bg-indigo-500/10' : 'bg-transparent'}
      `}></div>

      <div className="relative w-96 h-96 flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="absolute w-full h-full transform transition-transform duration-100" style={{ transform: `scale(${Math.min(pulseScale, 3)})` }}>
          <defs>
            <linearGradient id="orbGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className={`${theme.color === 'emerald' ? 'text-emerald-400' : theme.color === 'rose' ? 'text-rose-500' : 'text-cyan-400'}`} style={{ stopColor: 'currentColor' }} />
              <stop offset="100%" className={`${theme.color === 'emerald' ? 'text-teal-600' : theme.color === 'rose' ? 'text-red-800' : 'text-blue-600'}`} style={{ stopColor: 'currentColor' }} />
            </linearGradient>
          </defs>
          
          <circle 
            cx="100" cy="100" r="80" 
            fill="none" stroke="url(#orbGradient)" 
            strokeWidth="0.5" strokeDasharray="4 8"
            className={`opacity-20 transition-all duration-1000 ${isThinking ? 'animate-[spin_10s_linear_infinite]' : 'animate-[spin_30s_linear_infinite]'}`}
          />
          
          {!isMuted && (
            <path 
                d="M100,40 Q130,40 160,100 Q130,160 100,160 Q70,160 40,100 Q70,40 100,40"
                fill="url(#orbGradient)"
                className={`transition-all duration-300 transform-gpu ${isThinking ? 'animate-[pulse_1s_ease-in-out_infinite]' : 'animate-[pulse_4s_ease-in-out_infinite]'}`}
                style={{ 
                opacity: opacity * 0.30,
                transform: `rotate(${isThinking ? Date.now()/10 : 0}deg) scale(${1 + safeInputLevel})`
                }}
            />
          )}

          <circle 
            cx="100" cy="100" r={isMuted ? 30 : 40 + (safeInputLevel * 40)} 
            fill="url(#orbGradient)" 
            className="transition-all duration-300 transform-gpu"
            style={{ opacity: isMuted ? 0.2 : opacity * 0.4 }}
          />
        </svg>

        <div className={`
          relative w-32 h-32 rounded-full z-10
          bg-gradient-to-tr ${colorMap[theme.color]} 
          ${glowMap[theme.color]}
          shadow-[0_0_40px_rgba(0,0,0,0.4)]
          transition-all duration-500 ease-out transform-gpu
          flex items-center justify-center
        `}
        style={{ transform: `scale(${isUserSpeaking && !isMuted ? 1.1 + safeInputLevel : isThinking ? 1.05 : 1})` }}>
          
          <div className="w-[98%] h-[98%] rounded-full bg-[#020617] flex items-center justify-center overflow-hidden relative">
             <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
             
             {isMuted && (
                <svg className="w-8 h-8 text-rose-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
             )}

             {isThinking && !isMuted && (
               <div className="absolute inset-0 animate-spin">
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full border-t-2 border-indigo-500/60 rounded-full blur-[2px]"></div>
               </div>
             )}

             {!isMuted && (
                <div className="flex gap-1 items-end h-6">
                    {[...Array(5)].map((_, i) => (
                    <div 
                        key={i} 
                        className={`w-1.5 rounded-full transition-all duration-100 ${theme.color === 'indigo' ? 'bg-indigo-400' : 'bg-white/40'}`}
                        style={{ 
                        height: (isSpeaking || isUserSpeaking) 
                            ? `${20 + (Math.random() * 80)}%` 
                            : isThinking 
                            ? `${30 + (Math.sin(Date.now()/100 + i) * 20)}%` 
                            : '4px' 
                        }}
                    ></div>
                    ))}
                </div>
             )}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center space-y-4">
        <div className={`
          px-8 py-2.5 rounded-full border text-[10px] font-black tracking-[0.4em] uppercase 
          transition-all duration-700 glass-card backdrop-blur-md
          ${isMuted ? 'text-rose-400 border-rose-500/30' :
            isSpeaking ? 'text-cyan-400 border-cyan-500/30' : 
            isThinking ? 'text-indigo-400 border-indigo-500/30' :
            isUserSpeaking ? 'text-emerald-400 border-emerald-500/30' : 
            'text-slate-600 border-white/5'}
        `}>
          {theme.label}
        </div>
      </div>
    </div>
  );
};

export default VoiceOrb;
