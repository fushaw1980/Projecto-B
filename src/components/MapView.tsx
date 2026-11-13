import React, { useState, useEffect, useMemo, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Sparkles,
  Navigation,
  X,
  User,
  Star,
  Wrench,
  MapPin,
  Clock,
  ArrowRight,
  Camera,
  LayoutGrid
} from 'lucide-react';
import { calculateHaversineDistanceKm, estimateTravelTime, getProviderCoordinates } from '../lib/geoUtils';

const MARKER_ICONS: Record<string, L.DivIcon> = {};
const getCustomMarker = (type: 'job' | 'provider' | 'user') => {
  if (!MARKER_ICONS[type]) {
    const colors = {
      job: '#10B981',
      provider: '#E65100',
      user: '#3B82F6'
    };
    MARKER_ICONS[type] = L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-8 h-8 rounded-full blur-[2px] opacity-20" style="background-color: ${colors[type]}"></div>
          <div class="relative w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center" style="background-color: ${colors[type]}">
            <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
          </div>
          <div class="absolute -bottom-1 w-1.5 h-1.5 rotate-45" style="background-color: ${colors[type]}"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 24],
      popupAnchor: [0, -20]
    });
  }
  return MARKER_ICONS[type];
};

const ChangeView = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
};

const MapControls = ({
  userPos,
  setMapType,
  mapType
}: {
  userPos: [number, number];
  setMapType: (t: string) => void;
  mapType: string;
}) => {
  const map = useMap();

  return (
    <div className="absolute bottom-10 right-6 z-[1000] flex flex-col gap-3">
      <button
        onClick={() => map.flyTo(userPos, 15)}
        className="w-14 h-14 bg-white rounded-2xl shadow-premium border border-natural-line/50 flex items-center justify-center text-natural-heading hover:text-natural-accent transition-colors active:scale-90"
        title="Minha Localização"
      >
        <MapPin className="w-6 h-6" />
      </button>
      <button
        onClick={() => setMapType(mapType === 'streets' ? 'satellite' : 'streets')}
        className="w-14 h-14 bg-white rounded-2xl shadow-premium border border-natural-line/50 flex items-center justify-center text-natural-heading hover:text-natural-accent transition-colors active:scale-90 overflow-hidden group"
      >
        {mapType === 'streets' ? (
          <div className="flex flex-col items-center">
            <Camera className="w-5 h-5 mb-0.5" />
            <span className="text-[7px] font-black uppercase">Sat</span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <LayoutGrid className="w-5 h-5 mb-0.5" />
            <span className="text-[7px] font-black uppercase">Map</span>
          </div>
        )}
      </button>
    </div>
  );
};

export interface MapViewProps {
  jobs?: any[];
  providers?: any[];
  userPos: [number, number];
  t: any;
  selectedProvider?: any | null;
  onSelectProvider?: (p: any) => void;
}

