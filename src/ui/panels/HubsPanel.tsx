import React from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { HUB_ANNUAL_FEE_USD } from '@/utils/constants';
import {
  MAX_FIRST_CLASS_LOUNGE_LEVEL,
  MAX_HUB_TERMINAL_LEVEL,
  getFirstClassLoungeLevel,
  getFirstClassLoungeUpgradeCost,
  getHubCapacityMultiplier,
  getHubDemandMultiplier,
  getHubTerminalLevel,
  getHubTerminalUpgradeCost,
} from '@/engine/hubUpgrades';

export const HubsPanel: React.FC = () => {
  const airlines = useGameStore(s => s.airlines);
  const airports = useGameStore(s => s.airports);
  const removeHub = useGameStore(s => s.removeHub);
  const upgradeHubTerminal = useGameStore(s => s.upgradeHubTerminal);
  const upgradeHubLounge = useGameStore(s => s.upgradeHubLounge);
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
          Annual fee: {formatCurrency(HUB_ANNUAL_FEE_USD)}/hub - terminals raise capacity, lounges raise demand
        </p>
      </div>

      <div className="flex-none overflow-visible">
        {hubAirports.length === 0 && (
          <div className="p-4 text-gray-400 text-sm text-center">
            No hubs yet. Click an airport on the map to designate a hub.
          </div>
        )}
        {hubAirports.map(airport => {
          const terminalLevel = getHubTerminalLevel(airport);
          const loungeLevel = getFirstClassLoungeLevel(airport);
          const terminalUpgradeCost = getHubTerminalUpgradeCost(airport);
          const loungeUpgradeCost = getFirstClassLoungeUpgradeCost(airport);
          const canAffordTerminal = terminalUpgradeCost !== null && playerAirline.cashUSD >= terminalUpgradeCost;
          const canAffordLounge = loungeUpgradeCost !== null && playerAirline.cashUSD >= loungeUpgradeCost;

          return (
          <div key={airport.iata} className="p-3 border-b border-white/10 space-y-3">
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

            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-200">Terminal capacity {terminalLevel}/{MAX_HUB_TERMINAL_LEVEL}</div>
                    <div className="text-[10px] text-gray-500">Current capacity x{getHubCapacityMultiplier(airport).toFixed(2)}</div>
                  </div>
                  <button
                    type="button"
                    disabled={terminalUpgradeCost === null || !canAffordTerminal}
                    onClick={() => upgradeHubTerminal(airport.iata)}
                    className="apple-button disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {terminalUpgradeCost === null ? 'Max' : `Upgrade ${formatCurrency(terminalUpgradeCost)}`}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-200">First class lounges {loungeLevel}/{MAX_FIRST_CLASS_LOUNGE_LEVEL}</div>
                    <div className="text-[10px] text-gray-500">Current demand x{getHubDemandMultiplier(airport).toFixed(2)}</div>
                  </div>
                  <button
                    type="button"
                    disabled={loungeUpgradeCost === null || !canAffordLounge}
                    onClick={() => upgradeHubLounge(airport.iata)}
                    className="apple-button disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loungeUpgradeCost === null ? 'Max' : `Upgrade ${formatCurrency(loungeUpgradeCost)}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
        })}

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
