'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';

const defaultCenter = [-34.918, -8.115]; // [lng, lat] Jaboatão / Recife

// Busca paradas reais de ônibus via API direta e gratuita do Overpass (OpenStreetMap)
async function fetchRealStopsFromOverpass(bounds) {
  const [south, west, north, east] = bounds;
  
  // Query Overpass para pegar nós de paradas de ônibus e plataformas de transporte
  const query = `
    [out:json][timeout:10];
    (
      node["highway"="bus_stop"](${south},${west},${north},${east});
      node["public_transport"="platform"](${south},${west},${north},${east});
      node["amenity"="bus_station"](${south},${west},${north},${east});
    );
    out body 50;
  `;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query)
    });
    
    if (!res.ok) return { type: 'FeatureCollection', features: [] };
    const data = await res.json();

    if (data && data.elements) {
      return {
        type: 'FeatureCollection',
        features: data.elements.map(el => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [el.lon, el.lat]
          },
          properties: {
            id: el.id.toString(),
            name: el.tags?.name || el.tags?.description || 'Parada de Ônibus',
            address: el.tags?.['addr:street'] ? `Rua: ${el.tags['addr:street']}` : 'Parada de transporte público'
          }
        }))
      };
    }
  } catch (err) {
    console.error('Erro ao buscar paradas no Overpass:', err);
  }
  return { type: 'FeatureCollection', features: [] };
}

const RealMap = forwardRef(({ triggerRecenter, onSelectStop, selectedStopForRoute }, ref) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);

  const [userPos, setUserPos] = useState(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Recentraliza no GPS somente ao clicar no botão
  useImperativeHandle(ref, () => ({
    recenter: () => {
      if (mapRef.current && userPos) {
        mapRef.current.flyTo({ center: userPos, zoom: 16, essential: true });
      }
    }
  }));

  // Atualiza as paradas buscando do Overpass de acordo com o limite visível do mapa
  const updateStops = async (map) => {
    if (!map) return;
    const b = map.getBounds();
    const boundsArray = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
    
    const geojson = await fetchRealStopsFromOverpass(boundsArray);

    if (map.getSource('bus-stops-source')) {
      map.getSource('bus-stops-source').setData(geojson);
    }
  };

  useEffect(() => {
    if (!token || mapRef.current || !mapContainerRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: defaultCenter,
      zoom: 15,
      attributionControl: false
    });

    mapRef.current = map;

    map.on('load', () => {
      setTimeout(() => map.resize(), 200);

      // Camada nativa das paradas (Fixas no solo do mapa)
      map.addSource('bus-stops-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'bus-stops-circle',
        type: 'circle',
        source: 'bus-stops-source',
        paint: {
          'circle-color': '#16a34a',
          'circle-radius': 13,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      map.addLayer({
        id: 'bus-stops-icon',
        type: 'symbol',
        source: 'bus-stops-source',
        layout: {
          'text-field': '🚌',
          'text-size': 13,
          'text-allow-overlap': true
        }
      });

      // Clique na parada
      map.on('click', 'bus-stops-circle', (e) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const coordinates = feature.geometry.coordinates.slice();
        const properties = feature.properties;

        new mapboxgl.Popup({ offset: 15 })
          .setLngLat(coordinates)
          .setHTML(`
            <div style="font-family: sans-serif; padding: 2px;">
              <strong style="font-size: 13px; color: #0f172a; display: block;">🚏 ${properties.name}</strong>
              <span style="font-size: 11px; color: #64748b; display: block; margin-top: 2px;">${properties.address}</span>
            </div>
          `)
          .addTo(map);

        if (onSelectStop) {
          onSelectStop({
            id: properties.id,
            name: properties.name,
            address: properties.address,
            lon: coordinates[0],
            lat: coordinates[1]
          });
        }
      });

      map.on('mouseenter', 'bus-stops-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'bus-stops-circle', () => {
        map.getCanvas().style.cursor = '';
      });

      // Carrega as paradas da área visível assim que o mapa carrega
      updateStops(map);
    });

    // Quando o usuário terminar de mover/arrastar o mapa, carrega as paradas da nova área
    map.on('moveend', () => {
      updateStops(map);
    });

    // Pega GPS e coloca marcador azul SEM puxar ou mexer a câmera do mapa
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => {
          const coords = [pos.coords.longitude, pos.coords.latitude];
          setUserPos(coords);

          if (!userMarkerRef.current) {
            const el = document.createElement('div');
            el.style.cssText = 'width: 18px; height: 18px; background-color: #2563eb; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(37,99,235,0.8);';

            userMarkerRef.current = new mapboxgl.Marker(el)
              .setLngLat(coords)
              .addTo(map);
          } else {
            userMarkerRef.current.setLngLat(coords);
          }
        },
        (err) => console.warn('Aviso GPS:', err.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [token]);

  return (
    <div className="w-full h-full min-h-full relative bg-slate-200">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
