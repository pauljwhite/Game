import React, { useEffect, useRef, useState } from 'react';
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
import { SettingsModal } from './modals/SettingsModal';

const PANELS = {
  fleet: FleetPanel,
  routes: RoutesPanel,
  finance: FinancePanel,
  airlines: AirlinesPanel,
  hubs: HubsPanel,
};

const PANEL_SLIDE_MS = 280;
const MODAL_ANIMATION_MS = 220;

export const Layout: React.FC = () => {
  const openPanel        = useGameStore(s => s.openPanel);
  const openModal        = useGameStore(s => s.openModal);
  const isInitialized    = useGameStore(s => s.isInitialized);
  const hydrated         = useHydrated();
  const newspaperQueue   = useGameStore(s => s.newspaperQueue);
  const openModalById    = useGameStore(s => s.openModalById);
  const themeMode        = useGameStore(s => s.themeMode);
  const [displayedPanel, setDisplayedPanel] = useState<typeof openPanel>(openPanel);
  const [panelVisible, setPanelVisible] = useState(Boolean(openPanel));
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayedModal, setDisplayedModal] = useState<typeof openModal>(openModal);
  const [modalVisible, setModalVisible] = useState(Boolean(openModal));
  const modalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (openPanel) {
      setDisplayedPanel(openPanel);
      requestAnimationFrame(() => setPanelVisible(true));
      return;
    }

    setPanelVisible(false);
    closeTimerRef.current = setTimeout(() => {
      setDisplayedPanel(null);
      closeTimerRef.current = null;
    }, PANEL_SLIDE_MS);

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [openPanel]);

  useEffect(() => {
    if (modalTimerRef.current) {
      clearTimeout(modalTimerRef.current);
      modalTimerRef.current = null;
    }

    if (openModal) {
      setDisplayedModal(openModal);
      requestAnimationFrame(() => setModalVisible(true));
      return;
    }

    setModalVisible(false);
    modalTimerRef.current = setTimeout(() => {
      setDisplayedModal(null);
      modalTimerRef.current = null;
    }, MODAL_ANIMATION_MS);

    return () => {
      if (modalTimerRef.current) {
        clearTimeout(modalTimerRef.current);
        modalTimerRef.current = null;
      }
    };
  }, [openModal]);

  const nextAutoOpenArticle = newspaperQueue.find(article => !article.suppressAutoOpen);

  // Auto-open newspaper modal when queue has items and no other modal is showing
  useEffect(() => {
    if (openModal === null && nextAutoOpenArticle) {
      openModalById('newspaper', nextAutoOpenArticle.id);
    }
  }, [openModal, nextAutoOpenArticle, openModalById]);


  if (!hydrated || !isInitialized) {
    return (
      <div className={`w-screen h-screen flex items-center justify-center ${themeMode === 'light' ? 'bg-slate-100' : 'bg-gray-950'}`}>
        {hydrated && <NewGameModal />}
      </div>
    );
  }

  const PanelComponent = displayedPanel ? PANELS[displayedPanel] : null;
  const modalContent = (() => {
    if (displayedModal === 'buyAircraft') return <BuyAircraftModal />;
    if (displayedModal === 'newRoute') return <NewRouteModal />;
    if (displayedModal === 'routeDetail') return <RouteDetailModal />;
    if (displayedModal === 'takeover') return <TakeoverModal />;
    if (displayedModal === 'gameOver') return <GameOverModal />;
    if (displayedModal === 'aiRouteDetail') return <CompetitorRouteModal />;
    if (displayedModal === 'rebrand') return <RebrandModal />;
    if (displayedModal === 'sharesPurchase') return <SharePurchaseModal />;
    if (displayedModal === 'newspaper') return <NewspaperModal />;
    if (displayedModal === 'settings') return <SettingsModal />;
    return null;
  })();

  return (
    <div className={`flex flex-col h-[100svh] text-white overflow-hidden ${themeMode === 'light' ? 'bg-slate-100' : 'bg-slate-950'}`}>
      <TopBar />

      <div className="flex-1 min-h-0 flex relative overflow-hidden z-0">
        <div className="flex-1 min-h-0 relative">
          <GameMap />
          <AirportPopup />
        </div>

        {PanelComponent && (
          <div className={`absolute inset-x-2 top-2 bottom-2 z-20 rounded-2xl border border-white/10 backdrop-blur-sm shadow-2xl flex min-h-0 flex-col overflow-hidden transition-transform duration-300 ease-in-out will-change-transform md:inset-y-0 md:right-0 md:left-auto md:w-96 md:rounded-none md:border-y-0 md:border-r-0 md:border-l ${
            panelVisible ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'
          } ${themeMode === 'light' ? 'bg-white/95' : 'bg-gray-950/95'}`}>
            <PanelComponent />
          </div>
        )}
      </div>

      <BottomBar />

      {modalContent && (
        <div className={`fixed inset-0 z-[9998] transition-all duration-200 ease-in-out will-change-transform ${
          modalVisible
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-3 scale-[0.985] opacity-0'
        }`}>
          {modalContent}
        </div>
      )}
    </div>
  );
};
