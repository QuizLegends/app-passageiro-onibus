'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';

const defaultCenter = [-34.918, -8.115]; // [lng, lat] Jaboatão / Recife

// Busca rotas a pé oficiais via Mapbox Directions API
async function fetchMapboxWalkingRoute(startLon, startLat, endLon, endLat, token) {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${startLon},${startLat};${endLon},${endLat}?geometries=geojson&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      return {
        geometry: data.routes[0].geometry,
        distance: Math.round(data.routes[0].distance),
        duration: Math.round(data.routes[0].duration / 60)
      };
    }
  } catch (err) {
    console.error('Erro ao buscar rota no Mapbox:', err);
  }
  return null;
}

// Busca paradas reais no banco de dados do Mapbox (Tilequery API)
async function fetchRealStopsFromMapbox(lng, lat, token) {
  try {
    const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json?radius=1500&limit=50&layers=poi_label&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data && data.features) {
      const busStops = data.features.filter(f => {
        const type = f.properties.maki || f.properties.type || '';
        const name = f.properties.name || '';
        return type.includes('bus') || type.includes('rail') || name.toLowerCase().includes('parada') || name.toLowerCase().includes('estação');
      });

      return {
        type: 'FeatureCollection',
        features: busStops.map(stop => ({
          type: 'Feature',
          geometry: stop.geometry,
          properties: {
            id: stop.id || Math.random().toString(),
            name: stop.properties.name || 'Parada de Ônibus',
            address: stop.properties.address || 'Parada de transporte público'
          }
        }))
      };
    }
  } catch (err) {
    console.error('Erro ao buscar paradas reais via Mapbox:', err);
  }
  return { type: 'FeatureCollection', features: [] };
}

const RealMap = forwardRef(({ triggerRecenter, onSelectStop, selectedStopForRoute }, ref) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);

  const [userPos, setUserPos] = useState(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Recentralizar ÚNICA E EXCLUSIVAMENTE quando o usuário clica no botão GPS
  useImperativeHandle(ref, () => ({
    recenter: () => {
      if (mapRef.current && userPos) {
        mapRef.current.flyTo({ center: userPos, zoom: 16, essential: true });
      }
    }
  }));

  // Atualiza as paradas nativamente na camada GeoJSON
  const loadStopsGeoJSON = async (map, lng, lat) => {
    if (!token) return;
    const geojson = await fetchRealStopsFromMapbox(lng, lat, token);

    if (map.getSource('bus-stops-source')) {
      map.getSource('bus-stops-source').setData(geojson);
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

      // Fonte e camada para as paradas (Nativa e Fixa no Solo)
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
          'circle-radius': 14,
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
          'text-size': 14,
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

      // Camada para a rota
      if (!map.getSource('route-walking')) {
        map.addSource('route-walking', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] }
          }
        });

        map.addLayer({
          id: 'route-walking-line',
          type: 'line',
          source: 'route-walking',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#2563eb',
            'line-width': 5,
            'line-opacity': 0.8,
            'line-dasharray': [2, 2]
          }
        });
      }

      loadStopsGeoJSON(map, defaultCenter[0], defaultCenter[1]);
    });

    // Apenas armazena a coordenada do usuário e posiciona a bolinha azul SEM mover a câmera do mapa
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => {
          const coords = [pos.coords.longitude, pos.coords.latitude];
          setUserPos(coords);

          if (!userMarkerRef.current) {
            const el = document.createElement('div');
            el.style.cssText = 'width: 20px; height: 20px; background-color: #2563eb; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(37,99,235,0.8);';

            userMarkerRef.current = new mapboxgl.Marker(el)
              .setLngLat(coords)
              .addTo(map);
          } else {
            userMarkerRef.current.setLngLat(coords);
          }
        },
        (err) => console.warn('Aviso GPS:', err.message),
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

  // Evento do botão manual de GPS
  useEffect(() => {
    if (triggerRecenter > 0 && mapRef.current) {
      const posToUse = userPos || defaultCenter;
      mapRef.current.flyTo({ center: posToUse, zoom: 16, essential: true });
    }
  }, [triggerRecenter, userPos]);

  // Traçar Rota a Pé
  useEffect(() => {
    if (!selectedStopForRoute || !mapRef.current || !token) return;

    const map = mapRef.current;
    const startCoords = userPos || defaultCenter;

    async function drawRoute() {
      const routeData = await fetchMapboxWalkingRoute(
        startCoords[0], startCoords[1],
        selectedStopForRoute.lon, selectedStopForRoute.lat,
        token
      );

      if (routeData && map.getSource('route-walking')) {
        map.getSource('route-walking').setData({
          type: 'Feature',
          geometry: routeData.geometry
        });

        if (onSelectStop) {
          onSelectStop(prev => prev ? { ...prev, walkDistance: routeData.distance, walkTime: routeData.duration } : null);
        }
      }
    }

    drawRoute();
  }, [selectedStopForRoute, userPos, token]);

  return (
    <div className="w-full h-full min-h-full relative bg-slate-200">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
