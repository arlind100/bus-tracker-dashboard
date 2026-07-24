import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radio, Crosshair, Navigation, MapPinOff, SlidersHorizontal } from 'lucide-react';
import { latLngBounds, type LatLngBoundsExpression } from 'leaflet';
import { liveService } from '@/services/live.service';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { LoadingState } from '@/components/ui/spinner';
import { ErrorState, EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BusStatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import { LiveMap, type MapBus, type MapPolyline } from '@/pages/live/LiveMap';
import { CheckpointDialog } from '@/pages/live/CheckpointDialog';
import type { Bus, BusLocation, BusStatus } from '@/types';

const STATUS_COLOR: Record<string, string> = {
  Active: '#16a34a',
  Offline: '#94a3b8',
  Maintenance: '#f59e0b',
};
const FILTERS: (BusStatus | 'All')[] = ['All', 'Active', 'Offline', 'Maintenance'];

export function LiveOperationsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['live-data'],
    queryFn: () => liveService.getLiveData(),
  });

  // Realtime overlay of bus locations (reads only — no interval writes).
  const [liveLocations, setLiveLocations] = useState<Record<string, BusLocation> | null>(null);
  useEffect(() => {
    const unsub = liveService.subscribeToLocations(locations => {
      const map: Record<string, BusLocation> = {};
      locations.forEach(l => { map[l.busId ?? l.id] = l; });
      setLiveLocations(map);
    });
    return unsub;
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<(BusStatus | 'All')>('All');
  const [search, setSearch] = useState('');
  const [checkpointOpen, setCheckpointOpen] = useState(false);

  const locations = liveLocations ?? data?.locationsByBusId ?? {};
  const routesById = data?.routesById ?? {};
  const buses = data?.buses ?? [];

  const effectiveStatus = (bus: Bus): string => locations[bus.id]?.status || bus.status || 'Offline';

  const positionFor = (bus: Bus): [number, number] | null => {
    const loc = locations[bus.id];
    if (loc?.lat != null && loc?.lng != null) return [loc.lat, loc.lng];
    const path = bus.routeId ? routesById[bus.routeId]?.routePath : undefined;
    if (path && path.length > 0) return [path[0].lat, path[0].lng];
    return null;
  };

  const filteredBuses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return buses.filter(b => {
      const statusOk = filter === 'All' || effectiveStatus(b) === filter;
      const routeLabel = b.routeId ? routesById[b.routeId]?.name ?? '' : '';
      const textOk = !q || `${b.busNumber ?? ''} ${b.plate ?? ''} ${routeLabel}`.toLowerCase().includes(q);
      return statusOk && textOk;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buses, filter, search, locations, routesById]);

  const statusCounts = useMemo(() => {
    const c = { All: buses.length, Active: 0, Offline: 0, Maintenance: 0 } as Record<string, number>;
    buses.forEach(b => { c[effectiveStatus(b)] = (c[effectiveStatus(b)] ?? 0) + 1; });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buses, locations]);

  const mapBuses: MapBus[] = useMemo(() => {
    return filteredBuses
      .map(b => {
        const pos = positionFor(b);
        if (!pos) return null;
        return {
          id: b.id,
          label: b.busNumber || b.id,
          routeLabel: b.routeId ? routesById[b.routeId]?.name ?? b.routeId : '—',
          lat: pos[0],
          lng: pos[1],
          color: STATUS_COLOR[effectiveStatus(b)] ?? STATUS_COLOR.Offline,
        } satisfies MapBus;
      })
      .filter((b): b is MapBus => b !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredBuses, locations, routesById]);

  const polylines: MapPolyline[] = useMemo(() => {
    return Object.values(routesById)
      .filter(r => (r.routePath?.length ?? 0) >= 2)
      .map(r => ({
        id: r.id,
        positions: r.routePath!.map(p => [p.lat, p.lng] as [number, number]),
        color: r.color || '#2563eb',
      }));
  }, [routesById]);

  const bounds: LatLngBoundsExpression | null = useMemo(() => {
    const pts: [number, number][] = mapBuses.map(b => [b.lat, b.lng]);
    if (pts.length === 0) return null;
    return latLngBounds(pts).pad(0.2);
  }, [mapBuses]);

  const selectedBus = buses.find(b => b.id === selectedId) ?? null;
  const selectedRoute = selectedBus?.routeId ? routesById[selectedBus.routeId] ?? null : null;
  const selectedLocation = selectedBus ? locations[selectedBus.id] ?? null : null;

  if (isLoading) return <LoadingState label="Loading live operations…" />;
  if (isError) {
    return (
      <div>
        <PageHeader title="Live Operations" />
        <Card><ErrorState onRetry={() => refetch()} /></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Live Operations"
        description="Monitor the fleet and push manual checkpoint updates."
        actions={
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            Live
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        {/* Bus list panel */}
        <Card className="flex h-[calc(100svh-15rem)] min-h-[420px] flex-col overflow-hidden">
          <div className="border-b border-border p-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search fleet…" />
            <div className="mt-3 flex flex-wrap gap-1">
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    filter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f}
                  <span className={cn('rounded px-1 text-[10px]', filter === f ? 'bg-white/20' : 'bg-background')}>
                    {statusCounts[f] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredBuses.length === 0 ? (
              <EmptyState icon={Radio} title="No buses match" />
            ) : (
              <ul className="divide-y divide-border">
                {filteredBuses.map(bus => {
                  const status = effectiveStatus(bus);
                  const hasPos = positionFor(bus) !== null;
                  return (
                    <li key={bus.id}>
                      <button
                        onClick={() => setSelectedId(bus.id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                          selectedId === bus.id ? 'bg-accent' : 'hover:bg-muted/50',
                        )}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full ring-2 ring-white"
                          style={{ background: STATUS_COLOR[status] ?? STATUS_COLOR.Offline }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{bus.busNumber || bus.id}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {bus.routeId ? routesById[bus.routeId]?.name ?? bus.routeId : 'No route'}
                          </p>
                        </div>
                        {!hasPos && <MapPinOff className="size-3.5 shrink-0 text-muted-foreground" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* Map + selected detail */}
        <div className="flex flex-col gap-4">
          <Card className="h-[calc(100svh-15rem)] min-h-[420px] overflow-hidden p-0">
            <LiveMap
              buses={mapBuses}
              polylines={polylines}
              selectedBusId={selectedId}
              onSelectBus={setSelectedId}
              bounds={bounds}
            />
          </Card>

          {selectedBus && (
            <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Navigation className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{selectedBus.busNumber || selectedBus.id}</p>
                    <BusStatusBadge status={(effectiveStatus(selectedBus) as BusStatus)} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {selectedRoute?.name ?? 'No route'}
                    {selectedLocation?.currentStop && (
                      <>
                        {' · '}
                        <Crosshair className="mb-0.5 inline size-3" /> {selectedLocation.currentStop}
                        {selectedLocation.nextStop ? ` → ${selectedLocation.nextStop}` : ''}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Button onClick={() => setCheckpointOpen(true)}>
                <SlidersHorizontal className="size-4" />
                Update checkpoint
              </Button>
            </Card>
          )}
        </div>
      </div>

      <CheckpointDialog
        open={checkpointOpen}
        onOpenChange={setCheckpointOpen}
        bus={selectedBus}
        route={selectedRoute}
        location={selectedLocation}
      />
    </div>
  );
}
