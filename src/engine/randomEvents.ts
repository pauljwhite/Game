interface AircraftEventDef {
  id: string;
  newsTemplate: string; // placeholders: {airline}, {aircraft}, {airport}
  conditionDelta: number;
  ground: boolean;
  reputationDelta: number;
  probability: number; // per active aircraft per day
}

interface ScandalEventDef {
  id: string;
  newsTemplate: string; // placeholder: {airline}
  reputationDelta: number;
  probability: number; // per active (non-insolvent) AI airline per day
}

const AIRCRAFT_EVENTS: AircraftEventDef[] = [
  {
    id: 'bird_strike',
    newsTemplate: 'BIRD STRIKE: {airline} {aircraft} struck birds on approach to {airport}. Aircraft pulled for inspection.',
    conditionDelta: -8,
    ground: false,
    reputationDelta: 0,
    probability: 0.004,
  },
  {
    id: 'burst_tyre',
    newsTemplate: 'INCIDENT: {airline} {aircraft} suffered a burst tyre on landing at {airport}. Aircraft grounded for checks.',
    conditionDelta: -6,
    ground: true,
    reputationDelta: -2,
    probability: 0.003,
  },
  {
    id: 'oil_leak',
    newsTemplate: 'GROUNDED: {airline} {aircraft} taken offline at {airport} after oil leak discovered during pre-flight checks.',
    conditionDelta: -15,
    ground: true,
    reputationDelta: -3,
    probability: 0.0025,
  },
  {
    id: 'avionics_fault',
    newsTemplate: 'TECH FAULT: {airline} {aircraft} experiences avionics malfunction at {airport}. Passengers transferred to spare aircraft.',
    conditionDelta: -5,
    ground: true,
    reputationDelta: -2,
    probability: 0.003,
  },
  {
    id: 'pressurisation_fault',
    newsTemplate: 'EMERGENCY: {airline} {aircraft} makes emergency descent after pressurisation failure. Diverted to {airport}.',
    conditionDelta: -20,
    ground: true,
    reputationDelta: -6,
    probability: 0.0015,
  },
  {
    id: 'engine_shutdown',
    newsTemplate: 'ENGINE SHUTDOWN: {airline} {aircraft} shuts down engine in flight and diverts to {airport}. Aircraft grounded.',
    conditionDelta: -25,
    ground: true,
    reputationDelta: -10,
    probability: 0.001,
  },
  {
    id: 'hydraulic_fault',
    newsTemplate: 'EMERGENCY: {airline} {aircraft} declares emergency after hydraulic failure. Lands safely at {airport}.',
    conditionDelta: -22,
    ground: true,
    reputationDelta: -8,
    probability: 0.001,
  },
  {
    id: 'fuel_contamination',
    newsTemplate: 'GROUNDED: {airline} {aircraft} grounded at {airport} after contaminated fuel discovered during refuelling.',
    conditionDelta: -10,
    ground: true,
    reputationDelta: -4,
    probability: 0.002,
  },
  {
    id: 'lightning_strike',
    newsTemplate: 'LIGHTNING STRIKE: {airline} {aircraft} struck by lightning near {airport}. Aircraft inspected and grounded.',
    conditionDelta: -12,
    ground: true,
    reputationDelta: 0,
    probability: 0.002,
  },
];

const AI_SCANDAL_EVENTS: ScandalEventDef[] = [
  {
    id: 'price_fixing',
    newsTemplate: 'SCANDAL: {airline} under regulatory investigation for alleged price-fixing with competitor airlines.',
    reputationDelta: -20,
    probability: 0.0005,
  },
  {
    id: 'safety_violations',
    newsTemplate: 'FINE: {airline} hit with record fine after aviation authority uncovers years of unreported safety violations.',
    reputationDelta: -25,
    probability: 0.0005,
  },
  {
    id: 'overbooking_incident',
    newsTemplate: 'VIRAL VIDEO: {airline} staff filmed forcibly removing passenger sparks nationwide boycott calls.',
    reputationDelta: -22,
    probability: 0.0007,
  },
  {
    id: 'baggage_scandal',
    newsTemplate: 'SCANDAL: Investigation exposes systemic baggage theft and mishandling at {airline}. Compensation claims mount.',
    reputationDelta: -14,
    probability: 0.001,
  },
  {
    id: 'financial_fraud',
    newsTemplate: 'FRAUD: Whistleblower exposes financial irregularities at {airline}. CEO resigns amid criminal probe.',
    reputationDelta: -30,
    probability: 0.0003,
  },
  {
    id: 'customer_service_crisis',
    newsTemplate: 'CRISIS: {airline} faces mass complaints after stranding thousands of passengers and refusing refunds.',
    reputationDelta: -16,
    probability: 0.001,
  },
  {
    id: 'pilot_fatigue',
    newsTemplate: 'EXPOSÉ: Leaked documents reveal {airline} routinely violated pilot rest regulations to cut costs.',
    reputationDelta: -20,
    probability: 0.0006,
  },
  {
    id: 'toxic_cabin_air',
    newsTemplate: 'HEALTH ALERT: {airline} faces lawsuits after crew and passengers hospitalised by toxic cabin air events.',
    reputationDelta: -18,
    probability: 0.0005,
  },
  {
    id: 'data_breach',
    newsTemplate: 'DATA BREACH: {airline} suffers major cyberattack exposing millions of passenger records.',
    reputationDelta: -15,
    probability: 0.0007,
  },
];

