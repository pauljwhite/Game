import React, { useState } from 'react';
import { useGameStore } from '@/store';
import type { GameSettings, Airline } from '@/types';
import { AI_AIRLINES_INIT } from '@/data/airlinesInit';

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', cash: 50_000_000, desc: '$50M starting cash' },
  { id: 'normal', label: 'Normal', cash: 30_000_000, desc: '$30M starting cash' },
  { id: 'hard', label: 'Hard', cash: 15_000_000, desc: '$15M starting cash' },
] as const;

export const NewGameModal: React.FC = () => {
  const [airlineName, setAirlineName] = useState('My Airline');
  const [airlineColor, setAirlineColor] = useState('#3b82f6');
  const [hubIata, setHubIata] = useState('JFK');
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');

  const initWorld = useGameStore(s => s.initWorld);
  const initGameSettings = useGameStore(s => s.initGameSettings);
  const initPlayer = useGameStore(s => s.initPlayer);
  const setAIAirlines = useGameStore(s => s.setAIAirlines);
  const setAirportHub = useGameStore(s => s.setAirportHub);
  const designateHub = useGameStore(s => s.designateHub);
  const closeModal = useGameStore(s => s.closeModal);

  const startCash = DIFFICULTIES.find(d => d.id === difficulty)?.cash ?? 30_000_000;

  function handleStart() {
    const settings: GameSettings = {
      playerAirlineName: airlineName,
      playerAirlineColor: airlineColor,
      playerAirlineEmoji: '✈',
      startingCash: startCash,
      difficulty,
      aiCount: 6,
    };

    initWorld();
    initGameSettings(settings);
    initPlayer({ name: airlineName, color: airlineColor, emoji: '✈', startingCash: startCash, gameDay: 0 });
    setAirportHub(hubIata, true);
    designateHub(hubIata);

    // Build AI airline records
    const aiAirlines: Record<string, Airline> = {};
    AI_AIRLINES_INIT.forEach((config, i) => {
      const id = `ai-${i}`;
      aiAirlines[id] = {
        id,
        name: config.name,
        iataPrefix: config.iataPrefix,
        isPlayer: false,
        color: config.color,
        logoEmoji: config.logoEmoji,
        cashUSD: config.startCash,
        totalDebt: 0,
        hubIatas: [config.startHub, config.secondHub],
        fleetIds: [],
        routeIds: [],
        personality: config.personality,
        foundedGameDay: 0,
        isInsolvent: false,
        canBeTakenOver: false,
        marketSharePercent: 0,
        reputationScore: 60,
        totalPassengersAllTime: 0,
        dailyStats: [],
        crashPenaltyDaysLeft: 0,
      };
    });

    setAIAirlines(aiAirlines, {}, {});
    closeModal();
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-1">Airline Empire</h1>
        <p className="text-gray-400 text-sm mb-5">Build your airline from the ground up. Start in 1960.</p>

        <div className="space-y-4">
          <div>
            <label className="text-gray-300 text-sm block mb-1">Airline Name</label>
            <input
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
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

          <div>
            <label className="text-gray-300 text-sm block mb-1">Starting Hub (IATA code)</label>
            <input
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono uppercase focus:outline-none focus:border-blue-500"
              value={hubIata}
              onChange={e => setHubIata(e.target.value.toUpperCase().slice(0, 3))}
              maxLength={3}
            />
          </div>

          <div>
            <label className="text-gray-300 text-sm block mb-2">Difficulty</label>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  className={`py-2 rounded border text-sm transition-colors ${
                    difficulty === d.id
                      ? 'border-blue-500 bg-blue-900/40 text-blue-300'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <div className="font-bold">{d.label}</div>
                  <div className="text-xs mt-0.5 opacity-75">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={airlineName.trim().length === 0 || hubIata.length !== 3}
          className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
        >
          Start Game
        </button>
      </div>
    </div>
  );
};
