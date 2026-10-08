// src/App.jsx - Main Home / Starting Portal

import Navbar from './Navbar.jsx';
import LandingPage from './LandingPage.jsx';

function App() {
  return (
    <main className="bg-[#070707] min-h-screen text-white">
      <Navbar />
      <LandingPage />
    </main>
  );
}

export default App;
