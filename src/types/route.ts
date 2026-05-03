export interface Route {
  id: string;
  airlineId: string;
  originIata: string;
  destinationIata: string;
  aircraftId: string | null;
  flightsPerWeek: number;
  priceEconomy: number;
  priceBusiness: number;
  isActive: boolean;
  createdGameDay: number;
  distanceKm: number;
  flightDurationHours: number;
  dailyPassengers: number;
  dailyRevenue: number;
  dailyCost: number;
  dailyProfit: number;
  loadFactorEconomy: number;
  loadFactorBusiness: number;
}
