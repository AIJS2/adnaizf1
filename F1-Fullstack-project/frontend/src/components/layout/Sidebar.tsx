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

/** Wordmark. The red block is a stylised kerb: the brand's only ornament. */
const Wordmark: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => (
  <span className="flex items-center gap-2" translate="no">
    <span
      aria-hidden="true"
      className={`${size === 'md' ? 'h-5 w-2' : 'h-4 w-1.5'} -skew-x-12 bg-red-600`}
    />
    <span className={`${size === 'md' ? 'text-xl' : 'text-lg'} font-black italic tracking-tight text-chalk`}>
      Analyziz
    </span>
  </span>
);

const navItemClass = (isActive: boolean, isCollapsed: boolean) => `
  relative flex items-center gap-3 h-11 px-3 rounded-md
  transition-colors duration-150 ease-pit
  ${isCollapsed ? 'justify-center' : ''}
  ${isActive
    ? 'bg-neutral-850 text-chalk before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-red-600'
    : 'text-neutral-400 hover:text-chalk hover:bg-neutral-900'}
`;

const NavList: React.FC<{ isCollapsed?: boolean; onNavigate?: () => void }> = ({ isCollapsed = false, onNavigate }) => (
  <ul className="space-y-1">
    {navLinks.map(({ to, label, icon: Icon }) => (
      <li key={to}>
        <NavLink
          to={to}
          end={to === '/'}
          className={({ isActive }) => navItemClass(isActive, isCollapsed)}
          title={isCollapsed ? label : undefined}
          aria-label={isCollapsed ? label : undefined}
          onClick={onNavigate}
        >
          <Icon size={19} className="shrink-0" aria-hidden="true" />
          {!isCollapsed && <span className="font-semibold whitespace-nowrap">{label}</span>}
        </NavLink>
      </li>
    ))}
  </ul>
);

const SearchButton: React.FC<{ isMac: boolean; onClick: () => void }> = ({ isMac, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 h-11 px-3 rounded-md bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-chalk text-sm font-semibold transition-colors duration-150"
  >
    <Search size={16} className="text-red-500" aria-hidden="true" />
    <span>Search drivers, teams, races…</span>
    <kbd className="ml-auto px-1.5 py-0.5 text-[11px] bg-neutral-950 border border-neutral-800 rounded-sm text-neutral-400 font-semibold">
      {isMac ? '⌘ K' : 'Ctrl K'}
    </kbd>
  </button>
);

interface SidebarProps {
  isMobileDrawerOpen: boolean;
  onCloseMobileDrawer: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  /** The landing page has its own top nav, so the desktop rail is hidden there. */
  hideDesktop?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  isMobileDrawerOpen,
  onCloseMobileDrawer,
  isCollapsed = false,
  onToggleCollapse,
  hideDesktop = false,
}) => {
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

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobileDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileDrawerOpen, onCloseMobileDrawer]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        aria-label="Primary"
        className={`
          fixed left-0 top-0 h-full z-50 hidden flex-col ${hideDesktop ? '' : 'xl:flex'}
          bg-neutral-950 border-r border-neutral-900
          transition-[width] duration-200 ease-pit
          ${isCollapsed ? 'w-20' : 'w-72'}
        `}
      >
        <div className={`flex items-center h-20 border-b border-neutral-900 ${isCollapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
          {!isCollapsed && (
            <NavLink to="/" className="rounded-xs" aria-label="Analyziz home">
              <Wordmark />
            </NavLink>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-2 rounded-md text-neutral-500 hover:text-chalk hover:bg-neutral-900 transition-colors duration-150"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
          >
            <ChevronLeft
              size={18}
              aria-hidden="true"
              className={`transition-transform duration-200 ease-pit ${isCollapsed ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto py-5 px-3">
          <NavList isCollapsed={isCollapsed} />
        </nav>

        <div className={`border-t border-neutral-900 ${isCollapsed ? 'p-3 flex justify-center' : 'p-4'}`}>
          {isCollapsed ? (
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="p-3 rounded-md text-neutral-400 hover:text-chalk hover:bg-neutral-900 transition-colors duration-150"
              aria-label="Search"
              title={isMac ? 'Search (⌘ K)' : 'Search (Ctrl K)'}
            >
              <Search size={18} aria-hidden="true" />
            </button>
          ) : (
            <SearchButton isMac={isMac} onClick={() => setIsSearchOpen(true)} />
          )}
        </div>
      </aside>

      {/* Mobile drawer scrim */}
      <div
        className={`
          fixed inset-0 z-40 bg-tarmac/70 backdrop-blur-xs xl:hidden
          transition-opacity duration-200
          ${isMobileDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onCloseMobileDrawer}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <aside
        id="mobile-drawer"
        aria-label="Primary"
        inert={!isMobileDrawerOpen}
        className={`
          fixed left-0 top-0 h-full z-50 xl:hidden flex flex-col
          w-72 max-w-[85vw] bg-neutral-950 border-r border-neutral-900 overscroll-contain
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
          transition-transform duration-300 ease-pit
          ${isMobileDrawerOpen ? 'translate-x-0 shadow-2xl shadow-black/60' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-neutral-900">
          <NavLink to="/" onClick={onCloseMobileDrawer} className="rounded-xs" aria-label="Analyziz home">
            <Wordmark />
          </NavLink>
          <button
            type="button"
            onClick={onCloseMobileDrawer}
            className="p-2 rounded-md text-neutral-400 hover:text-chalk hover:bg-neutral-900 transition-colors duration-150"
            aria-label="Close navigation"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto overscroll-contain py-5 px-3">
          <NavList onNavigate={onCloseMobileDrawer} />
        </nav>

        <div className="p-4 border-t border-neutral-900">
          <SearchButton isMac={isMac} onClick={() => { setIsSearchOpen(true); onCloseMobileDrawer(); }} />
        </div>
      </aside>

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
    <header className="xl:hidden fixed top-0 left-0 right-0 z-50 bg-tarmac/90 backdrop-blur-lg border-b border-neutral-900 pt-[env(safe-area-inset-top)]">
      <div className="h-16 flex items-center justify-between px-4">
        <button
          type="button"
          onClick={onToggleMobileDrawer}
          className="p-2 -ml-2 rounded-md text-neutral-300 hover:text-chalk hover:bg-neutral-900 transition-colors duration-150"
          aria-label={isMobileDrawerOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={isMobileDrawerOpen}
          aria-controls="mobile-drawer"
        >
          {isMobileDrawerOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
        <NavLink to="/" className="rounded-xs" aria-label="Analyziz home">
          <Wordmark size="sm" />
        </NavLink>
        <div className="w-10" aria-hidden="true" />
      </div>
    </header>
  );
};

export default Sidebar;