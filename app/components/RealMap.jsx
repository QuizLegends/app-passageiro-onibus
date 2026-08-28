'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';

const defaultCenter = [-34.918, -8.115]; // [lng, lat] Jaboatão / Recife

// Busca paradas próximas usando a API Nativa do Mapbox (Sem bloqueio de CORS/Status 0)
async function fetchNearbyStopsMapbox(lng, lat, token) {
  if (!token) return [];

  // Busca POI de transporte público na proximidade das coordenadas atuais
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/parada%20de%20onibus.json?proximity=${lng},${lat}&types=poi&limit=15&access_token=${token}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('Mapbox Geocoding retornou status:', res.status);
      return [];
    }
    const data = await res.json();

    if (data && data.features) {
      return data.features.map(item => ({
        type: 'Feature',
        geometry: item.geometry,
        properties: {
          id: item.id,
          name: item.text || 'Parada de Ônibus',
          address: item.place_name || 'Ponto de transporte público'
        }
      }));
    }
  } catch (err) {
    console.error('Erro na busca nativa Mapbox:', err);
  }
  return [];
}

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

  // Carrega as paradas da região central do mapa
  const loadStopsInView = async (map) => {
    if (!map) return;
    const center = map.getCenter();
    const features = await fetchNearbyStopsMapbox(center.lng, center.lat, token);

    if (map.getSource('bus-stops-source')) {
      map.getSource('bus-stops-source').setData({
        type: 'FeatureCollection',
        features
      });
    }
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

      // Camada para exibir os ícones das paradas
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

      // Clique na parada
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

      // Busca inicial
      loadStopsInView(map);
    });

    // Atualiza paradas ao terminar de mover o mapa
    map.on('moveend', () => {
      loadStopsInView(map);
    });

    // Monitora posição GPS do usuário
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
