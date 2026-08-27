'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Search, SlidersHorizontal, MapPin, Navigation, Bus, Route, Heart } from 'lucide-react';

const RealMap = dynamic(() => import('./components/RealMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-200 text-purple-900 font-semibold">
      Carregando Mapa...
    </div>
  )
});

export default function AppHome() {
  const [isSaved, setIsSaved] = useState(false);
  const [recenterCount, setRecenterCount] = useState(0);

  const handleLocationClick = () => {
    // Força a atualização do GPS e o voo do mapa
    setRecenterCount(prev => prev + 1);
  };

  const currentBus = {
    number: "Selecione uma linha",
    direction: "Aguardando busca...",
    stop: "Toque em buscar para ver paradas",
    time: "-- min",
    operator: "Grande Recife Consórcio"
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-slate-100 font-sans relative overflow-hidden shadow-2xl touch-none">
      
      {/* 1. CABEÇALHO COM BUSCA */}
      <header className="bg-gradient-to-r from-purple-800 to-indigo-900 p-4 pt-6 text-white rounded-b-2xl shadow-lg z-20 shrink-0">
        <div className="flex items-center bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/20">
          <SlidersHorizontal className="w-5 h-5 text-purple-200 mr-2 cursor-pointer" />
          <input 
            type="text" 
            placeholder="Buscar Linha ou Destino" 
            className="bg-transparent w-full text-sm text-white placeholder-purple-200 focus:outline-none"
          />
          <Search className="w-5 h-5 text-purple-200 cursor-pointer" />
        </div>
      </header>

      {/* 2. ÁREA DO MAPA REAL */}
      <main className="flex-1 relative w-full overflow-hidden">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-1 rounded-full shadow-md z-10 border border-slate-200">
          <span className="text-xs font-semibold text-slate-700">GPS Ativo</span>
        </div>

        {/* Mapa Real Limpo sem linhas estáticas */}
        <RealMap triggerRecenter={recenterCount} />

        {/* 3. CARD FLUTUANTE DE INFORMAÇÕES */}
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-xl border border-slate-100 z-10">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Painel de Monitoramento</span>
          
          <div className="flex items-baseline justify-between mt-0.5">
            <h2 className="text-xl font-bold text-purple-900">
              {currentBus.number}
            </h2>
            <span className="text-xs font-semibold text-slate-600">
              {currentBus.direction}
            </span>
          </div>

          <p className="text-xs text-slate-600 mt-0.5">{currentBus.stop}</p>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
            <div>
              <span className="text-lg font-extrabold text-slate-900">{currentBus.time}</span>
              <p className="text-[9px] text-slate-400 uppercase font-medium">{currentBus.operator}</p>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setIsSaved(!isSaved)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isSaved 
                    ? 'bg-purple-100 text-purple-800 border border-purple-300' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-purple-700 text-purple-700' : ''}`} />
                {isSaved ? 'Salvo' : 'Salvar Linha'}
              </button>

              <button className="bg-purple-700 hover:bg-purple-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-md transition-all">
                Ver detalhes
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 4. BARRA DE NAVEGAÇÃO INFERIOR */}
      <nav className="bg-purple-800 text-purple-200 flex justify-around py-3 px-2 rounded-t-2xl shadow-lg z-20 shrink-0">
        <button className="flex flex-col items-center gap-1 hover:text-white transition-colors">
          <Route className="w-5 h-5" />
          <span className="text-[10px] font-medium">Rotas</span>
        </button>
        <button className="flex flex-col items-center gap-1 hover:text-white transition-colors">
          <MapPin className="w-5 h-5" />
          <span className="text-[10px] font-medium">Paradas</span>
        </button>
        <button className="flex flex-col items-center gap-1 hover:text-white transition-colors">
          <Bus className="w-5 h-5" />
          <span className="text-[10px] font-medium">Linhas</span>
        </button>
        
        {/* BOTÃO DA MINHA LOCALIZAÇÃO */}
        <button 
          onClick={handleLocationClick}
          className="flex flex-col items-center gap-1 text-white bg-purple-700/50 px-2 py-0.5 rounded-lg active:scale-95 transition-transform"
        >
          <Navigation className="w-5 h-5 text-cyan-300" />
          <span className="text-[10px] font-bold text-cyan-300">Minha localização</span>
        </button>
      </nav>

    </div>
  );
}
