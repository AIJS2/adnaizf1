import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useOutlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import Sidebar, { MobileHeader } from './Sidebar';
import SiteFooter from './SiteFooter';

/**
 * Route level enter & exit transition variants.
 * Exit accelerates swiftly (0.18s) to keep page switches snappy,
 * while enter decelerates with a luxurious easing curve (0.28s).
 */
const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 16,
    scale: 0.995,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.28,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.995,
    transition: {
      duration: 0.18,
      ease: [0.32, 0, 0.67, 0],
    },
  },
};

const reducedPageVariants: Variants = {
  initial: { opacity: 1, y: 0, scale: 1 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0 } },
  exit: { opacity: 1, y: 0, scale: 1, transition: { duration: 0 } },
};

/**
 * Fallback skeleton when lazy route chunks are loading between page transitions.
 * Keeps Layout and Sidebar rock-solid while the page content smoothly streams in.
 */
const PageFallback: React.FC = () => (
  <div
    className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 md:py-8 space-y-6 motion-safe:animate-pulse"
    role="status"
    aria-label="Loading page..."
  >
    <div className="flex items-center justify-between pb-4 border-b border-neutral-900">
      <div className="h-8 bg-neutral-900/80 border border-neutral-800 rounded-lg w-52" />
      <div className="h-8 bg-neutral-900/60 border border-neutral-800 rounded-lg w-32" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 bg-neutral-900/60 border border-neutral-800/80 rounded-xl" />
      ))}
    </div>
    <div className="h-72 sm:h-96 bg-neutral-900/50 border border-neutral-800/80 rounded-2xl w-full" />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-80 bg-neutral-900/50 border border-neutral-800/80 rounded-xl w-full" />
      <div className="h-80 bg-neutral-900/50 border border-neutral-800/80 rounded-xl w-full" />
    </div>
  </div>
);

/**
 * Top racing line: high-intensity red/amber accent that sweeps across the screen
 * on route transition like a high-speed telemetry pulse.
 */
const TopRacingLine: React.FC = () => {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const isFirstMount = useRef(true);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setPulseKey((k) => k + 1);
  }, [location.pathname]);

  if (shouldReduceMotion || pulseKey === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[3px] z-100 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <motion.div
        key={pulseKey}
        initial={{ x: '-100%', opacity: 1 }}
        animate={{ x: '100%', opacity: [1, 1, 0] }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="h-full w-full bg-linear-to-r from-transparent via-red-500 to-amber-400 shadow-[0_0_12px_rgba(230,57,70,0.9)]"
      />
    </div>
  );
};

const Layout: React.FC = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const outlet = useOutlet();

  // Route changes: close the mobile drawer
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-tarmac text-chalk overflow-x-clip">
      <TopRacingLine />
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
          flex-1 min-h-screen min-w-0 outline-hidden flex flex-col
          pt-16 lg:pt-0
          transition-[margin] duration-200 ease-pit
          ${isLandingPage ? 'ml-0' : isCollapsed ? 'ml-0 lg:ml-20' : 'ml-0 lg:ml-72'}
        `}
      >
        {/* AnimatePresence enables smooth exit and enter page transitions across every route */}
        <AnimatePresence
          mode="wait"
          onExitComplete={() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            mainRef.current?.focus({ preventScroll: true });
          }}
        >
          {outlet && (
            <motion.div
              key={location.pathname}
              variants={shouldReduceMotion ? reducedPageVariants : pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full flex-1 flex flex-col"
            >
              <Suspense fallback={<PageFallback />}>
                {outlet}
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {!isLandingPage && location.pathname !== '/guide' && <SiteFooter />}
      </main>
    </div>
  );
};

export default Layout;