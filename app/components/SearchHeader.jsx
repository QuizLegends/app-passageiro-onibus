'use client';

import React, { useState } from 'react';
import { Search, MapPin, X } from 'lucide-react';

export default function SearchHeader({ onSelectDestination }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Exemplo de locais populares em Recife e Jaboatão dos Guararapes para busca rápida
  const defaultLocations = [
    { name: 'Marco Zero, Recife Antigo', lat: -8.0631, lon: -34.8711 },
    { name: 'Shopping Recife, Boa Viagem', lat: -8.1192, lon: -34.9048 },
    { name: 'Shopping Guararapes, Piedade (Jaboatão)', lat: -8.1672, lon: -35.0003 },
    { name: 'Estação Central do Recife (Metrô)', lat: -8.0668, lon: -34.8837 },
    { name: 'TI Joana Bezerra', lat: -8.0706, lon: -34.8953 },
    { name: 'TI Jaboatão', lat: -8.1118, lon: -35.0152 }
  ];

  const handleSearch = (text) => {
    setQuery(text);

    if (text.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);

    // Filtra localmente os locais correspondentes ao texto digitado
    const filtered = defaultLocations.filter((item) =>
      item.name.toLowerCase().includes(text.toLowerCase())
    );

    setResults(filtered);
    setIsLoading(false);
  };

  const handleSelect = (item) => {
    setQuery(item.name);
    setResults([]);
    if (onSelectDestination) {
      onSelectDestination(item);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    if (onSelectDestination) {
      onSelectDestination(null);
    }
  };

  return (
    <div className="relative w-full">
      {/* Campo de Busca */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-5 h-5 text-purple-300 pointer-events-none" />
        
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Para onde você vai hoje?"
          className="w-full bg-purple-950/60 text-white placeholder-purple-300 text-sm font-medium rounded-2xl pl-10 pr-10 py-3 outline-none border border-purple-700/50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all shadow-inner"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 text-purple-300 hover:text-white p-1 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Lista Suspensa de Sugestões / Resultados */}
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <ul className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {results.map((item, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-purple-50 active:bg-purple-100 transition-colors"
                >
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-xl shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Pernambuco
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
