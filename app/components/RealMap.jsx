'use client';

import { useEffect, useState, useRef, forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ícone do Usuário / Passageiro (Bolinha Azul com pulso)
const userIcon = L.divIcon({
  className: 'custom-user-icon',
  html: `<div style="background-color: #2563eb; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 14px rgba(37,99,235,0.9); position: relative;">
          <div style="position: absolute; top: -5px; left: -5px; width: 26px; height: 26px; border-radius: 50%; border: 2px solid #2563eb; animation: ping 1.5s infinite; opacity: 0.7;"></div>
         </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

// Ícone da Parada de Ônibus (Verde)
const busStopIcon = L.divIcon({
  className: 'custom-bus-stop-icon',
  html: `<div style="background-color: #16a34a; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.4); font-size: 14px; color: white;">🚌</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

// Ícone do Destino (Vermelho)
const destinationIcon = L.divIcon({
  className: 'custom-dest-icon',
  html: `<div style="background-color: #dc2626; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.4); font-size: 14px; color: white;">📍</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

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

function MapController({ triggerRecenter, onPosFound, targetDestination, onNearestStopFound, focusStopTrigger }) {
  const map = useMap();
  const userPosRef = useRef(null);
  const nearestStopRef = useRef(null);

  // Captura a posição do GPS do passageiro
  useEffect(() => {
    map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });

    const handleLocationFound = (e) => {
      const pos = [e.latlng.lat, e.latlng.lng];
      userPosRef.current = pos;
      onPosFound(pos);
    };

    map.on('locationfound', handleLocationFound);
    return () => map.off('locationfound', handleLocationFound);
  }, [map, onPosFound]);

  // Recentralizar no Usuário quando clicar no botão da barra inferior
  useEffect(() => {
    if (triggerRecenter > 0 && userPosRef.current) {
      map.flyTo(userPosRef.current, 16, { animate: true, duration: 0.5 });
    }
  }, [triggerRecenter, map]);

  // ANIMAÇÃO VER NO MAPA: Foca e dá super zoom na Parada de Embarque ao tocar no card/botão
  useEffect(() => {
    if (focusStopTrigger > 0 && nearestStopRef.current) {
      map.flyTo([nearestStopRef.current.lat, nearestStopRef.current.lon], 18, {
        animate: true,
        duration: 1.0
      });
    }
  }, [focusStopTrigger, map]);

  // Calcula a parada de embarque instantaneamente assim que o destino é selecionado
  useEffect(() => {
    if (!targetDestination) return;

    let userLat = -8.0631;
    let userLon = -34.8711;

    if (userPosRef.current) {
      [userLat, userLon] = userPosRef.current;
    }

    // Ajusta a câmera do mapa para abranger o passageiro e o destino
    const bounds = L.latLngBounds([
      [userLat, userLon],
      [targetDestination.lat, targetDestination.lon]
    ]);
    map.fitBounds(bounds, { padding: [60, 60] });

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

    nearestStopRef.current = calculatedStop;
    onNearestStopFound(calculatedStop);
  }, [targetDestination, map, onNearestStopFound]);

  return null;
}

const RealMap = forwardRef(({ triggerRecenter, targetDestination, onNearestStopFound, focusStopTrigger }, ref) => {
  const [userPos, setUserPos] = useState(null);
  const [nearestStop, setNearestStop] = useState(null);
  const defaultCenter = [-8.0631, -34.8711];

  const handleStopFound = (stop) => {
    setNearestStop(stop);
    if (onNearestStopFound) onNearestStopFound(stop);
  };

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
          onPosFound={setUserPos} 
          targetDestination={targetDestination}
          onNearestStopFound={handleStopFound}
          focusStopTrigger={focusStopTrigger}
        />

        {/* 1. Passageiro (Bolinha azul) */}
        {userPos && (
          <Marker position={userPos} icon={userIcon}>
            <Popup>Você está aqui</Popup>
          </Marker>
        )}

        {/* 2. Destino Selecionado (Pino vermelho) */}
        {targetDestination && (
          <Marker position={[targetDestination.lat, targetDestination.lon]} icon={destinationIcon}>
            <Popup>{targetDestination.name}</Popup>
          </Marker>
        )}

        {/* 3. Parada de Embarque (Pino verde de ônibus) */}
        {nearestStop && (
          <Marker position={[nearestStop.lat, nearestStop.lon]} icon={busStopIcon}>
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
