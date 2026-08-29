'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';

const defaultCenter = [-34.918, -8.115];

const RealMap = forwardRef(({ onSelectStop, targetDestination, selectedStop, selectedStopForRoute }, ref) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
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
        const [resParadas, resParadaLinhas, resLinhas, resHorarios] = await Promise.all([
          fetch('/paradas.json'),
          fetch('/parada_linhas.json'),
          fetch('/linhas.json'),
          fetch('/horarios.json')
        ]);

        if (!resParadas.ok) throw new Error(`paradas.json → ${resParadas.status}`);
        if (!resParadaLinhas.ok) throw new Error(`parada_linhas.json → ${resParadaLinhas.status}`);
        if (!resLinhas.ok) throw new Error(`linhas.json → ${resLinhas.status}`);
        if (!resHorarios.ok) throw new Error(`horarios.json → ${resHorarios.status}`);

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
    if (status !== 'pronto' || !token || mapRef.current || !mapContainerRef.current) return;

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

      map.addLayer({
        id: 'bus-stops-circle',
        type: 'circle',
        source: 'bus-stops-source',
        paint: {
          'circle-color': '#16a34a',
          'circle-radius': 11,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      map.addLayer({
        id: 'bus-stops-icon',
        type: 'symbol',
        source: 'bus-stops-source',
        layout: {
          'text-field': '🚌',
          'text-size': 11,
          'text-allow-overlap': true
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

      // Clique na parada do mapa
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

    // GPS do usuário
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => {
          const coords = [pos.coords.longitude, pos.coords.latitude];
          setUserPos(coords);
          userPosRef.current = coords;

          if (!userMarkerRef.current) {
            const el = document.createElement('div');
            el.style.cssText =
              'width: 18px; height: 18px; background-color: #2563eb; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(37,99,235,0.8);';

            userMarkerRef.current = new mapboxgl.Marker(el)
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

  // Quando seleciona um LUGAR na pesquisa → voa até lá
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

  // Quando seleciona uma PARADA (pesquisa ou clique) → voa até ela
  useEffect(() => {
    if (!mapRef.current || !selectedStop) return;
    if (!selectedStop.lon || !selectedStop.lat) return;

    mapRef.current.flyTo({
      center: [selectedStop.lon, selectedStop.lat],
      zoom: 17,
      essential: true
    });
  }, [selectedStop]);

  // Botão "Seguir rota a pé"
  useEffect(() => {
    if (!mapRef.current || !selectedStopForRoute) return;

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

      {status === 'carregando' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-200/90 z-10">
          <span className="text-purple-900 font-semibold text-sm">Carregando dados...</span>
        </div>
      )}

      {status === 'erro' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-200/95 z-10 p-6 text-center">
          <p className="text-red-600 font-bold text-sm mb-2">Erro ao carregar dados</p>
          <p className="text-slate-600 text-xs">{mensagemErro}</p>
        </div>
      )}
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
