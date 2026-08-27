'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ícone personalizado para os Ônibus
const busIcon = L.divIcon({
  className: 'custom-bus-icon',
  html: `<div style="background-color: #7e22ce; color: white; padding: 6px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          🚌
        </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// Ícone para a Posição do Usuário
const userIcon = L.divIcon({
  className: 'custom-user-icon',
  html: `<div style="background-color: #2563eb; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(37,99,235,0.8);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

export default function RealMap() {
  // Coordenadas centrais de Recife (Praça da República / Marco Zero)
  const recifeCenter = [-8.0631, -34.8711];

  // Simulação da rota da Linha 503 (Caxangá / TI Recife)
  const routePolyline = [
    [-8.0631, -34.8711],
    [-8.0590, -34.8810],
    [-8.0520, -34.8950],
    [-8.0450, -34.9100]
  ];

  // Marcadores de Ônibus ao longo da rota
  const busPositions = [
    { id: 1, pos: [-8.0590, -34.8810], name: "Linha 503 - Ônibus 104" },
    { id: 2, pos: [-8.0450, -34.9100], name: "Linha 503 - Ônibus 112" }
  ];

  return (
    <MapContainer 
      center={recifeCenter} 
      zoom={14} 
      zoomControl={false}
      className="w-full h-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Posição do Usuário */}
      <Marker position={recifeCenter} icon={userIcon}>
        <Popup>Você está aqui (Recife)</Popup>
      </Marker>

      {/* Desenho do Trajeto do Ônibus */}
      <Polyline positions={routePolyline} color="#7e22ce" weight={6} opacity={0.8} />

      {/* Marcadores dos Ônibus */}
      {busPositions.map(bus => (
        <Marker key={bus.id} position={bus.pos} icon={busIcon}>
          <Popup>{bus.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
