'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';

const defaultCenter = [-34.918, -8.115]; // Jaboatão / Recife

// Servidores públicos do Overpass para Fallback (se um falhar/bloquear, tenta o outro)
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

async function fetchStopsDirect(south, west, north, east) {
  const query = `
    [out:json][timeout:25];
    (
      node["highway"="bus_stop"](${south},${west},${north},${east});
      node["public_transport"="platform"]["bus"!="no"](${south},${west},${north},${east});
    );
    out body;
  `;

  const encodedQuery = encodeURIComponent(query);

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}?data=${encodedQuery}`);
      if (!res.ok) {
        console.warn(`[Overpass Warning] Servidor ${endpoint} respondeu com status ${res.status}`);
        continue; // Tenta o próximo servidor da lista
      }

      const data = await res.json();
      console.log(`[Overpass Success] Retornou ${data.elements?.length ?? 0} elementos via ${endpoint}`);

      if (data?.elements) {
        const seen = new Set();
        return data.elements
          .filter(el => {
            if (seen.has(el.id)) return false;
            seen.add(el.id);
            return true;
          })
          .map(el => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [el.lon, el.lat]
            },
            properties: {
              id: el.id.toString(),
              name: el.tags?.name || el.tags?.description || 'Parada de Ônibus',
              address: el.tags?.['addr:street'] ? `Rua ${el.tags['addr:street']}` : 'Ponto de Ônibus'
            }
          }));
      }
    } catch (err) {
      console.error(`[Overpass Error] Falha ao conectar em ${endpoint}:`, err);
    }
  }

  console.error('[Overpass Error] Todos os servidores de Overpass falharam ou timeout.');
  return [];
}

const RealMap = forwardRef(({ onSelectStop, selectedStopForRoute }, ref) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const userPosRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const [userPos, setUserPos] = useState(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Método exposto para recentralização via botão de GPS
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

  // Função para buscar paradas com controle de debounce
  const loadStopsInView = (map) => {
    if (!map) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      const bounds = map.getBounds();
      const features = await fetchStopsDirect(
        bounds.getSouth(),
        bounds.getWest(),
        bounds.getNorth(),
        bounds.getEast()
      );

      if (map.getSource('bus-stops-source')) {
        map.getSource('bus-stops-source').setData({
          type: 'FeatureCollection',
          features
        });
      }
    }, 600); // Aguarda 600ms após o término da movimentação
  };

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

      map.addSource('bus-stops-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'bus-stops-circle',
        type: 'circle',
        source: 'bus-stops-source',
        paint: {
          'circle-color': '#16a34a',
          'circle-radius': 12,
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
          'text-size': 12,
          'text-allow-overlap': true
        }
      });

      map.on('click', 'bus-stops-circle', (e) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const coordinates = feature.geometry.coordinates.slice();
        const properties = feature.properties;

        new mapboxgl.Popup({ offset: 15 })
          .setLngLat(coordinates)
          .setHTML(`
            <div style="font-family: sans-serif; padding: 2px;">
              <strong style="font-size: 13px; color: #0f172a; display: block;">🚏 ${properties.name}</strong>
              <span style="font-size: 11px; color: #64748b; display: block; margin-top: 2px;">${properties.address}</span>
            </div>
          `)
          .addTo(map);

        if (onSelectStop) {
          onSelectStop({
            id: properties.id,
            name: properties.name,
            address: properties.address,
            lon: coordinates[0],
            lat: coordinates[1]
          });
        }
      });

      map.on('mouseenter', 'bus-stops-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'bus-stops-circle', () => {
        map.getCanvas().style.cursor = '';
      });

      loadStopsInView(map);
    });

    map.on('moveend', () => {
      loadStopsInView(map);
    });

    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => {
          const coords = [pos.coords.longitude, pos.coords.latitude];
          setUserPos(coords);
          userPosRef.current = coords;

          if (!userMarkerRef.current) {
            const el = document.createElement('div');
            el.style.cssText = 'width: 18px; height: 18px; background-color: #2563eb; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(37,99,235,0.8);';

            userMarkerRef.current = new mapboxgl.Marker(el)
              .setLngLat(coords)
              .addTo(map);
          } else {
            userMarkerRef.current.setLngLat(coords);
          }
        },
        (err) => console.warn('[GPS Warning]:', err.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
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
