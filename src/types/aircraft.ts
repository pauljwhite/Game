export type ProfileId =
  | 'narrow-classic'
  | 'narrow-trijet'
  | 'narrow-modern'
  | 'narrow-rear-twin'
  | 'narrow-rear-tri'
  | 'regional-turboprop'
  | 'regional-jet'
  | 'wide-twin'
  | 'wide-quad'
  | 'wide-a380';

export type AircraftCategory = 'regional' | 'narrowbody' | 'widebody';

export interface AircraftType {
  id: string;
  manufacturer: string;
  model: string;
  familyName: string;
  seatsEconomy: number;
  seatsBusiness: number;
  rangeKm: number;
  cruiseSpeedKmh: number;
  fuelBurnLPer100Km: number;
  purchasePrice: number;
  maintenanceCostPerHourUSD: number;
  category: AircraftCategory;
  yearIntroduced: number;
  profileId: ProfileId;
}

export type AircraftStatus = 'idle' | 'flying' | 'maintenance' | 'crashed';
export type MaintenanceTier = 'light' | 'standard' | 'full';

export interface Aircraft {
  id: string;
  typeId: string;
  name: string;
  airlineId: string;
  purchasedGameDay: number;
  totalFlightHours: number;
  condition: number;
  maintenanceHoursOwed: number;
  isGrounded: boolean;
  lastMaintenanceGameDay: number;
  crashRisk: number;
  assignedRouteId: string | null;
  status: AircraftStatus;
  currentLat: number;
  currentLon: number;
  flightProgress: number;
  // Maintenance settings
  activeMaintTier: MaintenanceTier | null;  // tier currently being serviced
  autoMaintenanceEnabled: boolean;
  autoMaintenanceThreshold: number;         // trigger at this condition %
  autoMaintenanceTier: MaintenanceTier;
  groundedReason?: string;
}
