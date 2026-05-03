export interface FlightResult {
  routeId: string;
  flightDate: number;
  passengersEconomy: number;
  passengersBusiness: number;
  revenueEconomy: number;
  revenueBusiness: number;
  fuelCostUSD: number;
  maintenanceCostUSD: number;
  airportFeesUSD: number;
  crewCostUSD: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
}

export interface DailyPnL {
  gameDay: number;
  airlineId: string;
  revenue: number;
  fuelCost: number;
  maintenanceCost: number;
  airportFees: number;
  crewCost: number;
  hubFees: number;
  totalCost: number;
  netProfit: number;
  cashBefore: number;
  cashAfter: number;
  passengers: number;
}

export interface RouteStats {
  routeId: string;
  competitorCount: number;
  totalMarketDemandDaily: number;
  playerMarketSharePct: number;
  priceCompetitiveness: number;
}
