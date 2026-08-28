'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Bus, Loader2, X } from 'lucide-react';

export default function SearchHeader({ onSelectDestination, onSelectBusLine }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);

  // Fecha a lista de resultados ao clicar fora do campo de busca
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Faz a busca em tempo real com debounce (aguarda 400ms após parar de digitar)
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setIsOpen(true);
      try {
        // Busca de endereços reais focada na RMR via OpenStreetMap Nominatim
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&viewbox=-35.15,-7.90,-34.75,-8.25&bounded=1&limit=5&countrycodes=br`
        );
        const data = await response.json();

        const formattedResults = data.map((item) => ({
          id: item.place_id,
          title: item.display_name.split(',')[0],
          subtitle: item.display_name.split(',').slice(1, 3).join(','),
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          type: 'location'
        }));

        setResults(formattedResults);
      } catch (err) {
        console.error('Erro ao buscar dados reais:', err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item) => {
    setQuery(item.title);
    setIsOpen(false);
    if (item.type === 'location' && onSelectDestination) {
      onSelectDestination({
        name: item.title,
        lat: item.lat,
        lon: item.lon
      });
    }
  };

  return (
    <div ref={searchRef} className="relative w-full z-30">
      <div className="flex items-center bg-white/15 backdrop-blur-md rounded-full px-4 py-2 border border-white/20 shadow-inner">
        <Search className="w-5 h-5 text-purple-200 shrink-0 mr-2" />
        
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 3 && setIsOpen(true)}
          placeholder="Para onde você quer ir ou qual linha buscar?" 
          className="bg-transparent w-full text-sm text-white placeholder-purple-200 focus:outline-none"
        />

        {loading && <Loader2 className="w-4 h-4 text-purple-200 animate-spin shrink-0 ml-2" />}
        
        {query && !loading && (
          <button onClick={() => { setQuery(''); setResults([]); setIsOpen(false); }}>
            <X className="w-4 h-4 text-purple-200 shrink-0 ml-2" />
          </button>
        )}
      </div>

      {/* RESULTADOS REAIS DA BUSCA */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-12 left-0 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-72 overflow-y-auto z-50">
          {results.map((item) => (
            <div
              key={item.id}
              onClick={() => handleSelect(item)}
              className="flex items-center gap-3 p-3 hover:bg-purple-50 cursor-pointer border-b border-slate-100 last:border-none transition-colors"
            >
              <div className="p-2 bg-purple-100 text-purple-800 rounded-full shrink-0">
                {item.type === 'location' ? <MapPin className="w-4 h-4" /> : <Bus className="w-4 h-4" />}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-slate-800 truncate">{item.title}</span>
                <span className="text-xs text-slate-500 truncate">{item.subtitle}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
