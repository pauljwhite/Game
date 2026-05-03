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
      const activeAI = Object.values(aiAirlines).filter(a => !a.isInsolvent).length;
      if (activeAI === 0) {
        openModalById('gameOver', 'win');
        setHasWon();
      }
    }
  }, [airlines, aiAirlines, gameDay, isInitialized, hasWon, openModalById, setHasWon]);

  return <Layout />;
}

export default App;
