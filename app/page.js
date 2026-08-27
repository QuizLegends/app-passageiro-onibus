'use client';
import React, { useState } from 'react';
import { Search, SlidersHorizontal, MapPin, Navigation, Bus, Route, Heart } from 'lucide-react';

export default function AppHome() {
  const [savedLines, setSavedLines] = useState([]);
  const [isSaved, setIsSaved] = useState(false);

  // Exemplo de dados da linha ativa
  const currentBus = {
    number: "503",
    direction: "Caxangá / TI Recife",
    stop: "Terminal Praça da República",
    time: "2 min",
    operator: "Grande Recife Consórcio"
  };

  const handleSaveLine = () => {
    setIsSaved(!isSaved);
  };

  return (
    <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-slate-100 font-sans relative overflow-hidden shadow-2xl">
      
      {/* 1. CABEÇALHO COM BUSCA */}
      <header className="bg-gradient-to-r from-purple-800 to-indigo-900 p-4 pt-6 text-white rounded-b-2xl shadow-lg z-10">
        <div className="flex items-center bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/20">
          <SlidersHorizontal className="w-5 h-5 text-purple-200 mr-2 cursor-pointer" />
          <input 
            type="text" 
            placeholder="Buscar Linha ou Destino em Recife" 
            className="bg-transparent w-full text-sm text-white placeholder-purple-200 focus:outline-none"
          />
          <Search className="w-5 h-5 text-purple-200 cursor-pointer" />
        </div>
      </header>

      {/* 2. ÁREA DO MINIMAPA */}
      <main className="flex-1 relative bg-slate-200">
        {/* Badge da Região */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-1 rounded-full shadow-md z-10 border border-slate-200">
          <span className="text-xs font-semibold text-slate-700">Foco em Recife, PE</span>
        </div>

        {/* Simulação Visual do Mapa */}
        <div className="w-full h-full bg-[#e5e3df] relative overflow-hidden flex items-center justify-center">
          {/* Linhas de ruas estilizadas */}
          <svg className="absolute inset-0 w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg">
            <path d="M 0 100 Q 150 120 200 250 T 400 450" fill="none" stroke="#9333ea" strokeWidth="8" strokeLinecap="round"/>
            <path d="M 50 0 L 350 600" fill="none" stroke="#ffffff" strokeWidth="12" />
            <path d="M 0 300 L 400 200" fill="none" stroke="#ffffff" strokeWidth="10" />
          </svg>

          {/* Marcador do Usuário */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-6 h-6 bg-blue-500/30 rounded-full flex items-center justify-center animate-ping absolute" />
            <div className="w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-md relative z-10" />
          </div>

          {/* Marcadores de Ônibus no Mapa */}
          <div className="absolute top-1/3 left-1/4 bg-purple-700 text-white p-1.5 rounded-full shadow-lg border border-white">
            <Bus className="w-4 h-4" />
          </div>
          <div className="absolute bottom-1/3 right-1/4 bg-purple-700 text-white p-1.5 rounded-full shadow-lg border border-white">
            <Bus className="w-4 h-4" />
          </div>
        </div>

        {/* 3. CARD FLOUTANTE DE INFORMAÇÕES */}
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-xl border border-slate-100 z-20">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ônibus Recomendado</span>
          
          <div className="flex items-baseline justify-between mt-1">
            <h2 className="text-2xl font-bold text-purple-900">
              Linha: {currentBus.number}
            </h2>
            <span className="text-sm font-semibold text-slate-600">
              Sentido: {currentBus.direction}
            </span>
          </div>

          <p className="text-sm text-slate-600 mt-1">{currentBus.stop}</p>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <div>
              <span className="text-xl font-extrabold text-slate-900">{currentBus.time}</span>
              <p className="text-[10px] text-slate-400 uppercase font-medium">Operadora: {currentBus.operator}</p>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleSaveLine}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isSaved 
                    ? 'bg-purple-100 text-purple-800 border border-purple-300' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-purple-700 text-purple-700' : ''}`} />
                {isSaved ? 'Salvo' : 'Salvar Linha'}
              </button>

              <button className="bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all">
                Ver detalhes
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 4. BARRA DE NAVEGAÇÃO INFERIOR */}
      <nav className="bg-purple-800 text-purple-200 flex justify-around py-3 px-2 rounded-t-2xl shadow-lg z-10">
        <button className="flex flex-col items-center gap-1 text-white">
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
        <button className="flex flex-col items-center gap-1 hover:text-white transition-colors">
          <Navigation className="w-5 h-5" />
          <span className="text-[10px] font-medium">Minha localização</span>
        </button>
      </nav>

    </div>
  );
}
