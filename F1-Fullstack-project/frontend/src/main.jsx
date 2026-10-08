// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Dashboard from './DashboardPage.jsx';
import DriversPage from './DriversPage.jsx';
import TeamsPage from './TeamsPage.jsx';
import RacesPage from './RacesPage.jsx'; 
import RaceDetailPage from './RaceDetailPage.jsx';
import StatsPage from './StatsPage.jsx';
import DriverProfilePage from './DriverProfilePage.jsx';
import TeamProfilePage from './TeamProfilePage.jsx';
import DriverComparePage from './DriverComparePage.jsx';
import SimulatorPage from './SimulatorPage.jsx';
import GuidePage from './GuidePage.jsx';

const router = createBrowserRouter([
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
    element: <StatsPage />,
  },
  {
    path: "/teams",
    element: <StatsPage />,
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
    path: "/simulator",
    element: <SimulatorPage />,
  },
  {
    path: "/guide",
    element: <GuidePage />,
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
