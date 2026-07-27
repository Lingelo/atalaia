import React, { useState } from 'react';
import { WatchZone, MapTileLayer } from '../types';
import { InteractiveMap } from './InteractiveMap';

interface WatchZonesViewProps {
  watchZones: WatchZone[];
  onAddWatchZone: (zone: Omit<WatchZone, 'id'>) => void;
  onToggleWatchZone: (id: string) => void;
  onDeleteWatchZone: (id: string) => void;
  tileLayerType: MapTileLayer;
  onChangeTileLayer: (layer: MapTileLayer) => void;
}

export const WatchZonesView: React.FC<WatchZonesViewProps> = ({
  watchZones,
  onAddWatchZone,
  onToggleWatchZone,
  onDeleteWatchZone,
  tileLayerType,
  onChangeTileLayer,
}) => {
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // Form State
  const [name, setName] = useState<string>('');
  const [radiusKm, setRadiusKm] = useState<number>(15);
  const [condition, setCondition] = useState<'all' | 'major'>('all');
  const [quietHoursStart, setQuietHoursStart] = useState<string>('23:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>('07:00');
  const [pickerPos, setPickerPos] = useState<{ lat: number; lng: number }>({
    lat: 37.3167,
    lng: -8.6333,
  });
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } else {
      alert('Seu navegador não suporta Notificações Desktop.');
    }
  };

  const handlePickerPosChange = (lat: number, lng: number) => {
    setPickerPos({ lat, lng });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor insira um nome para a localização.');
      return;
    }

    onAddWatchZone({
      name: name.trim(),
      locationName: `Lat: ${pickerPos.lat.toFixed(2)}, Lng: ${pickerPos.lng.toFixed(2)}`,
      lat: pickerPos.lat,
      lng: pickerPos.lng,
      radiusKm,
      condition,
      active: true,
      quietHoursStart,
      quietHoursEnd,
    });

    setSavedSuccessMsg(`Nova área de alerta "${name.trim()}" criada com sucesso!`);
    setName('');
    setTimeout(() => setSavedSuccessMsg(null), 3000);
  };

  return (
    <div className="flex-1 pb-16 md:pb-0 flex flex-col md:flex-row w-full h-full overflow-hidden bg-[#121415]">
      {/* LEFT COLUMN: ALERTS LIST */}
      <section className="w-full md:w-[420px] lg:w-[460px] h-full flex flex-col border-r border-[#333536] bg-[#121415] flex-shrink-0">
        <div className="p-4 border-b border-[#333536]">
          <h2 className="font-['Inter'] text-[24px] font-semibold text-[#e2e2e3] mb-3">Alertas</h2>

          {/* Browser Notification Banner */}
          {notificationPermission !== 'granted' && (
            <div className="bg-[#282a2b] p-3 rounded border border-[#333536] flex items-start gap-3">
              <span class="material-symbols-outlined text-[#ffb3ad] mt-0.5">notifications_active</span>
              <div className="flex-1">
                <p className="font-['Inter'] text-[14px] font-semibold text-[#e2e2e3]">
                  Notificações do navegador desativadas.
                </p>
                <p className="font-['Inter'] text-[13px] text-[#e5bdb9] mb-2">
                  Ative para receber alertas imediatos no computador.
                </p>
                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  className="font-['Inter'] text-[12px] font-bold uppercase tracking-wider text-[#121415] bg-[#e2e2e3] px-3 py-1.5 rounded hover:bg-white transition-colors"
                >
                  Ativar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* List of Active Subscriptions */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#333536]">
          {watchZones.map((zone) => (
            <div
              key={zone.id}
              className={`p-4 flex items-center gap-4 hover:bg-[#1a1c1d] transition-colors ${
                !zone.active ? 'opacity-50' : ''
              }`}
            >
              {/* Radius Icon Thumbnail */}
              <div className="w-14 h-14 rounded border border-[#333536] flex-shrink-0 relative overflow-hidden bg-[#0c0e0f] flex items-center justify-center">
                <div className="w-10 h-10 border border-[#ffb3ad] rounded-full bg-[#ffb3ad]/15 flex items-center justify-center">
                  <span class="material-symbols-outlined text-[16px] text-[#ffb3ad]">radar</span>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-['Inter'] text-[16px] font-semibold text-[#e2e2e3] truncate">
                  {zone.name}
                </h3>
                <p className="font-['Inter'] text-[13px] text-[#e5bdb9] mt-0.5 truncate">
                  {zone.radiusKm} km · {zone.condition === 'all' ? 'Qualquer ocorrência' : 'Apenas grandes incêndios'}
                </p>
              </div>

              {/* Action Toggle Switch */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleWatchZone(zone.id)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    zone.active ? 'bg-[#ffb3ad]' : 'bg-[#333536]'
                  }`}
                  title={zone.active ? 'Desativar Alerta' : 'Ativar Alerta'}
                >
                  <div
                    className={`bg-[#121415] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      zone.active ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteWatchZone(zone.id)}
                  className="p-1 text-[#e5bdb9] hover:text-[#ef4444] transition-colors"
                  title="Remover Área"
                >
                  <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          ))}

          {watchZones.length === 0 && (
            <div className="p-8 text-center text-[#e5bdb9] text-sm">
              Nenhuma área de alerta configurada. Use o formulário ao lado para criar.
            </div>
          )}
        </div>
      </section>

      {/* RIGHT COLUMN: NEW AREA FORM & INTERACTIVE MAP PICKER */}
      <section className="flex-1 h-full overflow-y-auto bg-[#121415] flex flex-col">
        {/* Interactive Map Picker Area */}
        <div className="h-64 md:h-[320px] w-full border-b border-[#333536] relative bg-[#0c0e0f]">
          <InteractiveMap
            incidents={[]}
            watchZones={[]}
            onSelectIncident={() => {}}
            tileLayerType={tileLayerType}
            onChangeTileLayer={onChangeTileLayer}
            isPickerMode={true}
            pickerPos={{ lat: pickerPos.lat, lng: pickerPos.lng, radiusKm: radiusKm }}
            onPickerPosChange={handlePickerPosChange}
            className="w-full h-full"
          />

          {/* Floating Simulated Alert Preview Overlay */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-[#1e2021]/95 border border-[#333536] rounded p-3 flex gap-3 z-[400] shadow-2xl backdrop-blur-md pointer-events-none">
            <div className="w-10 h-10 rounded bg-[#d8262c] flex items-center justify-center flex-shrink-0">
              <span class="material-symbols-outlined text-[#fff2f1] material-symbols-filled text-[20px]">
                local_fire_department
              </span>
            </div>
            <div>
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="font-['Inter'] text-[11px] font-bold text-[#e2e2e3] uppercase tracking-wider">
                  FOGO.PT
                </span>
                <span className="font-['Inter'] text-[11px] text-[#e5bdb9]">Agora</span>
              </div>
              <p className="font-['Inter'] text-[13px] text-[#e2e2e3] leading-tight">
                Nova ocorrência a {(radiusKm * 0.4).toFixed(1)} km de {name || 'sua localização'} — Em Curso, 94 operacionais
              </p>
            </div>
          </div>
        </div>

        {/* Form Details Container */}
        <div className="p-6 md:p-8 max-w-2xl mx-auto w-full">
          {savedSuccessMsg && (
            <div className="mb-4 p-3 bg-[#10b981]/20 border border-[#10b981] text-[#10b981] rounded text-sm text-center font-semibold">
              {savedSuccessMsg}
            </div>
          )}

          <h2 className="font-['Inter'] text-[24px] font-semibold text-[#e2e2e3] mb-6">
            Nova área de alerta
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Location Name */}
            <div>
              <label className="block font-['Inter'] text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider mb-2">
                Nome da localização
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Casa, Escritório, Terreno..."
                className="w-full bg-[#1e2021] border border-[#333536] rounded px-4 py-3 font-['Inter'] text-[16px] text-[#e2e2e3] placeholder:text-[#e5bdb9]/50 focus:border-[#ffb3ad] focus:outline-none transition-colors"
              />
            </div>

            {/* Radius Slider */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="block font-['Inter'] text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider">
                  Raio de vigilância
                </label>
                <span className="font-['Inter'] text-[20px] font-bold text-[#e2e2e3] tabular-nums">
                  {radiusKm} km
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full accent-[#ffb3ad] cursor-pointer"
              />
              <div className="flex justify-between mt-1 font-['Inter'] text-[12px] text-[#e5bdb9]">
                <span>1 km</span>
                <span>50 km</span>
              </div>
            </div>

            <hr className="border-[#333536]" />

            {/* Alert Condition Radio Group */}
            <div>
              <label className="block font-['Inter'] text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider mb-3">
                Condição de alerta
              </label>
              <div className="flex flex-col gap-2">
                <label
                  onClick={() => setCondition('all')}
                  className={`flex items-center p-3 border rounded cursor-pointer transition-colors ${
                    condition === 'all'
                      ? 'border-[#ffb3ad] bg-[#1e2021]'
                      : 'border-[#333536] bg-[#121415] hover:bg-[#1a1c1d]'
                  }`}
                >
                  <input
                    type="radio"
                    name="trigger"
                    checked={condition === 'all'}
                    onChange={() => setCondition('all')}
                    className="accent-[#ffb3ad]"
                  />
                  <div className="ml-3">
                    <span className="block font-['Inter'] text-[15px] font-semibold text-[#e2e2e3]">
                      Qualquer ocorrência
                    </span>
                    <span className="block font-['Inter'] text-[13px] text-[#e5bdb9]">
                      Assim que um foco for reportado.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => setCondition('major')}
                  className={`flex items-center p-3 border rounded cursor-pointer transition-colors ${
                    condition === 'major'
                      ? 'border-[#ffb3ad] bg-[#1e2021]'
                      : 'border-[#333536] bg-[#121415] hover:bg-[#1a1c1d]'
                  }`}
                >
                  <input
                    type="radio"
                    name="trigger"
                    checked={condition === 'major'}
                    onChange={() => setCondition('major')}
                    className="accent-[#ffb3ad]"
                  />
                  <div className="ml-3">
                    <span className="block font-['Inter'] text-[15px] font-semibold text-[#e2e2e3]">
                      Grandes incêndios (&gt; 50 op.)
                    </span>
                    <span className="block font-['Inter'] text-[13px] text-[#e5bdb9]">
                      Apenas quando há mobilização significativa.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Quiet Hours */}
            <div>
              <label className="block font-['Inter'] text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider mb-2">
                Horas de silêncio (Não perturbar)
              </label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <input
                    type="time"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                    className="w-full bg-[#1e2021] border border-[#333536] rounded px-4 py-3 font-['Inter'] text-[15px] text-[#e2e2e3] focus:border-[#ffb3ad] focus:outline-none"
                  />
                </div>
                <span className="text-[#e5bdb9] font-['Inter'] text-[14px]">até</span>
                <div className="flex-1">
                  <input
                    type="time"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                    className="w-full bg-[#1e2021] border border-[#333536] rounded px-4 py-3 font-['Inter'] text-[15px] text-[#e2e2e3] focus:border-[#ffb3ad] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setName('');
                  setRadiusKm(15);
                }}
                className="px-6 py-3 border border-[#333536] rounded font-['Inter'] text-[14px] font-semibold text-[#e2e2e3] hover:bg-[#282a2b] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-3 rounded bg-[#e2e2e3] text-[#121415] font-['Inter'] text-[14px] font-bold hover:bg-white transition-colors shadow-lg"
              >
                Guardar Alerta
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};
