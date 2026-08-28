'use client';

import { useEffect, useState, useRef, forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ícone da Posição Real do Usuário (Bolinha Azul com efeito de onda)
const userIcon = L.divIcon({
  className: 'custom-user-icon',
  html: `<div style="background-color: #2563eb; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 14px rgba(37,99,235,0.9); position: relative;">
          <div style="position: absolute; top: -5px; left: -5px; width: 26px; height: 26px; border-radius: 50%; border: 2px solid #2563eb; animation: ping 1.5s infinite; opacity: 0.7;"></div>
         </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

function MapController({ triggerRecenter, onPosFound }) {
  const map = useMap();
  const userPosRef = useRef(null);

  // 1. Busca a localização assim que abre o app e centraliza UMA ÚNICA VEZ
  useEffect(() => {
    map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });

    const handleLocationFound = (e) => {
      const pos = [e.latlng.lat, e.latlng.lng];
      userPosRef.current = pos;
      onPosFound(pos);
    };

    map.on('locationfound', handleLocationFound);

    return () => {
      map.off('locationfound', handleLocationFound);
    };
  }, [map, onPosFound]);

  // 2. Responde instantaneamente ao clique no botão "Minha localização"
  useEffect(() => {
    if (triggerRecenter > 0) {
      if (userPosRef.current) {
        // Se a posição já estiver em memória, voa instantaneamente em 0.3s
        map.flyTo(userPosRef.current, 16, { animate: true, duration: 0.3 });
      } else {
        // Caso a posição ainda não tenha sido capturada, faz uma nova busca rápida
        map.locate({ setView: true, maxZoom: 16 });
      }
    }
  }, [triggerRecenter, map]);

  return null;
}

const RealMap = forwardRef(({ triggerRecenter }, ref) => {
  const [userPos, setUserPos] = useState(null);
  // Coordenadas padrão da Região Metropolitana do Recife (Jaboatão / Recife)
  const defaultCenter = [-8.0631, -34.8711];

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

        {/* Exibe o bonequinho/bolinha azul onde você estiver */}
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
