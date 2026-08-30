'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';

const defaultCenter = [-34.918, -8.115];

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

    // Carrega os dados
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

    // Inicializa o mapa
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

      map.on('load', () => {
        setTimeout(() => map.resize(), 200);

        const features = paradas.map((parada) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [parada.lon, parada.lat]
          },
          properties: {
            id: parada.id,
            code: parada.code,
            name: parada.name
          }
        }));

        map.addSource('bus-stops-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features }
        });

        // Círculo verde (fundo do ícone)
        map.addLayer({
          id: 'bus-stops-circle',
          type: 'circle',
          source: 'bus-stops-source',
          paint: {
            'circle-color': '#16a34a',
            'circle-radius': 14,
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff'
          }
        });

        // Ícone de ônibus
        map.addLayer({
          id: 'bus-stops-icon',
          type: 'symbol',
          source: 'bus-stops-source',
          layout: {
            'text-field': '🚌',
            'text-size': 13,
            'text-allow-overlap': true,
            'text-ignore-placement': true
          }
        });

        // Fonte da rota a pé
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

        // Clique na parada
        map.on('click', 'bus-stops-circle', (e) => {
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

        map.on('mouseenter', 'bus-stops-circle', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'bus-stops-circle', () => {
          map.getCanvas().style.cursor = '';
        });
      });

      // GPS do usuário (ponto azul pulsando)
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

    // Lugar da pesquisa → voa até lá
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

    // Parada selecionada → voa + ônibus azul pulsando
    useEffect(() => {
      if (!mapRef.current || !selectedStop) return;
      if (!selectedStop.lon || !selectedStop.lat) return;

      mapRef.current.flyTo({
        center: [selectedStop.lon, selectedStop.lat],
        zoom: 17,
        essential: true
      });

      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.remove();
        selectedMarkerRef.current = null;
      }

      const el = document.createElement('div');
      el.className = 'pulse-bus';
      el.innerHTML = '<div class="pulse-bus-core">🚌</div>';

      selectedMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([selectedStop.lon, selectedStop.lat])
        .addTo(mapRef.current);

      return () => {
        if (selectedMarkerRef.current) {
          selectedMarkerRef.current.remove();
          selectedMarkerRef.current = null;
        }
      };
    }, [selectedStop]);

    // Rota a pé + cancelar
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
          @keyframes pulse-ring {
            0% {
              transform: scale(0.8);
              opacity: 0.8;
            }
            70% {
              transform: scale(1.6);
              opacity: 0;
            }
            100% {
              transform: scale(0.8);
              opacity: 0;
            }
          }
          .pulse-dot {
            position: relative;
            width: 18px;
            height: 18px;
          }
          .pulse-dot::before {
            content: '';
            position: absolute;
            inset: -6px;
            border-radius: 50%;
            background: rgba(37, 99, 235, 0.35);
            animation: pulse-ring 1.6s ease-out infinite;
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
          }
          .pulse-bus {
            position: relative;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .pulse-bus::before {
            content: '';
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            background: rgba(37, 99, 235, 0.35);
            animation: pulse-ring 1.6s ease-out infinite;
          }
          .pulse-bus-core {
            width: 28px;
            height: 28px;
            background: #2563eb;
            border: 2.5px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            box-shadow: 0 0 10px rgba(37, 99, 235, 0.5);
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
