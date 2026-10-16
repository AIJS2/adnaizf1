import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar, { MobileHeader } from './Sidebar';

const Layout: React.FC = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#070707] overflow-x-hidden">
      {/* Mobile Header (hamburger menu + logo) - only on mobile */}
      <MobileHeader 
        isMobileDrawerOpen={isMobileDrawerOpen} 
        onToggleMobileDrawer={() => setIsMobileDrawerOpen(prev => !prev)} 
      />
      
      {/* Vertical Sidebar - Desktop + Mobile Drawer */}
      <Sidebar 
        isMobileDrawerOpen={isMobileDrawerOpen} 
        onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)} 
      />
      
      {/* Main Content Area - with left margin to account for sidebar */}
      <main 
        className={`
          flex-1 min-h-screen min-w-0 transition-all duration-150
          pt-16 xl:pt-0
          ${isLandingPage ? 'ml-0' : 'ml-0 xl:ml-72'}
        `}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;

