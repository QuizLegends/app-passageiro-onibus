'use client';

import { useEffect, useState, useRef, forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ícone do Usuário (Bolinha Azul)
const userIcon = L.divIcon({
  className: 'custom-user-icon',
  html: `<div style="background-color: #2563eb; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 14px rgba(37,99,235,0.9); position: relative;">
          <div style="position: absolute; top: -5px; left: -5px; width: 26px; height: 26px; border-radius: 50%; border: 2px solid #2563eb; animation: ping 1.5s infinite; opacity: 0.7;"></div>
         </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

// Ícone do Ponto/Parada de Ônibus (Verde)
const busStopIcon = L.divIcon({
  className: 'custom-bus-stop-icon',
  html: `<div style="background-color: #16a34a; width: 26px; height: 26px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 14px; color: white;">🚌</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13]
});

// Ícone do Destino (Vermelho)
const destinationIcon = L.divIcon({
  className: 'custom-dest-icon',
  html: `<div style="background-color: #dc2626; width: 26px; height: 26px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 14px; color: white;">📍</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13]
});

// Função para calcular distância entre duas coordenadas em metros (Fórmula de Haversine)
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

function MapController({ triggerRecenter, onPosFound, targetDestination, onNearestStopFound }) {
  const map = useMap();
  const userPosRef = useRef(null);

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

  useEffect(() => {
    if (triggerRecenter > 0) {
      if (userPosRef.current) {
        map.flyTo(userPosRef.current, 16, { animate: true, duration: 0.3 });
      } else {
        map.locate({ setView: true, maxZoom: 16 });
      }
    }
  }, [triggerRecenter, map]);

  // Busca a parada de ônibus real mais próxima do usuário via API do Overpass
  useEffect(() => {
    if (!userPosRef.current || !targetDestination) return;

    const [userLat, userLon] = userPosRef.current;

    // Ajusta a visão do mapa para enquadrar a posição atual e o destino
    const bounds = L.latLngBounds([userPosRef.current, [targetDestination.lat, targetDestination.lon]]);
    map.fitBounds(bounds, { padding: [50, 50] });

    // Consulta de paradas reais em um raio de 600m
    const query = `[out:json];node["highway"="bus_stop"](around:600,${userLat},${userLon});out;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.elements && data.elements.length > 0) {
          let nearest = null;
          let minDistance = Infinity;

          data.elements.forEach((stop) => {
            const dist = getDistanceInMeters(userLat, userLon, stop.lat, stop.lon);
            if (dist < minDistance) {
              minDistance = dist;
              nearest = {
                id: stop.id,
                name: stop.tags.name || 'Parada de Ônibus',
                lat: stop.lat,
                lon: stop.lon,
                distance: dist
              };
            }
          });

          if (nearest && onNearestStopFound) {
            onNearestStopFound(nearest);
          }
        }
      })
      .catch((err) => console.error('Erro ao buscar parada mais próxima:', err));
  }, [targetDestination, map, onNearestStopFound]);

  return null;
}

const RealMap = forwardRef(({ triggerRecenter, targetDestination, onNearestStopFound }, ref) => {
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
        />

        {/* 1. Bonequinho Azul (Passageiro) */}
        {userPos && (
          <Marker position={userPos} icon={userIcon}>
            <Popup>Você está aqui!</Popup>
          </Marker>
        )}

        {/* 2. Marcador do Destino */}
        {targetDestination && (
          <Marker position={[targetDestination.lat, targetDestination.lon]} icon={destinationIcon}>
            <Popup>{targetDestination.name}</Popup>
          </Marker>
        )}

        {/* 3. Marcador da Parada de Ônibus mais próxima */}
        {nearestStop && (
          <Marker position={[nearestStop.lat, nearestStop.lon]} icon={busStopIcon}>
            <Popup>
              <strong>{nearestStop.name}</strong><br />
              A {nearestStop.distance}m de você (~{Math.ceil(nearestStop.distance / 80)} min a pé)
            </Popup>
          </Marker>
        )}

        {/* Trajeto pontilhado a pé: do passageiro até a parada */}
        {userPos && nearestStop && (
          <Polyline
            positions={[userPos, [nearestStop.lat, nearestStop.lon]]}
            pathOptions={{ color: '#2563eb', dashArray: '6, 8', weight: 4 }}
          />
        )}

        {/* Trajeto do ônibus: da parada até o destino */}
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