const MapView = memo(({
  jobs = [],
  providers = [],
  userPos,
  t,
  selectedProvider,
  onSelectProvider
}: MapViewProps) => {
  const [mapType, setMapType] = useState('streets');
  const [localSelectedProvider, setLocalSelectedProvider] = useState<any | null>(null);

  const activeTargetProvider = selectedProvider || localSelectedProvider;

  const activeTargetData = useMemo(() => {
    if (!activeTargetProvider) return null;
    const coords = getProviderCoordinates(activeTargetProvider.id, userPos);
    const distanceKm = calculateHaversineDistanceKm(userPos, coords);
    const travel = estimateTravelTime(distanceKm);
    return { coords, distanceKm, travel };
  }, [activeTargetProvider, userPos]);

  return (
    <div className="w-full h-[65vh] rounded-[3rem] overflow-hidden border-4 border-white shadow-premium relative z-10 group mt-4">
      <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-2 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-natural-line/50 shadow-premium flex items-center gap-2 transition-transform group-hover:scale-105">
          <Sparkles className="w-4 h-4 text-natural-accent" />
          <span className="text-[10px] font-black uppercase tracking-widest text-natural-heading">Explorar arredores</span>
        </div>
        <div className="bg-natural-accent text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider self-start shadow-sm shadow-orange-200">
          {providers.length} {t.verified || 'Verificados'}
        </div>
      </div>

      {activeTargetProvider && activeTargetData && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl border-2 border-natural-accent shadow-2xl p-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-natural-accent shrink-0">
              <Navigation className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-black uppercase text-natural-heading tracking-tight truncate">
                  {activeTargetProvider.name}
                </p>
                <span className="bg-orange-50 text-natural-accent font-black text-[9px] px-1.5 py-0.5 rounded border border-orange-200 shrink-0">
                  {activeTargetData.travel.formattedDistance} (Haversine)
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] font-black text-natural-heading">
                <span className="flex items-center gap-1 text-slate-800" title="Carro ou Chapa urbano">
                  🚗 ~{activeTargetData.travel.carMinutes} min
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1 text-slate-800" title="Txopela ou Moto">
                  🛵 ~{activeTargetData.travel.motoMinutes} min
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1 text-slate-800" title="Caminhada a pé">
                  🚶 ~{activeTargetData.travel.walkingMinutes} min
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setLocalSelectedProvider(null)}
              className="p-2 text-natural-muted hover:text-black rounded-lg text-xs"
              title="Limpar seleção"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSelectProvider?.(activeTargetProvider)}
              className="px-3.5 py-2 bg-natural-accent text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-transform"
            >
              Ver Perfil
            </button>
          </div>
        </div>
      )}

      <MapContainer center={userPos} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        {mapType === 'streets' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            attribution='Imagery &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        <ChangeView center={userPos} />
        <MapControls userPos={userPos} setMapType={setMapType} mapType={mapType} />

        {activeTargetData && (
          <Polyline
            positions={[userPos, activeTargetData.coords]}
            pathOptions={{ color: '#E65100', weight: 4, dashArray: '6, 8', opacity: 0.9 }}
          />
        )}

        {providers.map(p => {
          const providerPos = getProviderCoordinates(p.id, userPos);
          const distance = calculateHaversineDistanceKm(userPos, providerPos);
          const travel = estimateTravelTime(distance);

          return (
            <Marker
              key={p.id}
              position={providerPos}
              icon={getCustomMarker('provider')}
              eventHandlers={{
                click: () => {
                  setLocalSelectedProvider(p);
                }
              }}
            >
              <Popup className="premium-popup">
                <div className="p-3 min-w-[200px]">
                  <div className="flex items-center gap-3 mb-2.5 pb-2.5 border-b border-natural-line/30">
                    <div className="w-10 h-10 rounded-2xl bg-natural-surface border border-natural-line overflow-hidden shadow-sm shrink-0 flex items-center justify-center">
                      {p.photo ? (
                        <img src={p.photo} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="w-5 h-5 text-natural-muted/60" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-sm text-natural-heading leading-tight truncate">{p.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-black text-natural-heading">{p.rating}</span>
                        <span className="text-[9px] font-bold text-natural-muted">({p.jobs} jobs)</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-2.5">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-3 h-3 text-natural-accent shrink-0" />
                      <p className="font-black text-[10px] text-natural-accent uppercase tracking-wider">{p.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-natural-muted shrink-0" />
                      <p className="text-[10px] text-natural-muted font-bold">
                        {p.bairro}
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-2xl mb-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black uppercase text-orange-900 flex items-center gap-1 tracking-wider">
                        <Clock className="w-3 h-3 text-natural-accent shrink-0" /> Tempo Estimado
                      </span>
                      <span className="text-[9px] font-black text-natural-accent font-mono bg-white px-1.5 py-0.5 rounded border border-orange-200">
                        {travel.formattedDistance}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center mt-1.5">
                      <div className="bg-white p-1 rounded-xl border border-orange-100 shadow-2xs">
                        <span className="text-[8px] font-bold text-slate-500 block">🚗 Carro</span>
                        <span className="text-[10px] font-black text-natural-heading leading-none">~{travel.carMinutes}m</span>
                      </div>
                      <div className="bg-white p-1 rounded-xl border border-orange-100 shadow-2xs">
                        <span className="text-[8px] font-bold text-slate-500 block">🛵 Txopela</span>
                        <span className="text-[10px] font-black text-natural-heading leading-none">~{travel.motoMinutes}m</span>
                      </div>
                      <div className="bg-white p-1 rounded-xl border border-orange-100 shadow-2xs">
                        <span className="text-[8px] font-bold text-slate-500 block">🚶 A pé</span>
                        <span className="text-[10px] font-black text-natural-heading leading-none">~{travel.walkingMinutes}m</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setLocalSelectedProvider(p);
                      onSelectProvider?.(p);
                    }}
                    className="w-full bg-natural-accent text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Ver Perfil e Contratar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {jobs.filter(j => j.lat && j.lng).map(job => (
          <Marker key={job.id} position={[job.lat!, job.lng!]} icon={getCustomMarker('job')}>
            <Popup className="premium-popup">
              <div className="p-3 min-w-[140px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <p className="font-black text-[10px] text-green-600 uppercase tracking-widest">Biscate Aberto</p>
                </div>
                <p className="font-black text-lg text-natural-heading leading-none mb-1">{job.amount} MT</p>
                <p className="font-bold text-[10px] text-natural-muted mb-2 uppercase tracking-tight">{job.category}</p>
                <div className="bg-natural-surface p-2 rounded-xl border border-natural-line/50">
                  <p className="text-[10px] text-natural-heading font-medium line-clamp-3 italic opacity-80">"{job.description}"</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <Marker position={userPos} icon={getCustomMarker('user')}>
          <Popup className="premium-popup">
            <div className="p-2 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[min(3px,0.2em)] text-blue-600 text-center">Você está aqui</p>
              <div className="w-full h-[1px] bg-blue-100" />
              <p className="text-[9px] text-center font-bold text-natural-muted">Pesquisando profissionais próximos...</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
});

export default MapView;
