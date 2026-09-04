import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import HomePage from './pages/HomePage';
import ErrorBoundary from './components/ui/ErrorBoundary';

// Plotly and Leaflet are ~90% of the bundle. Loading them eagerly meant a
// phone downloaded several megabytes before it could show the landing page;
// split out, they only arrive when the user opens a page that charts or maps.
const DataCollectionPage = lazy(() => import('./pages/DataCollectionPage'));
const PotentialAnalysisPage = lazy(() => import('./pages/PotentialAnalysisPage'));

function App() {
  return (
    <ErrorBoundary>
      <AppShell>
        <Suspense
          fallback={
            <div className="route-loading">
              <span className="spinner" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/data-collection" element={<DataCollectionPage />} />
            <Route path="/potential-analysis" element={<PotentialAnalysisPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </ErrorBoundary>
  );
}

export default App;
