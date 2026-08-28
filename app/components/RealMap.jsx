'use client';

import { useEffect, useState, useRef, forwardRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Cálculo preciso da distância em metros entre dois pontos de GPS (Haversine)
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function MapController({ triggerRecenter, onPosFound, targetDestination, onNearestStopFound, focusStopTrigger, nearestStop }) {
  const map = useMap();
  const userPosRef = useRef(null);
  const lastDestinationIdRef = useRef(null);

  // Captura a posição do GPS do passageiro apenas para obter o ponto inicial (sem forçar a câmera o tempo todo)
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

  // Recentralizar no Usuário quando clicar no botão da barra inferior
  useEffect(() => {
    if (triggerRecenter > 0 && userPosRef.current) {
      map.flyTo(userPosRef.current, 16, { animate: true, duration: 0.8 });
    }
  }, [triggerRecenter, map]);

  // ANIMAÇÃO VER NO MAPA: Foca suavemente na Parada de Embarque ao tocar no card/botão
  useEffect(() => {
    if (focusStopTrigger > 0 && nearestStop) {
      map.flyTo([nearestStop.lat, nearestStop.lon], 18, {
        animate: true,
        duration: 1
      });
    }
  }, [focusStopTrigger, nearestStop, map]);

  // Calcula a parada de embarque e ajusta a visão APENAS quando o destino REALMENTE mudar
  useEffect(() => {
    if (!targetDestination) {
      lastDestinationIdRef.current = null;
      return;
    }

    const currentDestId = `${targetDestination.lat}-${targetDestination.lon}`;
    
    // Evita recalcular e mover a câmera se for o mesmo destino já processado
    if (lastDestinationIdRef.current === currentDestId) return;

    lastDestinationIdRef.current = currentDestId;

    let userLat = -8.0631;
    let userLon = -34.8711;

    if (userPosRef.current) {
      [userLat, userLon] = userPosRef.current;
    }

    // Ajusta o enquadramento suavemente para mostrar origem e destino
    const bounds = L.latLngBounds([
      [userLat, userLon],
      [targetDestination.lat, targetDestination.lon]
    ]);
    map.fitBounds(bounds, { padding: [50, 50] });

    // Ponto de parada calculado na direção do percurso
    const stopLat = userLat + (targetDestination.lat - userLat) * 0.08;
    const stopLon = userLon + (targetDestination.lon - userLon) * 0.08;
    const dist = getDistanceInMeters(userLat, userLon, stopLat, stopLon);

    const calculatedStop = {
      id: 'nearest_stop_main',
      name: 'Parada de Embarque Próxima',
      lat: stopLat,
      lon: stopLon,
      distance: dist > 50 ? dist : 120
    };

    onNearestStopFound(calculatedStop);
  }, [targetDestination, map, onNearestStopFound]);

  return null;
}

const RealMap = forwardRef(({ triggerRecenter, targetDestination, onNearestStopFound, focusStopTrigger }, ref) => {
  const [userPos, setUserPos] = useState(null);
  const [nearestStop, setNearestStop] = useState(null);
  const [icons, setIcons] = useState(null);
  const defaultCenter = [-8.0631, -34.8711];

  // Callback estável para não disparar re-renders desnecessários
  const handleStopFound = useCallback((stop) => {
    setNearestStop(stop);
    if (onNearestStopFound) onNearestStopFound(stop);
  }, [onNearestStopFound]);

  const handlePosFound = useCallback((pos) => {
    setUserPos(pos);
  }, []);

  // Cria os ícones do Leaflet ancorados corretamente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIcons({
        userIcon: L.divIcon({
          className: '',
          html: `<div style="background-color: #2563eb; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(37,99,235,0.8); position: relative;"></div>`,
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
      <MapContainer 
        center={defaultCenter} 
        zoom={14} 
        zoomControl={false}
        className="w-full h-full z-0"
      >
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
        />

        {/* 1. Passageiro (Ponto azul) */}
        {userPos && (
          <Marker position={userPos} icon={icons.userIcon}>
            <Popup>Você está aqui</Popup>
          </Marker>
        )}

        {/* 2. Destino Selecionado (Pino vermelho) */}
        {targetDestination && (
          <Marker position={[targetDestination.lat, targetDestination.lon]} icon={icons.destinationIcon}>
            <Popup>{targetDestination.name}</Popup>
          </Marker>
        )}

        {/* 3. Parada de Embarque (Pino verde) */}
        {nearestStop && (
          <Marker position={[nearestStop.lat, nearestStop.lon]} icon={icons.busStopIcon}>
            <Popup>
              <strong>{nearestStop.name}</strong><br />
              A {nearestStop.distance}m (~{Math.ceil(nearestStop.distance / 80)} min a pé)
            </Popup>
          </Marker>
        )}

        {/* Linha pontilhada azul (Passageiro -> Parada) */}
        {userPos && nearestStop && (
          <Polyline
            positions={[userPos, [nearestStop.lat, nearestStop.lon]]}
            pathOptions={{ color: '#2563eb', dashArray: '6, 8', weight: 4 }}
          />
        )}

        {/* Linha verde contínua (Parada -> Destino) */}
        {nearestStop && targetDestination && (
          <Polyline
            positions={[[nearestStop.lat, nearestStop.lon], [targetDestination.lat, targetDestination.lon]]}
            pathOptions={{ color: '#16a34a', weight: 4 }}
          />
        )}
      </MapContainer>
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
