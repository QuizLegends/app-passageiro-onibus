'use client';

import { useEffect, useState, useRef, forwardRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Busca rota real pelas ruas via API OSRM (Gratuita)
async function fetchRealRoute(startLat, startLon, endLat, endLon, profile = 'foot') {
  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      // Converte [lon, lat] do GeoJSON para [lat, lon] do Leaflet
      const coordinates = data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      const distance = Math.round(data.routes[0].distance);
      return { coordinates, distance };
    }
  } catch (err) {
    console.error('Erro ao buscar rota real das ruas:', err);
  }
  return null;
}

// Busca a parada de ônibus cadastrada mais próxima no OpenStreetMap
async function fetchNearestRealBusStop(lat, lon) {
  try {
    // Procura por paradas de ônibus em um raio de 500m
    const query = `[out:json];node["highway"="bus_stop"](around:500,${lat},${lon});out;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.elements && data.elements.length > 0) {
      const stop = data.elements[0];
      return {
        id: stop.id,
        name: stop.tags.name || 'Parada de Ônibus',
        lat: stop.lat,
        lon: stop.lon
      };
    }
  } catch (err) {
    console.error('Erro ao buscar parada real:', err);
  }

  // Fallback seguro (retorna ponto próximo na rua se a API falhar)
  return null;
}

function MapController({ triggerRecenter, onPosFound, targetDestination, onNearestStopFound, focusStopTrigger, nearestStop, setWalkingPath, setBusPath }) {
  const map = useMap();
  const userPosRef = useRef(null);
  const lastDestinationIdRef = useRef(null);

  // Localização inicial do passageiro
  useEffect(() => {
    map.locate({ enableHighAccuracy: true });

    const handleLocationFound = (e) => {
      const pos = [e.latlng.lat, e.latlng.lng];
      if (!userPosRef.current) {
        map.setView(pos, 15);
      }
      userPosRef.current = pos;
      onPosFound(pos);
    };

    map.on('locationfound', handleLocationFound);
    return () => map.off('locationfound', handleLocationFound);
  }, [map, onPosFound]);

  // Recentralizar
  useEffect(() => {
    if (triggerRecenter > 0 && userPosRef.current) {
      map.flyTo(userPosRef.current, 16, { animate: true, duration: 0.8 });
    }
  }, [triggerRecenter, map]);

  // Animação de foco na parada
  useEffect(() => {
    if (focusStopTrigger > 0 && nearestStop) {
      map.flyTo([nearestStop.lat, nearestStop.lon], 18, { animate: true, duration: 1 });
    }
  }, [focusStopTrigger, nearestStop, map]);

  // Processa o destino: Busca Parada Real e Traça as Rotas pelas Pistas/Calçadas
  useEffect(() => {
    if (!targetDestination) {
      lastDestinationIdRef.current = null;
      setWalkingPath([]);
      setBusPath([]);
      return;
    }

    const currentDestId = `${targetDestination.lat}-${targetDestination.lon}`;
    if (lastDestinationIdRef.current === currentDestId) return;
    lastDestinationIdRef.current = currentDestId;

    let userLat = userPosRef.current ? userPosRef.current[0] : -8.0631;
    let userLon = userPosRef.current ? userPosRef.current[1] : -34.8711;

    async function processNavigation() {
      // 1. Busca parada de ônibus real mais próxima da pessoa
      let realStop = await fetchNearestRealBusStop(userLat, userLon);

      if (!realStop) {
        // Se não achar via Overpass, coloca a parada 150m a frente no caminho do destino
        realStop = {
          id: 'fallback_stop',
          name: 'Parada Próxima',
          lat: userLat + (targetDestination.lat - userLat) * 0.05,
          lon: userLon + (targetDestination.lon - userLon) * 0.05
        };
      }

      // 2. Calcula Rota a pé (A pé até a Parada)
      const walkRoute = await fetchRealRoute(userLat, userLon, realStop.lat, realStop.lon, 'foot');
      
      // 3. Calcula Rota do Ônibus (Da Parada até o Destino final)
      const busRoute = await fetchRealRoute(realStop.lat, realStop.lon, targetDestination.lat, targetDestination.lon, 'driving');

      if (walkRoute) {
        setWalkingPath(walkRoute.coordinates);
        realStop.distance = walkRoute.distance;
      } else {
        setWalkingPath([[userLat, userLon], [realStop.lat, realStop.lon]]);
        realStop.distance = 100;
      }

      if (busRoute) {
        setBusPath(busRoute.coordinates);
      } else {
        setBusPath([[realStop.lat, realStop.lon], [targetDestination.lat, targetDestination.lon]]);
      }

      onNearestStopFound(realStop);

      // Ajusta enquadramento do mapa
      const bounds = L.latLngBounds([
        [userLat, userLon],
        [targetDestination.lat, targetDestination.lon]
      ]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    processNavigation();
  }, [targetDestination, map, onNearestStopFound, setWalkingPath, setBusPath]);

  return null;
}

const RealMap = forwardRef(({ triggerRecenter, targetDestination, onNearestStopFound, focusStopTrigger }, ref) => {
  const [userPos, setUserPos] = useState(null);
  const [nearestStop, setNearestStop] = useState(null);
  const [walkingPath, setWalkingPath] = useState([]);
  const [busPath, setBusPath] = useState([]);
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
          html: `<div style="background-color: #16a34a; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 14px; color: white;">🚌</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
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
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <MapController 
          triggerRecenter={triggerRecenter} 
          onPosFound={handlePosFound} 
          targetDestination={targetDestination}
          onNearestStopFound={handleStopFound}
          focusStopTrigger={focusStopTrigger}
          nearestStop={nearestStop}
          setWalkingPath={setWalkingPath}
          setBusPath={setBusPath}
        />

        {/* 1. Passageiro */}
        {userPos && (
          <Marker position={userPos} icon={icons.userIcon}>
            <Popup>Você está aqui</Popup>
          </Marker>
        )}

        {/* 2. Destino */}
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
              A {nearestStop.distance}m da sua posição
            </Popup>
          </Marker>
        )}

        {/* ROTA A PÉ (Curvando as esquinas da calçada em azul) */}
        {walkingPath.length > 0 && (
          <Polyline positions={walkingPath} pathOptions={{ color: '#2563eb', dashArray: '6, 8', weight: 5 }} />
        )}

        {/* ROTA DO ÔNIBUS (Curvando as pistas e avenidas em verde) */}
        {busPath.length > 0 && (
          <Polyline positions={busPath} pathOptions={{ color: '#16a34a', weight: 5 }} />
        )}
      </MapContainer>
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