function pickAirport(store: ReturnType<typeof import('@/store/index')['useGameStore']['getState']>, iata: string | undefined): string {
  if (iata && store.airports[iata]) return store.airports[iata].city;
  const keys = Object.keys(store.airports);
  const key = keys[Math.floor(Math.random() * keys.length)];
  return store.airports[key]?.city ?? 'unknown';
}

export function runRandomEventsTick(
  store: ReturnType<typeof import('@/store/index')['useGameStore']['getState']>,
): void {
  const { aircraft, aiAircraft, airlines, aiAirlines, routes, aiRoutes } = store;
  const playerAirline = airlines['player'];

  // ── Player aircraft events ────────────────────────────────────────────
  if (playerAirline && !playerAirline.isInsolvent) {
    const eligibleAc = Object.values(aircraft).filter(
      ac => ac.airlineId === 'player' &&
            ac.status !== 'maintenance' &&
            ac.status !== 'crashed' &&
            !ac.isGrounded,
    );

    for (const ac of eligibleAc) {
      for (const evt of AIRCRAFT_EVENTS) {
        if (Math.random() > evt.probability) continue;

        // Find a plausible airport for the news message
        const route = ac.assignedRouteId ? routes[ac.assignedRouteId] : null;
        const airportIata = route ? route.destinationIata : undefined;
        const airportCity = pickAirport(store, airportIata);

        const msg = evt.newsTemplate
          .replace('{airline}', playerAirline.name)
          .replace('{aircraft}', `${ac.name}`)
          .replace('{airport}', airportCity);

        store.pushNewsItem(msg);
        store.updateAircraftCondition(ac.id, evt.conditionDelta, 0);

        if (evt.ground) {
          store.groundAircraft(ac.id);
        }
        if (evt.reputationDelta !== 0) {
          store.applyReputationHit('player', evt.reputationDelta);
        }

        break; // one event per aircraft per day
      }
    }
  }

  // ── AI aircraft events ────────────────────────────────────────────────
  Object.values(aiAirlines).forEach(aiAirline => {
    if (aiAirline.isInsolvent) return;

    const eligibleAc = aiAirline.fleetIds
      .map(id => aiAircraft[id])
      .filter(ac => ac && ac.status !== 'crashed' && !ac.isGrounded) as typeof aircraft[string][];

    for (const ac of eligibleAc) {
      for (const evt of AIRCRAFT_EVENTS) {
        if (Math.random() > evt.probability) continue;

        const route = ac.assignedRouteId ? aiRoutes[ac.assignedRouteId] : null;
        const airportIata = route ? route.destinationIata : undefined;
        const airportCity = pickAirport(store, airportIata);

        const msg = evt.newsTemplate
          .replace('{airline}', aiAirline.name)
          .replace('{aircraft}', `${aiAirline.name} aircraft`)
          .replace('{airport}', airportCity);

        store.pushNewsItem(msg);

        // For AI, a large enough delta will trigger auto-grounding via updateAIAircraftCondition
        const delta = evt.ground ? Math.min(evt.conditionDelta, -(ac.condition - 15)) : evt.conditionDelta;
        store.updateAIAircraftCondition(ac.id, delta, 0);

        if (evt.reputationDelta !== 0) {
          store.updateAIAirline(aiAirline.id, {
            reputationScore: Math.max(0, aiAirline.reputationScore + evt.reputationDelta),
          });
        }

        break; // one event per aircraft per day
      }
    }
  });

  // ── AI airline scandal events ─────────────────────────────────────────
  Object.values(aiAirlines).forEach(aiAirline => {
    if (aiAirline.isInsolvent) return;

    for (const scandal of AI_SCANDAL_EVENTS) {
      if (Math.random() > scandal.probability) continue;

      const msg = scandal.newsTemplate.replace('{airline}', aiAirline.name);
      store.pushNewsItem(msg);
      store.updateAIAirline(aiAirline.id, {
        reputationScore: Math.max(0, aiAirline.reputationScore + scandal.reputationDelta),
      });

      break; // one scandal per airline per day
    }
  });
}
