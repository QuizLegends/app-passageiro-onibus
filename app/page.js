'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useRef } from 'react';
import dynamicNext from 'next/dynamic';
import SearchHeader from './components/SearchHeader';
import { MapPin, Navigation, Bus, Route, Navigation2 } from 'lucide-react';

const RealMap = dynamicNext(() => import('./components/RealMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-200 text-purple-900 font-semibold">
      Carregando Mapa...
    </div>
  )
});

export default function AppHome() {
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [activeStop, setActiveStop] = useState(null);
  const [selectedStopForRoute, setSelectedStopForRoute] = useState(null);
  const [activeTab, setActiveTab] = useState(null);

  const mapRef = useRef(null);

  const handleLocationClick = () => {
    setActiveTab('gps');
    if (mapRef.current) {
      mapRef.current.recenter();
    }
  };

  const handleSelectDestination = (dest) => {
    setSelectedDestination(dest);
    setActiveStop(null); // limpa parada ao escolher um lugar
  };

  const handleSelectStop = (stop) => {
    setActiveStop(stop);
    setSelectedDestination(null); // limpa destino ao escolher parada
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
        <SearchHeader 
          onSelectDestination={handleSelectDestination}
          onSelectStop={handleSelectStop}
        />
      </header>

      {/* MAPA */}
      <main className="flex-1 relative w-full overflow-hidden">
        <RealMap 
          ref={mapRef}
          targetDestination={selectedDestination}
          onSelectStop={handleSelectStop}
          selectedStopForRoute={selectedStopForRoute}
        />

        {/* CARD INFERIOR */}
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-2xl border border-slate-100 z-10 transition-all">
          {activeStop ? (
            <div>
              {/* Cabeçalho da parada */}
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2">
                <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0">
                  <Bus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                    Parada Selecionada
                  </span>
                  <h2 className="text-sm font-bold text-slate-800">
                    Parada {activeStop.code}
                  </h2>
                </div>
              </div>

              {/* Linhas + Horários */}
              {activeStop.linhasComHorarios && activeStop.linhasComHorarios.length > 0 ? (
                <div className="mb-3 max-h-48 overflow-y-auto space-y-2">
                  {activeStop.linhasComHorarios.map((linha, index) => (
                    <div key={index} className="bg-purple-50 rounded-xl p-2 border border-purple-100">
                      <p className="text-[11px] font-bold text-purple-900 mb-1">
                        {linha.nome}
                      </p>
                      {linha.horarios && linha.horarios.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {linha.horarios.slice(0, 12).map((hora, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-white text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                            >
                              {hora}
                            </span>
                          ))}
                          {linha.horarios.length > 12 && (
                            <span className="text-[10px] text-slate-500 px-1">
                              +{linha.horarios.length - 12}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400">Sem horários</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 mb-3">
                  Nenhuma linha encontrada.
                </p>
              )}

              {/* Botão de rota a pé */}
              <button
                type="button"
                onClick={handleStartRouteToStop}
                className="w-full bg-purple-700 active:bg-purple-900 text-white font-bold py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs"
              >
                <Navigation2 className="w-4 h-4" />
                Seguir rota a pé até esta parada
              </button>
            </div>
          ) : (
            <div>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Transporte Público
              </span>
              <h2 className="text-base font-bold text-purple-900">Paradas no Mapa</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Toque em uma parada 🚌 ou busque no campo acima.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* NAVEGAÇÃO INFERIOR */}
      <nav className="bg-purple-900 text-purple-200 flex justify-around py-3 px-2 rounded-t-2xl shadow-lg z-20 shrink-0">
        
        <button 
          onClick={() => setActiveTab('rotas')}
          className={`flex flex-col items-center gap-1 transition-colors px-3 py-1 rounded-xl ${
            activeTab === 'rotas' ? 'text-white bg-purple-800 font-bold' : 'text-purple-300 hover:text-white'
          }`}
        >
          <Route className="w-5 h-5" />
          <span className="text-[10px]">Rotas</span>
        </button>

        <button 
          onClick={() => setActiveTab('paradas')}
          className={`flex flex-col items-center gap-1 transition-colors px-3 py-1 rounded-xl ${
            activeTab === 'paradas' ? 'text-emerald-400 bg-purple-800 font-bold' : 'text-purple-300 hover:text-white'
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[10px]">Paradas</span>
        </button>

        <button 
          onClick={() => setActiveTab('linhas')}
          className={`flex flex-col items-center gap-1 transition-colors px-3 py-1 rounded-xl ${
            activeTab === 'linhas' ? 'text-white bg-purple-800 font-bold' : 'text-purple-300 hover:text-white'
          }`}
        >
          <Bus className="w-5 h-5" />
          <span className="text-[10px]">Linhas</span>
        </button>
        
        <button 
          onClick={handleLocationClick}
          className={`flex flex-col items-center gap-1 transition-colors px-3 py-1 rounded-xl ${
            activeTab === 'gps' ? 'text-cyan-300 bg-purple-800 font-bold' : 'text-purple-300 hover:text-white'
          }`}
        >
          <Navigation className="w-5 h-5" />
          <span className="text-[10px]">GPS</span>
        </button>

      </nav>

    </div>
  );
}
