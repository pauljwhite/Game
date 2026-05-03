import React from 'react';
import { useGameStore, useHydrated } from '@/store';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { GameMap } from '@/map/GameMap';
import { AirportPopup } from './components/AirportPopup';
import { FleetPanel } from './panels/FleetPanel';
import { RoutesPanel } from './panels/RoutesPanel';
import { FinancePanel } from './panels/FinancePanel';
import { AirlinesPanel } from './panels/AirlinesPanel';
import { HubsPanel } from './panels/HubsPanel';
import { NewGameModal } from './modals/NewGameModal';
import { BuyAircraftModal } from './modals/BuyAircraftModal';
import { NewRouteModal } from './modals/NewRouteModal';
import { RouteDetailModal } from './modals/RouteDetailModal';
import { TakeoverModal } from './modals/TakeoverModal';
import { GameOverModal } from './modals/GameOverModal';

const PANELS = {
  fleet: FleetPanel,
  routes: RoutesPanel,
  finance: FinancePanel,
  airlines: AirlinesPanel,
  hubs: HubsPanel,
};

export const Layout: React.FC = () => {
  const openPanel = useGameStore(s => s.openPanel);
  const openModal = useGameStore(s => s.openModal);
  const isInitialized = useGameStore(s => s.isInitialized);
  const hydrated = useHydrated();


  if (!hydrated || !isInitialized) {
    return (
      <div className="w-screen h-screen bg-gray-950 flex items-center justify-center">
        {hydrated && <NewGameModal />}
      </div>
    );
  }

  const PanelComponent = openPanel ? PANELS[openPanel] : null;

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      <TopBar />

      <div className="flex-1 flex relative overflow-hidden">
        <div className="flex-1 relative">
          <GameMap />
          <AirportPopup />
        </div>

        {PanelComponent && (
          <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden shrink-0">
            <PanelComponent />
          </div>
        )}
      </div>

      <BottomBar />

      {openModal === 'buyAircraft' && <BuyAircraftModal />}
      {openModal === 'newRoute' && <NewRouteModal />}
      {openModal === 'routeDetail' && <RouteDetailModal />}
      {openModal === 'takeover' && <TakeoverModal />}
      {openModal === 'gameOver' && <GameOverModal />}
    </div>
  );
};
