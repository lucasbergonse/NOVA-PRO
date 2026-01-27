
import React from 'react';
import { ConnectionStatus, Persona, PersonaKey } from '../types';
import { PERSONAS } from '../utils/constants';

interface HeaderProps {
    status: ConnectionStatus;
    isMuted: boolean;
    onToggleMute: () => void;
    onToggleConnection: () => void;
    currentPersona: Persona;
    onPersonaChange: (personaKey: PersonaKey) => void;
}

export const Header: React.FC<HeaderProps> = ({ status, isMuted, onToggleMute, onToggleConnection, currentPersona, onPersonaChange }) => {
  return (
      <header className="flex flex-col md:flex-row items-center justify-between px-6 py-4 glass-card border-b border-white/5 z-50 backdrop-blur-xl shrink-0 gap-4">
        <div className="flex items-center gap-6 w-full md:w-auto justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black italic tracking-tighter uppercase text-white">Nova<span className="text-cyan-500 ml-1">Pro</span></span>
            <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${status === ConnectionStatus.CONNECTED ? 'bg-cyan-500 shadow-[0_0_10px_#06b6d4]' : status === ConnectionStatus.CONNECTING ? 'bg-amber-500 animate-bounce' : 'bg-red-500'}`}></div>
          </div>
          
          <div className="flex items-center gap-2">
              {/* Persona Selector - Compact on Mobile */}
              <div className="relative group">
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/30 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-all">
                      <span className="w-2 h-2 rounded-full bg-cyan-500/50"></span>
                      {currentPersona.name}
                      <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  
                  <div className="absolute top-full left-0 mt-2 w-56 bg-[#0B1221] border border-white/10 rounded-xl shadow-2xl overflow-hidden hidden group-hover:block z-[100]">
                      {Object.values(PERSONAS).map((p) => (
                          <button 
                            key={p.id}
                            onClick={() => onPersonaChange(p.id)}
                            className={`w-full text-left px-4 py-3 text-xs font-bold flex flex-col gap-1 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${currentPersona.id === p.id ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400'}`}
                          >
                              <span className="uppercase tracking-wider">{p.name}</span>
                              <span className="text-[10px] font-normal opacity-70 normal-case text-slate-500">{p.role}</span>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto justify-end">
          <button 
            onClick={onToggleMute}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[10px] font-bold tracking-wider uppercase ${
                isMuted 
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 hover:bg-rose-500/30' 
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {isMuted ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" /></svg>
            ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            )}
          </button>
          
          <button 
            onClick={onToggleConnection} 
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all border ${
              status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING
              ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20' 
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            {status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING ? 'Desconectar' : 'Conectar'}
          </button>
        </div>
      </header>
  );
};
