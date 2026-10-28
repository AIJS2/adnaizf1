// src/main
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/titillium-web/latin-300.css';
import '@fontsource/titillium-web/latin-400.css';
import '@fontsource/titillium-web/latin-600.css';
import '@fontsource/titillium-web/latin-700.css';
import '@fontsource/titillium-web/latin-900.css';
import '@fontsource/titillium-web/latin-400-italic.css';
import '@fontsource/titillium-web/latin-700-italic.css';
import './index.css';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from './components/layout/Layout';

const App = lazy(() => import('./App'));
const Dashboard = lazy(() => import('./pages/DashboardPage'));
const DriversPage = lazy(() => import('./pages/DriversPage'));
const TeamsPage = lazy(() => import('./pages/TeamsPage'));
const RacesPage = lazy(() => import('./pages/RacesPage'));
const RaceDetailPage = lazy(() => import('./pages/RaceDetailPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const DriverProfilePage = lazy(() => import('./pages/DriverProfilePage'));
const TeamProfilePage = lazy(() => import('./pages/TeamProfilePage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const LiveTimingPage = lazy(() => import('./pages/LiveTimingPage'));
const SimulatorPage = lazy(() => import('./pages/SimulatorPage'));
const GuidePage = lazy(() => import('./pages/GuidePage'));

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {
        path: "/",
        element: <App />,
      },
      {
        path: "/dashboard",
        element: <Dashboard />,
      },
      {
        path: "/stats",
        element: <StatsPage />,
      },
      {
        path: "/drivers",
        element: <DriversPage />,
      },
      {
        path: "/teams",
        element: <TeamsPage />,
      },
      {
        path: "/compare",
        element: <ComparePage />,
      },
      {
        path: "/driver/:id",
        element: <DriverProfilePage />,
      },
      {
        path: "/team/:id",
        element: <TeamProfilePage />,
      },
      {
        path: "/races",
        element: <RacesPage />,
      },
      {
        path: "/race/:year/:round",
        element: <RaceDetailPage />,
      },
      {
        path: "/live",
        element: <LiveTimingPage />,
      },
      {
        path: "/livetiming",
        element: <LiveTimingPage />,
      },
      {
        path: "/simulator",
        element: <SimulatorPage />,
      },
      {
        path: "/guide",
        element: <GuidePage />,
      },
    ],
  }
]);

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

import { GlobalErrorBoundary } from './ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Suspense
          fallback={
            <div className="min-h-screen bg-tarmac" role="status" aria-label="Loading…">
              {/* Thin red sweep along the top edge, like a timing-screen refresh. */}
              <div className="fixed inset-x-0 top-0 h-0.5 overflow-hidden bg-neutral-900">
                <div className="h-full w-2/5 bg-red-600 animate-load-sweep" />
              </div>
            </div>
          }
        >
          <RouterProvider router={router} />
        </Suspense>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>,
);
