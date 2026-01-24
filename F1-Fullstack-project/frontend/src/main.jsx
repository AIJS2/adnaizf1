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
import RaceDetailPage from './RaceDetailPage.jsx'; // <-- 1. IMPORT HALAMAN BARU

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
    path: "/drivers",
    element: <DriversPage />,
  },
  {
    path: "/teams",
    element: <TeamsPage />,
  },
  {
    path: "/races", // ✅ Route baru
    element: <RacesPage />,
  },

  {
    path: "/race/:year/:round", // Path dinamis
    element: <RaceDetailPage />,
  },

]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
