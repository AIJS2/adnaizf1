import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Flag, Activity, Trophy, Users, Search, Calculator, Home, ChevronLeft, Menu, X } from 'lucide-react';
import CommandPalette from '../ui/CommandPalette';

interface NavLinkItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

const navLinks: NavLinkItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/races', label: 'Races', icon: Flag },
  { to: '/stats', label: 'Stats', icon: Trophy },
  { to: '/compare', label: 'Compare', icon: Users },
  { to: '/simulator', label: 'Simulator', icon: Calculator },
  { to: '/live', label: 'Live Timing', icon: Activity },
];

interface SidebarProps {
  isMobileDrawerOpen: boolean;
  onCloseMobileDrawer: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isMobileDrawerOpen, onCloseMobileDrawer }) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isMac, setIsMac] = useState<boolean>(false);

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

  return (
    <>
      {/* Vertical Sidebar - Desktop */}
      <aside
        className={`
          fixed left-0 top-0 h-full z-50
          bg-black/40 backdrop-blur-lg border-r border-white/10
          transition-all duration-150 ease-out
          xl:block hidden
          ${isCollapsed ? 'w-20' : 'w-72'}
        `}
        style={{ backgroundColor: '#0a0a0a' }}
      >
        {/* Logo / Brand */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-white/10">
          {!isCollapsed && (
            <NavLink
              to="/"
              className="text-2xl font-extrabold text-white tracking-wider flex items-center gap-1 shrink-0 transition-opacity duration-150"
              style={{ opacity: isCollapsed ? 0 : 1 }}
            >
              <span className="text-red-600">ANA</span>
              <span>LYZIZ</span>
            </NavLink>
          )}
          <button
            onClick={() => setIsCollapsed(prev => !prev)}
            className={`
              p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10
              transition-all duration-300 flex-shrink-0
              ${isCollapsed ? 'rotate-180' : 'rotate-0'}
            `}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `
                relative flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-neutral-300 hover:text-white
                transition-all duration-150 ease-out
                group
                ${isActive
                  ? 'bg-white/5 text-white border-l-[3px] border-red-500'
                  : 'hover:bg-white/5 border-l-[3px] border-transparent hover:border-red-500/50'}
                ${isCollapsed ? 'justify-center' : ''}
              `}
              title={isCollapsed ? label : undefined}
            >
              <Icon size={20} className="flex-shrink-0" />
              {!isCollapsed && (
                <span className="font-medium text-base whitespace-nowrap transition-opacity duration-100">
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: Search Button */}
        {!isCollapsed && (
          <div className="p-4 border-t border-white/10">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/80 hover:border-neutral-600 text-neutral-300 hover:text-white text-sm font-medium transition-all duration-150 shadow-inner group"
              title="Search (Ctrl + K)"
            >
              <Search size={16} className="text-red-500 group-hover:scale-110 transition-transform" />
              <span className="text-neutral-400 group-hover:text-neutral-200">Search F1...</span>
              <kbd className="ml-auto px-2 py-0.5 text-[10px] bg-neutral-800 border border-neutral-700 rounded text-neutral-400 font-mono font-bold group-hover:border-neutral-500">
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Drawer Overlay */}
      <div
        className={`
          fixed inset-0 z-40 bg-black/50 backdrop-blur-sm
          xl:hidden transition-opacity duration-150
          ${isMobileDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onCloseMobileDrawer}
        aria-hidden="true"
      />

      {/* Mobile Drawer Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-full z-50 xl:hidden
          bg-black/40 backdrop-blur-lg border-r border-white/10
          w-72 transform transition-transform duration-300 ease-out
          ${isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ backgroundColor: '#0a0a0a' }}
      >
        {/* Mobile Drawer Header */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-white/10">
          <NavLink
            to="/"
            className="text-2xl font-extrabold text-white tracking-wider flex items-center gap-1 shrink-0"
            onClick={onCloseMobileDrawer}
          >
            <span className="text-red-600">ANA</span>
            <span>LYZIZ</span>
          </NavLink>
          <button
            onClick={onCloseMobileDrawer}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-all duration-150"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Links - Mobile */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `
                relative flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-neutral-300 hover:text-white
                transition-all duration-150 ease-out
                group
                ${isActive
                  ? 'bg-white/5 text-white border-l-[3px] border-red-500'
                  : 'hover:bg-white/5 border-l-[3px] border-transparent hover:border-red-500/50'}
              `}
              onClick={onCloseMobileDrawer}
            >
              <Icon size={20} className="flex-shrink-0" />
              <span className="font-medium text-base whitespace-nowrap transition-opacity duration-100">
                {label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom: Search Button - Mobile */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => { setIsSearchOpen(true); onCloseMobileDrawer(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/80 hover:border-neutral-600 text-neutral-300 hover:text-white text-sm font-medium transition-all duration-150 shadow-inner group"
            title="Search (Ctrl + K)"
          >
            <Search size={16} className="text-red-500 group-hover:scale-110 transition-transform" />
            <span className="text-neutral-400 group-hover:text-neutral-200">Search F1...</span>
            <kbd className="ml-auto px-2 py-0.5 text-[10px] bg-neutral-800 border border-neutral-700 rounded text-neutral-400 font-mono font-bold group-hover:border-neutral-500">
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>
        </div>
      </aside>

      {/* Global Command Palette Modal */}
      <CommandPalette isOpen={isSearchOpen} setIsOpen={setIsSearchOpen} />
    </>
  );
};

interface MobileHeaderProps {
  isMobileDrawerOpen: boolean;
  onToggleMobileDrawer: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ isMobileDrawerOpen, onToggleMobileDrawer }) => {
  return (
    <header className="xl:hidden fixed top-0 left-0 right-0 h-16 z-50 bg-black/80 backdrop-blur-lg border-b border-white/10 flex items-center justify-between px-4">
      <button
        onClick={onToggleMobileDrawer}
        className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition-all duration-150"
        aria-label={isMobileDrawerOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={isMobileDrawerOpen}
      >
        {isMobileDrawerOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
      <NavLink
        to="/"
        className="text-xl font-extrabold text-white tracking-wider flex items-center gap-1 shrink-0"
      >
        <span className="text-red-600">ANA</span>
        <span>LYZIZ</span>
      </NavLink>
      <div className="w-10" />
    </header>
  );
};

export default Sidebar;