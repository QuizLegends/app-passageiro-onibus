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

// Controla as ações de GPS de forma rápida
function MapController({ triggerRecenter, onPosFound }) {
  const map = useMap();
  const currentPosRef = useRef(null);

  // Monitora a localização em tempo real de forma leve
  useEffect(() => {
    map.locate({ 
      setView: true, 
      maxZoom: 16,
      watch: true, // Mantém o GPS escutando mudanças sem reatrasar o clique
      enableHighAccuracy: false // Desativa a busca lenta por altíssima precisão imediata
    });

    const handleLocationFound = (e) => {
      const pos = [e.latlng.lat, e.latlng.lng];
      currentPosRef.current = pos;
      onPosFound(pos);
    };

    map.on('locationfound', handleLocationFound);

    return () => {
      map.off('locationfound', handleLocationFound);
    };
  }, [map, onPosFound]);

  // Ao clicar no botão, move instantaneamente para a posição já armazenada
  useEffect(() => {
    if (triggerRecenter > 0 && currentPosRef.current) {
      // Animação rápida (0.4s) em vez do voo demorado
      map.flyTo(currentPosRef.current, 16, { animate: true, duration: 0.4 });
    } else if (triggerRecenter > 0) {
      // Caso ainda não tenha a posição gravada, pede via navegador rapidamente
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        currentPosRef.current = coords;
        onPosFound(coords);
        map.flyTo(coords, 16, { animate: true, duration: 0.4 });
      });
    }
  }, [triggerRecenter, map, onPosFound]);

  return null;
}

const RealMap = forwardRef(({ triggerRecenter }, ref) => {
  const [userPos, setUserPos] = useState(null);
  const defaultCenter = [-8.0631, -34.8711]; // Centro padrão RMR (Recife/Jaboatão)

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
