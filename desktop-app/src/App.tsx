import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import WidgetUI from './components/WidgetUI';
import DashboardUI from './components/DashboardUI';

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function App() {
  const [windowLabel, setWindowLabel] = useState<string | null>(null);

  useEffect(() => {
    if (isTauri()) {
      setWindowLabel(getCurrentWindow().label);
    } else {
      // Fallback for browser testing
      setWindowLabel('main');
    }
  }, []);

  if (!windowLabel) return null;

  return windowLabel === 'widget' ? <WidgetUI /> : <DashboardUI />;
}

export default App;
