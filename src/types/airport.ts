export type AirportSize = 'small' | 'medium' | 'large' | 'major';

export type AirportRegion =
  | 'north_america'
  | 'europe'
  | 'asia_pacific'
  | 'middle_east'
  | 'africa'
  | 'latin_america'
  | 'oceania';

export interface Airport {
  iata: string;
  icao?: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  size: AirportSize;
  region: AirportRegion;
  landingFee: number;
  isHub?: boolean;
  closedUntilGameDay?: number;
  closureReason?: string;
}
