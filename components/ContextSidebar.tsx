
import React, { useEffect, useState } from 'react';
import { ChatContext } from '../types';
import { memoryDB } from '../utils/memory-db';

interface ContextSidebarProps {
  currentContextId: string;
  onSelectContext: (context: ChatContext) => void;
  onNewContext: () => void;
  onDeleteContext: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  triggerRefresh: number; // Trigger to reload list
}

export const ContextSidebar: React.FC<ContextSidebarProps> = ({ 
  currentContextId, 
  onSelectContext, 
  onNewContext, 
  onDeleteContext,
  isOpen, 
  onClose,
  triggerRefresh
}) => {
  const [contexts, setContexts] = useState<ChatContext[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await memoryDB.getContexts();
        setContexts(list);
      } catch (e) {
        console.error("Failed to load contexts", e);
      }
    };
    load();
  }, [triggerRefresh]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 left-0 w-72 bg-[#0B1221]/95 backdrop-blur-xl border-r border-white/10 z-[60] transform transition-transform duration-300 flex flex-col shadow-2xl">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Memória Neural</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="p-4">
        <button 
          onClick={onNewContext}
          className="w-full py-3 rounded-xl border border-dashed border-white/20 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          Novo Contexto
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar space-y-2">
        {contexts.length === 0 && (
            <div className="text-center mt-10 opacity-30">
                <p className="text-[10px] uppercase">Nenhuma memória salva</p>
            </div>
        )}

        {contexts.map(ctx => (
          <div 
            key={ctx.id} 
            className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
              currentContextId === ctx.id 
                ? 'bg-cyan-500/10 border-cyan-500/30' 
                : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
            }`}
            onClick={() => onSelectContext(ctx)}
          >
            <div className="flex justify-between items-start mb-1">
               <h3 className={`text-sm font-bold truncate ${currentContextId === ctx.id ? 'text-white' : 'text-slate-300'}`}>
                 {ctx.title || 'Sem Título'}
               </h3>
               <button 
                 onClick={(e) => { e.stopPropagation(); onDeleteContext(ctx.id); }}
                 className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-opacity"
               >
                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
               </button>
            </div>
            
            <p className="text-[10px] text-slate-500 font-mono mb-2">
               {new Date(ctx.lastModified).toLocaleDateString()}
            </p>
            
            {ctx.preview && (
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {ctx.preview}
              </p>
            )}
            
            <div className="mt-2 flex items-center gap-2">
               <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/30 text-cyan-500/70 border border-white/5 uppercase">
                 {ctx.personaId}
               </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
