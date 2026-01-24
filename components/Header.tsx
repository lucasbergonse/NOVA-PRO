
import React from 'react';
import { ConnectionStatus } from '../types';

interface HeaderProps {
    status: ConnectionStatus;
    isMuted: boolean;
    onToggleMute: () => void;
    onToggleConnection: () => void;
}

export const Header: React.FC<HeaderProps> = ({ status, isMuted, onToggleMute, onToggleConnection }) => {
  return (
      <header className="flex items-center justify-between px-6 py-4 glass-card border-b border-white/5 z-50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black italic tracking-tighter uppercase text-white">Nova<span className="text-cyan-500 ml-1">Pro</span></span>
            <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${status === ConnectionStatus.CONNECTED ? 'bg-cyan-500 shadow-[0_0_10px_#06b6d4]' : status === ConnectionStatus.CONNECTING ? 'bg-amber-500 animate-bounce' : 'bg-red-500'}`}></div>
          </div>
          
          <button 
            onClick={onToggleMute}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[10px] font-bold tracking-wider uppercase ${
                isMuted 
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 hover:bg-rose-500/30' 
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {isMuted ? 'Mic Off' : 'Mic On'}
          </button>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={onToggleConnection} 
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all border ${
              status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING
              ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20' 
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            {status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING ? 'Desligar Sistema' : 'Iniciar Sistema'}
          </button>
        </div>
      </header>
  );
};
