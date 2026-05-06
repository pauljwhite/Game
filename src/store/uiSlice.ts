import type { StateCreator } from 'zustand';
import type { GameStore } from './index';

export type PanelId = 'fleet' | 'routes' | 'finance' | 'airlines' | 'hubs';
export type ModalId = 'buyAircraft' | 'newRoute' | 'routeDetail' | 'takeover' | 'gameOver' | 'newGame' | 'aiRouteDetail' | 'rebrand' | 'sharesPurchase' | 'newspaper' | 'settings';
export type ThemeMode = 'dark' | 'light';

export interface NewsArticle {
  id: string;
  headline: string;
  subheadline: string;
  paragraphs: string[];
  severity: 'incident' | 'grounding' | 'crash';
  gameDay: number;
  // When set, the modal shows maintenance/ignore action buttons for a player aircraft
  actionAircraftId?: string;
  actionMaintenanceCost?: number;
  suppressAutoOpen?: boolean;
}

export interface NewsTickerItem {
  id: string;
  text: string;
  severity?: 'normal' | 'fleet' | 'breaking';
  articleId?: string;
}

export interface UISlice {
  selectedAirportIata: string | null;
  selectedRouteId: string | null;
  openPanel: PanelId | null;
  openModal: ModalId | null;
  modalPayload: unknown;
  newspaperQueue: NewsArticle[];
  themeMode: ThemeMode;

  selectAirport: (iata: string | null) => void;
  selectRoute: (routeId: string | null) => void;
  openPanelById: (id: PanelId) => void;
  closePanel: () => void;
  openModalById: (id: ModalId, payload?: unknown) => void;
  closeModal: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  pushNewspaper: (article: NewsArticle) => void;
  popNewspaper: (articleId?: string) => void;
}

export const createUISlice: StateCreator<GameStore, [['zustand/immer', never]], [], UISlice> = (set) => ({
  selectedAirportIata: null,
  selectedRouteId: null,
  openPanel: null,
  openModal: null,
  modalPayload: null,
  newspaperQueue: [],
  themeMode: 'dark',

  selectAirport: (iata) => set((state) => { state.selectedAirportIata = iata; }),
  selectRoute: (routeId) => set((state) => { state.selectedRouteId = routeId; }),
  openPanelById: (id) => set((state) => { state.openPanel = id; }),
  closePanel: () => set((state) => { state.openPanel = null; }),
  openModalById: (id, payload) => set((state) => { state.openModal = id; state.modalPayload = payload ?? null; }),
  closeModal: () => set((state) => { state.openModal = null; state.modalPayload = null; }),
  setThemeMode: (mode) => set((state) => { state.themeMode = mode; }),
  pushNewspaper: (article) => set((state) => {
    state.newspaperQueue.push(article);
    if (state.newspaperQueue.length > 8) state.newspaperQueue.shift();
  }),
  popNewspaper: (articleId) => set((state) => {
    if (!articleId) {
      state.newspaperQueue.shift();
      return;
    }
    state.newspaperQueue = state.newspaperQueue.filter(article => article.id !== articleId);
  }),
});
