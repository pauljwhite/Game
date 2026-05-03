import React, { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '@/store';
import { haversineKm } from '@/utils/geo';
import { computeFlightCost, gameDayFromMs } from '@/engine/economicsEngine';
import { getSuggestedEconomyPrice } from '@/engine/demandModel';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import type { Route } from '@/types';
import { FUEL_PRICE_USD_PER_LITER } from '@/utils/constants';
import { AirportSearchInput } from '@/ui/components/AirportSearchInput';
import { findAirportByQuery } from '@/utils/airportSearch';

function formatUSD(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export const NewRouteModal: React.FC = () => {
  const airports = useGameStore(s => s.airports);
  const aircraft = useGameStore(s => s.aircraft);
  const modalPayload = useGameStore(s => s.modalPayload);
  const closeModal = useGameStore(s => s.closeModal);
  const createRoute = useGameStore(s => s.createRoute);
  const gameTimeMs = useGameStore(s => s.gameTimeMs);

  const gameDay = gameDayFromMs(gameTimeMs);

  const prefilledOrigin = typeof modalPayload === 'string' ? modalPayload.toUpperCase() : '';

  const [originIata, setOriginIata] = useState(prefilledOrigin);
  const [destIata, setDestIata] = useState('');
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [flightsPerWeek, setFlightsPerWeek] = useState(7);
  const [priceEconomy, setPriceEconomy] = useState(200);
  const [priceBusiness, setPriceBusiness] = useState(800);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // P&L preview
  const pnlPreview = useMemo(() => {
    if (!selectedAc || !selectedType || !originAirport || !destAirport || !distanceKm) return null;

    const mockRoute: Route = {
      id: 'preview',
      airlineId: 'player',
      originIata: originAirport?.iata ?? originIata.toUpperCase(),
      destinationIata: destAirport?.iata ?? destIata.toUpperCase(),
      aircraftId: selectedAc.id,
      flightsPerWeek,
      priceEconomy,
      priceBusiness,
      isActive: true,
      createdGameDay: gameDay,
      distanceKm,
      flightDurationHours: 0,
      dailyPassengers: 0,
      dailyRevenue: 0,
      dailyCost: 0,
      dailyProfit: 0,
      loadFactorEconomy: 0,
      loadFactorBusiness: 0,
    };

    const costs = computeFlightCost(mockRoute, selectedAc, selectedType, originAirport, destAirport, FUEL_PRICE_USD_PER_LITER);
    const flightsPerDay = flightsPerWeek / 7;
    const dailyCost = costs.totalCost * flightsPerDay;

    const totalSeats = selectedType.seatsEconomy + selectedType.seatsBusiness;
    const assumedLoadFactor = 0.75;
    const ecoPax = Math.floor(selectedType.seatsEconomy * flightsPerDay * assumedLoadFactor);
    const bizPax = Math.floor(selectedType.seatsBusiness * flightsPerDay * assumedLoadFactor);
    const dailyRevenue = ecoPax * priceEconomy + bizPax * priceBusiness;
    const dailyProfit = dailyRevenue - dailyCost;

    return { dailyRevenue, dailyCost, dailyProfit, totalSeats, flightDurationHours: costs.flightDurationHours };
  }, [selectedAc, selectedType, originAirport, destAirport, distanceKm, flightsPerWeek, priceEconomy, priceBusiness, gameDay, originIata, destIata]);

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

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
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
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-300 text-sm block mb-1">Economy Price (USD)</label>
              <input
                type="number"
                min={1}
                step={10}
                value={priceEconomy}
                onChange={e => {
                  const val = Number(e.target.value);
                  setPriceEconomy(val);
                  setPriceBusiness(Math.round(val * 4));
                }}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm block mb-1">Business Price (USD)</label>
              <input
                type="number"
                min={1}
                step={10}
                value={priceBusiness}
                onChange={e => setPriceBusiness(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* P&L Preview */}
          {pnlPreview && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Estimated Daily P&L (75% load factor)</p>
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
              <p className="text-xs text-gray-500 mt-2">
                Flight time: {pnlPreview.flightDurationHours.toFixed(1)}h - {flightsPerWeek} flights/week
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
        <div className="px-6 py-4 border-t border-gray-700 flex-shrink-0 flex gap-3 justify-end">
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
