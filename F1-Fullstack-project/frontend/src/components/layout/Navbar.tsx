import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Flag, Activity, Trophy, Menu, X, Users, Search, Calculator } from 'lucide-react';
import CommandPalette from '../ui/CommandPalette';

interface NavLinkItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

const navLinks: NavLinkItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/races',     label: 'Races',     icon: Flag },
  { to: '/stats',     label: 'Stats',     icon: Trophy },
  { to: '/compare',   label: 'Compare',   icon: Users },
  { to: '/simulator', label: 'Simulator', icon: Calculator },
  { to: '/live',      label: 'Live Timing', icon: Activity },
];

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isMac, setIsMac] = useState<boolean>(false);
  const activeLinkStyle: React.CSSProperties = { color: '#EF4444' };

  useEffect(() => {
    setIsMac(typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform));

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  const toggleMenu = () => setIsMenuOpen(prev => !prev);
  const closeMenu  = () => setIsMenuOpen(false);

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-50 bg-black/40 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center gap-4">

          {/* Logo */}
          <NavLink to="/" onClick={closeMenu} className="text-2xl font-extrabold text-white tracking-wider shrink-0">
            ANA<span className="text-red-600">LYZIZ</span>
          </NavLink>

          {/* Center/Desktop Menu */}
          <ul className="hidden md:flex items-center space-x-6 lg:space-x-8 text-base lg:text-lg">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className="text-gray-200 hover:text-red-500 transition-colors duration-300 flex items-center gap-2"
                  style={({ isActive }) => isActive ? activeLinkStyle : undefined}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Right Action: Command Palette Quick Search Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/80 hover:border-neutral-600 text-neutral-300 hover:text-white text-xs font-medium transition-all shadow-inner group"
              title="Search (Ctrl + K)"
            >
              <Search size={14} className="text-red-500 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline text-neutral-400 group-hover:text-neutral-200">Search F1...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-neutral-800 border border-neutral-700 rounded text-neutral-400 font-mono font-bold group-hover:border-neutral-500">
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
            </button>

            {/* Hamburger Button — mobile only */}
            <button
              onClick={toggleMenu}
              className="md:hidden text-white hover:text-red-500 transition-colors duration-300 p-1"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <ul className="flex flex-col border-t border-white/10 bg-black/80 backdrop-blur-lg px-6 py-4 space-y-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={closeMenu}
                  className="flex items-center gap-3 py-3 px-2 rounded-lg text-gray-200 hover:text-red-500 hover:bg-white/5 transition-all duration-200 font-medium"
                  style={({ isActive }) => isActive ? activeLinkStyle : undefined}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Global Command Palette Modal */}
      <CommandPalette isOpen={isSearchOpen} setIsOpen={setIsSearchOpen} />
    </>
  );
}

export default Navbar;
