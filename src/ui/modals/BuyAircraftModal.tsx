import React, { useMemo, useState } from 'react';
import { useGameStore } from '@/store';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { AircraftProfile } from '@/assets/profiles/AircraftProfile';
import { gameDayFromMs } from '@/engine/economicsEngine';
import { manufacturerFlag } from '@/utils/manufacturerFlags';
import { formatRunwayLength } from '@/utils/runway';

const EPOCH_YEAR = 1960;
const ALL_MANUFACTURERS = 'All';

function currentGameYear(gameTimeMs: number): number {
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return EPOCH_YEAR + Math.floor(gameTimeMs / msPerYear);
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatCategory(category: string): string {
  if (category === 'sst') return 'SST';
  if (category === 'narrowbody') return 'Narrowbody';
  if (category === 'widebody') return 'Widebody';
  return 'Regional';
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
    return [ALL_MANUFACTURERS, ...Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))];
  }, []);

  const [activeTab, setActiveTab] = useState(ALL_MANUFACTURERS);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const visibleTypes = useMemo(
    () => activeTab === ALL_MANUFACTURERS
      ? AIRCRAFT_TYPES
      : AIRCRAFT_TYPES.filter(t => t.manufacturer === activeTab),
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999]">
      <div className="glass-panel rounded-t-2xl sm:rounded-xl w-full max-w-4xl h-[92svh] sm:h-[85vh] flex flex-col">
        {/* Header */}
        <div className="panel-header flex items-center justify-between px-4 sm:px-6 sm:py-4 flex-shrink-0">
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
        <div className="flex flex-col sm:flex-row flex-1 min-h-0">
          {/* Manufacturer sidebar */}
          <div className="w-full sm:w-44 shrink-0 border-b sm:border-b-0 sm:border-r border-white/10 overflow-x-auto sm:overflow-y-auto py-1 sm:py-2 bg-white/[0.025] flex sm:block scrollbar-none">
            {manufacturers.map(mfr => (
              <button
                key={mfr}
                onClick={() => { setActiveTab(mfr); setPurchaseError(null); }}
                className={`shrink-0 sm:w-full text-left px-3 py-2 text-xs sm:text-sm transition-colors leading-tight ${
                  activeTab === mfr
                    ? 'bg-white/[0.12] text-white font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.07]'
                }`}
              >
                {mfr === ALL_MANUFACTURERS ? (
                  <span className="mr-1.5">All</span>
                ) : (
                  <>
                    <span className="mr-1.5">{manufacturerFlag(mfr)}</span>{mfr}
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Aircraft list */}
          <div className="overflow-y-auto flex-1 px-3 sm:px-4 py-3 sm:py-4 overscroll-contain">
            {purchaseError && (
              <div className="mb-3 px-3 py-2 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
                {purchaseError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:gap-3">
              {visibleTypes.map(type => {
                const unavailable = type.yearIntroduced > gameYear;
                const canAfford = cashUSD >= type.purchasePrice;

                return (
                  <div
                    key={type.id}
                    className={`rounded-lg border px-3 sm:px-4 py-3 transition-colors ${
                      unavailable
                        ? 'border-white/10 bg-white/[0.025] opacity-50'
                        : 'border-white/10 bg-white/[0.055] hover:border-white/20 hover:bg-white/[0.075]'
                    }`}
                  >
                    {/* Mobile: stacked layout */}
                    <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-start gap-3">
                      {/* Profile SVG — hidden on mobile */}
                      <div className="hidden sm:flex flex-shrink-0 w-44 items-center justify-center self-center">
                        <AircraftProfile
                          type={type}
                          color={unavailable ? '#6b7280' : '#60a5fa'}
                          className="w-44 h-16"
                        />
                      </div>

                      {/* Info + actions */}
                      <div className="flex-1 min-w-0">
                        {/* Top row: model name + price + buy */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                              <span className="text-white font-semibold text-sm">{type.model}</span>
                              <span className="text-xs text-gray-500">{formatCategory(type.category)}</span>
                              {unavailable && (
                                <span className="px-1.5 py-0.5 bg-yellow-900/50 border border-yellow-700 rounded text-yellow-400 text-xs">
                                  Avail. {type.yearIntroduced}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                            <span className={`text-sm font-bold whitespace-nowrap ${!unavailable && !canAfford ? 'text-red-400' : 'text-white'}`}>
                              {formatUSD(type.purchasePrice)}
                            </span>
                            {!unavailable && (
                              <button
                                onClick={() => handleBuy(type.id)}
                                disabled={!canAfford}
                                className={`px-3 py-1 rounded text-xs font-semibold transition-colors whitespace-nowrap min-h-9 ${
                                  canAfford
                                    ? 'apple-button-primary'
                                    : 'bg-white/10 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                {canAfford ? 'Buy' : 'No funds'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Specs grid */}
                        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-xs text-gray-400">
                          <span>Seats: <span className="text-gray-300">{type.seatsEconomy}Y{type.seatsBusiness > 0 ? `/${type.seatsBusiness}J` : ''}</span></span>
                          <span>Range: <span className="text-gray-300">{type.rangeKm.toLocaleString()} km</span></span>
                          <span>Runway: <span className="text-gray-300">{formatRunwayLength(type.minRunwayM)}</span></span>
                          <span>Speed: <span className="text-gray-300">{type.cruiseSpeedKmh} km/h</span></span>
                          <span>Fuel: <span className="text-gray-300">{type.fuelBurnLPer100Km.toLocaleString()} L/100km</span></span>
                          <span>Maint: <span className="text-gray-300">{formatUSD(type.maintenanceCostPerHourUSD)}/hr</span></span>
                        </div>
                      </div>
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
