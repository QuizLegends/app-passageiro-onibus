'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';

const defaultCenter = [-34.918, -8.115];

// Ícone HTML igual ao card (Lucide Bus)
function criarIconeOnibusVerde(size = 28) {
  const el = document.createElement('div');
  el.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    background: #16a34a;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    box-sizing: border-box;
  `;
  const iconSize = Math.round(size * 0.55);
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"
      fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 6v6"/>
      <path d="M15 6v6"/>
      <path d="M2 12h19.6"/>
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
      <circle cx="7" cy="18" r="2"/>
      <path d="M9 18h6"/>
      <circle cx="17" cy="18" r="2"/>
    </svg>
  `;
  return el;
}

// Gera imagem do ícone para o Mapbox (todas as paradas)
function gerarImagemOnibusMapbox() {
  return new Promise((resolve, reject) => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Fundo verde arredondado
    const inset = 4;
    const r = 16;
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.moveTo(inset + r, inset);
    ctx.arcTo(size - inset, inset, size - inset, size - inset, r);
    ctx.arcTo(size - inset, size - inset, inset, size - inset, r);
    ctx.arcTo(inset, size - inset, inset, inset, r);
    ctx.arcTo(inset, inset, size - inset, inset, r);
    ctx.closePath();
    ctx.fill();

    // Borda branca
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"
        fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 6v6"/>
        <path d="M15 6v6"/>
        <path d="M2 12h19.6"/>
        <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
        <circle cx="7" cy="18" r="2"/>
        <path d="M9 18h6"/>
        <circle cx="17" cy="18" r="2"/>
      </svg>
    `;

    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, (size - 36) / 2, (size - 36) / 2, 36, 36);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar SVG do ônibus'));
    };
    img.src = url;
  });
}

const RealMap = forwardRef(
  (
    {
      onSelectStop,
      targetDestination,
      selectedStop,
      selectedStopForRoute,
      onRouteInfo
    },
    ref
  ) => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const userMarkerRef = useRef(null);
    const destMarkerRef = useRef(null);
    const selectedMarkerRef = useRef(null);
    const userPosRef = useRef(null);

    const [userPos, setUserPos] = useState(null);
    const [paradas, setParadas] = useState([]);
    const [paradaLinhas, setParadaLinhas] = useState({});
    const [linhasMap, setLinhasMap] = useState({});
    const [horarios, setHorarios] = useState({});
    const [status, setStatus] = useState('carregando');
    const [mensagemErro, setMensagemErro] = useState('');

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    useImperativeHandle(ref, () => ({
      recenter: () => {
        const currentPos = userPosRef.current || userPos;
        if (mapRef.current && currentPos) {
          mapRef.current.flyTo({
            center: currentPos,
            zoom: 16,
            essential: true
          });
        }
      }
    }));

    // Carrega dados
    useEffect(() => {
      async function carregarDados() {
        try {
          const [resParadas, resParadaLinhas, resLinhas, resHorarios] =
            await Promise.all([
              fetch('/paradas.json'),
              fetch('/parada_linhas.json'),
              fetch('/linhas.json'),
              fetch('/horarios.json')
            ]);

          if (!resParadas.ok) throw new Error(`paradas.json → ${resParadas.status}`);
          if (!resParadaLinhas.ok)
            throw new Error(`parada_linhas.json → ${resParadaLinhas.status}`);
          if (!resLinhas.ok) throw new Error(`linhas.json → ${resLinhas.status}`);
          if (!resHorarios.ok)
            throw new Error(`horarios.json → ${resHorarios.status}`);

          const dadosParadas = await resParadas.json();
          const dadosParadaLinhas = await resParadaLinhas.json();
          const dadosLinhas = await resLinhas.json();
          const dadosHorarios = await resHorarios.json();

          const mapa = {};
          dadosLinhas.forEach((linha) => {
            mapa[linha.code] = `${linha.code} - ${linha.name}`;
          });

          setParadas(dadosParadas);
          setParadaLinhas(dadosParadaLinhas);
          setLinhasMap(mapa);
          setHorarios(dadosHorarios);
          setStatus('pronto');
        } catch (err) {
          console.error(err);
          setMensagemErro(err.message || 'Erro desconhecido');
          setStatus('erro');
        }
      }

      carregarDados();
    }, []);

    // Inicializa mapa
    useEffect(() => {
      if (status !== 'pronto' || !token || mapRef.current || !mapContainerRef.current)
        return;

      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: defaultCenter,
        zoom: 15,
        attributionControl: false
      });

      mapRef.current = map;

      map.on('load', async () => {
        setTimeout(() => map.resize(), 200);

        const features = paradas.map((parada) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [parada.lon, parada.lat]
          },
          properties: {
            id: String(parada.id),
            code: parada.code,
            name: parada.name
          }
        }));

        map.addSource('bus-stops-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features }
        });

        // Ícone em TODAS as paradas
        try {
          const canvas = await gerarImagemOnibusMapbox();
          if (!map.hasImage('bus-lucide')) {
            map.addImage('bus-lucide', canvas);
          }

          map.addLayer({
            id: 'bus-stops-icon',
            type: 'symbol',
            source: 'bus-stops-source',
            layout: {
              'icon-image': 'bus-lucide',
              'icon-size': 0.5,
              'icon-allow-overlap': true,
              'icon-ignore-placement': true
            }
          });
        } catch (err) {
          console.error('Erro no ícone, usando fallback 🚌', err);
          map.addLayer({
            id: 'bus-stops-icon',
            type: 'symbol',
            source: 'bus-stops-source',
            layout: {
              'text-field': '🚌',
              'text-size': 18,
              'text-allow-overlap': true,
              'text-ignore-placement': true
            }
          });
        }

        // Rota a pé
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#7c3aed',
            'line-width': 5,
            'line-opacity': 0.85
          }
        });

        // Clique
        map.on('click', 'bus-stops-icon', (e) => {
          if (!e.features || e.features.length === 0) return;

          const feature = e.features[0];
          const coordinates = feature.geometry.coordinates.slice();
          const props = feature.properties;

          const codigosLinhas = paradaLinhas[props.id] || [];
          const nomesLinhas = codigosLinhas.map((c) => linhasMap[c] || c);
          const horariosDaParada = horarios[props.id] || {};

          const linhasComHorarios = codigosLinhas.map((codigo) => ({
            codigo,
            nome: linhasMap[codigo] || codigo,
            horarios: horariosDaParada[codigo] || []
          }));

          if (onSelectStop) {
            onSelectStop({
              id: props.id,
              code: props.code,
              name: `Parada ${props.code}`,
              lon: coordinates[0],
              lat: coordinates[1],
              routes: codigosLinhas,
              routesNames: nomesLinhas,
              linhasComHorarios
            });
          }

          new mapboxgl.Popup({ offset: 15, maxWidth: '260px' })
            .setLngLat(coordinates)
            .setHTML(`
              <div style="font-family: sans-serif; padding: 4px;">
                <strong style="font-size: 14px; color: #0f172a;">🚏 Parada ${props.code}</strong>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                  ${nomesLinhas.length} linha(s) passam aqui
                </div>
              </div>
            `)
            .addTo(map);
        });

        map.on('mouseenter', 'bus-stops-icon', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'bus-stops-icon', () => {
          map.getCanvas().style.cursor = '';
        });
      });

      // GPS azul pulsando (circular)
      if (typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.watchPosition(
          (pos) => {
            const coords = [pos.coords.longitude, pos.coords.latitude];
            setUserPos(coords);
            userPosRef.current = coords;

            if (!userMarkerRef.current) {
              const el = document.createElement('div');
              el.className = 'pulse-dot';
              el.innerHTML = '<div class="pulse-dot-core"></div>';

              userMarkerRef.current = new mapboxgl.Marker({ element: el })
                .setLngLat(coords)
                .addTo(map);
            } else {
              userMarkerRef.current.setLngLat(coords);
            }
          },
          (err) => console.warn('GPS:', err.message),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }

      return () => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    }, [status, token, paradas, paradaLinhas, linhasMap, horarios]);

    // Lugar da pesquisa
    useEffect(() => {
      if (!mapRef.current || !targetDestination) return;
      if (!targetDestination.lon || !targetDestination.lat) return;

      const coords = [targetDestination.lon, targetDestination.lat];

      mapRef.current.flyTo({
        center: coords,
        zoom: 16,
        essential: true
      });

      if (destMarkerRef.current) {
        destMarkerRef.current.remove();
      }

      const el = document.createElement('div');
      el.style.cssText =
        'width: 22px; height: 22px; background-color: #dc2626; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(220,38,38,0.6);';

      destMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat(coords)
        .addTo(mapRef.current);
    }, [targetDestination]);

    // Parada selecionada → mesmo ícone + pulso CIRCULAR
    useEffect(() => {
      if (!mapRef.current || !selectedStop) return;
      if (!selectedStop.lon || !selectedStop.lat) return;

      const map = mapRef.current;
      const stopId = String(selectedStop.id);

      map.flyTo({
        center: [selectedStop.lon, selectedStop.lat],
        zoom: 17,
        essential: true
      });

      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.remove();
        selectedMarkerRef.current = null;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'pulse-bus-green';
      wrapper.appendChild(criarIconeOnibusVerde(32));

      selectedMarkerRef.current = new mapboxgl.Marker({ element: wrapper })
        .setLngLat([selectedStop.lon, selectedStop.lat])
        .addTo(map);

      if (map.getLayer('bus-stops-icon')) {
        map.setFilter('bus-stops-icon', ['!=', ['get', 'id'], stopId]);
      }

      return () => {
        if (selectedMarkerRef.current) {
          selectedMarkerRef.current.remove();
          selectedMarkerRef.current = null;
        }
        if (map.getLayer('bus-stops-icon')) {
          map.setFilter('bus-stops-icon', null);
        }
      };
    }, [selectedStop]);

    // Rota a pé
    useEffect(() => {
      if (!mapRef.current) return;

      if (!selectedStopForRoute) {
        const source = mapRef.current.getSource('route');
        if (source) {
          source.setData({ type: 'FeatureCollection', features: [] });
        }
        if (onRouteInfo) onRouteInfo(null);
        return;
      }

      const stop = selectedStopForRoute;
      const origin = userPosRef.current || userPos;

      if (!origin || !stop.lon || !stop.lat) {
        mapRef.current.flyTo({
          center: [stop.lon, stop.lat],
          zoom: 16,
          essential: true
        });
        return;
      }

      const start = origin.join(',');
      const end = `${stop.lon},${stop.lat}`;

      fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${start};${end}?geometries=geojson&access_token=${token}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (!data.routes || data.routes.length === 0) return;

          const route = data.routes[0];
          const geojson = {
            type: 'Feature',
            properties: {},
            geometry: route.geometry
          };

          const source = mapRef.current.getSource('route');
          if (source) {
            source.setData({
              type: 'FeatureCollection',
              features: [geojson]
            });
          }

          if (onRouteInfo) {
            onRouteInfo({
              distance: route.distance,
              duration: route.duration
            });
          }

          const coordinates = route.geometry.coordinates;
          const bounds = coordinates.reduce(
            (b, coord) => b.extend(coord),
            new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
          );

          mapRef.current.fitBounds(bounds, {
            padding: 60,
            duration: 1000
          });
        })
        .catch((err) => {
          console.error('Erro ao traçar rota:', err);
          mapRef.current.flyTo({
            center: [stop.lon, stop.lat],
            zoom: 16
          });
        });
    }, [selectedStopForRoute, token]);

    return (
      <div className="w-full h-full min-h-full relative bg-slate-200">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

        {/* Botão minha localização */}
        <button
          type="button"
          onClick={() => {
            const currentPos = userPosRef.current || userPos;
            if (mapRef.current && currentPos) {
              mapRef.current.flyTo({
                center: currentPos,
                zoom: 16,
                essential: true
              });
            }
          }}
          className="absolute bottom-28 right-4 z-20 w-12 h-12 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center active:bg-slate-100"
          aria-label="Minha localização"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>

        <style jsx global>{`
          @keyframes pulse-ring-circular {
            0% {
              transform: translate(-50%, -50%) scale(0.85);
              opacity: 0.75;
            }
            70% {
              transform: translate(-50%, -50%) scale(1.7);
              opacity: 0;
            }
            100% {
              transform: translate(-50%, -50%) scale(0.85);
              opacity: 0;
            }
          }

          /* GPS — pulso circular */
          .pulse-dot {
            position: relative;
            width: 18px;
            height: 18px;
          }
          .pulse-dot::before {
            content: '';
            position: absolute;
            width: 18px;
            height: 18px;
            left: 50%;
            top: 50%;
            border-radius: 50%;
            background: rgba(37, 99, 235, 0.35);
            animation: pulse-ring-circular 1.6s ease-out infinite;
          }
          .pulse-dot-core {
            width: 18px;
            height: 18px;
            background: #2563eb;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 8px rgba(37, 99, 235, 0.6);
            position: relative;
            z-index: 1;
            box-sizing: border-box;
          }

          /* Parada selecionada — pulso CIRCULAR em volta do ícone */
          .pulse-bus-green {
            position: relative;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .pulse-bus-green::before {
            content: '';
            position: absolute;
            width: 40px;
            height: 40px;
            left: 50%;
            top: 50%;
            border-radius: 50%;
            background: rgba(22, 163, 74, 0.4);
            animation: pulse-ring-circular 1.6s ease-out infinite;
            z-index: 0;
          }
          .pulse-bus-green > div {
            position: relative;
            z-index: 1;
          }
        `}</style>

        {status === 'carregando' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200/90 z-10">
            <span className="text-purple-900 font-semibold text-sm">
              Carregando dados...
            </span>
          </div>
        )}

        {status === 'erro' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-200/95 z-10 p-6 text-center">
            <p className="text-red-600 font-bold text-sm mb-2">
              Erro ao carregar dados
            </p>
            <p className="text-slate-600 text-xs">{mensagemErro}</p>
          </div>
        )}
      </div>
    );
  }
);

RealMap.displayName = 'RealMap';

export default RealMap;
