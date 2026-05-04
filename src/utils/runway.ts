import type { Airport, AircraftType } from '@/types';

export function formatRunwayLength(lengthM: number | undefined): string {
  return lengthM ? `${lengthM.toLocaleString()} m` : 'Unknown';
}

export function canAirportHandleAircraft(airport: Airport | undefined, type: AircraftType | null | undefined): boolean {
  if (!airport || !type) return false;
  if (!airport.longestRunwayM) return true;
  return airport.longestRunwayM >= type.minRunwayM;
}
