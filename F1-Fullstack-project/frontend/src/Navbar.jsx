// src/Navbar.jsx - VERSI FIXED DENGAN IKON FLAG

import { NavLink } from 'react-router-dom'; 
import { LayoutDashboard, User, Users, Flag } from 'lucide-react'; // <-- Ganti FlagCheckered jadi Flag

function Navbar() {

  const activeLinkStyle = { color: '#EF4444' }; // Warna merah Ferrari

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-black/30 backdrop-blur-lg border-b border-white/10">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        
        {/* Logo/Branding */}
        <NavLink to="/" className="text-2xl font-extrabold text-white tracking-wider">
          ANA<span className="text-red-600">LYZIZ</span>
        </NavLink>

        <ul className="hidden md:flex items-center space-x-8 text-lg">
          
          {/* Dashboard */}
          <li>
            <NavLink 
              to="/dashboard" 
              className="text-gray-200 hover:text-red-500 transition-colors duration-300 flex items-center gap-2"
              style={({ isActive }) => isActive ? activeLinkStyle : undefined}
            >
              <LayoutDashboard size={20} /> 
              <span>Dashboard</span>
            </NavLink>
          </li>
          
          {/* Drivers */}
          <li>
            <NavLink 
              to="/drivers"
              className="text-gray-200 hover:text-red-500 transition-colors duration-300 flex items-center gap-2"
              style={({ isActive }) => isActive ? activeLinkStyle : undefined}
            >
              <User size={20} />
              <span>Drivers</span>
            </NavLink>
          </li>
          
          {/* Teams */}
          <li>
            <NavLink 
              to="/teams"
              className="text-gray-200 hover:text-red-500 transition-colors duration-300 flex items-center gap-2"
              style={({ isActive }) => isActive ? activeLinkStyle : undefined}
            >
              <Users size={20} />
              <span>Teams</span>
            </NavLink>
          </li>

          {/* Races */}
          <li>
            <NavLink 
              to="/races"
              className="text-gray-200 hover:text-red-500 transition-colors duration-300 flex items-center gap-2"
              style={({ isActive }) => isActive ? activeLinkStyle : undefined}
            >
              <Flag size={20} /> {/* Ganti dari FlagCheckered ke Flag */}
              <span>Races</span>
            </NavLink>
          </li>

        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
