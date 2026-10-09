import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ImprovementDetailScreen } from './screens/ImprovementDetailScreen';
import { ImprovementsScreen } from './screens/ImprovementsScreen';
import { LearnedScreen } from './screens/LearnedScreen';
import { NewImprovementScreen } from './screens/NewImprovementScreen';
import { ProcessesScreen } from './screens/ProcessesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AppStateProvider } from './state/AppState';

export function App() {
  return (
    <AppStateProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/verbeteringen" replace />} />
            <Route path="/verbeteringen" element={<ImprovementsScreen />} />
            <Route path="/verbeteringen/nieuw" element={<NewImprovementScreen />} />
            <Route path="/verbeteringen/:id" element={<ImprovementDetailScreen />} />
            <Route path="/processen" element={<ProcessesScreen />} />
            <Route path="/geleerd" element={<LearnedScreen />} />
            <Route path="/instellingen" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/verbeteringen" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppStateProvider>
  );
}
