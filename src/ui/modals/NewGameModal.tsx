import React, { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '@/store';
import type { CurrencyCode, GameObjective, GameSettings, Airline } from '@/types';
import { AI_AIRLINES_INIT } from '@/data/airlinesInit';
import { AIRPORTS } from '@/data/airports';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { AirportSearchInput } from '@/ui/components/AirportSearchInput';
import { findAirportByQuery } from '@/utils/airportSearch';
import { AirlineLogoPicker } from '@/ui/components/AirlineLogoPicker';
import { createInitialAIOperations } from '@/engine/aiEngine';
import { pickUnusedAirlineColor } from '@/data/airlineColors';
import { CURRENCY_OPTIONS, formatCurrency, setDisplayCurrency } from '@/utils/format';

const DIFFICULTIES = [
  { id: 'easy',   label: 'Easy',   cash: 50_000_000 },
  { id: 'normal', label: 'Normal', cash: 30_000_000 },
  { id: 'hard',   label: 'Hard',   cash: 15_000_000 },
] as const;

const ERAS = [
  { year: 1960, label: 'Jet Age',       flagship: '707, DC-8, Il-18' },
  { year: 1970, label: 'Wide-body',     flagship: '747, DC-10, Il-62' },
  { year: 1980, label: 'Glass cockpit', flagship: '757, 767, A300' },
  { year: 1990, label: 'FBW era',       flagship: 'A320, 777, A330' },
  { year: 2000, label: 'Low-cost boom', flagship: '737NG, A319/320/321' },
  { year: 2010, label: 'Composite',     flagship: '787, A380, A350' },
  { year: 2020, label: 'New gen',       flagship: 'MAX, NEO, 777X' },
] as const;

function yearToGameTimeMs(year: number): number {
  const epoch = new Date(1960, 0, 1).getTime();
  return new Date(year, 0, 1).getTime() - epoch;
}

export const NewGameModal: React.FC = () => {
  const [airlineName, setAirlineName] = useState('My Airline');
  const [airlineColor, setAirlineColor] = useState('#3b82f6');
  const [airlineLogo, setAirlineLogo] = useState('✈️');
  const [hubQuery, setHubQuery] = useState('JFK');
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [startingYear, setStartingYear] = useState(1960);
  const [objective, setObjective] = useState<GameObjective>('last_airline_standing');
  const [targetMarketShare, setTargetMarketShare] = useState(60);

  const airportOptions = useMemo(
    () => AIRPORTS.reduce<Record<string, (typeof AIRPORTS)[number]>>((acc, airport) => {
      acc[airport.iata] = airport;
      return acc;
    }, {}),
    [],
  );

  const initWorld        = useGameStore(s => s.initWorld);
  const initGameSettings = useGameStore(s => s.initGameSettings);
  const initPlayer       = useGameStore(s => s.initPlayer);
  const setAIAirlines    = useGameStore(s => s.setAIAirlines);
  const setAirportHub    = useGameStore(s => s.setAirportHub);
  const designateHub     = useGameStore(s => s.designateHub);
  const advanceTime      = useGameStore(s => s.advanceTime);
  const closeModal       = useGameStore(s => s.closeModal);

  const startingCash  = DIFFICULTIES.find(d => d.id === difficulty)?.cash ?? 30_000_000;
  const startingHub   = findAirportByQuery(hubQuery, airportOptions);
  const unlockedCount = AIRCRAFT_TYPES.filter(t => t.yearIntroduced <= startingYear).length;

  useEffect(() => {
    setDisplayCurrency(currency);
  }, [currency]);

  function handleStart() {
    if (!startingHub) return;
    setDisplayCurrency(currency);

    const startingGameTimeMs = yearToGameTimeMs(startingYear);
    const startingGameDay    = Math.floor(startingGameTimeMs / 86_400_000);

    const settings: GameSettings = {
      playerAirlineName:  airlineName,
      playerAirlineColor: airlineColor,
      playerAirlineEmoji: airlineLogo,
      startingCash,
      difficulty,
      aiCount:            6,
      startingYear,
      objective,
      targetMarketShare,
      currency,
    };

    initWorld();
    initGameSettings(settings);
    advanceTime(startingGameTimeMs, startingGameDay);
    initPlayer({ name: airlineName, color: airlineColor, emoji: airlineLogo, startingCash, gameDay: startingGameDay });
    setAirportHub(startingHub.iata, true);
    designateHub(startingHub.iata);

    const aiAirlines: Record<string, Airline> = {};
    const usedAIColors = new Set<string>();
    AI_AIRLINES_INIT.forEach((config, i) => {
      const id = `ai-${i}`;
      const color = usedAIColors.has(config.color.toLowerCase())
        ? pickUnusedAirlineColor(usedAIColors, i)
        : config.color;
      usedAIColors.add(color.toLowerCase());
      aiAirlines[id] = {
        id,
        name:                   config.name,
        iataPrefix:             config.iataPrefix,
        isPlayer:               false,
        color,
        logoEmoji:              config.logoEmoji,
        cashUSD:                config.startCash,
        totalDebt:              0,
        hubIatas:               [config.startHub, config.secondHub],
        fleetIds:               [],
        routeIds:               [],
        personality:            config.personality,
        foundedGameDay:         startingGameDay,
        isInsolvent:            false,
        canBeTakenOver:         false,
        marketSharePercent:     0,
        reputationScore:        60,
        totalPassengersAllTime: 0,
        dailyStats:             [],
        crashPenaltyDaysLeft:   0,
        shareholders:           {},
        lastDailyProfit:        0,
        maintenancePolicy:      { enabled: false, threshold: 40, tier: 'standard', autoMaintainIssues: false },
      };
    });

    // Seed cross-shareholdings for realism
    if (aiAirlines['ai-1']) aiAirlines['ai-1'].shareholders['ai-0'] = 8;  // Eagle Air owns 8% of Sky Pacific
    if (aiAirlines['ai-4']) aiAirlines['ai-4'].shareholders['ai-1'] = 5;  // Sky Pacific owns 5% of Meridian

    const { aiAircraft, aiRoutes } = createInitialAIOperations(AI_AIRLINES_INIT, aiAirlines, airportOptions, startingGameDay);
    setAIAirlines(aiAirlines, aiAircraft, aiRoutes);
    closeModal();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999]">
      <div className="glass-panel rounded-t-2xl sm:rounded-xl w-full max-w-lg px-4 sm:px-6 py-5 max-h-[92svh] overflow-y-auto overscroll-contain">
        <h1 className="text-2xl font-bold text-white mb-1">Mighty Airline Empire</h1>
        <p className="text-gray-400 text-sm mb-5">Build your airline from the ground up.</p>

        <div className="space-y-4">
          <div>
            <label className="text-gray-300 text-sm block mb-1">Airline Name</label>
            <input
              className="w-full rounded-md border border-white/10 bg-white/[0.07] px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-400"
              value={airlineName}
              onChange={e => setAirlineName(e.target.value)}
              maxLength={30}
            />
          </div>

          <div>
            <label className="text-gray-300 text-sm block mb-1">Airline Colour</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="w-10 h-8 rounded cursor-pointer bg-gray-800 border border-gray-600"
                value={airlineColor}
                onChange={e => setAirlineColor(e.target.value)}
              />
              <span className="text-gray-400 text-sm">{airlineColor}</span>
            </div>
          </div>

          <AirlineLogoPicker value={airlineLogo} onChange={setAirlineLogo} />

          <AirportSearchInput
            label="Starting Hub"
            value={hubQuery}
            airports={airportOptions}
            placeholder="JFK, KJFK, New York"
            onChange={setHubQuery}
            onSelect={airport => setHubQuery(airport.iata)}
          />

          <div>
            <label className="text-gray-300 text-sm block mb-2">Starting Era</label>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {ERAS.map(era => (
                <button
                  key={era.year}
                  onClick={() => setStartingYear(era.year)}
                  className={`py-2 px-1 rounded border text-center transition-colors ${
                    startingYear === era.year
                      ? 'border-blue-500 bg-blue-900/40 text-blue-300'
                      : 'border-white/10 bg-white/[0.055] text-gray-400 hover:border-white/20'
                  }`}
                >
                  <div className="font-bold text-sm">{era.year}</div>
                  <div className="text-[10px] mt-0.5 opacity-75 leading-tight">{era.label}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              <span className="text-gray-300 font-medium">{unlockedCount} aircraft</span> available
              <span className="mx-1.5">·</span>
              <span className="italic">{ERAS.find(e => e.year === startingYear)?.flagship}</span>
            </p>
          </div>

          <div>
            <label className="text-gray-300 text-sm block mb-2">Difficulty</label>
            <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  className={`py-2 rounded border text-sm transition-colors ${
                    difficulty === d.id
                      ? 'border-blue-500 bg-blue-900/40 text-blue-300'
                      : 'border-white/10 bg-white/[0.055] text-gray-400 hover:border-white/20'
                  }`}
                >
                  <div className="font-bold">{d.label}</div>
                  <div className="text-xs mt-0.5 opacity-75">{formatCurrency(d.cash)} starting cash</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-gray-300 text-sm block mb-2">Currency</label>
            <div className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-2">
              {CURRENCY_OPTIONS.map(option => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => setCurrency(option.code)}
                  className={`rounded border px-3 py-2 text-left transition-colors ${
                    currency === option.code
                      ? 'border-emerald-500 bg-emerald-900/35 text-emerald-200'
                      : 'border-white/10 bg-white/[0.055] text-gray-400 hover:border-white/20'
                  }`}
                >
                  <div className="text-sm font-semibold">{option.symbol} {option.code}</div>
                  <div className="text-[10px] opacity-75">{option.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-gray-300 text-sm block mb-2">Objective</label>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setObjective('last_airline_standing')}
                className={`rounded border px-3 py-2 text-left transition-colors ${
                  objective === 'last_airline_standing'
                    ? 'border-yellow-500 bg-yellow-900/35 text-yellow-200'
                    : 'border-white/10 bg-white/[0.055] text-gray-400 hover:border-white/20'
                }`}
              >
                <div className="text-sm font-semibold">Last airline standing</div>
                <div className="text-[10px] opacity-75">Win when every rival carrier collapses.</div>
              </button>
              <button
                type="button"
                onClick={() => setObjective('market_share')}
                className={`rounded border px-3 py-2 text-left transition-colors ${
                  objective === 'market_share'
                    ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                    : 'border-white/10 bg-white/[0.055] text-gray-400 hover:border-white/20'
                }`}
              >
                <div className="text-sm font-semibold">Market Share</div>
                <div className="text-[10px] opacity-75">Win by carrying the target share of all passengers.</div>
              </button>
            </div>
            {objective === 'market_share' && (
              <div className="mt-3 rounded border border-white/10 bg-white/[0.035] p-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-400">Target market share</span>
                  <span className="text-white font-semibold">{targetMarketShare}%</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={100}
                  step={1}
                  value={targetMarketShare}
                  onChange={e => setTargetMarketShare(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>60%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={airlineName.trim().length === 0 || !startingHub}
          className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
        >
          Start in {startingYear}
        </button>
      </div>
    </div>
  );
};
