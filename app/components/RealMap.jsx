'use client';

import { useEffect, useState, useRef, forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ícone da Posição Real do Usuário
const userIcon = L.divIcon({
  className: 'custom-user-icon',
  html: `<div style="background-color: #2563eb; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 14px rgba(37,99,235,0.9); position: relative;">
          <div style="position: absolute; top: -4px; left: -4px; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #2563eb; animation: ping 1.5s infinite; opacity: 0.7;"></div>
         </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

function MapController({ triggerRecenter, onPosFound }) {
  const map = useMap();
  const userPosRef = useRef(null);

  // 1. Pega a localização apenas UMA VEZ ao abrir o app para definir o marcador inicial
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = [position.coords.latitude, position.coords.longitude];
          userPosRef.current = coords;
          onPosFound(coords);
          // Move o mapa para o usuário apenas na carga inicial
          map.setView(coords, 16);
        },
        (err) => console.log("Erro ao obter GPS inicial:", err),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
      );
    }
  }, [map, onPosFound]);

  // 2. Dispara a centralização RÁPIDA apenas quando você clica no botão
  useEffect(() => {
    if (triggerRecenter > 0) {
      if (userPosRef.current) {
        // Se já temos a posição salva, move imediatamente em 0.3s
        map.flyTo(userPosRef.current, 16, { animate: true, duration: 0.3 });
      }

      // Em segundo plano, atualiza a coordenada para manter o bonequinho no lugar correto
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = [position.coords.latitude, position.coords.longitude];
            userPosRef.current = coords;
            onPosFound(coords);
          },
          null,
          { enableHighAccuracy: false }
        );
      }
    }
  }, [triggerRecenter, map, onPosFound]);

  return null;
}

const RealMap = forwardRef(({ triggerRecenter }, ref) => {
  const [userPos, setUserPos] = useState(null);
  const defaultCenter = [-8.0631, -34.8711]; // Recife/Jaboatão

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
        
        <MapController triggerRecenter={triggerRecenter} onPosFound={setUserPos} />

        {userPos && (
          <Marker position={userPos} icon={userIcon}>
            <Popup>Você está aqui!</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
