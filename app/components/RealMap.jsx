'use client';

import { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
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

// Ícone para os Ônibus de Recife
const busIcon = L.divIcon({
  className: 'custom-bus-icon',
  html: `<div style="background-color: #7e22ce; color: white; padding: 5px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-size: 13px; text-align: center;">🚌</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

// Controlador interno do mapa para ações de navegação
const MapController = forwardRef(({ userPos, setUserPos }, ref) => {
  const map = useMap();

  const goToUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newPos = [latitude, longitude];
          setUserPos(newPos);
          map.flyTo(newPos, 16, { animate: true, duration: 1.5 });
        },
        (error) => {
          alert("Não foi possível obter sua localização. Verifique se o GPS está ativado e se você deu permissão no navegador.");
        },
        { enableHighAccuracy: true }
      );
    }
  };

  useImperativeHandle(ref, () => ({
    centerOnUser: goToUserLocation
  }));

  // Busca a localização assim que abre o mapa
  useEffect(() => {
    goToUserLocation();
  }, []);

  return userPos ? (
    <Marker position={userPos} icon={userIcon}>
      <Popup>Você está aqui!</Popup>
    </Marker>
  ) : null;
});

MapController.displayName = 'MapController';

const RealMap = forwardRef((props, ref) => {
  // Posição inicial padrão enquanto carrega o GPS
  const [userPos, setUserPos] = useState(null);
  const defaultCenter = [-8.0631, -34.8711]; // Centro base RMR

  // Rota de teste (Caxangá / TI Recife)
  const routePolyline = [
    [-8.0631, -34.8711],
    [-8.0590, -34.8810],
    [-8.0520, -34.8950],
    [-8.0450, -34.9100]
  ];

  const busPositions = [
    { id: 1, pos: [-8.0590, -34.8810], name: "Linha 503 - Veículo 104" },
    { id: 2, pos: [-8.0450, -34.9100], name: "Linha 503 - Veículo 112" }
  ];

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
        
        <MapController ref={ref} userPos={userPos} setUserPos={setUserPos} />

        <Polyline positions={routePolyline} color="#7e22ce" weight={5} opacity={0.7} />

        {busPositions.map(bus => (
          <Marker key={bus.id} position={bus.pos} icon={busIcon}>
            <Popup>{bus.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
