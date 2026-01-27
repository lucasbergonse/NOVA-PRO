
import React, { useState, useRef, useEffect } from 'react';
import { useGemini } from './hooks/useGemini';
import { ConnectionStatus, PersonaKey } from './types';
import { Header } from './components/Header';
import VoiceOrb from './components/VoiceOrb';
import TranscriptionList from './components/TranscriptionList';
import { ContextSidebar } from './components/ContextSidebar';
import { PERSONAS } from './utils/constants';

const App: React.FC = () => {
  const {
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
    sendFile,
    // Context
    currentContext,
    createNewContext,
    switchContext,
    deleteContext,
    isIncognito,
    toggleIncognito,
    contextsRefreshTrigger
  } = useGemini();

  const [textCommand, setTextCommand] = useState('');
  const [currentPersona, setCurrentPersona] = useState(PERSONAS.GENERAL);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-reconnect if persona changes while connected
  const handlePersonaChange = (key: PersonaKey) => {
      const newPersona = Object.values(PERSONAS).find(p => p.id === key) || PERSONAS.GENERAL;
      setCurrentPersona(newPersona);
      
      setMessages(prev => [...prev, {
          id: `sys-persona-${Date.now()}`,
          role: 'system',
          text: `Perfil alterado para: ${newPersona.name} (${newPersona.role}).`,
          timestamp: new Date()
      }]);

      if (status === ConnectionStatus.CONNECTED) {
          disconnect();
          setTimeout(() => {
              connect(newPersona.systemInstruction);
          }, 500);
      }
  };

  const handleToggleConnection = () => {
      if (status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING) {
          disconnect();
      } else {
          connect(currentPersona.systemInstruction);
      }
  };

  const handleCommand = (cmd: string, args: string[]) => {
      switch(cmd.toLowerCase()) {
          case 'clear':
          case 'limpar':
              setMessages([]);
              break;
          case 'incognito':
          case 'privado':
              toggleIncognito();
              break;
          case 'dev':
          case 'developer':
              handlePersonaChange('developer');
              break;
          case 'fin':
          case 'financeiro':
              handlePersonaChange('finance');
              break;
          case 'jus':
          case 'juridico':
          case 'legal':
              handlePersonaChange('legal');
              break;
          case 'vendas':
          case 'sales':
              handlePersonaChange('sales');
              break;
          case 'mkt':
          case 'criativo':
              handlePersonaChange('creative');
              break;
          case 'pessoal':
          case 'geral':
              handlePersonaChange('general');
              break;
          case 'help':
          case 'ajuda':
              setMessages(prev => [...prev, {
                  id: `sys-help-${Date.now()}`,
                  role: 'system',
                  text: `Comandos:
                  /limpar - Limpar chat
                  /privado - Alternar modo confidencial
                  /dev - Modo Desenvolvedor
                  /fin - Modo Financeiro
                  /jus - Modo Jurídico
                  /vendas - Modo Vendedor
                  /pessoal - Modo Pessoal`,
                  timestamp: new Date()
              }]);
              break;
          default:
             setMessages(prev => [...prev, {
                  id: `sys-err-${Date.now()}`,
                  role: 'system',
                  text: `Comando desconhecido: /${cmd}.`,
                  timestamp: new Date()
             }]);
             break;
      }
  };

  const handleSendText = () => {
      const trimmed = textCommand.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('/')) {
          const parts = trimmed.slice(1).split(' ');
          handleCommand(parts[0].slice(1), parts.slice(1));
      } else {
          sendText(trimmed);
      }
      setTextCommand('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          sendFile(e.target.files[0]);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#020617] text-[#f8fafc] overflow-hidden neural-bg font-sans select-none relative">
      <video ref={videoRef} playsInline muted autoPlay className="fixed opacity-0 pointer-events-none w-1 h-1 top-0 left-0" />

      {/* Sidebar Overlay */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
      
      <ContextSidebar 
        currentContextId={currentContext?.id || ''}
        onSelectContext={(ctx) => { switchContext(ctx); setIsSidebarOpen(false); }}
        onNewContext={() => { createNewContext(currentPersona.id); setIsSidebarOpen(false); }}
        onDeleteContext={deleteContext}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        triggerRefresh={contextsRefreshTrigger}
      />

      {/* Main Content */}
      <div className={`flex flex-col h-full transition-all duration-300 ${isSidebarOpen ? 'lg:pl-72' : ''}`}>
          
          {/* Custom Header Wrapper to include Sidebar Toggle */}
          <div className="flex items-center gap-2 pl-4 pt-2 md:pt-0">
             <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 mt-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-all z-40"
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
             </button>
             <div className="flex-1">
                <Header 
                    status={status} 
                    isMuted={isMuted} 
                    onToggleMute={() => setIsMuted(!isMuted)} 
                    onToggleConnection={handleToggleConnection}
                    currentPersona={currentPersona}
                    onPersonaChange={handlePersonaChange}
                />
             </div>
          </div>

          {/* Privacy Banner */}
          {isIncognito && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 py-1 px-4 text-center">
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Modo Confidencial Ativo • Histórico não será salvo</p>
              </div>
          )}

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-6 overflow-hidden">
            
            {/* Chat */}
            <div className="lg:col-span-5 flex flex-col glass-card rounded-[2rem] border border-white/5 overflow-hidden order-2 lg:order-1 h-full shadow-2xl">
              <div className="px-6 py-4 border-b border-white/5 bg-[#0B1221]/80 backdrop-blur-md flex justify-between items-center z-10">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Terminal Neural</span>
                    <span className="text-[9px] text-cyan-500/60 truncate max-w-[150px]">{currentContext?.title || 'Contexto Temporário'}</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={toggleIncognito} className={`text-[10px] font-bold uppercase transition-colors ${isIncognito ? 'text-amber-500' : 'text-slate-600 hover:text-slate-400'}`} title="Modo Confidencial">
                        {isIncognito ? 'Privado ON' : 'Privado OFF'}
                    </button>
                    <button onClick={() => setMessages([])} className="text-[10px] font-bold text-slate-500 hover:text-cyan-400 uppercase transition-colors">Limpar</button>
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden relative bg-[#020617]/50">
                <TranscriptionList messages={messages} isThinking={isThinking} />
              </div>
              
              <div className="p-4 bg-[#0B1221] border-t border-white/5">
                <div className="flex items-center gap-3">
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="p-3.5 rounded-xl bg-slate-800/50 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-all border border-white/5 hover:border-cyan-500/30">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </button>

                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      value={textCommand} 
                      onChange={(e) => setTextCommand(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && handleSendText()} 
                      placeholder={textCommand.startsWith('/') ? "Comando..." : `Falar com ${currentPersona.name}...`}
                      className={`w-full bg-slate-900/50 border border-white/10 rounded-xl py-3.5 pl-4 pr-10 text-sm outline-none focus:bg-slate-900 focus:ring-1 transition-all text-white font-medium ${textCommand.startsWith('/') ? 'text-amber-400 focus:border-amber-500/50' : 'placeholder-slate-600 focus:border-cyan-500/50'}`}
                    />
                  </div>
                  
                  <button onClick={handleSendText} disabled={!textCommand.trim()} className="p-3.5 rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:shadow-none">
                    <svg className="w-5 h-5 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Visual Panel */}
            <div className="lg:col-span-7 flex flex-col gap-6 order-1 lg:order-2 h-full overflow-hidden">
              <div className="flex-[0.4] glass-card rounded-[2rem] border border-white/5 relative overflow-hidden flex items-center justify-center bg-gradient-to-b from-[#0B1221] to-transparent shadow-2xl">
                 <VoiceOrb isSpeaking={isSpeaking} isUserSpeaking={isUserSpeaking} isThinking={isThinking} isConnecting={status === ConnectionStatus.CONNECTING} isMuted={isMuted} status={status} inputLevel={inputLevel} />
              </div>

              <div className="flex-[0.6] glass-card rounded-[2rem] border border-white/5 relative overflow-hidden group flex flex-col shadow-2xl bg-[#020617]/40">
                <div className="px-8 py-5 flex items-center justify-between z-20 absolute top-0 left-0 w-full bg-gradient-to-b from-black/80 to-transparent">
                  <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isScreenSharing ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`}></div>
                      <span className="text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase">Córtex Visual</span>
                  </div>
                  <button onClick={isScreenSharing ? stopScreenSharing : startScreenSharing} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all backdrop-blur-md ${isScreenSharing ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'}`}>
                    {isScreenSharing ? 'Desconectar' : 'Conectar'}
                  </button>
                </div>

                <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                  {isScreenSharing ? (
                    <canvas ref={canvasRef} className="max-w-full max-h-full object-contain shadow-2xl" />
                  ) : (
                    <div className="flex flex-col items-center gap-6 opacity-20">
                      <div className="w-24 h-24 rounded-3xl border-2 border-dashed border-slate-500 flex items-center justify-center animate-[pulse_4s_ease-in-out_infinite]">
                        <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </div>
                      <span className="text-xs font-bold tracking-[0.2em] uppercase text-slate-400">Sinal de Vídeo Ausente</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default App;
