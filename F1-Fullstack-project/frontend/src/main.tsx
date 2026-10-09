// src/main.jsx
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from './components/layout/Layout.jsx';

const App = lazy(() => import('./App.jsx'));
const Dashboard = lazy(() => import('./pages/DashboardPage.jsx'));
const DriversPage = lazy(() => import('./pages/DriversPage.jsx'));
const TeamsPage = lazy(() => import('./pages/TeamsPage.jsx'));
const RacesPage = lazy(() => import('./pages/RacesPage.jsx'));
const RaceDetailPage = lazy(() => import('./pages/RaceDetailPage.jsx'));
const StatsPage = lazy(() => import('./pages/StatsPage.jsx'));
const DriverProfilePage = lazy(() => import('./pages/DriverProfilePage.jsx'));
const TeamProfilePage = lazy(() => import('./pages/TeamProfilePage.jsx'));
const DriverComparePage = lazy(() => import('./pages/DriverComparePage.jsx'));
const LiveTimingPage = lazy(() => import('./pages/LiveTimingPage.jsx'));
const SimulatorPage = lazy(() => import('./pages/SimulatorPage.jsx'));
const GuidePage = lazy(() => import('./pages/GuidePage.jsx'));

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
        element: <DriverComparePage />,
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

import { GlobalErrorBoundary } from './ErrorBoundary.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div className="min-h-screen bg-[#070707] text-white" />}>
          <RouterProvider router={router} />
        </Suspense>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>,
);
