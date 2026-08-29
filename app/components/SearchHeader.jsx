'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Bus, Loader2, X, Route } from 'lucide-react';

export default function SearchHeader({ onSelectDestination, onSelectStop }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [paradas, setParadas] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [paradaLinhas, setParadaLinhas] = useState({});
  const searchRef = useRef(null);

  // Carrega os dados uma vez
  useEffect(() => {
    async function carregar() {
      try {
        const [resParadas, resLinhas, resParadaLinhas] = await Promise.all([
          fetch('/paradas.json'),
          fetch('/linhas.json'),
          fetch('/parada_linhas.json')
        ]);

        const dadosParadas = await resParadas.json();
        const dadosLinhas = await resLinhas.json();
        const dadosParadaLinhas = await resParadaLinhas.json();

        setParadas(dadosParadas);
        setLinhas(dadosLinhas);
        setParadaLinhas(dadosParadaLinhas);
      } catch (err) {
        console.error('Erro ao carregar dados da busca:', err);
      }
    }
    carregar();
  }, []);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Busca com debounce
  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setIsOpen(true);

      try {
        const q = query.trim().toLowerCase();
        // Remove a palavra "linha" se o usuário digitar "linha 001"
        const qLimpo = q.replace(/^linha\s*/i, '').trim();

        // 1. Busca nas LINHAS
        const linhasEncontradas = linhas
          .filter((l) => {
            const code = (l.code || '').toLowerCase();
            const name = (l.name || '').toLowerCase();
            return (
              code.includes(qLimpo) ||
              name.includes(qLimpo) ||
              code.includes(q) ||
              name.includes(q)
            );
          })
          .slice(0, 6)
          .map((l) => ({
            id: `line-${l.id}`,
            title: `${l.code} - ${l.name}`,
            subtitle: 'Linha de ônibus',
            type: 'line',
            lineData: l
          }));

        // 2. Busca nas PARADAS
        const paradasEncontradas = paradas
          .filter((p) => {
            const code = (p.code || '').toLowerCase();
            const name = (p.name || '').toLowerCase();
            return code.includes(q) || name.includes(q) || code.includes(qLimpo);
          })
          .slice(0, 5)
          .map((p) => ({
            id: `stop-${p.id}`,
            title: `Parada ${p.code}`,
            subtitle: p.name || `Código ${p.code}`,
            lat: p.lat,
            lon: p.lon,
            type: 'stop',
            stopData: p
          }));

        // 3. Busca de LUGARES (Recife)
        let lugares = [];
        if (q.length >= 3) {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                query + ' Recife'
              )}&viewbox=-35.15,-7.90,-34.75,-8.25&bounded=1&limit=4&countrycodes=br`
            );
            const data = await response.json();

            lugares = data.map((item) => ({
              id: `place-${item.place_id}`,
              title: item.display_name.split(',')[0],
              subtitle: item.display_name.split(',').slice(1, 3).join(',').trim(),
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon),
              type: 'location'
            }));
          } catch (err) {
            console.warn('Erro na busca de lugares:', err);
          }
        }

        // Ordem: Linhas → Paradas → Lugares
        setResults([...linhasEncontradas, ...paradasEncontradas, ...lugares]);
      } catch (err) {
        console.error('Erro na busca:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, paradas, linhas]);

  const handleSelect = (item) => {
    setQuery(item.title);
    setIsOpen(false);

    if (item.type === 'line') {
      // Ao selecionar uma linha → encontra uma parada que tenha essa linha
      const codigoLinha = item.lineData.code;
      let paradaEncontrada = null;

      // Procura a primeira parada que tenha essa linha
      for (const [stopId, listaLinhas] of Object.entries(paradaLinhas)) {
        if (listaLinhas.includes(codigoLinha)) {
          paradaEncontrada = paradas.find((p) => p.id === stopId);
          if (paradaEncontrada) break;
        }
      }

      if (paradaEncontrada && onSelectStop) {
        onSelectStop({
          id: paradaEncontrada.id,
          code: paradaEncontrada.code,
          name: paradaEncontrada.name || `Parada ${paradaEncontrada.code}`,
          lat: paradaEncontrada.lat,
          lon: paradaEncontrada.lon
        });
      }
    } else if (item.type === 'stop' && onSelectStop) {
      onSelectStop({
        id: item.stopData.id,
        code: item.stopData.code,
        name: item.stopData.name || `Parada ${item.stopData.code}`,
        lat: item.lat,
        lon: item.lon
      });
    } else if (item.type === 'location' && onSelectDestination) {
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
          onFocus={() => query.length >= 1 && setIsOpen(true)}
          placeholder="Buscar linha, parada ou lugar..."
          className="bg-transparent w-full text-sm text-white placeholder-purple-200 focus:outline-none"
        />

        {loading && <Loader2 className="w-4 h-4 text-purple-200 animate-spin shrink-0 ml-2" />}

        {query && !loading && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
          >
            <X className="w-4 h-4 text-purple-200 shrink-0 ml-2" />
          </button>
        )}
      </div>

      {/* Resultados */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-12 left-0 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-80 overflow-y-auto z-50">
          {results.map((item) => (
            <div
              key={item.id}
              onClick={() => handleSelect(item)}
              className="flex items-center gap-3 p-3 hover:bg-purple-50 cursor-pointer border-b border-slate-100 last:border-none transition-colors"
            >
              <div
                className={`p-2 rounded-full shrink-0 ${
                  item.type === 'line'
                    ? 'bg-indigo-100 text-indigo-700'
                    : item.type === 'stop'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {item.type === 'line' ? (
                  <Route className="w-4 h-4" />
                ) : item.type === 'stop' ? (
                  <Bus className="w-4 h-4" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-slate-800 truncate">
                  {item.title}
                </span>
                <span className="text-xs text-slate-500 truncate">
                  {item.subtitle}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen && !loading && results.length === 0 && query.length >= 1 && (
        <div className="absolute top-12 left-0 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-50">
          <p className="text-sm text-slate-500 text-center">Nenhum resultado encontrado</p>
        </div>
      )}
    </div>
  );
}
