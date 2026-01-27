
import React from 'react';
import { Transcription } from '../types';
import { formatFileSize } from '../utils/file-helpers';

interface TranscriptionListProps {
  messages: Transcription[];
  isThinking: boolean;
}

const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-cyan-500/20 bg-[#0B1221] shadow-2xl group/code relative">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5 backdrop-blur-sm select-none">
        <div className="flex items-center gap-2">
           <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
           <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
           <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
           <span className="ml-2 text-[10px] font-mono text-slate-400 lowercase">{language || 'plaintext'}</span>
        </div>
        <button onClick={handleCopy} className="text-[10px] font-bold uppercase tracking-wider text-cyan-500 hover:text-cyan-300 transition-colors">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="relative">
        <pre className="p-4 overflow-x-auto custom-scrollbar">
          <code className="text-[13px] font-mono text-slate-300 leading-relaxed block min-w-full select-text cursor-text">
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
};

// Helper para obter ícones baseados no MIME type
const getFileIcon = (type: string) => {
    if (type.includes('image')) return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
    );
    if (type.includes('pdf')) return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
    );
    if (type.includes('text') || type.includes('code') || type.includes('script')) return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>
    );
    return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
    );
};

const FileCard: React.FC<{ file: NonNullable<Transcription['fileAttachment']>; isAssistant: boolean }> = ({ file, isAssistant }) => {
    const isImage = file.type.startsWith('image/');

    return (
        <div className={`mt-3 rounded-xl border overflow-hidden transition-all group/file ${isAssistant ? 'bg-cyan-950/20 border-cyan-500/30' : 'bg-slate-800/60 border-white/10'}`}>
            {isImage && file.url ? (
                 <div className="relative h-48 w-full bg-[#020617]/50 border-b border-white/5 group-hover/file:border-cyan-500/20 transition-colors">
                    <img src={file.url} alt={file.name} className="w-full h-full object-contain p-2 opacity-90 group-hover/file:opacity-100 transition-all duration-300" />
                    
                    {/* Overlay de Ação */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/file:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                         <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-white/10 hover:bg-cyan-500 text-white border border-white/20 transition-all transform hover:scale-110" title="Visualizar">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                         </a>
                         <a href={file.url} download={file.name} className="p-2.5 rounded-full bg-white/10 hover:bg-emerald-500 text-white border border-white/20 transition-all transform hover:scale-110" title="Baixar">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                         </a>
                    </div>
                 </div>
            ) : null}

            <div className="p-4 flex items-center gap-4">
                <div className={`
                    w-12 h-12 rounded-xl shrink-0 flex items-center justify-center border
                    shadow-[0_0_15px_rgba(0,0,0,0.2)]
                    ${isAssistant ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-slate-700/50 text-indigo-400 border-white/10'}
                `}>
                    {getFileIcon(file.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate group-hover/file:text-cyan-200 transition-colors" title={file.name}>{file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold bg-white/5 px-1.5 py-0.5 rounded">{file.type.split('/')[1] || 'FILE'}</span>
                        {file.size && (
                            <>
                            <span className="text-[10px] text-slate-600">•</span>
                            <span className="text-[10px] text-slate-400 font-mono">{formatFileSize(file.size)}</span>
                            </>
                        )}
                    </div>
                </div>

                {file.url && !isImage && (
                    <a href={file.url} download={file.name} className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 border border-transparent hover:border-emerald-500/30 transition-all shrink-0" title="Baixar Arquivo">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 12.75l-3.25-3.25m0 0l-3.25 3.25M12 12.75V3" /></svg>
                    </a>
                )}
            </div>
        </div>
    )
}

const FormattedText: React.FC<{ text: string; isAssistant: boolean }> = ({ text, isAssistant }) => {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-3 select-text cursor-text">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
          return <CodeBlock key={i} code={(match?.[2] || part.replace(/```/g, '')).trim()} language={match?.[1] || ''} />;
        }
        return (
          <p key={i} className={`text-[13px] leading-6 whitespace-pre-wrap ${isAssistant ? 'text-slate-200' : 'text-slate-100'}`}>
            {part.split(/(\*\*.*?\*\*)/g).map((chunk, ci) => {
              if (chunk.startsWith('**')) return <strong key={ci} className={`${isAssistant ? 'text-cyan-200' : 'text-white'} font-bold`}>{chunk.slice(2,-2)}</strong>;
              return chunk;
            })}
          </p>
        );
      })}
    </div>
  );
};

const Avatar: React.FC<{ role: string }> = ({ role }) => (
  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border select-none ${
    role === 'user' 
    ? 'bg-slate-800 border-white/10' 
    : 'bg-gradient-to-tr from-cyan-600 to-blue-600 border-cyan-400/30 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
  }`}>
    {role === 'user' ? (
      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    ) : (
      <svg className="w-4 h-4 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    )}
  </div>
);

const TypingIndicator: React.FC = () => (
  <div className="flex gap-1 p-2">
    <div className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-[bounce_1s_infinite_0ms]"></div>
    <div className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-[bounce_1s_infinite_200ms]"></div>
    <div className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-[bounce_1s_infinite_400ms]"></div>
  </div>
);

const TranscriptionList: React.FC<TranscriptionListProps> = ({ messages, isThinking }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  return (
    <div className="flex flex-col h-full bg-[#020617]/50">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar scroll-smooth space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-40 select-none pointer-events-none">
            <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center mb-4">
               <div className="w-12 h-12 rounded-full bg-white/5"></div>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500">Sistema Neural Pronto</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div 
            key={msg.id} 
            className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end group animate-in slide-in-from-bottom-4 fade-in duration-500`}
          >
            <Avatar role={msg.role} />
            
            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1 px-1 select-none">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{msg.role === 'user' ? 'Você' : 'Nova Pro'}</span>
                    <span className="text-[9px] text-slate-700">{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>

                <div className={`
                    relative px-5 py-3.5 rounded-2xl shadow-lg border backdrop-blur-sm
                    ${msg.role === 'user' 
                        ? 'bg-gradient-to-br from-cyan-600/20 to-blue-600/20 border-cyan-500/20 rounded-br-none text-slate-100' 
                        : 'bg-slate-900/60 border-white/10 rounded-bl-none text-slate-200'
                    }
                `}>
                    <FormattedText text={msg.text} isAssistant={msg.role === 'assistant'} />
                    {msg.fileAttachment && <FileCard file={msg.fileAttachment} isAssistant={msg.role === 'assistant'} />}
                </div>
            </div>
          </div>
        ))}

        {isThinking && (
             <div className="flex gap-4 flex-row items-end animate-in fade-in duration-300">
                <Avatar role="assistant" />
                <div className="bg-slate-900/40 border border-white/5 rounded-2xl rounded-bl-none px-4 py-3">
                   <TypingIndicator />
                </div>
             </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptionList;
