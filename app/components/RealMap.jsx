'use client';

import { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ícone para a Posição Real do Usuário (GPS)
const userIcon = L.divIcon({
  className: 'custom-user-icon',
  html: `<div style="background-color: #2563eb; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 14px rgba(37,99,235,0.9); position: relative;">
          <div style="position: absolute; top: -4px; left: -4px; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #2563eb; animation: ping 1.5s infinite; opacity: 0.7;"></div>
         </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Componente filho para manipular o pan do mapa diretamente
function MapController({ triggerRecenter, onPosFound }) {
  const map = useMap();

  useEffect(() => {
    // Busca localização inicial
    map.locate({ setView: true, maxZoom: 16 });

    map.on('locationfound', (e) => {
      onPosFound([e.latlng.lat, e.latlng.lng]);
    });
  }, [map, onPosFound]);

  useEffect(() => {
    if (triggerRecenter > 0) {
      map.locate({ setView: false }).on('locationfound', (e) => {
        onPosFound([e.latlng.lat, e.latlng.lng]);
        map.flyTo(e.latlng, 16, { animate: true, duration: 1.2 });
      });
    }
  }, [triggerRecenter, map, onPosFound]);

  return null;
}

const RealMap = forwardRef(({ triggerRecenter }, ref) => {
  const [userPos, setUserPos] = useState(null);
  const defaultCenter = [-8.0631, -34.8711]; // Centro padrão RMR

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

        {/* Exibe o marcador do usuário no local do GPS */}
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
