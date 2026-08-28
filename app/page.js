'use client';

import React, { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import SearchHeader from './components/SearchHeader';
import { MapPin, Navigation, Bus, Route, Heart } from 'lucide-react';

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
  const [selectedDestination, setSelectedDestination] = useState(null);

  const handleLocationClick = () => {
    setRecenterCount((prev) => prev + 1);
  };

  const handleSelectDestination = (dest) => {
    setSelectedDestination(dest);
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-slate-100 font-sans relative overflow-hidden shadow-2xl touch-none">
      
      {/* 1. CABEÇALHO COM BUSCA REAL */}
      <header className="bg-gradient-to-r from-purple-800 to-indigo-900 p-4 pt-6 text-white rounded-b-2xl shadow-lg z-20 shrink-0">
        <SearchHeader onSelectDestination={handleSelectDestination} />
      </header>

      {/* 2. ÁREA DO MAPA REAL */}
      <main className="flex-1 relative w-full overflow-hidden">
        <RealMap triggerRecenter={recenterCount} targetDestination={selectedDestination} />

        {/* CARD FLUTUANTE DE INFORMAÇÕES */}
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-xl border border-slate-100 z-10">
          {selectedDestination ? (
            <div>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Destino Selecionado</span>
              <h2 className="text-lg font-bold text-purple-900 truncate">{selectedDestination.name}</h2>
              <p className="text-xs text-slate-600 mt-1">Calculando melhor parada de embarque...</p>
            </div>
          ) : (
            <div>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Painel de Mobilidade</span>
              <h2 className="text-base font-bold text-purple-900">Digite seu destino para buscar rotas</h2>
              <p className="text-xs text-slate-600 mt-0.5">Busque por ruas, bairros ou linhas de Recife e Região.</p>
            </div>
          )}
        </div>
      </main>

      {/* 3. BARRA DE NAVEGAÇÃO INFERIOR */}
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
