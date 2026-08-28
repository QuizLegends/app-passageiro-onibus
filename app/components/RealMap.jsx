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
    // Busca num raio de 1.5km (1500m) por pontos cadastrados como transporte público
    const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json?radius=1500&limit=50&layers=poi_label&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data && data.features) {
      // Filtra apenas locais classificados como parada de ônibus / transporte público
      const busStops = data.features.filter(f => {
        const type = f.properties.maki || f.properties.type || '';
        const name = f.properties.name || '';
        return type.includes('bus') || type.includes('rail') || name.toLowerCase().includes('parada') || name.toLowerCase().includes('estação');
      });

      return busStops.map(stop => ({
        id: stop.id || Math.random().toString(),
        name: stop.properties.name || 'Parada de Ônibus',
        lon: stop.geometry.coordinates[0],
        lat: stop.geometry.coordinates[1],
        address: stop.properties.address || 'Sem endereço cadastrado'
      }));
    }
  } catch (err) {
    console.error('Erro ao buscar paradas reais via Mapbox:', err);
  }
  return [];
}

const RealMap = forwardRef(({ triggerRecenter, onSelectStop, selectedStopForRoute }, ref) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const stopMarkersRef = useRef([]);

  const [userPos, setUserPos] = useState(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useImperativeHandle(ref, () => ({
    recenter: () => {
      if (mapRef.current && userPos) {
        mapRef.current.flyTo({ center: userPos, zoom: 16, essential: true });
      }
    }
  }));

  // Função para renderizar as paradas reais no mapa
  const loadStops = async (map, lng, lat) => {
    if (!token) return;

    const stops = await fetchRealStopsFromMapbox(lng, lat, token);

    // Limpa marcadores anteriores
    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = [];

    stops.forEach((stop) => {
      const el = document.createElement('div');
      el.style.cssText = 'background: #15803d; width: 32px; height: 32px; border-radius: 50%; border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; font-size: 15px; color: white; box-shadow: 0 3px 8px rgba(0,0,0,0.4); cursor: pointer; transition: transform 0.2s;';
      el.innerText = '🚌';

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="font-family: sans-serif; padding: 4px;">
          <strong style="font-size: 13px; color: #0f172a; display: block;">🚏 ${stop.name}</strong>
          <span style="font-size: 11px; color: #64748b; display: block; margin-top: 2px;">${stop.address}</span>
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([stop.lon, stop.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('click', () => {
        if (onSelectStop) {
          onSelectStop(stop);
        }
      });

      stopMarkersRef.current.push(marker);
    });
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

      // Adiciona a camada para a rota pontilhada
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

      loadStops(map, defaultCenter[0], defaultCenter[1]);
    });

    // Quando o usuário mover o mapa, recarrega as paradas reais daquela área
    map.on('moveend', () => {
      const center = map.getCenter();
      loadStops(map, center.lng, center.lat);
    });

    // Posição GPS real
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => {
          const coords = [pos.coords.longitude, pos.coords.latitude];
          setUserPos(coords);

          if (!userMarkerRef.current) {
            const el = document.createElement('div');
            el.style.cssText = 'width: 22px; height: 22px; background-color: #2563eb; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 12px rgba(37,99,235,0.9);';

            userMarkerRef.current = new mapboxgl.Marker(el)
              .setLngLat(coords)
              .addTo(map);

            map.flyTo({ center: coords, zoom: 15 });
            loadStops(map, coords[0], coords[1]);
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

  // Recentralizar
  useEffect(() => {
    if (triggerRecenter > 0 && mapRef.current) {
      const posToUse = userPos || defaultCenter;
      mapRef.current.flyTo({ center: posToUse, zoom: 16, essential: true });
    }
  }, [triggerRecenter, userPos]);

  // Rota Real a Pé até a Parada
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

        const bounds = new mapboxgl.LngLatBounds()
          .extend(startCoords)
          .extend([selectedStopForRoute.lon, selectedStopForRoute.lat]);

        map.fitBounds(bounds, { padding: 80, maxZoom: 17 });
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
