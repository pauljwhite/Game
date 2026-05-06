import { useEffect } from 'react';
import { startGameLoop, stopGameLoop } from '@/engine/gameLoop';
import { Layout } from '@/ui/Layout';
import { useGameStore } from '@/store';

function App() {
  const isInitialized = useGameStore(s => s.isInitialized);
  const airlines     = useGameStore(s => s.airlines);
  const aiAirlines   = useGameStore(s => s.aiAirlines);
  const gameDay      = useGameStore(s => s.gameDay);
  const hasWon       = useGameStore(s => s.hasWon);
  const settings     = useGameStore(s => s.settings);
  const setHasWon    = useGameStore(s => s.setHasWon);
  const openModalById = useGameStore(s => s.openModalById);

  // Start/stop game loop based on initialization
  useEffect(() => {
    if (isInitialized) {
      startGameLoop();
    }
    return () => stopGameLoop();
  }, [isInitialized]);

  // Win/lose check
  useEffect(() => {
    if (!isInitialized) return;
    const player = airlines['player'];
    if (!player) return;

    if (player.isInsolvent) {
      openModalById('gameOver', 'lose');
      return;
    }

    // Win: all AI airlines are insolvent or fully dissolved, and game has been running
    if (!hasWon && gameDay > 1) {
      const aiEntries = Object.values(aiAirlines);
      const activeAI = aiEntries.filter(a => !a.isInsolvent).length;
      const totalPassengers = player.totalPassengersAllTime + aiEntries.reduce((sum, airline) => sum + airline.totalPassengersAllTime, 0);
      const playerMarketShare = totalPassengers > 0 ? (player.totalPassengersAllTime / totalPassengers) * 100 : 0;
      const hasMetObjective = settings.objective === 'market_share'
        ? playerMarketShare >= settings.targetMarketShare
        : activeAI === 0;

      if (hasMetObjective) {
        openModalById('gameOver', 'win');
        setHasWon();
      }
    }
  }, [airlines, aiAirlines, gameDay, isInitialized, hasWon, settings, openModalById, setHasWon]);

  return <Layout />;
}

export default App;
