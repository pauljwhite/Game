import type { StateCreator } from 'zustand';
import type { GameStore } from './index';

export type PanelId = 'fleet' | 'routes' | 'finance' | 'airlines' | 'hubs';
export type ModalId = 'buyAircraft' | 'newRoute' | 'routeDetail' | 'takeover' | 'gameOver' | 'newGame' | 'aiRouteDetail';

export interface UISlice {
  selectedAirportIata: string | null;
  selectedRouteId: string | null;
  openPanel: PanelId | null;
  openModal: ModalId | null;
  modalPayload: unknown;

  selectAirport: (iata: string | null) => void;
  selectRoute: (routeId: string | null) => void;
  openPanelById: (id: PanelId) => void;
  closePanel: () => void;
  openModalById: (id: ModalId, payload?: unknown) => void;
  closeModal: () => void;
}

export const createUISlice: StateCreator<GameStore, [['zustand/immer', never]], [], UISlice> = (set) => ({
  selectedAirportIata: null,
  selectedRouteId: null,
  openPanel: null,
  openModal: null,
  modalPayload: null,

  selectAirport: (iata) => set((state) => { state.selectedAirportIata = iata; }),
  selectRoute: (routeId) => set((state) => { state.selectedRouteId = routeId; }),
  openPanelById: (id) => set((state) => { state.openPanel = id; }),
  closePanel: () => set((state) => { state.openPanel = null; }),
  openModalById: (id, payload) => set((state) => { state.openModal = id; state.modalPayload = payload ?? null; }),
  closeModal: () => set((state) => { state.openModal = null; state.modalPayload = null; }),
});
