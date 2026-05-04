import React, { useEffect } from 'react';
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
import { CompetitorRouteModal } from './modals/CompetitorRouteModal';
import { RebrandModal } from './modals/RebrandModal';
import { SharePurchaseModal } from './modals/SharePurchaseModal';
import { NewspaperModal } from './modals/NewspaperModal';

const PANELS = {
  fleet: FleetPanel,
  routes: RoutesPanel,
  finance: FinancePanel,
  airlines: AirlinesPanel,
  hubs: HubsPanel,
};

export const Layout: React.FC = () => {
  const openPanel        = useGameStore(s => s.openPanel);
  const openModal        = useGameStore(s => s.openModal);
  const isInitialized    = useGameStore(s => s.isInitialized);
  const hydrated         = useHydrated();
  const newspaperQueue   = useGameStore(s => s.newspaperQueue);
  const openModalById    = useGameStore(s => s.openModalById);

  // Auto-open newspaper modal when queue has items and no other modal is showing
  useEffect(() => {
    if (openModal === null && newspaperQueue.length > 0) {
      openModalById('newspaper');
    }
  }, [openModal, newspaperQueue.length, openModalById]);


  if (!hydrated || !isInitialized) {
    return (
      <div className="w-screen h-screen bg-gray-950 flex items-center justify-center">
        {hydrated && <NewGameModal />}
      </div>
    );
  }

  const PanelComponent = openPanel ? PANELS[openPanel] : null;

  return (
    <div className="flex flex-col h-[100svh] bg-slate-950 text-white overflow-hidden">
      <TopBar />

      <div className="flex-1 flex relative overflow-hidden z-0">
        <div className="flex-1 relative">
          <GameMap />
          <AirportPopup />
        </div>

        {PanelComponent && (
          <div className="absolute inset-x-2 top-2 bottom-2 z-20 rounded-2xl border border-white/10 bg-gray-950/95 backdrop-blur-sm shadow-2xl flex flex-col overflow-hidden md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:top-0 md:w-96 md:rounded-none md:border-y-0 md:border-r-0 md:border-l">
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
      {openModal === 'aiRouteDetail' && <CompetitorRouteModal />}
      {openModal === 'rebrand' && <RebrandModal />}
      {openModal === 'sharesPurchase' && <SharePurchaseModal />}
      {openModal === 'newspaper' && <NewspaperModal />}
    </div>
  );
};
