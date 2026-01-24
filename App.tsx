
import React, { useState } from 'react';
import { useGemini } from './hooks/useGemini';
import { ConnectionStatus } from './types';
import { Header } from './components/Header';
import VoiceOrb from './components/VoiceOrb';
import TranscriptionList from './components/TranscriptionList';

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
    sendText
  } = useGemini();

  const [textCommand, setTextCommand] = useState('');

  const handleToggleConnection = () => {
      if (status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING) {
          disconnect();
      } else {
          connect();
      }
  };

  const handleSendText = () => {
      if (textCommand.trim()) {
          sendText(textCommand);
          setTextCommand('');
      }
  };

  const clearChat = () => {
      setMessages([]);
      localStorage.removeItem('nova_chat_history');
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#020617] text-[#f8fafc] overflow-hidden neural-bg font-sans select-none">
      <video ref={videoRef} playsInline muted autoPlay className="fixed opacity-0 pointer-events-none w-1 h-1 top-0 left-0" />

      <Header 
        status={status} 
        isMuted={isMuted} 
        onToggleMute={() => setIsMuted(!isMuted)} 
        onToggleConnection={handleToggleConnection} 
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden">
        
        {/* Esquerda: Chat */}
        <div className="lg:col-span-5 flex flex-col glass-card rounded-[2rem] border border-white/5 overflow-hidden order-2 lg:order-1 h-full">
          <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Terminal Neural</span>
            <button onClick={clearChat} className="text-[10px] font-bold text-slate-600 hover:text-red-400 uppercase transition-colors" title="Limpar Histórico">Limpar</button>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <TranscriptionList messages={messages} />
          </div>
          <div className="p-4 bg-slate-900/50 border-t border-white/10">
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={textCommand} 
                onChange={(e) => setTextCommand(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleSendText()} 
                placeholder="Enviar comando de texto..." 
                className="flex-1 bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-xs outline-none focus:border-cyan-500/50 transition-all text-white placeholder-slate-600"
              />
              <button onClick={handleSendText} className="p-3 rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-900/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Direita: Visual + Tela */}
        <div className="lg:col-span-7 flex flex-col gap-6 order-1 lg:order-2 h-full overflow-hidden">
          
          {/* Orb */}
          <div className="flex-[0.4] glass-card rounded-[2rem] border border-white/5 relative overflow-hidden flex items-center justify-center bg-gradient-to-b from-slate-900/50 to-transparent">
             <div className="absolute top-4 left-6 text-[9px] font-black tracking-[0.5em] text-slate-500 uppercase z-10">Núcleo</div>
             <VoiceOrb 
                isSpeaking={isSpeaking} 
                isUserSpeaking={isUserSpeaking} 
                isThinking={isThinking} 
                isConnecting={status === ConnectionStatus.CONNECTING} 
                isMuted={isMuted}
                status={status} 
                inputLevel={inputLevel} 
             />
          </div>

          {/* Tela */}
          <div className="flex-[0.6] glass-card rounded-[2rem] border border-white/5 relative overflow-hidden group flex flex-col">
            <div className="px-6 py-4 flex items-center justify-between z-20">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${isScreenSharing ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`}></div>
                  <span className="text-[9px] font-black tracking-[0.5em] text-slate-500 uppercase">Sensores</span>
                </div>
              </div>

              <button 
                onClick={isScreenSharing ? stopScreenSharing : startScreenSharing}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all ${
                  isScreenSharing 
                  ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' 
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20'
                }`}
              >
                {isScreenSharing ? 'Parar Visão' : 'Ativar Visão'}
              </button>
            </div>

            <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
              {isScreenSharing && (
                <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
                   <div className="w-full h-full bg-[linear-gradient(rgba(6,182,212,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                </div>
              )}
              
              {isScreenSharing ? (
                <canvas ref={canvasRef} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/10" />
              ) : (
                <div className="flex flex-col items-center gap-4 opacity-30">
                  <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-500 flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">Aguardando Sinal de Vídeo</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`.neural-bg { background: radial-gradient(circle at center, #020617 0%, #000 100%); }`}</style>
    </div>
  );
};

export default App;
