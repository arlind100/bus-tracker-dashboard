import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Tooltip,
  useMap,
} from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';

export interface MapBus {
  id: string;
  label: string;
  routeLabel: string;
  lat: number;
  lng: number;
  color: string;
}

export interface MapPolyline {
  id: string;
  positions: LatLngExpression[];
  color: string;
}

// Skopje — the seeded data's city. A sensible default center.
const DEFAULT_CENTER: LatLngExpression = [41.9981, 21.4254];

/** Pans/zooms to fit the given bounds whenever they change. */
function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [bounds, map]);
  return null;
}

export function LiveMap({
  buses,
  polylines,
  selectedBusId,
  onSelectBus,
  bounds,
}: {
  buses: MapBus[];
  polylines: MapPolyline[];
  selectedBusId: string | null;
  onSelectBus: (id: string) => void;
  bounds: LatLngBoundsExpression | null;
}) {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={12}
      scrollWheelZoom
      className="h-full w-full"
      style={{ background: 'var(--muted)' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {polylines.map(pl => (
        <Polyline
          key={pl.id}
          positions={pl.positions}
          pathOptions={{ color: pl.color, weight: 4, opacity: 0.7 }}
        />
      ))}

      {buses.map(bus => {
        const selected = bus.id === selectedBusId;
        return (
          <CircleMarker
            key={bus.id}
            center={[bus.lat, bus.lng]}
            radius={selected ? 11 : 8}
            pathOptions={{
              color: '#ffffff',
              weight: selected ? 3 : 2,
              fillColor: bus.color,
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelectBus(bus.id) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="text-xs font-medium">{bus.label}</span>
              <span className="text-xs text-muted-foreground"> · {bus.routeLabel}</span>
            </Tooltip>
          </CircleMarker>
        );
      })}

      <FitBounds bounds={bounds} />
    </MapContainer>
  );
}
