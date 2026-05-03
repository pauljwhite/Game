import React, { useMemo, useState } from 'react';
import { useGameStore } from '@/store';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { AircraftProfile } from '@/assets/profiles/AircraftProfile';
import { gameDayFromMs } from '@/engine/economicsEngine';

const EPOCH_YEAR = 1960;

function currentGameYear(gameTimeMs: number): number {
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return EPOCH_YEAR + Math.floor(gameTimeMs / msPerYear);
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export const BuyAircraftModal: React.FC = () => {
  const gameTimeMs = useGameStore(s => s.gameTimeMs);
  const cashUSD = useGameStore(s => s.airlines['player']?.cashUSD ?? 0);
  const closeModal = useGameStore(s => s.closeModal);
  const buyAircraft = useGameStore(s => s.buyAircraft);

  const gameYear = currentGameYear(gameTimeMs);
  const gameDay = gameDayFromMs(gameTimeMs);

  const manufacturers = useMemo(() => {
    const set = new Set(AIRCRAFT_TYPES.map(t => t.manufacturer));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, []);

  const [activeTab, setActiveTab] = useState(manufacturers[0] ?? '');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const visibleTypes = useMemo(
    () => AIRCRAFT_TYPES.filter(t => t.manufacturer === activeTab),
    [activeTab],
  );

  function handleBuy(typeId: string) {
    const type = AIRCRAFT_TYPES.find(t => t.id === typeId);
    if (!type) return;
    if (type.yearIntroduced > gameYear) return;
    if (cashUSD < type.purchasePrice) return;
    setPurchaseError(null);
    const result = buyAircraft(type.id, type, gameDay);
    if (result !== null) {
      closeModal();
    } else {
      setPurchaseError('Purchase failed. Check your funds.');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[9999]">
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-4xl h-[92svh] sm:h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Buy Aircraft</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Cash available: <span className="text-green-400 font-semibold">{formatUSD(cashUSD)}</span>
              <span className="ml-3 text-gray-500">Year {gameYear}</span>
            </p>
          </div>
          <button
            onClick={closeModal}
            className="text-gray-400 hover:text-white text-2xl leading-none transition-colors"
            aria-label="Close"
          >
            x
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 min-h-0">
          {/* Manufacturer sidebar */}
          <div className="w-36 sm:w-44 shrink-0 border-r border-gray-700 overflow-y-auto py-2">
            {manufacturers.map(mfr => (
              <button
                key={mfr}
                onClick={() => { setActiveTab(mfr); setPurchaseError(null); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  activeTab === mfr
                    ? 'bg-gray-700 text-white font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                }`}
              >
                {mfr}
              </button>
            ))}
          </div>

          {/* Aircraft list */}
          <div className="overflow-y-auto flex-1 px-4 py-4">
          {purchaseError && (
            <div className="mb-3 px-3 py-2 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
              {purchaseError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            {visibleTypes.map(type => {
              const unavailable = type.yearIntroduced > gameYear;
              const canAfford = cashUSD >= type.purchasePrice;

              return (
                <div
                  key={type.id}
                  className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors ${
                    unavailable
                      ? 'border-gray-700 bg-gray-800/30 opacity-50'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                  }`}
                >
                  {/* Profile SVG */}
                  <div className="flex-shrink-0 w-24 flex items-center justify-center">
                    <AircraftProfile
                      type={type}
                      color={unavailable ? '#6b7280' : '#60a5fa'}
                      className="w-24 h-10"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold text-sm">{type.model}</span>
                      <span className="text-xs text-gray-500 capitalize">{type.category}</span>
                      {unavailable && (
                        <span className="ml-1 px-2 py-0.5 bg-yellow-900/50 border border-yellow-700 rounded text-yellow-400 text-xs">
                          Available {type.yearIntroduced}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-gray-400">
                      <span>Seats: <span className="text-gray-300">{type.seatsEconomy}Y{type.seatsBusiness > 0 ? ` / ${type.seatsBusiness}J` : ''}</span></span>
                      <span>Range: <span className="text-gray-300">{type.rangeKm.toLocaleString()} km</span></span>
                      <span>Speed: <span className="text-gray-300">{type.cruiseSpeedKmh} km/h</span></span>
                      <span>Fuel: <span className="text-gray-300">{type.fuelBurnLPer100Km.toLocaleString()} L/100km</span></span>
                      <span>Maint: <span className="text-gray-300">{formatUSD(type.maintenanceCostPerHourUSD)}/hr</span></span>
                    </div>
                  </div>

                  {/* Price + Buy */}
                  <div className="flex-shrink-0 text-right flex flex-col items-end gap-2">
                    <span className={`text-sm font-bold ${!unavailable && !canAfford ? 'text-red-400' : 'text-white'}`}>
                      {formatUSD(type.purchasePrice)}
                    </span>
                    {!unavailable && (
                      <button
                        onClick={() => handleBuy(type.id)}
                        disabled={!canAfford}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                          canAfford
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {canAfford ? 'Buy' : 'Insufficient funds'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};
