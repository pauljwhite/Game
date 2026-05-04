import React from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { HUB_ANNUAL_FEE_USD } from '@/utils/constants';

export const HubsPanel: React.FC = () => {
  const airlines = useGameStore(s => s.airlines);
  const airports = useGameStore(s => s.airports);
  const removeHub = useGameStore(s => s.removeHub);
  const openModalById = useGameStore(s => s.openModalById);
  const closePanel = useGameStore(s => s.closePanel);

  const playerAirline = airlines['player'];
  if (!playerAirline) return null;

  const hubAirports = playerAirline.hubIatas.map(iata => airports[iata]).filter(Boolean);

  return (
    <div className="panel-scroll flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
      <div className="panel-header shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold">Hubs ({hubAirports.length})</h2>
          <button onClick={closePanel} aria-label="Close" className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg leading-none">×</button>
        </div>
        <p className="text-gray-400 text-xs mt-0.5">
          Annual fee: {formatCurrency(HUB_ANNUAL_FEE_USD)}/hub - Benefits: −15% airport fees, +20% demand
        </p>
      </div>

      <div className="flex-none overflow-visible">
        {hubAirports.length === 0 && (
          <div className="p-4 text-gray-400 text-sm text-center">
            No hubs yet. Click an airport on the map to designate a hub.
          </div>
        )}
        {hubAirports.map(airport => (
          <div key={airport.iata} className="p-3 border-b border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white text-sm font-medium">{airport.name}</div>
                <div className="text-gray-400 text-xs">{airport.city}, {airport.country} - {airport.iata}</div>
                <div className="text-yellow-400 text-xs mt-0.5">
                  {formatCurrency(HUB_ANNUAL_FEE_USD / 365)}/day
                </div>
              </div>
              <button
                onClick={() => removeHub(airport.iata)}
                className="apple-button"
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <div className="p-3 text-xs text-gray-500">
          Total hub cost: {formatCurrency(hubAirports.length * HUB_ANNUAL_FEE_USD / 365)}/day
        </div>

        <div className="p-3">
          <button
            onClick={() => openModalById('newRoute')}
            className="apple-button-primary w-full"
          >
            Click airports on map to set hubs
          </button>
        </div>
      </div>
    </div>
  );
};
