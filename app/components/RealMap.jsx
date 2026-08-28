'use client';

import { useEffect, useRef, useState, forwardRef } from 'react';
import mapboxgl from 'mapbox-gl';

const defaultCenter = [-34.8711, -8.0631]; // Recife/Jaboatão [lng, lat]

// Busca rota a pé na Mapbox Directions API
async function fetchMapboxWalkingRoute(startLon, startLat, endLon, endLat, token) {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${startLon},${startLat};${endLon},${endLat}?geometries=geojson&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      return {
        geometry: data.routes[0].geometry,
        distance: Math.round(data.routes[0].distance) // distância em metros
      };
    }
  } catch (err) {
    console.error('Erro na Rota Mapbox:', err);
  }
  return null;
}

// Busca parada de ônibus mais próxima no OpenStreetMap
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
  const [tokenError, setTokenError] = useState(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // 1. Inicialização do Mapa e Verificação de Token
  useEffect(() => {
    if (!token) {
      console.error('NEXT_PUBLIC_MAPBOX_TOKEN não encontrada!');
      setTokenError(true);
      return;
    }

    mapboxgl.accessToken = token;
    if (mapRef.current) return;

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/navigation-day-v1',
        center: defaultCenter,
        zoom: 14,
        attributionControl: false
      });

      mapRef.current = map;

      map.on('load', () => {
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
            'line-opacity': 0.55,
            'line-dasharray': [2, 2]
          }
        });
      });

      // GPS do Usuário
      if (navigator.geolocation) {
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

              map.flyTo({ center: coords, zoom: 15 });
            } else {
              userMarkerRef.current.setLngLat(coords);
            }
          },
          (err) => console.warn('Erro GPS:', err),
          { enableHighAccuracy: true }
        );
      }
    } catch (e) {
      console.error('Erro ao carregar Mapbox:', e);
      setTokenError(true);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [token]);

  // 2. Traçar rota e buscar parada ao definir destino
  useEffect(() => {
    if (!targetDestination || !mapRef.current || !token) return;

    const map = mapRef.current;
    const startCoords = userPos || defaultCenter;

    if (destMarkerRef.current) destMarkerRef.current.remove();
    const destEl = document.createElement('div');
    destEl.style.cssText = 'background: #dc2626; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
    destEl.innerText = '📍';
    destMarkerRef.current = new mapboxgl.Marker(destEl)
      .setLngLat([targetDestination.lon, targetDestination.lat])
      .addTo(map);

    async function calculateNavigation() {
      let stop = await fetchNearestRealBusStop(startCoords[1], startCoords[0]);

      if (!stop) {
        stop = {
          id: 'fallback_stop',
          name: 'Parada de Embarque Próxima',
          lat: startCoords[1] + (targetDestination.lat - startCoords[1]) * 0.05,
          lon: startCoords[0] + (targetDestination.lon - startCoords[0]) * 0.05
        };
      }

      if (stopMarkerRef.current) stopMarkerRef.current.remove();
      const stopEl = document.createElement('div');
      stopEl.style.cssText = 'background: #16a34a; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 15px; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
      stopEl.innerText = '🚌';
      stopMarkerRef.current = new mapboxgl.Marker(stopEl)
        .setLngLat([stop.lon, stop.lat])
        .addTo(map);

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
        stop.distance = 150;
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

  if (tokenError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center">
        <p className="text-red-400 font-bold mb-2">Erro ao carregar o Mapa</p>
        <p className="text-sm text-gray-300">A chave <code className="bg-gray-800 px-2 py-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> precisa estar configurada na Vercel.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
