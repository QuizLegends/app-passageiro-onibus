'use client';

import { useEffect, useRef, useState, forwardRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Token do Mapbox carregado a partir do seu .env.local
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// Coordenada padrão (Recife / Jaboatão)
const defaultCenter = [-34.8711, -8.0631]; // Mapbox usa [longitude, latitude]

// Busca rota real a pé pelas ruas usando a API do Mapbox
async function fetchMapboxWalkingRoute(startLon, startLat, endLon, endLat) {
  try {
    const token = mapboxgl.accessToken;
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${startLon},${startLat};${endLon},${endLat}?geometries=geojson&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        geometry: route.geometry,
        distance: Math.round(route.distance) // metros
      };
    }
  } catch (err) {
    console.error('Erro na Rota do Mapbox:', err);
  }
  return null;
}

// Busca a parada de ônibus real mais próxima usando a Overpass API/OSM
async function fetchNearestRealBusStop(lat, lon) {
  try {
    const query = `[out:json];(node["highway"="bus_stop"](around:700,${lat},${lon});node["public_transport"="platform"](around:700,${lat},${lon}););out;`;
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
  const lastDestinationIdRef = useRef(null);

  // 1. Inicializa o Mapa do Mapbox
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/navigation-day-v1', // Estilo vetor limpo (Waze/Uber)
      center: defaultCenter,
      zoom: 14,
      attributionControl: false
    });

    mapRef.current = map;

    // Configuração da camada para a linha azul translúcida
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
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#2563eb',
          'line-width': 5,
          'line-opacity': 0.5, // Semi-transparente para ver o nome da rua
          'line-dasharray': [2, 2] // Pontilhada
        }
      });
    });

    // Geolocalização Contínua do Usuário
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => {
          const coords = [pos.coords.longitude, pos.coords.latitude];
          setUserPos(coords);

          // Cria ou atualiza marcador do usuário (Ponto Azul)
          if (!userMarkerRef.current) {
            const el = document.createElement('div');
            el.className = 'custom-user-marker';
            el.style.cssText = 'width: 20px; height: 20px; background-color: #2563eb; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(37,99,235,0.8);';

            userMarkerRef.current = new mapboxgl.Marker(el)
              .setLngLat(coords)
              .addTo(map);

            map.flyTo({ center: coords, zoom: 15 });
          } else {
            userMarkerRef.current.setLngLat(coords);
          }
        },
        (err) => console.warn('Erro ao obter GPS:', err),
        { enableHighAccuracy: true }
      );
    }

    return () => map.remove();
  }, []);

  // 2. Botão "Minha Localização"
  useEffect(() => {
    if (triggerRecenter > 0 && mapRef.current && userPos) {
      mapRef.current.flyTo({ center: userPos, zoom: 16, essential: true });
    }
  }, [triggerRecenter, userPos]);

  // 3. Focar na Parada ("Ver no Mapa")
  useEffect(() => {
    if (focusStopTrigger > 0 && mapRef.current && nearestStop) {
      mapRef.current.flyTo({
        center: [nearestStop.lon, nearestStop.lat],
        zoom: 18,
        essential: true
      });
    }
  }, [focusStopTrigger, nearestStop]);

  // 4. Processar Destino Selecionado
  useEffect(() => {
    if (!targetDestination || !mapRef.current) return;

    const destId = `${targetDestination.lat}-${targetDestination.lon}`;
    if (lastDestinationIdRef.current === destId) return;
    lastDestinationIdRef.current = destId;

    const map = mapRef.current;
    const startCoords = userPos || defaultCenter;

    // Marcador do Destino (Pino Vermelho)
    if (destMarkerRef.current) destMarkerRef.current.remove();
    const destEl = document.createElement('div');
    destEl.style.cssText = 'background: #dc2626; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
    destEl.innerText = '📍';
    destMarkerRef.current = new mapboxgl.Marker(destEl)
      .setLngLat([targetDestination.lon, targetDestination.lat])
      .addTo(map);

    async function calculateNavigation() {
      // Busca a parada mais próxima
      let stop = await fetchNearestRealBusStop(startCoords[1], startCoords[0]);

      if (!stop) {
        stop = {
          id: 'fallback_stop',
          name: 'Parada de Embarque Próxima',
          lat: startCoords[1] + (targetDestination.lat - startCoords[1]) * 0.05,
          lon: startCoords[0] + (targetDestination.lon - startCoords[0]) * 0.05
        };
      }

      // Marcador da Parada (Ônibus Verde)
      if (stopMarkerRef.current) stopMarkerRef.current.remove();
      const stopEl = document.createElement('div');
      stopEl.style.cssText = 'background: #16a34a; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 15px; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
      stopEl.innerText = '🚌';
      stopMarkerRef.current = new mapboxgl.Marker(stopEl)
        .setLngLat([stop.lon, stop.lat])
        .addTo(map);

      // Traça rota a pé no Mapbox
      const routeData = await fetchMapboxWalkingRoute(
        startCoords[0], startCoords[1],
        stop.lon, stop.lat
      );

      if (routeData) {
        stop.distance = routeData.distance;

        // Atualiza a linha no mapa
        if (map.getSource('route-walking')) {
          map.getSource('route-walking').setData({
            type: 'Feature',
            geometry: routeData.geometry
          });
        }
      }

      setNearestStop(stop);
      if (onNearestStopFound) onNearestStopFound(stop);

      // Enquadra passageiro e parada
      const bounds = new mapboxgl.LngLatBounds()
        .extend(startCoords)
        .extend([stop.lon, stop.lat]);

      map.fitBounds(bounds, { padding: 60, maxZoom: 17 });
    }

    calculateNavigation();
  }, [targetDestination, userPos, onNearestStopFound]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
