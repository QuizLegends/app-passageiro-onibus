'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';

// Dados reais
import paradas from '../../paradas.json';
import paradaLinhas from '../../parada_linhas.json';

const defaultCenter = [-34.918, -8.115]; // Jaboatão / Recife

const RealMap = forwardRef(({ onSelectStop }, ref) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const userPosRef = useRef(null);

  const [userPos, setUserPos] = useState(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Botão de GPS exposto para o componente pai
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

  useEffect(() => {
    if (!token || mapRef.current || !mapContainerRef.current) return;

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

      // Transforma as paradas reais em GeoJSON
      const features = paradas.map((parada) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parada.lon, parada.lat]
        },
        properties: {
          id: parada.id,
          code: parada.code,
          name: parada.name,
          url: parada.url || ''
        }
      }));

      map.addSource('bus-stops-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features
        }
      });

      // Círculo verde
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

      // Emoji 🚌
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

      // Clique na parada
      map.on('click', 'bus-stops-circle', (e) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const coordinates = feature.geometry.coordinates.slice();
        const props = feature.properties;

        // Linhas que passam nesta parada
        const linhas = paradaLinhas[props.id] || [];

        const linhasHtml = linhas.length > 0
          ? `<div style="margin-top:6px; font-size:11px; color:#334155;">
               <strong>Linhas:</strong> ${linhas.join(', ')}
             </div>`
          : `<div style="margin-top:6px; font-size:11px; color:#94a3b8;">Nenhuma linha encontrada</div>`;

        new mapboxgl.Popup({ offset: 15 })
          .setLngLat(coordinates)
          .setHTML(`
            <div style="font-family: sans-serif; padding: 2px; min-width: 140px;">
              <strong style="font-size: 13px; color: #0f172a; display: block;">
                🚏 ${props.code}
              </strong>
              <span style="font-size: 11px; color: #64748b; display: block; margin-top: 2px;">
                ${props.name}
              </span>
              ${linhasHtml}
            </div>
          `)
          .addTo(map);

        if (onSelectStop) {
          onSelectStop({
            id: props.id,
            code: props.code,
            name: props.name,
            address: `Código: ${props.code}`,
            lon: coordinates[0],
            lat: coordinates[1],
            routes: linhas
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
        (err) => console.warn('GPS Warning:', err.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [token]);

  return (
    <div className="w-full h-full min-h-full relative bg-slate-200">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
