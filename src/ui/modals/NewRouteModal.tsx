import React, { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '@/store';
import { haversineKm } from '@/utils/geo';
import { computeFlightCost, gameDayFromMs, msToGameDate } from '@/engine/economicsEngine';
import { getSuggestedEconomyPrice, getBaselineDailyPax, conditionDemandMod } from '@/engine/demandModel';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import type { Aircraft, Route } from '@/types';
import { FUEL_PRICE_USD_PER_LITER, PRICE_ELASTICITY } from '@/utils/constants';
import { AirportSearchInput } from '@/ui/components/AirportSearchInput';
import { findAirportByQuery } from '@/utils/airportSearch';
import { LoadFactorBar } from '@/ui/components/LoadFactorBar';
import { PriceInput } from '@/ui/components/PriceInput';
import { formatCurrency } from '@/utils/format';
import { manufacturerFlag } from '@/utils/manufacturerFlags';
import { canAirportHandleAircraft, formatRunwayLength } from '@/utils/runway';

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
  // Pending purchase: aircraft type chosen in shop but not yet bought (committed on route create)
  const [pendingPurchaseTypeId, setPendingPurchaseTypeId] = useState<string | null>(null);

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

  // Pending aircraft type (chosen in shop, bought only when route is confirmed)
  const pendingType = pendingPurchaseTypeId ? AIRCRAFT_TYPES.find(t => t.id === pendingPurchaseTypeId) ?? null : null;

  // Mock Aircraft instance used purely for P&L preview of a pending purchase
  const pendingMockAc = useMemo((): Aircraft | null => {
    if (!pendingType) return null;
    return {
      id: 'pending', typeId: pendingType.id, name: pendingType.model,
      airlineId: 'player', purchasedGameDay: gameDay, totalFlightHours: 0,
      condition: 100, maintenanceHoursOwed: 0, isGrounded: false,
      lastMaintenanceGameDay: gameDay, crashRisk: 0, knownFaultRiskMod: 1,
      assignedRouteId: null, status: 'idle', currentLat: 0, currentLon: 0,
      flightProgress: 0, activeMaintTier: null, autoMaintenanceEnabled: false,
      autoMaintenanceThreshold: 40, autoMaintenanceTier: 'standard', excludedFromPolicy: false,
    };
  }, [pendingType, gameDay]);

  const effectiveAc   = selectedAc ?? pendingMockAc;
  const effectiveType = selectedType ?? pendingType;

  // Suggested price from flight cost
  useEffect(() => {
    if (!effectiveType || !distanceKm) return;
    const flightDurationHours = distanceKm / effectiveType.cruiseSpeedKmh;
    const totalCostPerFlight =
      (distanceKm / 100) * effectiveType.fuelBurnLPer100Km * 0.82 +
      effectiveType.maintenanceCostPerHourUSD * flightDurationHours +
      flightDurationHours * 85 +
      2000;
    const suggested = getSuggestedEconomyPrice(totalCostPerFlight, effectiveType.seatsEconomy + effectiveType.seatsBusiness);
    setPriceEconomy(suggested);
    setPriceBusiness(suggested * 4);
  }, [effectiveType, distanceKm]);

  // Validation
  const validOrigin = !!originAirport;
  const validDest = !!destAirport;
  const sameAirport = !!originAirport && !!destAirport && originAirport.iata === destAirport.iata;
  const outOfRange = distanceKm !== null && effectiveType !== null && distanceKm > effectiveType.rangeKm;
  const originRunwayShort = !!originAirport && !!effectiveType && !canAirportHandleAircraft(originAirport, effectiveType);
  const destRunwayShort = !!destAirport && !!effectiveType && !canAirportHandleAircraft(destAirport, effectiveType);
  const runwayLimited = originRunwayShort || destRunwayShort;

  const canSubmit =
    validOrigin &&
    validDest &&
    !sameAirport &&
    distanceKm !== null &&
    !outOfRange &&
    !runwayLimited;

  // P&L preview — uses real demand model with price elasticity
  const pnlPreview = useMemo(() => {
    if (!effectiveAc || !effectiveType || !originAirport || !destAirport || !distanceKm) return null;

    const mockRoute: Route = {
      id: 'preview', airlineId: 'player',
      originIata: originAirport.iata, destinationIata: destAirport.iata,
      aircraftId: effectiveAc.id, flightsPerWeek, priceEconomy, priceBusiness,
      isActive: true, createdGameDay: gameDay, distanceKm, flightDurationHours: 0,
      dailyPassengers: 0, dailyRevenue: 0, dailyCost: 0, dailyProfit: 0,
      loadFactorEconomy: 0, loadFactorBusiness: 0,
    };

    const costs = computeFlightCost(mockRoute, effectiveAc, effectiveType, originAirport, destAirport, FUEL_PRICE_USD_PER_LITER);
    const flightsPerDay = flightsPerWeek / 7;
    const dailyCost = costs.totalCost * flightsPerDay;

    // Reference price: cost-per-seat * 1.4 (the suggested break-even price)
    const totalSeats = effectiveType.seatsEconomy + effectiveType.seatsBusiness;
    const referencePrice = totalSeats > 0 ? Math.round(costs.totalCost / totalSeats * 1.4) : 200;
    const referencePriceBiz = referencePrice * 4;

    // Price elasticity vs reference → demand factor
    const ecoFactor = Math.min(5, Math.pow(priceEconomy / referencePrice, PRICE_ELASTICITY));
    const bizFactor = Math.min(5, Math.pow(priceBusiness / referencePriceBiz, PRICE_ELASTICITY));

    const baselinePax = getBaselineDailyPax(originAirport, destAirport);
    const ecoCapacity = effectiveType.seatsEconomy * flightsPerDay;
    const bizCapacity = effectiveType.seatsBusiness * flightsPerDay;
    const bizSplit = Math.min(0.25, Math.max(0.05, 0.10 * Math.sqrt(priceBusiness / (priceEconomy * 6 + 1))));

    const condMod = conditionDemandMod(effectiveAc.condition);
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
  }, [effectiveAc, effectiveType, originAirport, destAirport, distanceKm, flightsPerWeek, priceEconomy, priceBusiness, gameDay]);

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitError(null);

    // If user picked a new aircraft from the shop, buy it now as part of route creation
    let aircraftId: string | null = selectedAircraftId;
    if (pendingPurchaseTypeId && !selectedAircraftId) {
      const type = AIRCRAFT_TYPES.find(t => t.id === pendingPurchaseTypeId)!;
      if (playerCash < type.purchasePrice) {
        setSubmitError('Insufficient funds to purchase the selected aircraft.');
        return;
      }
      const newId = buyAircraft(pendingPurchaseTypeId, type, gameDay);
      if (!newId) {
        setSubmitError('Aircraft purchase failed.');
        return;
      }
      aircraftId = newId;
    }

    const result = createRoute(
      { originIata: originAirport!.iata, destinationIata: destAirport!.iata, aircraftId, flightsPerWeek, priceEconomy, priceBusiness },
      airports, gameDay,
    );
    if (result !== null) {
      closeModal();
    } else {
      setSubmitError('Failed to create route. Check airport codes.');
    }
  }

  // Stage an aircraft type for purchase — committed only when the route is created
  function handleSelectForPurchase(typeId: string) {
    setPendingPurchaseTypeId(typeId);
    setSelectedAircraftId(null);
    setShowBuyPanel(false);
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
  const buyMfrs = useMemo(() => Array.from(new Set(buyableTypes.map(t => t.manufacturer))).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })), [buyableTypes]);
  const activeBuyMfr = buyMfr ?? buyMfrs[0] ?? '';
  const shopVisible = buyableTypes.filter(t => t.manufacturer === activeBuyMfr);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999]">
      <div className="glass-panel rounded-t-2xl sm:rounded-xl w-full max-w-2xl max-h-[92svh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="panel-header flex items-center justify-between px-4 sm:px-6 sm:py-4 flex-shrink-0">
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
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 space-y-5 overscroll-contain">

          {/* Airport Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
            <div className="flex flex-wrap items-center gap-2 text-sm">
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
              {runwayLimited && effectiveType && (
                <span className="text-red-400 ml-2">
                  Runway too short for {effectiveType.model} ({formatRunwayLength(effectiveType.minRunwayM)} required)
                </span>
              )}
            </div>
          )}

          {/* Aircraft Selector */}
          <div>
            <label className="text-gray-300 text-sm block mb-2">
              Aircraft <span className="text-gray-500 font-normal">(optional — route inactive without one)</span>
            </label>
            <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
              {/* Pending purchase row */}
              {pendingType && (
                <div className="flex items-center justify-between px-3 py-2 rounded border border-amber-400/40 bg-amber-500/10 text-sm">
                  <div>
                    <span className="text-amber-200 font-medium">{manufacturerFlag(pendingType.manufacturer)} {pendingType.model}</span>
                    <span className="ml-2 text-amber-400/70 text-xs">
                      {pendingType.seatsEconomy}Y{pendingType.seatsBusiness > 0 ? `/${pendingType.seatsBusiness}J` : ''} · {pendingType.rangeKm.toLocaleString()} km
                    </span>
                    <span className="ml-2 text-xs text-amber-300/60 italic">purchased on create</span>
                  </div>
                  <button
                    onClick={() => setPendingPurchaseTypeId(null)}
                    className="text-gray-500 hover:text-red-400 text-xs ml-3"
                  >
                    ✕
                  </button>
                </div>
              )}
              {/* No aircraft option */}
              {!pendingType && (
                <button
                  onClick={() => setSelectedAircraftId(null)}
                  className={`w-full text-left px-3 py-2 rounded border text-sm transition-colors ${
                    selectedAircraftId === null
                      ? 'border-sky-300/40 bg-sky-500/15 text-sky-200'
                      : 'border-white/10 bg-white/[0.055] text-gray-400 hover:border-white/20'
                  }`}
                >
                  No aircraft (inactive route)
                </button>
              )}
              {/* Existing fleet */}
              {availableAircraft.map(ac => {
                const acType = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
                const tooFar = distanceKm !== null && acType && distanceKm > acType.rangeKm;
                const tooShort = !!acType && (
                  (!!originAirport && !canAirportHandleAircraft(originAirport, acType)) ||
                  (!!destAirport && !canAirportHandleAircraft(destAirport, acType))
                );
                const unavailable = !!tooFar || tooShort;
                return (
                  <button
                    key={ac.id}
                    onClick={() => { if (!unavailable) { setSelectedAircraftId(ac.id); setPendingPurchaseTypeId(null); } }}
                    disabled={unavailable}
                    className={`w-full text-left px-3 py-2 rounded border text-sm transition-colors ${
                      selectedAircraftId === ac.id && !pendingType
                        ? 'border-sky-300/40 bg-sky-500/15 text-sky-200'
                        : unavailable
                        ? 'border-white/10 bg-white/[0.025] text-gray-600 cursor-not-allowed'
                        : 'border-white/10 bg-white/[0.055] text-gray-300 hover:border-white/20'
                    }`}
                  >
                    <span className="font-mono text-xs text-gray-500 mr-2">{ac.id.slice(0, 8).toUpperCase()}</span>
                    {acType?.model ?? ac.typeId}
                    {acType && (
                      <span className="ml-2 text-gray-500 text-xs">
                        {acType.seatsEconomy}Y{acType.seatsBusiness > 0 ? `/${acType.seatsBusiness}J` : ''} · {acType.rangeKm.toLocaleString()} km
                      </span>
                    )}
                    {tooFar && <span className="ml-2 text-red-500 text-xs">out of range</span>}
                    {tooShort && <span className="ml-2 text-red-500 text-xs">runway too short</span>}
                  </button>
                );
              })}
              {availableAircraft.length === 0 && !pendingType && (
                <p className="text-xs text-gray-500 italic px-1">No unassigned aircraft — buy one below.</p>
              )}
            </div>
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
              <div className="mt-2 glass-card overflow-hidden">
                <div className="px-3 py-2 bg-white/[0.05] text-xs text-gray-400 border-b border-white/10">
                  Your cash: <span className="text-white font-semibold">{formatCurrency(playerCash)}</span>
                  {distanceKm && <span className="ml-2">· Route: {distanceKm.toLocaleString()} km</span>}
                </div>
                  <div className="flex flex-col sm:flex-row h-[22rem] sm:h-52">
                  {/* Manufacturer sidebar */}
                  <div className="w-full sm:w-36 shrink-0 border-b sm:border-b-0 sm:border-r border-white/10 overflow-x-auto sm:overflow-y-auto py-1 bg-white/[0.025] flex sm:block scrollbar-none">
                    {buyMfrs.map(mfr => (
                      <button
                        key={mfr}
                        onClick={() => setBuyMfr(mfr)}
                        className={`shrink-0 sm:w-full text-left px-3 sm:px-2 py-2 sm:py-1.5 text-xs transition-colors ${
                          activeBuyMfr === mfr
                            ? 'bg-white/[0.12] text-white font-semibold'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.07]'
                        }`}
                      >
                        {mfr}
                      </button>
                    ))}
                  </div>
                  {/* Aircraft list */}
                  <div className="flex-1 overflow-y-auto divide-y divide-white/10 bg-slate-950/25">
                    {shopVisible.map(t => {
                      const fitsRange = distanceKm === null || t.rangeKm >= distanceKm;
                      const fitsRunway = (!originAirport || canAirportHandleAircraft(originAirport, t)) && (!destAirport || canAirportHandleAircraft(destAirport, t));
                      const fits      = fitsRange && fitsRunway;
                      const canAfford = playerCash >= t.purchasePrice;
                      const isPending = pendingPurchaseTypeId === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => fits && canAfford && handleSelectForPurchase(t.id)}
                          disabled={!fits || !canAfford}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                            isPending
                              ? 'bg-amber-500/15 border-l-2 border-amber-400'
                              : !fits
                              ? 'opacity-40 cursor-not-allowed'
                              : !canAfford
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:bg-white/[0.07] cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-medium">{t.model}</span>
                              {!fitsRange && <span className="text-[10px] text-red-400 bg-red-900/40 px-1 rounded">out of range</span>}
                              {fitsRange && !fitsRunway && <span className="text-[10px] text-red-400 bg-red-900/40 px-1 rounded">runway too short</span>}
                              {fits && <span className="text-[10px] text-green-400 bg-green-900/40 px-1 rounded">✓ in range</span>}
                              {isPending && <span className="text-[10px] text-amber-300 bg-amber-900/40 px-1 rounded">selected</span>}
                            </div>
                            <div className="text-xs text-gray-500">
                              {t.seatsEconomy}Y{t.seatsBusiness > 0 ? `/${t.seatsBusiness}J` : ''} · {t.rangeKm.toLocaleString()} km
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <div className={canAfford ? 'text-green-400 font-semibold text-xs' : 'text-red-400 font-semibold text-xs'}>
                              {formatCurrency(t.purchasePrice)}
                            </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Economy (max {formatUSD(maxEco)})</label>
                    <PriceInput
                      value={priceEconomy} min={1} max={maxEco}
                      onChange={v => setPriceEconomy(v)}
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
            <div className="glass-card px-4 py-3 space-y-3">
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
              <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2 sm:gap-3 text-sm">
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
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-white/10 bg-white/[0.025] flex-shrink-0 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
          <button
            onClick={closeModal}
            className="px-4 py-2 rounded border border-gray-600 text-gray-300 hover:border-gray-400 text-sm transition-colors min-h-11"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="apple-button-primary px-5 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pendingType
              ? `Create Route + Buy ${pendingType.model} (${formatCurrency(pendingType.purchasePrice)})`
              : 'Create Route'}
          </button>
        </div>
      </div>
    </div>
  );
};
