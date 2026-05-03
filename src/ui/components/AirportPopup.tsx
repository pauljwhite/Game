import React from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { airportIcao } from '@/utils/airportSearch';

export const AirportPopup: React.FC = () => {
  const selectedIata = useGameStore(s => s.selectedAirportIata);
  const airports = useGameStore(s => s.airports);
  const selectAirport = useGameStore(s => s.selectAirport);
  const airlines = useGameStore(s => s.airlines);
  const openModalById = useGameStore(s => s.openModalById);
  const designateHub = useGameStore(s => s.designateHub);
  const removeHub = useGameStore(s => s.removeHub);
  const gameDay = useGameStore(s => s.gameDay);

  if (!selectedIata) return null;
  const airport = airports[selectedIata];
  if (!airport) return null;

  const playerAirline = airlines['player'];
  const isHub = airport.isHub;
  const playerHasHub = playerAirline?.hubIatas.includes(selectedIata);
  const isClosed = airport.closedUntilGameDay !== undefined && airport.closedUntilGameDay >= gameDay;

  return (
    <div className="absolute bottom-12 left-4 z-[800] glass-panel rounded-xl p-3 w-64">
      {isClosed && (
        <div className="mb-2 px-2 py-1.5 bg-red-900/50 border border-red-500/50 rounded-lg flex items-center gap-1.5">
          <span className="text-red-400 font-bold text-xs">CLOSED</span>
          <span className="text-red-300 text-xs">{airport.closureReason}</span>
        </div>
      )}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-white font-bold text-sm">{airport.name}</div>
          <div className="text-gray-400 text-xs">{airport.city}, {airport.country}</div>
        </div>
        <button
          onClick={() => selectAirport(null)}
          className="text-gray-500 hover:text-white text-xs ml-2"
        >
          x
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <span className="text-gray-400">IATA</span>
        <span className="text-white font-mono">{airport.iata}</span>
        <span className="text-gray-400">ICAO</span>
        <span className="text-white font-mono">{airportIcao(airport) ?? '-'}</span>
        <span className="text-gray-400">Size</span>
        <span className="text-white capitalize">{airport.size}</span>
        <span className="text-gray-400">Landing fee</span>
        <span className="text-white">{formatCurrency(airport.landingFee)}</span>
        <span className="text-gray-400">Region</span>
        <span className="text-white capitalize">{airport.region.replace('_', ' ')}</span>
        {isHub && (
          <>
            <span className="text-gray-400">Status</span>
            <span className="text-yellow-400">Hub</span>
          </>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => openModalById('newRoute', selectedIata)}
          className="apple-button-primary flex-1 py-1"
        >
          + New Route
        </button>
        {!playerHasHub ? (
          <button
            onClick={() => { designateHub(selectedIata); }}
            className="apple-button flex-1 py-1 border-yellow-300/20 bg-yellow-500/20 text-yellow-100"
          >
            Set Hub
          </button>
        ) : (
          <button
            onClick={() => { removeHub(selectedIata); }}
            className="apple-button flex-1 py-1"
          >
            Remove Hub
          </button>
        )}
      </div>
    </div>
  );
};
