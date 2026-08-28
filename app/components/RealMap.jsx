'use client';

import { useEffect, useState, useRef, forwardRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Busca rota real a pé dobrando as esquinas via API OSRM Foot
async function fetchWalkingRoute(startLat, startLon, endLat, endLon) {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      const coordinates = data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      const distance = Math.round(data.routes[0].distance);
      return { coordinates, distance };
    }
  } catch (err) {
    console.error('Erro ao buscar rota a pé:', err);
  }
  return null;
}

// Busca a parada de ônibus REAL mais próxima no OpenStreetMap (Overpass API)
async function fetchNearestRealBusStop(lat, lon) {
  try {
    // Procura por paradas reais de ônibus em um raio de até 600m da posição do passageiro
    const query = `[out:json];(node["highway"="bus_stop"](around:600,${lat},${lon});node["public_transport"="platform"](around:600,${lat},${lon}););out;`;
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
    console.error('Erro ao consultar API de paradas reais:', err);
  }

  return null;
}

function MapController({ triggerRecenter, onPosFound, targetDestination, onNearestStopFound, focusStopTrigger, nearestStop, setWalkingPath }) {
  const map = useMap();
  const userPosRef = useRef(null);
  const lastDestinationIdRef = useRef(null);

  // Posição inicial do GPS do passageiro
  useEffect(() => {
    map.locate({ enableHighAccuracy: true });

    const handleLocationFound = (e) => {
      const pos = [e.latlng.lat, e.latlng.lng];
      if (!userPosRef.current) {
        map.setView(pos, 16);
      }
      userPosRef.current = pos;
      onPosFound(pos);
    };

    map.on('locationfound', handleLocationFound);
    return () => map.off('locationfound', handleLocationFound);
  }, [map, onPosFound]);

  // Recentralizar botão "Minha localização"
  useEffect(() => {
    if (triggerRecenter > 0 && userPosRef.current) {
      map.flyTo(userPosRef.current, 16, { animate: true, duration: 0.8 });
    }
  }, [triggerRecenter, map]);

  // Animação de zoom ao clicar em "Ver no mapa"
  useEffect(() => {
    if (focusStopTrigger > 0 && nearestStop) {
      map.flyTo([nearestStop.lat, nearestStop.lon], 18, { animate: true, duration: 1 });
    }
  }, [focusStopTrigger, nearestStop, map]);

  // Processa a busca da parada REAL e gera apenas a linha de caminhada
  useEffect(() => {
    if (!targetDestination) {
      lastDestinationIdRef.current = null;
      setWalkingPath([]);
      return;
    }

    const currentDestId = `${targetDestination.lat}-${targetDestination.lon}`;
    if (lastDestinationIdRef.current === currentDestId) return;
    lastDestinationIdRef.current = currentDestId;

    let userLat = userPosRef.current ? userPosRef.current[0] : -8.0631;
    let userLon = userPosRef.current ? userPosRef.current[1] : -34.8711;

    async function processWalkToStop() {
      // 1. Busca Parada Real próxima
      let realStop = await fetchNearestRealBusStop(userLat, userLon);

      if (!realStop) {
        // Fallback caso a API esteja sem sinal na área exata
        realStop = {
          id: 'stop_fallback',
          name: 'Parada de Embarque Próxima',
          lat: userLat + (targetDestination.lat - userLat) * 0.04,
          lon: userLon + (targetDestination.lon - userLon) * 0.04
        };
      }

      // 2. Traça o caminho a pé até a parada pelas calçadas
      const walkRoute = await fetchWalkingRoute(userLat, userLon, realStop.lat, realStop.lon);

      if (walkRoute) {
        setWalkingPath(walkRoute.coordinates);
        realStop.distance = walkRoute.distance;
      } else {
        setWalkingPath([[userLat, userLon], [realStop.lat, realStop.lon]]);
        realStop.distance = 120;
      }

      onNearestStopFound(realStop);

      // Foca levemente no trecho do passageiro até a parada
      const bounds = L.latLngBounds([
        [userLat, userLon],
        [realStop.lat, realStop.lon]
      ]);
      map.fitBounds(bounds, { padding: [60, 60] });
    }

    processWalkToStop();
  }, [targetDestination, map, onNearestStopFound, setWalkingPath]);

  return null;
}

const RealMap = forwardRef(({ triggerRecenter, targetDestination, onNearestStopFound, focusStopTrigger }, ref) => {
  const [userPos, setUserPos] = useState(null);
  const [nearestStop, setNearestStop] = useState(null);
  const [walkingPath, setWalkingPath] = useState([]);
  const [icons, setIcons] = useState(null);
  const defaultCenter = [-8.0631, -34.8711];

  const handleStopFound = useCallback((stop) => {
    setNearestStop(stop);
    if (onNearestStopFound) onNearestStopFound(stop);
  }, [onNearestStopFound]);

  const handlePosFound = useCallback((pos) => {
    setUserPos(pos);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIcons({
        userIcon: L.divIcon({
          className: '',
          html: `<div style="background-color: #2563eb; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(37,99,235,0.8);"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        }),
        busStopIcon: L.divIcon({
          className: '',
          html: `<div style="background-color: #16a34a; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 15px; color: white;">🚌</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        }),
        destinationIcon: L.divIcon({
          className: '',
          html: `<div style="background-color: #dc2626; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 14px; color: white;">📍</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      });
    }
  }, []);

  if (!icons) return null;

  return (
    <div className="w-full h-full relative">
      <MapContainer center={defaultCenter} zoom={14} zoomControl={false} className="w-full h-full z-0">
        <TileLayer 
          attribution='&copy; OpenStreetMap' 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
        />

        <MapController 
          triggerRecenter={triggerRecenter} 
          onPosFound={handlePosFound} 
          targetDestination={targetDestination}
          onNearestStopFound={handleStopFound}
          focusStopTrigger={focusStopTrigger}
          nearestStop={nearestStop}
          setWalkingPath={setWalkingPath}
        />

        {/* 1. Passageiro */}
        {userPos && (
          <Marker position={userPos} icon={icons.userIcon}>
            <Popup>Você está aqui</Popup>
          </Marker>
        )}

        {/* 2. Destino Selecionado */}
        {targetDestination && (
          <Marker position={[targetDestination.lat, targetDestination.lon]} icon={icons.destinationIcon}>
            <Popup>{targetDestination.name}</Popup>
          </Marker>
        )}

        {/* 3. Parada de Embarque Real */}
        {nearestStop && (
          <Marker position={[nearestStop.lat, nearestStop.lon]} icon={icons.busStopIcon}>
            <Popup>
              <strong>{nearestStop.name}</strong><br />
              A {nearestStop.distance}m de caminhada
            </Popup>
          </Marker>
        )}

        {/* ROTA A PÉ: Azul semi-transparente (opacity: 0.55) para não tapar o nome das ruas */}
        {walkingPath.length > 0 && (
          <Polyline 
            positions={walkingPath} 
            pathOptions={{ 
              color: '#3b82f6', 
              dashArray: '8, 10', 
              weight: 5,
              opacity: 0.55
            }} 
          />
        )}
      </MapContainer>
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
