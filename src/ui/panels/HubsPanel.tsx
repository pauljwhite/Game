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
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold">Hubs ({hubAirports.length})</h2>
          <button onClick={closePanel} aria-label="Close" className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg leading-none">×</button>
        </div>
        <p className="text-gray-400 text-xs mt-0.5">
          Annual fee: {formatCurrency(HUB_ANNUAL_FEE_USD)}/hub - Benefits: −15% airport fees, +20% demand
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {hubAirports.length === 0 && (
          <div className="p-4 text-gray-400 text-sm text-center">
            No hubs yet. Click an airport on the map to designate a hub.
          </div>
        )}
        {hubAirports.map(airport => (
          <div key={airport.iata} className="p-3 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white text-sm font-medium">{airport.name}</div>
                <div className="text-gray-400 text-xs">{airport.city}, {airport.country} - {airport.iata}</div>
                <div className="text-yellow-400 text-xs mt-0.5">
                  {formatCurrency(HUB_ANNUAL_FEE_USD / 365)}/day
                </div>
              </div>
              <button
                onClick={() => removeHub(airport.iata)}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded"
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
            className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
          >
            Click airports on map to set hubs
          </button>
        </div>
      </div>
    </div>
  );
};
