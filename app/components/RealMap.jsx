'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';

const defaultCenter = [-34.918, -8.115]; // Jaboatão / Recife [lng, lat]

// Dados simulados de linhas para dar dinamismo imediato ao passageiro
const mockBusSchedule = [
  { line: '061 - Piedade', destination: 'TI Tancredo Neves', etaMin: 4 },
  { line: '062 - Jardim Piedade', destination: 'TI Aeroporto', etaMin: 12 },
  { line: '910 - Piedade / Rio Doce', destination: 'TI Rio Doce', etaMin: 18 },
  { line: '044 - Massangana / TI T. Neves', destination: 'TI Tancredo Neves', etaMin: 25 },
];

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

// Busca MÚLTIPLAS paradas de ônibus reais num raio do ponto central via Overpass API
async function fetchNearbyBusStops(lat, lon) {
  try {
    const query = `[out:json];(node["highway"="bus_stop"](around:1200,${lat},${lon});node["public_transport"="platform"](around:1200,${lat},${lon}););out;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.elements && data.elements.length > 0) {
      return data.elements.map((stop) => ({
        id: stop.id,
        name: stop.tags.name || stop.tags['description'] || stop.tags['ref'] || 'Parada de Ônibus',
        lat: stop.lat,
        lon: stop.lon
      }));
    }
  } catch (err) {
    console.error('Erro ao buscar paradas da área:', err);
  }
  return [];
}

const RealMap = forwardRef(({ triggerRecenter, targetDestination, onSelectStop, selectedStopForRoute }, ref) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const stopMarkersRef = useRef([]);
  const destMarkerRef = useRef(null);
  const activePopupRef = useRef(null);

  const [userPos, setUserPos] = useState(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useImperativeHandle(ref, () => ({
    recenter: () => {
      if (mapRef.current && userPos) {
        mapRef.current.flyTo({ center: userPos, zoom: 16, essential: true });
      }
    }
  }));

  // Função para renderizar marcadores de paradas no mapa
  const loadStopsOnMap = async (map, centerLat, centerLon) => {
    const stops = await fetchNearbyBusStops(centerLat, centerLon);

    // Limpa marcadores antigos de paradas
    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = [];

    stops.forEach((stop) => {
      const el = document.createElement('div');
      el.style.cssText = 'background: #16a34a; width: 30px; height: 30px; border-radius: 50%; border: 2.5px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px; color: white; box-shadow: 0 2px 6px rgba(0,0,0,0.35); cursor: pointer; transition: transform 0.2s;';
      el.innerText = '🚌';

      el.addEventListener('mouseenter', () => el.style.transform = 'scale(1.2)');
      el.addEventListener('mouseleave', () => el.style.transform = 'scale(1)');

      // Gerador de horário em tempo real dinâmico
      const now = new Date();
      const formatTime = (minutesToAdd) => {
        const t = new Date(now.getTime() + minutesToAdd * 60000);
        return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      };

      const popupHTML = `
        <div style="font-family: sans-serif; padding: 4px; max-width: 210px;">
          <strong style="font-size: 13px; color: #1e293b; display: block; margin-bottom: 4px;">🚏 ${stop.name}</strong>
          <div style="font-size: 10px; color: #64748b; margin-bottom: 6px; font-weight: bold;">PRÓXIMOS ÔNIBUS:</div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between; background: #f1f5f9; padding: 4px 6px; border-radius: 6px; font-size: 11px;">
              <span><strong>062</strong> - Jr. Piedade</span>
              <strong style="color: #16a34a;">${formatTime(5)} (${5} min)</strong>
            </div>
            <div style="display: flex; justify-content: space-between; background: #f1f5f9; padding: 4px 6px; border-radius: 6px; font-size: 11px;">
              <span><strong>061</strong> - Piedade / T. Neves</span>
              <strong style="color: #2563eb;">${formatTime(14)} (${14} min)</strong>
            </div>
            <div style="display: flex; justify-content: space-between; background: #f1f5f9; padding: 4px 6px; border-radius: 6px; font-size: 11px;">
              <span><strong>910</strong> - Rio Doce</span>
              <strong style="color: #64748b;">${formatTime(22)} (${22} min)</strong>
            </div>
          </div>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([stop.lon, stop.lat])
        .setPopup(popup)
        .addTo(map);

      // Evento de clique na parada
      el.addEventListener('click', () => {
        if (onSelectStop) {
          onSelectStop({
            ...stop,
            schedules: [
              { line: '062 - Jardim Piedade', time: formatTime(5), inMin: 5 },
              { line: '061 - Piedade / T. Neves', time: formatTime(14), inMin: 14 },
              { line: '910 - Piedade / Rio Doce', time: formatTime(22), inMin: 22 }
            ]
          });
        }
      });

      stopMarkersRef.current.push(marker);
    });
  };

  // 1. Inicialização do Mapa
  useEffect(() => {
    if (!token) return;
    if (!mapContainerRef.current || mapRef.current) return;

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
            'line-opacity': 0.7,
            'line-dasharray': [2, 2]
          }
        });
      }

      // Carrega as paradas da área inicial
      loadStopsOnMap(map, defaultCenter[1], defaultCenter[0]);
    });

    // Atualiza paradas se o usuário arrastar o mapa
    map.on('moveend', () => {
      const center = map.getCenter();
      loadStopsOnMap(map, center.lat, center.lng);
    });

    // Captura GPS do Celular
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
            loadStopsOnMap(map, pos.coords.latitude, pos.coords.longitude);
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

  // 2. Centralizar
  useEffect(() => {
    if (triggerRecenter > 0 && mapRef.current) {
      const posToUse = userPos || defaultCenter;
      mapRef.current.flyTo({ center: posToUse, zoom: 16, essential: true });
    }
  }, [triggerRecenter, userPos]);

  // 3. Traçar Rota para a Parada Selecionada
  useEffect(() => {
    if (!selectedStopForRoute || !mapRef.current || !token) return;

    const map = mapRef.current;
    const startCoords = userPos || defaultCenter;

    async function drawRouteToStop() {
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

        const bounds = new mapboxgl.LngLatBounds()
          .extend(startCoords)
          .extend([selectedStopForRoute.lon, selectedStopForRoute.lat]);

        map.fitBounds(bounds, { padding: 80, maxZoom: 17 });
      }
    }

    drawRouteToStop();
  }, [selectedStopForRoute, userPos, token]);

  return (
    <div className="w-full h-full min-h-full relative bg-slate-200">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
