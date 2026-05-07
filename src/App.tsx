import { useEffect } from 'react';
import { startGameLoop, stopGameLoop } from '@/engine/gameLoop';
import { Layout } from '@/ui/Layout';
import { useGameStore } from '@/store';

function App() {
  const isInitialized = useGameStore(s => s.isInitialized);
  const playerExists = useGameStore(s => !!s.airlines['player']);
  const playerInsolvent = useGameStore(s => !!s.airlines['player']?.isInsolvent);
  const playerPassengers = useGameStore(s => s.airlines['player']?.totalPassengersAllTime ?? 0);
  const rivalPassengers = useGameStore(s =>
    Object.values(s.aiAirlines).reduce((sum, airline) => sum + airline.totalPassengersAllTime, 0),
  );
  const activeAICount = useGameStore(s =>
    Object.values(s.aiAirlines).filter(airline => !airline.isInsolvent).length,
  );
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
    if (!playerExists) return;

    if (playerInsolvent) {
      openModalById('gameOver', 'lose');
      return;
    }

    // Win: all AI airlines are insolvent or fully dissolved, and game has been running
    if (!hasWon && gameDay > 1) {
      const totalPassengers = playerPassengers + rivalPassengers;
      const playerMarketShare = totalPassengers > 0 ? (playerPassengers / totalPassengers) * 100 : 0;
      const hasMetObjective = settings.objective === 'market_share'
        ? rivalPassengers > 0 && playerMarketShare >= settings.targetMarketShare
        : activeAICount === 0;

      if (hasMetObjective) {
        openModalById('gameOver', 'win');
        setHasWon();
      }
    }
  }, [
    activeAICount,
    gameDay,
    hasWon,
    isInitialized,
    openModalById,
    playerExists,
    playerInsolvent,
    playerPassengers,
    rivalPassengers,
    setHasWon,
    settings,
  ]);

  return <Layout />;
}

export default App;
