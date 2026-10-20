import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar, { MobileHeader } from './Sidebar';

const Layout: React.FC = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // Route changes: close the drawer, return to the top, and move focus to the
  // new page so keyboard and screen-reader users land on its content.
  useEffect(() => {
    setIsMobileDrawerOpen(false);
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-tarmac text-chalk overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-md focus:bg-red-600 focus:px-4 focus:py-2 focus:font-bold focus:text-white"
      >
        Skip to Content
      </a>

      <MobileHeader
        isMobileDrawerOpen={isMobileDrawerOpen}
        onToggleMobileDrawer={() => setIsMobileDrawerOpen(prev => !prev)}
      />

      <Sidebar
        isMobileDrawerOpen={isMobileDrawerOpen}
        onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
        isCollapsed={isCollapsed}
        hideDesktop={isLandingPage}
        onToggleCollapse={() => setIsCollapsed(prev => !prev)}
      />

      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className={`
          flex-1 min-h-screen min-w-0 outline-hidden
          pt-16 xl:pt-0
          transition-[margin] duration-200 ease-pit
          ${isLandingPage ? 'ml-0' : isCollapsed ? 'ml-0 xl:ml-20' : 'ml-0 xl:ml-72'}
        `}
      >
        {/* Keyed on the path so each route fades in once; opacity only, so
            it never shifts layout or fights a page's own scroll position. */}
        <div key={location.pathname} className="animate-route-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;