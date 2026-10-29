import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
// The landing page, loaded at once: the method in four steps and the guided tour.
import HomePage from './pages/HomePreviewPage';
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
            {/* The preview became the home page; old links still land there. */}
            <Route path="/home-preview" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </ErrorBoundary>
  );
}

export default App;
