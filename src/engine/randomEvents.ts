interface AircraftEventDef {
  id: string;
  newsTemplate: string; // placeholders: {airline}, {aircraft}, {airport}
  conditionDelta: number;
  ground: boolean;
  groundReason?: string; // short label shown in fleet panel
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
  // ── Minor incidents — inspection only, no grounding ──────────────────
  {
    id: 'bird_strike_minor',
    newsTemplate: 'BIRD STRIKE: {airline} {aircraft} ingested birds into No.1 engine on approach to {airport}. Borescope inspection ordered.',
    conditionDelta: -5,
    ground: false,
    reputationDelta: 0,
    probability: 0.004,
  },
  {
    id: 'windshield_crack',
    newsTemplate: 'TECH: {airline} {aircraft} returned to {airport} after a hairline crack developed in the outer windshield layer. Precautionary landing.',
    conditionDelta: -4,
    ground: false,
    reputationDelta: 0,
    probability: 0.003,
  },
  {
    id: 'apu_failure',
    newsTemplate: 'TECH: {airline} {aircraft} APU failed to start at {airport}. Ground power used; APU sent for overhaul.',
    conditionDelta: -6,
    ground: false,
    reputationDelta: 0,
    probability: 0.003,
  },
  {
    id: 'static_discharger',
    newsTemplate: 'TECH: Maintenance crew at {airport} found multiple missing static dischargers on {airline} {aircraft}. Replaced before next departure.',
    conditionDelta: -3,
    ground: false,
    reputationDelta: 0,
    probability: 0.005,
  },
  {
    id: 'galley_smoke',
    newsTemplate: 'PRECAUTIONARY: {airline} {aircraft} declared a precautionary landing at {airport} after smoke detected in forward galley. Faulty oven unit found.',
    conditionDelta: -4,
    ground: false,
    reputationDelta: -1,
    probability: 0.003,
  },
  {
    id: 'pitot_heat_fail',
    newsTemplate: 'TECH: {airline} {aircraft} returned to {airport} after a pitot heat fault illuminated. Airspeed disagreement procedure followed.',
    conditionDelta: -5,
    ground: false,
    reputationDelta: 0,
    probability: 0.0025,
  },
  {
    id: 'tcas_ra',
    newsTemplate: 'SAFETY: {airline} {aircraft} followed a TCAS Resolution Advisory near {airport}, deviating from assigned altitude. Incident under review.',
    conditionDelta: -2,
    ground: false,
    reputationDelta: -1,
    probability: 0.003,
  },
  {
    id: 'idg_disconnect',
    newsTemplate: 'TECH: {airline} {aircraft} had an Integrated Drive Generator disconnect in cruise. Single-bus electrical operations to {airport}. IDG replaced on ground.',
    conditionDelta: -7,
    ground: false,
    reputationDelta: 0,
    probability: 0.002,
  },
  {
    id: 'oxygen_mask_deploy',
    newsTemplate: 'INCIDENT: Passenger oxygen masks deployed briefly on {airline} {aircraft} due to a transient cabin altitude blip. Flight continued to {airport}. Investigation ongoing.',
    conditionDelta: -8,
    ground: false,
    reputationDelta: -3,
    probability: 0.002,
  },
  // ── Moderate — aircraft grounded, moderate condition hit ──────────────
  {
    id: 'burst_tyre',
    newsTemplate: 'INCIDENT: {airline} {aircraft} suffered a main-gear tyre blowout on landing roll at {airport}. FOD inspection of runway ordered. Aircraft grounded.',
    conditionDelta: -8,
    ground: true,
    reputationDelta: -2,
    probability: 0.003,
  },
  {
    id: 'nose_gear_fault',
    newsTemplate: 'GROUNDED: {airline} {aircraft} grounded at {airport} after a nose-gear retraction fault was logged post-departure. Gear actuator and uplock under inspection.',
    conditionDelta: -10,
    ground: true,
    reputationDelta: -3,
    probability: 0.0025,
  },
  {
    id: 'oil_leak',
    newsTemplate: 'GROUNDED: {airline} {aircraft} taken offline at {airport} after a No.2 engine oil seal failure was detected during pre-flight. Engine pulled for shop visit.',
    conditionDelta: -16,
    ground: true,
    reputationDelta: -3,
    probability: 0.0025,
  },
  {
    id: 'fuel_contamination',
    newsTemplate: 'GROUNDED: {airline} {aircraft} defuelled at {airport} after water contamination found in centre tank sump. Bowser batch under investigation.',
    conditionDelta: -10,
    ground: true,
    reputationDelta: -4,
    probability: 0.002,
  },
  {
    id: 'engine_compressor_stall',
    newsTemplate: 'INCIDENT: {airline} {aircraft} experienced a compressor stall on climb-out from {airport}. Engine reset and flight continued; borescope inspection required on arrival.',
    conditionDelta: -14,
    ground: true,
    reputationDelta: -4,
    probability: 0.002,
  },
  {
    id: 'bleed_air_duct_failure',
    newsTemplate: 'GROUNDED: {airline} {aircraft} grounded at {airport} after a bleed air duct overheat warning. Duct rupture found in the wing-to-body fairing.',
    conditionDelta: -13,
    ground: true,
    reputationDelta: -2,
    probability: 0.002,
  },
  {
    id: 'avionics_fault',
    newsTemplate: 'TECH FAULT: {airline} {aircraft} grounded at {airport} after dual ADIRU (Air Data/Inertial Reference Unit) faults. Aircraft unable to dispatch under MEL.',
    conditionDelta: -7,
    ground: true,
    reputationDelta: -2,
    probability: 0.003,
  },
  {
    id: 'lightning_strike',
    newsTemplate: 'LIGHTNING STRIKE: {airline} {aircraft} struck by lightning near {airport}. Composite skin inspection revealed damage to radome and wing tip. Aircraft grounded.',
    conditionDelta: -12,
    ground: true,
    reputationDelta: 0,
    probability: 0.002,
  },
  {
    id: 'hard_landing_check',
    newsTemplate: 'GROUNDED: {airline} {aircraft} grounded at {airport} for mandatory hard landing inspection after exceeding maximum landing weight sink rate. Structural survey ordered.',
    conditionDelta: -11,
    ground: true,
    reputationDelta: -3,
    probability: 0.002,
  },
  {
    id: 'brake_overheat',
    newsTemplate: 'INCIDENT: {airline} {aircraft} held on stand at {airport} after brake temperature monitoring showed multiple overheated brake units. Brake assembly replaced.',
    conditionDelta: -8,
    ground: true,
    reputationDelta: -2,
    probability: 0.0025,
  },
  {
    id: 'fod_engine_damage',
    newsTemplate: 'GROUNDED: {airline} {aircraft} grounded at {airport} after FOD ingestion caused blade damage to fan stage. Engine removed for inspection.',
    conditionDelta: -18,
    ground: true,
    reputationDelta: -5,
    probability: 0.0015,
  },
  {
    id: 'fuel_system_fault',
    newsTemplate: 'GROUNDED: {airline} {aircraft} grounded at {airport} after a fuel crossfeed valve failed in the open position, indicating a fuel transfer system fault.',
    conditionDelta: -9,
    ground: true,
    reputationDelta: -2,
    probability: 0.002,
  },
  // ── Serious — significant condition loss, reputation hit ──────────────
  {
    id: 'pressurisation_fault',
    newsTemplate: 'EMERGENCY: {airline} {aircraft} declared MAYDAY and conducted emergency descent to 10,000 ft after a rapid decompression event. Diverted to {airport}. Fuselage skin inspection ordered.',
    conditionDelta: -22,
    ground: true,
    reputationDelta: -7,
    probability: 0.0015,
  },
  {
    id: 'engine_shutdown',
    newsTemplate: 'ENGINE FAILURE: {airline} {aircraft} shut down No.2 engine in cruise following an uncontained oil loss and rising EGT. Continued on single engine, diverted to {airport}. Engine removed.',
    conditionDelta: -28,
    ground: true,
    reputationDelta: -10,
    probability: 0.001,
  },
  {
    id: 'hydraulic_loss',
    newsTemplate: 'EMERGENCY: {airline} {aircraft} declared PAN-PAN after total loss of System B hydraulics. Alternate gear extension used. Landed safely at {airport}. Aircraft grounded pending full hydraulic system audit.',
    conditionDelta: -24,
    ground: true,
    reputationDelta: -8,
    probability: 0.001,
  },
  {
    id: 'tail_strike',
    newsTemplate: 'INCIDENT: {airline} {aircraft} sustained a tail strike on take-off rotation at {airport}. Aircraft returned immediately; rear fuselage and pressure bulkhead under inspection.',
    conditionDelta: -20,
    ground: true,
    reputationDelta: -6,
    probability: 0.001,
  },
  {
    id: 'engine_fire_warning',
    newsTemplate: 'EMERGENCY: {airline} {aircraft} discharged a fire bottle into No.1 engine after a fire warning in climb out of {airport}. Engine shut down. Aircraft returned; cowling inspection confirmed seal failure.',
    conditionDelta: -26,
    ground: true,
    reputationDelta: -11,
    probability: 0.0008,
  },
  {
    id: 'cargo_smoke',
    newsTemplate: 'EMERGENCY: {airline} {aircraft} declared an emergency and diverted to {airport} after a smoke indication in the forward cargo hold. Halon discharged. Smouldering lithium battery found.',
    conditionDelta: -18,
    ground: true,
    reputationDelta: -9,
    probability: 0.001,
  },
  {
    id: 'runway_excursion',
    newsTemplate: 'SERIOUS INCIDENT: {airline} {aircraft} veered off the runway centreline during a wet-runway landing at {airport} due to asymmetric thrust reverser deployment. Aircraft suffered gear and flap damage.',
    conditionDelta: -30,
    ground: true,
    reputationDelta: -12,
    probability: 0.0006,
  },
  {
    id: 'bird_strike_severe',
    newsTemplate: 'BIRD STRIKE: {airline} {aircraft} suffered catastrophic bird ingestion into both engines on approach to {airport}. Emergency landing conducted; both engines require replacement.',
    conditionDelta: -35,
    ground: true,
    reputationDelta: -10,
    probability: 0.0004,
  },
  {
    id: 'structural_fatigue_find',
    newsTemplate: 'GROUNDED: Routine C-check on {airline} {aircraft} at {airport} uncovered significant fatigue cracking in the wing lower skin. Aircraft grounded pending airworthiness directive compliance.',
    conditionDelta: -20,
    ground: true,
    reputationDelta: -5,
    probability: 0.0008,
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

interface AirportEventDef {
  id: string;
  newsTemplate: string; // {airport}, {city}
  closureReason: string; // short label for UI
  minDays: number;
  maxDays: number;
  probability: number; // per eligible airport per day
  sizesAffected: string[]; // which airport sizes can be hit
}

const AIRPORT_EVENTS: AirportEventDef[] = [
  {
    id: 'storm',
    newsTemplate: 'STORM: Severe weather forces closure of {city} Airport ({airport}). Flights suspended for {duration}.',
    closureReason: 'Storm',
    minDays: 1, maxDays: 2,
    probability: 0.0004,
    sizesAffected: ['small', 'medium', 'large', 'major'],
  },
  {
    id: 'blizzard',
    newsTemplate: 'BLIZZARD: Heavy snowfall shuts down {city} Airport ({airport}). Operations halted for {duration}.',
    closureReason: 'Blizzard',
    minDays: 1, maxDays: 3,
    probability: 0.0003,
    sizesAffected: ['medium', 'large', 'major'],
  },
  {
    id: 'fog',
    newsTemplate: 'FOG: Dense fog blankets {city} Airport ({airport}), forcing a {duration} suspension of all flights.',
    closureReason: 'Dense fog',
    minDays: 1, maxDays: 1,
    probability: 0.0005,
    sizesAffected: ['small', 'medium', 'large', 'major'],
  },
  {
    id: 'it_outage',
    newsTemplate: 'IT OUTAGE: Systems failure at {city} Airport ({airport}) grounds all flights. Engineers working to restore services.',
    closureReason: 'IT outage',
    minDays: 1, maxDays: 1,
    probability: 0.0003,
    sizesAffected: ['large', 'major'],
  },
  {
    id: 'security_alert',
    newsTemplate: 'SECURITY: {city} Airport ({airport}) evacuated and closed following a security alert. Flights diverted.',
    closureReason: 'Security alert',
    minDays: 1, maxDays: 1,
    probability: 0.0002,
    sizesAffected: ['large', 'major'],
  },
  {
    id: 'runway_incident',
    newsTemplate: 'RUNWAY CLOSED: {city} Airport ({airport}) runway closed following an aircraft incident. Flights suspended for {duration}.',
    closureReason: 'Runway incident',
    minDays: 1, maxDays: 2,
    probability: 0.0003,
    sizesAffected: ['medium', 'large', 'major'],
  },
  {
    id: 'ash_cloud',
    newsTemplate: 'ASH CLOUD: Volcanic ash disruption closes {city} Airport ({airport}) for {duration}.',
    closureReason: 'Volcanic ash',
    minDays: 1, maxDays: 3,
    probability: 0.00015,
    sizesAffected: ['small', 'medium', 'large', 'major'],
  },
  {
    id: 'flood',
    newsTemplate: 'FLOODING: Flash flooding at {city} Airport ({airport}) suspends all operations for {duration}.',
    closureReason: 'Flooding',
    minDays: 1, maxDays: 2,
    probability: 0.0002,
    sizesAffected: ['small', 'medium', 'large', 'major'],
  },
  {
    id: 'bird_flock',
    newsTemplate: 'BIRD STRIKE RISK: Large bird flock grounds all traffic at {city} Airport ({airport}) for {duration}.',
    closureReason: 'Bird flock hazard',
    minDays: 1, maxDays: 1,
    probability: 0.0002,
    sizesAffected: ['small', 'medium'],
  },
  {
    id: 'power_failure',
    newsTemplate: 'POWER FAILURE: Major blackout at {city} Airport ({airport}) halts all operations. Backup power insufficient.',
    closureReason: 'Power failure',
    minDays: 1, maxDays: 2,
    probability: 0.00025,
    sizesAffected: ['medium', 'large', 'major'],
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
          const reason = evt.groundReason ?? evt.id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          store.groundAircraft(ac.id, reason);
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

  // ── Airport closure events ─────────────────────────────────────────────
  const { airports, gameDay } = store;
  const airportList = Object.values(airports).filter(ap => {
    // Skip airports already closed
    if (ap.closedUntilGameDay && ap.closedUntilGameDay >= gameDay) return false;
    return true;
  });

  for (const airport of airportList) {
    for (const evt of AIRPORT_EVENTS) {
      if (!evt.sizesAffected.includes(airport.size)) continue;
      if (Math.random() > evt.probability) continue;

      const durationDays = evt.minDays + Math.floor(Math.random() * (evt.maxDays - evt.minDays + 1));
      const untilDay = gameDay + durationDays - 1;
      const durationLabel = durationDays === 1 ? '1 day' : `${durationDays} days`;

      const msg = evt.newsTemplate
        .replace('{airport}', airport.iata)
        .replace('{city}', airport.city)
        .replace('{duration}', durationLabel);

      store.pushNewsItem(msg);
      store.setAirportClosure(airport.iata, untilDay, evt.closureReason);
      break; // one event per airport per day
    }
  }
}
