import { useEffect } from 'react';
import { startGameLoop, stopGameLoop } from '@/engine/gameLoop';
import { Layout } from '@/ui/Layout';
import { useGameStore } from '@/store';

function App() {
  const isInitialized = useGameStore(s => s.isInitialized);
  const airlines = useGameStore(s => s.airlines);
  const openModalById = useGameStore(s => s.openModalById);

  // On first mount, open new-game modal only if no saved game exists
  useEffect(() => {
    const state = useGameStore.getState();
    if (!state.isInitialized) {
      state.openModalById('newGame');
    }
  }, []);

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
    }
  }, [airlines, isInitialized, openModalById]);

  return <Layout />;
}

export default App;
