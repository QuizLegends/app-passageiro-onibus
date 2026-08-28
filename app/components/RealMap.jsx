'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';

const defaultCenter = [-34.918, -8.115]; // Jaboatão / Recife [lng, lat]

// Busca rota a pé no Mapbox Directions API
async function fetchMapboxWalkingRoute(startLon, startLat, endLon, endLat, token) {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${startLon},${startLat};${endLon},${endLat}?geometries=geojson&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      return {
        geometry: data.routes[0].geometry,
        distance: Math.round(data.routes[0].distance)
      };
    }
  } catch (err) {
    console.error('Erro na Rota Mapbox:', err);
  }
  return null;
}

// Busca parada de ônibus mais próxima no OpenStreetMap / Overpass
async function fetchNearestRealBusStop(lat, lon) {
  try {
    const query = `[out:json];(node["highway"="bus_stop"](around:800,${lat},${lon});node["public_transport"="platform"](around:800,${lat},${lon}););out;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.elements && data.elements.length > 0) {
      const stop = data.elements[0];
      return {
        id: stop.id,
        name: stop.tags.name || stop.tags['description'] || 'Parada de Ônibus',
        lat: stop.lat,
        lon: stop.lon
      };
    }
  } catch (err) {
    console.error('Erro ao buscar parada:', err);
  }
  return null;
}

const RealMap = forwardRef(({ triggerRecenter, targetDestination, onNearestStopFound, focusStopTrigger }, ref) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const stopMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);

  const [userPos, setUserPos] = useState(null);
  const [nearestStop, setNearestStop] = useState(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Permite chamada do botão de centralizar vindo de fora
  useImperativeHandle(ref, () => ({
    recenter: () => {
      if (mapRef.current && userPos) {
        mapRef.current.flyTo({ center: userPos, zoom: 16, essential: true });
      }
    }
  }));

  // 1. Inicialização do Mapa
  useEffect(() => {
    if (!token) {
      console.error("Token do Mapbox não encontrado! Certifique-se de definir NEXT_PUBLIC_MAPBOX_TOKEN na Vercel.");
      return;
    }

    if (!mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12', // Estilo de ruas ultra leve e compatível
      center: defaultCenter,
      zoom: 14,
      attributionControl: false
    });

    mapRef.current = map;

    map.on('load', () => {
      // Pequeno atraso para garantir o dimensionamento perfeito da tela sem tela branca
      setTimeout(() => {
        map.resize();
      }, 200);

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
            'line-opacity': 0.6,
            'line-dasharray': [2, 2]
          }
        });
      }
    });

    // Captura GPS do Celular
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => {
          const coords = [pos.coords.longitude, pos.coords.latitude];
          setUserPos(coords);

          if (!userMarkerRef.current) {
            const el = document.createElement('div');
            el.style.cssText = 'width: 22px; height: 22px; background-color: #2563eb; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(37,99,235,0.8);';

            userMarkerRef.current = new mapboxgl.Marker(el)
              .setLngLat(coords)
              .addTo(map);

            map.flyTo({ center: coords, zoom: 15 });
          } else {
            userMarkerRef.current.setLngLat(coords);
          }
        },
        (err) => console.warn('Aviso de GPS:', err.message),
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

  // 2. Clique no Botão de Localização
  useEffect(() => {
    if (triggerRecenter > 0 && mapRef.current) {
      const posToUse = userPos || defaultCenter;
      mapRef.current.flyTo({ center: posToUse, zoom: 16, essential: true });
    }
  }, [triggerRecenter, userPos]);

  // 3. Clique no Botão "Ver Parada no Mapa"
  useEffect(() => {
    if (focusStopTrigger > 0 && mapRef.current && nearestStop) {
      mapRef.current.flyTo({
        center: [nearestStop.lon, nearestStop.lat],
        zoom: 18,
        essential: true
      });
    }
  }, [focusStopTrigger, nearestStop]);

  // 4. Traçar Rota ao Selecionar Destino
  useEffect(() => {
    if (!targetDestination || !mapRef.current || !token) return;

    const map = mapRef.current;
    const startCoords = userPos || defaultCenter;

    // Marcador do Destino
    if (destMarkerRef.current) destMarkerRef.current.remove();
    const destEl = document.createElement('div');
    destEl.style.cssText = 'background: #dc2626; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 16px; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);';
    destEl.innerText = '📍';
    destMarkerRef.current = new mapboxgl.Marker(destEl)
      .setLngLat([targetDestination.lon, targetDestination.lat])
      .addTo(map);

    async function calculateNavigation() {
      let stop = await fetchNearestRealBusStop(startCoords[1], startCoords[0]);

      if (!stop) {
        stop = {
          id: 'fallback_stop',
          name: 'Parada Próxima (Padrão)',
          lat: startCoords[1] + 0.001,
          lon: startCoords[0] + 0.001
        };
      }

      // Marcador da Parada
      if (stopMarkerRef.current) stopMarkerRef.current.remove();
      const stopEl = document.createElement('div');
      stopEl.style.cssText = 'background: #16a34a; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 16px; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);';
      stopEl.innerText = '🚌';
      stopMarkerRef.current = new mapboxgl.Marker(stopEl)
        .setLngLat([stop.lon, stop.lat])
        .addTo(map);

      // Traça Rota
      const routeData = await fetchMapboxWalkingRoute(
        startCoords[0], startCoords[1],
        stop.lon, stop.lat,
        token
      );

      if (routeData) {
        stop.distance = routeData.distance;

        if (map.getSource('route-walking')) {
          map.getSource('route-walking').setData({
            type: 'Feature',
            geometry: routeData.geometry
          });
        }
      } else {
        stop.distance = 120;
      }

      setNearestStop(stop);
      if (onNearestStopFound) onNearestStopFound(stop);

      const bounds = new mapboxgl.LngLatBounds()
        .extend(startCoords)
        .extend([stop.lon, stop.lat]);

      map.fitBounds(bounds, { padding: 60, maxZoom: 17 });
    }

    calculateNavigation();
  }, [targetDestination, userPos, token, onNearestStopFound]);

  return (
    <div className="w-full h-full min-h-full relative bg-slate-200">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
