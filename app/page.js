'use client';

// Desativa a pré-renderização estática (SSR) para evitar erro de 'window is not defined' no Leaflet na Vercel
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import dynamicNext from 'next/dynamic';
import SearchHeader from './components/SearchHeader';
import { MapPin, Navigation, Bus, Route, Footprints, ChevronRight } from 'lucide-react';

// Carregamento dinâmico sem Server-Side Rendering (ssr: false)
const RealMap = dynamicNext(() => import('./components/RealMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-200 text-purple-900 font-semibold">
      Carregando Mapa...
    </div>
  )
});

export default function AppHome() {
  const [recenterCount, setRecenterCount] = useState(0);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [nearestStop, setNearestStop] = useState(null);
  const [focusStopTrigger, setFocusStopTrigger] = useState(0);

  const handleLocationClick = () => {
    setRecenterCount((prev) => prev + 1);
  };

  const handleSelectDestination = (dest) => {
    setSelectedDestination(dest);
    setNearestStop(null);
  };

  const handleFocusStop = (e) => {
    if (e) e.stopPropagation();
    if (nearestStop) {
      setFocusStopTrigger((prev) => prev + 1);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-slate-100 font-sans relative overflow-hidden shadow-2xl touch-none">
      
      {/* CABEÇALHO */}
      <header className="bg-gradient-to-r from-purple-800 to-indigo-900 p-4 pt-6 text-white rounded-b-2xl shadow-lg z-20 shrink-0">
        <SearchHeader onSelectDestination={handleSelectDestination} />
      </header>

      {/* MAPA PRINCIPAL */}
      <main className="flex-1 relative w-full overflow-hidden">
        <RealMap 
          triggerRecenter={recenterCount} 
          targetDestination={selectedDestination}
          onNearestStopFound={setNearestStop}
          focusStopTrigger={focusStopTrigger}
        />

        {/* CARD INFERIOR */}
        <div 
          onClick={handleFocusStop}
          className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-2xl border border-slate-100 z-10 cursor-pointer transition-all active:scale-98"
        >
          {selectedDestination ? (
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <div>
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Destino Selecionado</span>
                  <h2 className="text-base font-bold text-slate-800 truncate">{selectedDestination.name}</h2>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>

              {nearestStop ? (
                <div className="flex items-center justify-between bg-purple-50 p-2.5 rounded-2xl border border-purple-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0">
                      <Footprints className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-800 truncate">{nearestStop.name}</span>
                      <span className="text-[11px] text-emerald-700 font-semibold">
                        A {nearestStop.distance}m • ~{Math.ceil(nearestStop.distance / 80)} min a pé
                      </span>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleFocusStop}
                    className="text-[10px] bg-purple-700 active:bg-purple-900 text-white font-bold px-3 py-1.5 rounded-xl shadow-md transition-all shrink-0 ml-2"
                  >
                    Ver no mapa
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-1">
                  <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-slate-600 font-medium">Localizando parada de embarque...</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Painel de Mobilidade</span>
              <h2 className="text-base font-bold text-purple-900">Digite seu destino para buscar rotas</h2>
              <p className="text-xs text-slate-600 mt-0.5">Busque por ruas, bairros ou locais de Recife e Jaboatão.</p>
            </div>
          )}
        </div>
      </main>

      {/* BARRA DE NAVEGAÇÃO INFERIOR */}
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
