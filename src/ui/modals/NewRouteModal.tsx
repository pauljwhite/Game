import React, { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '@/store';
import { haversineKm } from '@/utils/geo';
import { computeFlightCost, gameDayFromMs, msToGameDate } from '@/engine/economicsEngine';
import { getSuggestedEconomyPrice, getBaselineDailyPax, conditionDemandMod } from '@/engine/demandModel';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import type { Route } from '@/types';
import { FUEL_PRICE_USD_PER_LITER, PRICE_ELASTICITY } from '@/utils/constants';
import { AirportSearchInput } from '@/ui/components/AirportSearchInput';
import { findAirportByQuery } from '@/utils/airportSearch';
import { LoadFactorBar } from '@/ui/components/LoadFactorBar';
import { PriceInput } from '@/ui/components/PriceInput';
import { formatCurrency } from '@/utils/format';

function formatUSD(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export const NewRouteModal: React.FC = () => {
  const airports    = useGameStore(s => s.airports);
  const aircraft    = useGameStore(s => s.aircraft);
  const airlines    = useGameStore(s => s.airlines);
  const modalPayload = useGameStore(s => s.modalPayload);
  const closeModal  = useGameStore(s => s.closeModal);
  const createRoute = useGameStore(s => s.createRoute);
  const buyAircraft = useGameStore(s => s.buyAircraft);
  const gameTimeMs  = useGameStore(s => s.gameTimeMs);

  const gameDay = gameDayFromMs(gameTimeMs);
  const currentYear = msToGameDate(gameTimeMs).getFullYear();

  const prefilledOrigin = typeof modalPayload === 'string' ? modalPayload.toUpperCase() : '';

  const [originIata, setOriginIata] = useState(prefilledOrigin);
  const [destIata, setDestIata] = useState('');
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [flightsPerWeek, setFlightsPerWeek] = useState(7);
  const [priceEconomy, setPriceEconomy] = useState(200);
  const [priceBusiness, setPriceBusiness] = useState(800);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showBuyPanel, setShowBuyPanel] = useState(false);
  const [buyingTypeId, setBuyingTypeId] = useState<string | null>(null);

  // Resolve airports
  const originAirport = findAirportByQuery(originIata, airports);
  const destAirport = findAirportByQuery(destIata, airports);

  const distanceKm = useMemo(() => {
    if (!originAirport || !destAirport) return null;
    return Math.round(haversineKm(originAirport.lat, originAirport.lon, destAirport.lat, destAirport.lon));
  }, [originAirport, destAirport]);

  // Unassigned player aircraft
  const availableAircraft = useMemo(
    () => Object.values(aircraft).filter(
      ac => ac.airlineId === 'player' && ac.assignedRouteId === null && ac.status !== 'maintenance',
    ),
    [aircraft],
  );

  const selectedAc = selectedAircraftId ? aircraft[selectedAircraftId] ?? null : null;
  const selectedType = selectedAc ? AIRCRAFT_TYPES.find(t => t.id === selectedAc.typeId) ?? null : null;

  // Suggested price from flight cost
  useEffect(() => {
    if (!selectedType || !distanceKm) return;
    const flightDurationHours = distanceKm / selectedType.cruiseSpeedKmh;
    const totalCostPerFlight =
      (distanceKm / 100) * selectedType.fuelBurnLPer100Km * 0.82 +
      selectedType.maintenanceCostPerHourUSD * flightDurationHours +
      flightDurationHours * 85 +
      2000;
    const suggested = getSuggestedEconomyPrice(totalCostPerFlight, selectedType.seatsEconomy + selectedType.seatsBusiness);
    setPriceEconomy(suggested);
    setPriceBusiness(suggested * 4);
  }, [selectedType, distanceKm]);

  // Validation
  const validOrigin = !!originAirport;
  const validDest = !!destAirport;
  const sameAirport = !!originAirport && !!destAirport && originAirport.iata === destAirport.iata;
  const outOfRange = distanceKm !== null && selectedType !== null && distanceKm > selectedType.rangeKm;

  const canSubmit =
    validOrigin &&
    validDest &&
    !sameAirport &&
    distanceKm !== null &&
    !outOfRange;

  // P&L preview — uses real demand model with price elasticity
  const pnlPreview = useMemo(() => {
    if (!selectedAc || !selectedType || !originAirport || !destAirport || !distanceKm) return null;

    const mockRoute: Route = {
      id: 'preview', airlineId: 'player',
      originIata: originAirport.iata, destinationIata: destAirport.iata,
      aircraftId: selectedAc.id, flightsPerWeek, priceEconomy, priceBusiness,
      isActive: true, createdGameDay: gameDay, distanceKm, flightDurationHours: 0,
      dailyPassengers: 0, dailyRevenue: 0, dailyCost: 0, dailyProfit: 0,
      loadFactorEconomy: 0, loadFactorBusiness: 0,
    };

    const costs = computeFlightCost(mockRoute, selectedAc, selectedType, originAirport, destAirport, FUEL_PRICE_USD_PER_LITER);
    const flightsPerDay = flightsPerWeek / 7;
    const dailyCost = costs.totalCost * flightsPerDay;

    // Reference price: cost-per-seat * 1.4 (the suggested break-even price)
    const totalSeats = selectedType.seatsEconomy + selectedType.seatsBusiness;
    const referencePrice = totalSeats > 0 ? Math.round(costs.totalCost / totalSeats * 1.4) : 200;
    const referencePriceBiz = referencePrice * 4;

    // Price elasticity vs reference → demand factor
    const ecoFactor = Math.min(5, Math.pow(priceEconomy / referencePrice, PRICE_ELASTICITY));
    const bizFactor = Math.min(5, Math.pow(priceBusiness / referencePriceBiz, PRICE_ELASTICITY));

    const baselinePax = getBaselineDailyPax(originAirport, destAirport);
    const ecoCapacity = selectedType.seatsEconomy * flightsPerDay;
    const bizCapacity = selectedType.seatsBusiness * flightsPerDay;
    const bizSplit = Math.min(0.25, Math.max(0.05, 0.10 * Math.sqrt(priceBusiness / (priceEconomy * 6 + 1))));

    const condMod = conditionDemandMod(selectedAc.condition);
    const ecoPax = Math.min(ecoCapacity, baselinePax * ecoFactor * condMod * (1 - bizSplit));
    const bizPax = Math.min(bizCapacity, baselinePax * bizFactor * condMod * bizSplit);
    const loadFactorEco = ecoCapacity > 0 ? ecoPax / ecoCapacity : 0;
    const loadFactorBiz = bizCapacity > 0 ? bizPax / bizCapacity : 0;

    const dailyRevenue = ecoPax * priceEconomy + bizPax * priceBusiness;
    const dailyProfit = dailyRevenue - dailyCost;

    return {
      dailyRevenue, dailyCost, dailyProfit,
      loadFactorEco, loadFactorBiz,
      referencePrice, flightDurationHours: costs.flightDurationHours,
      condMod,
    };
  }, [selectedAc, selectedType, originAirport, destAirport, distanceKm, flightsPerWeek, priceEconomy, priceBusiness, gameDay]);

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitError(null);

    const config = {
      originIata: originAirport!.iata,
      destinationIata: destAirport!.iata,
      aircraftId: selectedAircraftId,
      flightsPerWeek,
      priceEconomy,
      priceBusiness,
    };

    const result = createRoute(config, airports, gameDay);
    if (result !== null) {
      closeModal();
    } else {
      setSubmitError('Failed to create route. Check airport codes.');
    }
  }

  function handleBuyAircraft(typeId: string) {
    const type = AIRCRAFT_TYPES.find(t => t.id === typeId);
    if (!type) return;
    setBuyingTypeId(typeId);
    const newId = buyAircraft(typeId, type, gameDay);
    setBuyingTypeId(null);
    if (newId) {
      setSelectedAircraftId(newId);
      setShowBuyPanel(false);
    }
  }

  const playerCash = airlines['player']?.cashUSD ?? 0;
  const unlockedTypes = AIRCRAFT_TYPES.filter(t => t.yearIntroduced <= currentYear);
  const buyableTypes = unlockedTypes.sort((a, b) => {
    const aFits = distanceKm === null || a.rangeKm >= distanceKm;
    const bFits = distanceKm === null || b.rangeKm >= distanceKm;
    if (aFits !== bFits) return aFits ? -1 : 1;
    return a.purchasePrice - b.purchasePrice;
  });
  const [buyMfr, setBuyMfr] = useState<string | null>(null);
  const buyMfrs = useMemo(() => Array.from(new Set(buyableTypes.map(t => t.manufacturer))).sort(), [buyableTypes]);
  const activeBuyMfr = buyMfr ?? buyMfrs[0] ?? '';
  const shopVisible = buyableTypes.filter(t => t.manufacturer === activeBuyMfr);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[9999]">
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-2xl max-h-[92svh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">New Route</h2>
          <button
            onClick={closeModal}
            className="text-gray-400 hover:text-white text-2xl leading-none transition-colors"
            aria-label="Close"
          >
            x
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 space-y-5">

          {/* Airport Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <AirportSearchInput
              label="Origin"
              value={originIata}
              airports={airports}
              placeholder="JFK, KJFK, New York"
              onChange={setOriginIata}
              onSelect={airport => setOriginIata(airport.iata)}
            />
            <AirportSearchInput
              label="Destination"
              value={destIata}
              airports={airports}
              placeholder="LAX, KLAX, Los Angeles"
              onChange={setDestIata}
              onSelect={airport => setDestIata(airport.iata)}
            />
          </div>

          {/* Distance */}
          {distanceKm !== null && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">Distance:</span>
              <span className="text-white font-semibold">{distanceKm.toLocaleString()} km</span>
              {sameAirport && (
                <span className="text-red-400 ml-2">Origin and destination must differ</span>
              )}
              {outOfRange && selectedType && (
                <span className="text-red-400 ml-2">
                  Exceeds {selectedType.model} range ({selectedType.rangeKm.toLocaleString()} km)
                </span>
              )}
            </div>
          )}

          {/* Aircraft Selector */}
          <div>
            <label className="text-gray-300 text-sm block mb-2">
              Aircraft <span className="text-gray-500 font-normal">(optional - route inactive without one)</span>
            </label>
            {availableAircraft.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No unassigned aircraft available. Buy aircraft first.</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                <button
                  onClick={() => setSelectedAircraftId(null)}
                  className={`w-full text-left px-3 py-2 rounded border text-sm transition-colors ${
                    selectedAircraftId === null
                      ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  No aircraft (inactive route)
                </button>
                {availableAircraft.map(ac => {
                  const acType = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
                  const tooFar = distanceKm !== null && acType && distanceKm > acType.rangeKm;
                  return (
                    <button
                      key={ac.id}
                      onClick={() => !tooFar && setSelectedAircraftId(ac.id)}
                      disabled={!!tooFar}
                      className={`w-full text-left px-3 py-2 rounded border text-sm transition-colors ${
                        selectedAircraftId === ac.id
                          ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                          : tooFar
                          ? 'border-gray-700 bg-gray-800/40 text-gray-600 cursor-not-allowed'
                          : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      <span className="font-mono text-xs text-gray-500 mr-2">{ac.id.slice(0, 8).toUpperCase()}</span>
                      {acType?.model ?? ac.typeId}
                      {acType && (
                        <span className="ml-2 text-gray-500 text-xs">
                          {acType.seatsEconomy}Y{acType.seatsBusiness > 0 ? `/${acType.seatsBusiness}J` : ''} - {acType.rangeKm.toLocaleString()} km
                        </span>
                      )}
                      {tooFar && <span className="ml-2 text-red-500 text-xs">out of range</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inline aircraft shop */}
          <div>
            <button
              type="button"
              onClick={() => setShowBuyPanel(v => !v)}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {showBuyPanel ? '▲ Hide aircraft shop' : '+ Buy new aircraft'}
            </button>

            {showBuyPanel && (
              <div className="mt-2 border border-gray-700 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-800 text-xs text-gray-400 border-b border-gray-700">
                  Your cash: <span className="text-white font-semibold">{formatCurrency(playerCash)}</span>
                  {distanceKm && <span className="ml-2">· Route: {distanceKm.toLocaleString()} km</span>}
                </div>
                <div className="flex h-52">
                  {/* Manufacturer sidebar */}
                  <div className="w-28 sm:w-36 shrink-0 border-r border-gray-700 overflow-y-auto py-1 bg-gray-900">
                    {buyMfrs.map(mfr => (
                      <button
                        key={mfr}
                        onClick={() => setBuyMfr(mfr)}
                        className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                          activeBuyMfr === mfr
                            ? 'bg-gray-700 text-white font-semibold'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                        }`}
                      >
                        {mfr}
                      </button>
                    ))}
                  </div>
                  {/* Aircraft list */}
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-800 bg-gray-900">
                    {shopVisible.map(t => {
                      const fits      = distanceKm === null || t.rangeKm >= distanceKm;
                      const canAfford = playerCash >= t.purchasePrice;
                      const isBuying  = buyingTypeId === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => fits && canAfford && handleBuyAircraft(t.id)}
                          disabled={!fits || !canAfford || isBuying}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                            !fits
                              ? 'opacity-40 cursor-not-allowed'
                              : !canAfford
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:bg-gray-800 cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-medium">{t.model}</span>
                              {!fits && <span className="text-[10px] text-red-400 bg-red-900/40 px-1 rounded">out of range</span>}
                              {fits && <span className="text-[10px] text-green-400 bg-green-900/40 px-1 rounded">✓ in range</span>}
                            </div>
                            <div className="text-xs text-gray-500">
                              {t.seatsEconomy}Y{t.seatsBusiness > 0 ? `/${t.seatsBusiness}J` : ''} · {t.rangeKm.toLocaleString()} km
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <div className={canAfford ? 'text-green-400 font-semibold text-xs' : 'text-red-400 font-semibold text-xs'}>
                              {formatCurrency(t.purchasePrice)}
                            </div>
                            {isBuying && <div className="text-xs text-blue-400">Buying…</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Flights per week */}
          <div>
            <label className="text-gray-300 text-sm block mb-2">
              Flights per week: <span className="text-white font-semibold">{flightsPerWeek}</span>
              <span className="text-gray-500 ml-2 font-normal text-xs">({(flightsPerWeek / 7).toFixed(2)}/day)</span>
            </label>
            <input
              type="range"
              min={1}
              max={21}
              step={1}
              value={flightsPerWeek}
              onChange={e => setFlightsPerWeek(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span>7</span>
              <span>14</span>
              <span>21</span>
            </div>
          </div>

          {/* Pricing */}
          {(() => {
            const refPrice = pnlPreview?.referencePrice ?? null;
            const maxEco = refPrice ? refPrice * 6 : 9999;
            const maxBiz = refPrice ? refPrice * 24 : 39999;
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">Pricing</span>
                  {refPrice && (
                    <button
                      type="button"
                      onClick={() => { setPriceEconomy(refPrice); setPriceBusiness(refPrice * 4); }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      ↺ Reset to suggested ({formatUSD(refPrice)} / {formatUSD(refPrice * 4)})
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Economy (max {formatUSD(maxEco)})</label>
                    <PriceInput
                      value={priceEconomy} min={1} max={maxEco}
                      onChange={v => { setPriceEconomy(v); setPriceBusiness(Math.min(maxBiz, Math.round(v * 4))); }}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Business (max {formatUSD(maxBiz)})</label>
                    <PriceInput
                      value={priceBusiness} min={1} max={maxBiz}
                      onChange={v => setPriceBusiness(v)}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* P&L Preview */}
          {pnlPreview && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 space-y-3">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Estimated Daily P&L</p>

              {/* Load factors */}
              <div className="space-y-1.5">
                <LoadFactorBar value={pnlPreview.loadFactorEco} label="Eco LF" />
                <LoadFactorBar value={pnlPreview.loadFactorBiz} label="Biz LF" />
              </div>

              <p className="text-[10px] text-gray-500">
                Suggested price: <span className="text-gray-400">{formatUSD(pnlPreview.referencePrice)}</span>
                {' · '}higher price = lower load factor · lower price = fuller plane
              </p>
              {pnlPreview.condMod < 0.95 && (
                <p className="text-[10px] text-yellow-500">
                  ⚠ Aircraft condition {selectedAc!.condition.toFixed(0)}% is reducing demand by {((1 - pnlPreview.condMod) * 100).toFixed(0)}%
                </p>
              )}

              {/* Revenue / cost / profit */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Revenue</p>
                  <p className="text-green-400 font-semibold">{formatUSD(pnlPreview.dailyRevenue)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Cost</p>
                  <p className="text-red-400 font-semibold">{formatUSD(pnlPreview.dailyCost)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Profit</p>
                  <p className={`font-semibold ${pnlPreview.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatUSD(pnlPreview.dailyProfit)}
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                {pnlPreview.flightDurationHours.toFixed(1)}h flight · {flightsPerWeek} flights/week
              </p>
            </div>
          )}

          {submitError && (
            <div className="px-3 py-2 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-700 flex-shrink-0 flex gap-3 justify-end">
          <button
            onClick={closeModal}
            className="px-4 py-2 rounded border border-gray-600 text-gray-300 hover:border-gray-400 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
          >
            Create Route
          </button>
        </div>
      </div>
    </div>
  );
};
