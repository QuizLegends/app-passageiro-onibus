'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import dynamicNext from 'next/dynamic';
import SearchHeader from './components/SearchHeader';
import { MapPin, Navigation, Bus, Route, Footprints, Clock, Navigation2 } from 'lucide-react';

const RealMap = dynamicNext(() => import('./components/RealMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-200 text-purple-900 font-semibold">
      Carregando Mapa de Paradas...
    </div>
  )
});

export default function AppHome() {
  const [recenterCount, setRecenterCount] = useState(0);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [activeStop, setActiveStop] = useState(null);
  const [selectedStopForRoute, setSelectedStopForRoute] = useState(null);

  const handleLocationClick = () => {
    setRecenterCount((prev) => prev + 1);
  };

  const handleSelectDestination = (dest) => {
    setSelectedDestination(dest);
  };

  const handleSelectStop = (stop) => {
    setActiveStop(stop);
  };

  const handleStartRouteToStop = () => {
    if (activeStop) {
      setSelectedStopForRoute(activeStop);
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
          onSelectStop={handleSelectStop}
          selectedStopForRoute={selectedStopForRoute}
        />

        {/* CARD INFERIOR DINÂMICO */}
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-2xl border border-slate-100 z-10 transition-all">
          {activeStop ? (
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0">
                    <Bus className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Parada Selecionada</span>
                    <h2 className="text-sm font-bold text-slate-800 truncate">{activeStop.name}</h2>
                  </div>
                </div>
              </div>

              {/* LISTA DE HORÁRIOS NA PARADA */}
              <div className="space-y-1.5 my-3">
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Próximas chegadas nesta parada:</span>
                </div>
                {activeStop.schedules && activeStop.schedules.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-700">{item.line}</span>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-600 block">{item.time}</span>
                      <span className="text-[10px] text-slate-400">em {item.inMin} min</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* BOTÃO PARA SEGUIR ROTA */}
              <button
                type="button"
                onClick={handleStartRouteToStop}
                className="w-full bg-purple-700 active:bg-purple-900 text-white font-bold py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs"
              >
                <Navigation2 className="w-4 h-4" />
                Seguir rota até esta parada (A pé)
              </button>
            </div>
          ) : (
            <div>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Mobilidade Urbana</span>
              <h2 className="text-base font-bold text-purple-900">Clique em qualquer parada 🚌 no mapa</h2>
              <p className="text-xs text-slate-600 mt-0.5">Veja os ônibus e horários em tempo real ou pesquise o seu destino acima.</p>
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
        <button className="flex flex-col items-center gap-1 text-white font-bold">
          <MapPin className="w-5 h-5 text-emerald-400" />
          <span className="text-[10px] text-emerald-400">Paradas</span>
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
          <span className="text-[10px] font-bold text-cyan-300">GPS</span>
        </button>
      </nav>

    </div>
  );
}
