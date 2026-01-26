
import React from 'react';
import { Transcription } from '../types';

interface TranscriptionListProps {
  messages: Transcription[];
}

const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-white/5 bg-black/40 shadow-xl group/code">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{language || 'code'}</span>
        <button onClick={handleCopy} className="text-[9px] font-black uppercase text-cyan-500">{copied ? 'Ok' : 'Copy'}</button>
      </div>
      <pre className="p-4 overflow-x-auto custom-scrollbar">
        <code className="text-[12px] mono-text text-slate-300 leading-relaxed">{code}</code>
      </pre>
    </div>
  );
};

const FileCard: React.FC<{ file: { name: string; url?: string; type: string }; isAssistant: boolean }> = ({ file, isAssistant }) => {
    return (
        <div className={`mt-2 p-3 rounded-xl border flex items-center gap-3 ${isAssistant ? 'bg-cyan-900/20 border-cyan-500/30' : 'bg-slate-800/50 border-white/10'}`}>
            <div className={`p-2 rounded-lg ${isAssistant ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-300'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{file.name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{file.type}</p>
            </div>
            {file.url && (
                <a href={file.url} download={file.name} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold uppercase rounded-lg transition-colors">
                    Baixar
                </a>
            )}
        </div>
    )
}

const FormattedText: React.FC<{ text: string; isAssistant: boolean }> = ({ text, isAssistant }) => {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-4">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
          return <CodeBlock key={i} code={(match?.[2] || part.replace(/```/g, '')).trim()} language={match?.[1] || ''} />;
        }
        return (
          <p key={i} className={`text-sm leading-relaxed ${isAssistant ? 'text-cyan-50/90 italic' : 'text-slate-300'}`}>
            {part.split(/(\*\*.*?\*\*)/g).map((chunk, ci) => {
              if (chunk.startsWith('**')) return <strong key={ci} className="text-white font-bold">{chunk.slice(2,-2)}</strong>;
              return chunk;
            })}
          </p>
        );
      })}
    </div>
  );
};

const TranscriptionList: React.FC<TranscriptionListProps> = ({ messages }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  return (
    <div ref={scrollRef} className="flex flex-col gap-6 overflow-y-auto h-full p-4 lg:p-8 custom-scrollbar scroll-smooth">
      {messages.length === 0 && (
        <div className="h-full flex items-center justify-center opacity-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.5em]">Standby</p>
        </div>
      )}
      {messages.map((msg) => (
        <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
          <span className={`text-[8px] font-black uppercase tracking-widest mb-2 ${msg.role === 'user' ? 'text-cyan-500' : 'text-slate-500'}`}>
            {msg.role === 'user' ? 'Operador' : 'Nova'}
          </span>
          <div className={`max-w-[90%] px-5 py-4 rounded-2xl shadow-lg ${msg.role === 'user' ? 'bg-cyan-500/10 border border-cyan-500/10 rounded-tr-none' : 'bg-slate-900/80 border border-white/5 rounded-tl-none'}`}>
            <FormattedText text={msg.text} isAssistant={msg.role === 'assistant'} />
            {msg.fileAttachment && <FileCard file={msg.fileAttachment} isAssistant={msg.role === 'assistant'} />}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TranscriptionList;
