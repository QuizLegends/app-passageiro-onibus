'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';

const defaultCenter = [-34.918, -8.115];

const RealMap = forwardRef(({ onSelectStop }, ref) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const userPosRef = useRef(null);

  const [userPos, setUserPos] = useState(null);
  const [paradas, setParadas] = useState([]);
  const [paradaLinhas, setParadaLinhas] = useState({});
  const [linhasMap, setLinhasMap] = useState({}); // código → nome completo
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

  // Carrega os 3 arquivos
  useEffect(() => {
    async function carregarDados() {
      try {
        const [resParadas, resParadaLinhas, resLinhas] = await Promise.all([
          fetch('/paradas.json'),
          fetch('/parada_linhas.json'),
          fetch('/linhas.json')
        ]);

        if (!resParadas.ok) throw new Error(`paradas.json → ${resParadas.status}`);
        if (!resParadaLinhas.ok) throw new Error(`parada_linhas.json → ${resParadaLinhas.status}`);
        if (!resLinhas.ok) throw new Error(`linhas.json → ${resLinhas.status}`);

        const dadosParadas = await resParadas.json();
        const dadosParadaLinhas = await resParadaLinhas.json();
        const dadosLinhas = await resLinhas.json();

        // Cria um mapa rápido: código da linha → nome completo
        const mapa = {};
        dadosLinhas.forEach((linha) => {
          mapa[linha.code] = `${linha.code} - ${linha.name}`;
        });

        setParadas(dadosParadas);
        setParadaLinhas(dadosParadaLinhas);
        setLinhasMap(mapa);
        setStatus('pronto');
      } catch (err) {
        console.error(err);
        setMensagemErro(err.message || 'Erro desconhecido');
        setStatus('erro');
      }
    }

    carregarDados();
  }, []);

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

      map.on('click', 'bus-stops-circle', (e) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const coordinates = feature.geometry.coordinates.slice();
        const props = feature.properties;

        const codigosLinhas = paradaLinhas[props.id] || [];
        
        // Transforma os códigos em nomes completos
        const nomesLinhas = codigosLinhas.map(
          (codigo) => linhasMap[codigo] || codigo
        );

        const linhasHtml = nomesLinhas.length > 0
          ? `<div style="margin-top:8px; font-size:11px; color:#334155; max-height:120px; overflow-y:auto;">
               <strong style="display:block; margin-bottom:4px;">Linhas que passam aqui:</strong>
               ${nomesLinhas.map(n => `<div style="margin-bottom:2px;">• ${n}</div>`).join('')}
             </div>`
          : `<div style="margin-top:6px; font-size:11px; color:#94a3b8;">Nenhuma linha encontrada</div>`;

        new mapboxgl.Popup({ offset: 15, maxWidth: '280px' })
          .setLngLat(coordinates)
          .setHTML(`
            <div style="font-family: sans-serif; padding: 4px;">
              <strong style="font-size: 14px; color: #0f172a; display: block;">
                🚏 Parada ${props.code}
              </strong>
              ${linhasHtml}
            </div>
          `)
          .addTo(map);

        if (onSelectStop) {
          onSelectStop({
            id: props.id,
            code: props.code,
            name: `Parada ${props.code}`,
            lon: coordinates[0],
            lat: coordinates[1],
            routes: codigosLinhas,
            routesNames: nomesLinhas   // nomes completos
          });
        }
      });

      map.on('mouseenter', 'bus-stops-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'bus-stops-circle', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    // GPS
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
  }, [status, token, paradas, paradaLinhas, linhasMap]);

  return (
    <div className="w-full h-full min-h-full relative bg-slate-200">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {status === 'carregando' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-200/90 z-10">
          <span className="text-purple-900 font-semibold text-sm">Carregando paradas...</span>
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
