'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useRef } from 'react';
import dynamicNext from 'next/dynamic';
import SearchHeader from './components/SearchHeader';
import { Bus, Navigation2 } from 'lucide-react';

const RealMap = dynamicNext(() => import('./components/RealMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-200 text-purple-900 font-semibold">
      Carregando Mapa...
    </div>
  )
});

function LinhaComHorarios({ linha }) {
  const [expandido, setExpandido] = useState(false);

  const horariosVisiveis = expandido
    ? linha.horarios
    : (linha.horarios || []).slice(0, 12);

  const temMais = (linha.horarios?.length || 0) > 12;

  return (
    <div className="bg-purple-50 rounded-xl p-2 border border-purple-100">
      <p className="text-[11px] font-bold text-purple-900 mb-1">{linha.nome}</p>

      {linha.horarios && linha.horarios.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {horariosVisiveis.map((hora, i) => (
            <span
              key={i}
              className="text-[10px] bg-white text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
            >
              {hora}
            </span>
          ))}

          {temMais && (
            <button
              type="button"
              onClick={() => setExpandido(!expandido)}
              className="text-[10px] font-semibold text-purple-700 px-1.5 py-0.5 rounded border border-purple-300 bg-purple-100 active:bg-purple-200"
            >
              {expandido ? 'mostrar menos' : `+${linha.horarios.length - 12}`}
            </button>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-slate-400">Sem horários</p>
      )}
    </div>
  );
}

export default function AppHome() {
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [activeStop, setActiveStop] = useState(null);
  const [selectedStopForRoute, setSelectedStopForRoute] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);

  const mapRef = useRef(null);

  const handleSelectDestination = (dest) => {
    setSelectedDestination(dest);
    setActiveStop(null);
    setSelectedStopForRoute(null);
    setRouteInfo(null);
  };

  const handleSelectStop = (stop) => {
    setActiveStop(stop);
    setSelectedDestination(null);
    setSelectedStopForRoute(null);
    setRouteInfo(null);
  };

  const handleStartRouteToStop = () => {
    if (activeStop) {
      setSelectedStopForRoute(activeStop);
    }
  };

  const handleCancelRoute = () => {
    setSelectedStopForRoute(null);
    setRouteInfo(null);
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
          selectedStop={activeStop}
          onSelectStop={handleSelectStop}
          selectedStopForRoute={selectedStopForRoute}
          onRouteInfo={setRouteInfo}
        />

        {/* CARD INFERIOR */}
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-2xl border border-slate-100 z-10 transition-all">
          {activeStop ? (
            <div>
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
                  {activeStop.street && (
                    <p className="text-[11px] text-slate-500 truncate">
                      {activeStop.street}
                      {activeStop.locality ? ` · ${activeStop.locality}` : ''}
                    </p>
                  )}
                </div>
              </div>

              {activeStop.linhasComHorarios &&
              activeStop.linhasComHorarios.length > 0 ? (
                <div className="mb-3 max-h-40 overflow-y-auto space-y-2">
                  {activeStop.linhasComHorarios.map((linha, index) => (
                    <LinhaComHorarios key={index} linha={linha} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 mb-3">
                  Nenhuma linha encontrada.
                </p>
              )}

              {selectedStopForRoute && routeInfo ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
                    <div className="text-xs text-violet-900">
                      <span className="font-bold">
                        {routeInfo.distance >= 1000
                          ? `${(routeInfo.distance / 1000).toFixed(1)} km`
                          : `${Math.round(routeInfo.distance)} m`}
                      </span>
                      {' • '}
                      <span className="font-bold">
                        {routeInfo.duration >= 60
                          ? `${Math.round(routeInfo.duration / 60)} min`
                          : `${Math.round(routeInfo.duration)} seg`}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelRoute}
                    className="w-full bg-red-500 active:bg-red-600 text-white font-bold py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs"
                  >
                    Cancelar rota a pé
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartRouteToStop}
                  className="w-full bg-purple-700 active:bg-purple-900 text-white font-bold py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <Navigation2 className="w-4 h-4" />
                  Seguir rota a pé até esta parada
                </button>
              )}
            </div>
          ) : (
            <div>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Transporte Público
              </span>
              <h2 className="text-base font-bold text-purple-900">
                Paradas no Mapa
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Toque em uma parada 🚌 ou busque no campo acima.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
