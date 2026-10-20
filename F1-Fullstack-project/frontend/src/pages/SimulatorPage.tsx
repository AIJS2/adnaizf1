import { DriverProfile, Race, TeamProfile } from '../types/f1';
import { useState, useMemo, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teamColors, teamLogos } from '../data/teamData';
import { Calculator, Trophy, ArrowUp, ArrowDown, Minus, RefreshCw, Zap, Flag, FlaskConical, Activity, Crosshair, Users, Timer, CalendarDays, Crown } from 'lucide-react';
import { fetchAllRaces, fetchChampionship } from '../services/api';
import type { ChampionshipPayload, RacesPayload } from '../services/api';

// Design tokens — spacing, color surfaces, radius
const tokens = `
  :root {
    --surface-0: #050709;
    --surface-1: #0A0D11;
    --surface-2: #0F1419;
    --surface-3: #151B23;
    --surface-4: #1C232E;
    --surface-5: #242D3A;

    --accent-primary: #E63946;
    --accent-primary-dim: #B8303B;
    --accent-cyan: #38BDF8;
    --accent-purple: #A855F7;
    --accent-amber: #FBBF24;
    --accent-yellow: #FDE047;

    --sim-radius-sm: 0.5rem;
    --sim-radius-md: 0.75rem;
    --sim-radius-lg: 1rem;
    --sim-radius-pill: 999px;

    --gap-section: 2rem;
    --gap-card: 1.5rem;
    --gap-item: 1rem;
  }
`;

const SimulatorPage = () => {
  const [originalDrivers, setOriginalDrivers] = useState<DriverProfile[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);

  // Simulation inputs
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');
  const [fastestLap, setFastestLap] = useState('');
  const [sprintWinner, setSprintWinner] = useState('');

  // View Mode: 'drivers' | 'constructors'
  const [viewMode, setViewMode] = useState('drivers');

  // Which remaining round is being simulated (defaults to the next race).
  const [selectedRound, setSelectedRound] = useState<number | ''>('');

  const currentYear = new Date().getFullYear();

  // The championship API emits `id` (e.g. "max_verstappen"), not `driverId`.
  // Every lookup must go through this helper; matching on the wrong key makes
  // the whole simulation silently add zero points.
  const driverKey = (d: DriverProfile): string =>
    d.id ?? d.driverId ?? d.name?.toLowerCase().replace(/\s+/g, '_') ?? '';

  // Standings come from react-query (cached + retried); the simulator keeps a
  // LOCAL mutable copy that the what-if maths mutates, seeded from the query.
  const { data, isLoading: loading, error, refetch } = useQuery<ChampionshipPayload>({
    queryKey: ['championship', currentYear],
    queryFn: () => fetchChampionship(currentYear),
  });

  const standings: DriverProfile[] = useMemo(() => {
    const rows = data?.drivers ?? [];
    const sorted = [...rows].sort((a, b) => (b.points || 0) - (a.points || 0));
    sorted.forEach((d, i) => { d.position = i + 1; });
    return sorted;
  }, [data]);

  // Remaining rounds come from the real calendar: every round the backend has
  // not classified as finished yet. Only these are simulatable.
  const { data: racesData } = useQuery<RacesPayload>({
    queryKey: ['races', currentYear],
    queryFn: () => fetchAllRaces(currentYear),
  });

  const remainingRaces: Race[] = useMemo(() => {
    // `/api/races/{year}` answers with a bare array; tolerate the wrapped
    // shape too so a future envelope change cannot break the simulator.
    const raw = racesData as unknown;
    const list: Race[] = Array.isArray(raw)
      ? (raw as Race[])
      : ((raw as { races?: Race[] } | undefined)?.races ?? []);
    return list
      .filter((r) => String(r.status ?? '').toLowerCase() !== 'finished')
      .sort((a, b) => Number(a.round) - Number(b.round));
  }, [racesData]);

  const selectedRace = useMemo(
    () => remainingRaces.find((r) => Number(r.round) === selectedRound),
    [remainingRaces, selectedRound],
  );
  const isSprintWeekend = Boolean(selectedRace?.is_sprint);

  // Default to the next race once the calendar arrives.
  useEffect(() => {
    if (selectedRound === '' && remainingRaces.length > 0) {
      setSelectedRound(Number(remainingRaces[0].round));
    }
  }, [remainingRaces, selectedRound]);

  // A sprint pick only counts at sprint weekends; clear it when the user
  // switches to a conventional Grand Prix.
  useEffect(() => {
    if (!isSprintWeekend && sprintWinner) setSprintWinner('');
  }, [isSprintWeekend, sprintWinner]);

  // Seed the working copy once real standings arrive (and only when the user
  // has not started simulating, so a background refetch cannot wipe inputs).
  const seededRef = useRef(false);
  useEffect(() => {
    if (standings.length === 0 || seededRef.current) return;
    seededRef.current = true;
    setOriginalDrivers(standings);
    setDrivers(JSON.parse(JSON.stringify(standings)));
  }, [standings]);

  // Live what-if: any change to the picks immediately re-runs the maths, so the
  // standings are always in sync with the form. `simulate` is declared below,
  // so this effect lives with the other effects and just mirrors the state.
  const computeSignature = `${p1}|${p2}|${p3}|${fastestLap}|${sprintWinner}|${isSprintWeekend}|${selectedRound}`;
  const lastSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (originalDrivers.length === 0) return;
    // Skip the very first run after seeding: nothing was picked yet, so the
    // working copy already equals the real standings.
    if (lastSignatureRef.current === null) {
      lastSignatureRef.current = computeSignature;
      return;
    }
    if (lastSignatureRef.current === computeSignature) return;
    lastSignatureRef.current = computeSignature;
    runSimulation();
  }, [computeSignature, originalDrivers]);

  // --- Title fight maths ----------------------------------------------------
  // Max points a driver can still score: a race win is 25, the fastest lap 1,
  // and a Sprint win 8. Sprint weekends are counted per round from the real
  // schedule (`is_sprint`), so the maths stays correct for any calendar.
  const maxPointsInfo = useMemo(() => {
    if (originalDrivers.length === 0 || remainingRaces.length === 0) return null;

    const maxPerRound = (r: Race) => 25 + 1 + (r.is_sprint ? 8 : 0);
    const sprintRounds = remainingRaces.filter((r) => r.is_sprint).length;
    const available = remainingRaces.reduce((sum, r) => sum + maxPerRound(r), 0);

    const leader = originalDrivers[0];
    const leaderPoints = leader.points || 0;
    const bestRivalPoints = originalDrivers
      .slice(1)
      .reduce((max, d) => Math.max(max, d.points || 0), 0);

    // The leader has clinched when even a maximum-score rival cannot reach
    // the leader's current total while the leader scores nothing more.
    const clinched =
      originalDrivers.length > 1 && leaderPoints > bestRivalPoints + available;

    const contenders = originalDrivers.slice(0, 6).map((d) => ({
      id: driverKey(d),
      name: d.name || d.id || '',
      team: d.team,
      points: d.points || 0,
      maxPossible: (d.points || 0) + available,
      eliminated: (d.points || 0) + available < leaderPoints,
    }));

    const inContention = originalDrivers.filter(
      (d) => (d.points || 0) + available >= leaderPoints,
    ).length;

    return {
      available,
      sprintRounds,
      clinched,
      contenders,
      inContention,
      leaderName: leader.name || leader.id || '',
      leaderPoints,
      gapToSecond: leaderPoints - bestRivalPoints,
    };
  }, [originalDrivers, remainingRaces]);

  const runSimulation = () => {
    const simulated: DriverProfile[] = JSON.parse(JSON.stringify(originalDrivers));

    // Apply predictions
    if (p1) {
      const d = simulated.find((x: DriverProfile) => driverKey(x) === p1);
      if (d) { d.points = (d.points || 0) + 25; d.wins = (d.wins || 0) + 1; d.podiums = (d.podiums || 0) + 1; }
    }
    if (p2) {
      const d = simulated.find((x: DriverProfile) => driverKey(x) === p2);
      if (d) { d.points = (d.points || 0) + 18; d.podiums = (d.podiums || 0) + 1; }
    }
    if (p3) {
      const d = simulated.find((x: DriverProfile) => driverKey(x) === p3);
      if (d) { d.points = (d.points || 0) + 15; d.podiums = (d.podiums || 0) + 1; }
    }
    if (fastestLap) {
      const d = simulated.find((x: DriverProfile) => driverKey(x) === fastestLap);
      if (d) { d.points = (d.points || 0) + 1; }
    }
    // Sprint points only exist at Sprint weekends (schedule-driven), so a
    // leftover pick from another round can never inflate the totals.
    if (sprintWinner && isSprintWeekend) {
      const d = simulated.find((x: DriverProfile) => driverKey(x) === sprintWinner);
      if (d) { d.points = (d.points || 0) + 8; }
    }

    // Re-sort
    simulated.sort((a: DriverProfile, b: DriverProfile) => (b.points || 0) - (a.points || 0));
    // Re-assign position
    simulated.forEach((d: DriverProfile, i: number) => d.position = i + 1);

    setDrivers(simulated);
  };

  const reset = () => {
    setP1(''); setP2(''); setP3(''); setFastestLap(''); setSprintWinner('');
    setDrivers(JSON.parse(JSON.stringify(originalDrivers)));
  };

  // --- Derived UI state -----------------------------------------------------
  // Points injected by the current picks. Drives the "scenario summary" so the
  // user always sees the total impact of a scenario at a glance.
  const appliedPoints = useMemo(() => {
    let total = 0;
    if (p1) total += 25;
    if (p2) total += 18;
    if (p3) total += 15;
    if (fastestLap) total += 1;
    if (sprintWinner && isSprintWeekend) total += 8;
    return total;
  }, [p1, p2, p3, fastestLap, sprintWinner, isSprintWeekend]);

  const hasPicks = Boolean(p1 || p2 || p3 || fastestLap || (isSprintWeekend && sprintWinner));

  // A driver can only be picked once per slot — flag conflicts instead of
  // silently double-awarding points (e.g. same driver as P1 and fastest lap is
  // legal in F1, but P1+P2 is not).
  const conflicts = useMemo(() => {
    const found: string[] = [];
    const seen = new Map<string, string>();
    ([['P1', p1], ['P2', p2], ['P3', p3]] as [string, string][]).forEach(([slot, id]) => {
      if (!id) return;
      if (seen.has(id)) found.push(seen.get(id) as string);
      else seen.set(id, slot);
    });
    return found;
  }, [p1, p2, p3]);

  const hasConflict = conflicts.length > 0;

  // Preset scenarios — the most common "what if" a user wants in one click.
  const applyStandingOrder = () => {
    const top = originalDrivers.slice(0, 3).map(driverKey);
    setP1(top[0] ?? ''); setP2(top[1] ?? ''); setP3(top[2] ?? '');
  };
  const applyChaos = () => {
    const top = originalDrivers.slice(0, 3).map(driverKey);
    setP1(top[2] ?? top[0] ?? ''); setP2(top[0] ?? ''); setP3(top[1] ?? '');
  };
  const clearPodium = () => { setP1(''); setP2(''); setP3(''); };

  // Enter anywhere on the page recomputes — keyboard users should not have to
  // hunt for the button after changing a dropdown.
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter') return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'BUTTON' || tag === 'SELECT') return; // let the control handle it
    e.preventDefault();
    if (!loading && !error && originalDrivers.length > 0) runSimulation();
  };

  // Calculate Constructors Standings dynamically
  const originalConstructors = useMemo(() => {
    const teams: Record<string, TeamProfile> = {};
    originalDrivers.forEach((d: DriverProfile) => {
      if (!teams[d.team]) teams[d.team] = { id: d.team, name: d.team, points: 0, drivers: [] };
      teams[d.team].points = (teams[d.team].points || 0) + (d.points || 0);
      teams[d.team].drivers?.push(d.name?.split(' ').pop() as unknown as DriverProfile);
    });
    const sorted = Object.values(teams).sort((a: TeamProfile, b: TeamProfile) => (b.points || 0) - (a.points || 0));
    sorted.forEach((t: TeamProfile, i: number) => t.position = i + 1);
    return sorted;
  }, [originalDrivers]);

  const simulatedConstructors = useMemo(() => {
    const teams: Record<string, TeamProfile> = {};
    drivers.forEach((d: DriverProfile) => {
      if (!teams[d.team]) teams[d.team] = { id: d.team, name: d.team, points: 0, drivers: [] };
      teams[d.team].points = (teams[d.team].points || 0) + (d.points || 0);
      teams[d.team].drivers?.push(d.name?.split(' ').pop() as unknown as DriverProfile);
    });
    const sorted = Object.values(teams).sort((a: TeamProfile, b: TeamProfile) => (b.points || 0) - (a.points || 0));
    sorted.forEach((t: TeamProfile, i: number) => t.position = i + 1);
    return sorted;
  }, [drivers]);

  if (error) {
    return (
      <div className="bg-neutral-950 min-h-screen text-white font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4 flex justify-center"><Activity size={48} /></div>
          <h2 className="text-3xl font-black mb-2">Failed to load Championship</h2>
          <p className="text-neutral-400 mb-6">{error?.message}</p>
          <button onClick={() => { void refetch(); }} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{tokens}</style>
      <div className="min-h-screen text-white font-sans relative" style={{ backgroundColor: 'var(--surface-0)' }} onKeyDown={onKeyDown}>
        {/* Layered backgrounds */}
        <div className="fixed inset-0 xl:left-72 bg-[url('https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat opacity-[0.06] pointer-events-none mix-blend-luminosity"></div>
        <div className="fixed inset-0 xl:left-72 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.08] pointer-events-none mix-blend-overlay"></div>
        <div className="fixed inset-0 xl:left-72 pointer-events-none" style={{ background: 'radial-gradient(circle at 20% 10%, rgba(230,57,70,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 90%, rgba(56,189,248,0.08) 0%, transparent 50%)' }}></div>

        <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-10 py-8 md:py-12 xl:py-16 relative z-10">

          {/* Header */}
          <div className="mb-12 relative">
            <div className="absolute -left-12 -top-12 w-40 h-40 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(230,57,70,0.25) 0%, transparent 70%)', filter: 'blur(60px)' }}></div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight flex items-center gap-4 italic relative" style={{ letterSpacing: '-0.02em' }}>
              <Calculator style={{ color: 'var(--accent-primary)' }} size={52} />
              <span style={{
                background: 'linear-gradient(135deg, #fff 0%, #d1d5db 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Championship Simulator
              </span>
            </h1>
            <p className="text-neutral-400 mt-4 text-base md:text-lg font-medium max-w-3xl leading-relaxed md:leading-7">
              Test "What-If" scenarios on the remaining rounds{remainingRaces.length > 0 && <> (R{remainingRaces[0].round}–R{remainingRaces[remainingRaces.length - 1].round})</>}. Pick a Grand Prix, predict the podium, fastest lap, and Sprint winner, then watch the championship standings recalculate in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Left Panel: Inputs + Title Fight */}
            <div className="lg:col-span-4 space-y-8">

          <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-lg p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 blur-[100px] rounded-full pointer-events-none"></div>
            
            <h3 className="text-2xl font-black mb-6 flex items-center gap-2 uppercase tracking-tight italic border-b border-white/10 pb-4 text-white">
              <FlaskConical className="text-red-500 " size={24} /> 
              Strategy Command
            </h3>
            
            <div className="space-y-4 relative z-10">

              {/* Quick presets — one-click common scenarios */}
              <div className="flex flex-wrap gap-2">
                <span className="w-full text-[11px] uppercase font-black text-neutral-500 tracking-widest mb-1">Quick Scenarios</span>
                <button
                  onClick={applyStandingOrder}
                  disabled={originalDrivers.length < 3}
                  className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 rounded-full transition-ui disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Current Order
                </button>
                <button
                  onClick={applyChaos}
                  disabled={originalDrivers.length < 3}
                  className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 rounded-full transition-ui disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Podium Chaos
                </button>
                <button
                  onClick={clearPodium}
                  disabled={!p1 && !p2 && !p3}
                  className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider bg-neutral-800/60 hover:bg-neutral-700/60 border border-white/10 text-neutral-300 rounded-full transition-ui disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Clear Podium
                </button>
              </div>

              {/* Conflict warning — same driver cannot occupy two podium slots */}
              {hasConflict && (
                <div role="alert" className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/40 text-orange-300 text-xs font-bold px-3 py-2 rounded-md">
                  <Crosshair size={14} className="mt-0.5 shrink-0" />
                  <span>A driver can't hold two podium spots — adjust the duplicate selection ({conflicts.join(', ')}).</span>
                </div>
              )}

              {/* Grand Prix selector — only the remaining rounds are simulatable */}
              <div className="relative group">
                <label className="block text-[11px] uppercase font-black text-neutral-400 mb-1.5 tracking-widest flex justify-between">
                  <span className="flex items-center gap-1"><CalendarDays size={12} className="text-red-400" /> Grand Prix</span>
                  {selectedRace && (
                    <span className={selectedRace.is_sprint ? 'text-orange-400 drop-shadow-[0_0_5px_rgba(251,146,60,0.8)]' : 'text-neutral-500'}>
                      {selectedRace.is_sprint ? 'SPRINT WEEKEND' : 'CONVENTIONAL'}
                    </span>
                  )}
                </label>
                <select
                  aria-label="Grand Prix"
                  value={selectedRound}
                  onChange={e => setSelectedRound(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={remainingRaces.length === 0}
                  className="w-full bg-neutral-950/90 border border-white/10 hover:border-red-500/50 rounded-md p-3.5 text-white font-bold focus:outline-hidden focus:border-red-400 focus:ring-4 focus:ring-red-400/20 transition-ui shadow-inner appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {remainingRaces.length === 0 && <option value="">{loading ? 'Loading calendar…' : 'No remaining rounds'}</option>}
                  {remainingRaces.map(r => (
                    <option key={`race-${r.round}`} value={Number(r.round)}>
                      R{r.round} — {r.name}{r.is_sprint ? ' • SPRINT' : ''}
                    </option>
                  ))}
                </select>
                {selectedRace && (
                  <p className="mt-1.5 text-[11px] text-neutral-500 font-bold uppercase tracking-widest">
                    {selectedRace.location || selectedRace.country || ''}{selectedRace.date ? ` • ${selectedRace.date}` : ''}
                  </p>
                )}
              </div>

              {/* P1 Input */}
              <div className="relative group">
                <label className="block text-[11px] uppercase font-black text-neutral-400 mb-1.5 tracking-widest flex justify-between">
                  <span className="flex items-center gap-1"><Trophy size={12} className="text-yellow-400" /> P1 Winner</span> <span className="text-yellow-400 ">+25 PTS</span>
                </label>
                <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-md opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                <select aria-label="P1 Winner" value={p1} onChange={e => setP1(e.target.value)} className="relative w-full bg-neutral-950/90 border border-white/10 hover:border-yellow-500/50 rounded-md p-3.5 text-white font-bold focus:outline-hidden focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20 transition-ui shadow-inner appearance-none cursor-pointer">
                  <option value="">-- Select P1 --</option>
                  {originalDrivers.map(d => <option key={`p1-${driverKey(d)}`} value={driverKey(d)}>{d.name} ({d.team})</option>)}
                </select>
              </div>

              {/* P2 Input */}
              <div className="relative group">
                <label className="block text-[11px] uppercase font-black text-neutral-400 mb-1.5 tracking-widest flex justify-between">
                  <span className="flex items-center gap-1"><Crosshair size={12} className="text-slate-300" /> P2 Runner-up</span> <span className="text-slate-300 ">+18 PTS</span>
                </label>
                <div className="absolute inset-0 bg-slate-300/20 blur-xl rounded-md opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                <select aria-label="P2 Runner-up" value={p2} onChange={e => setP2(e.target.value)} className="relative w-full bg-neutral-950/90 border border-white/10 hover:border-slate-300/50 rounded-md p-3.5 text-white font-bold focus:outline-hidden focus:border-slate-300 focus:ring-4 focus:ring-slate-300/20 transition-ui shadow-inner appearance-none cursor-pointer">
                  <option value="">-- Select P2 --</option>
                  {originalDrivers.map(d => <option key={`p2-${driverKey(d)}`} value={driverKey(d)}>{d.name} ({d.team})</option>)}
                </select>
              </div>

              {/* P3 Input */}
              <div className="relative group">
                <label className="block text-[11px] uppercase font-black text-neutral-400 mb-1.5 tracking-widest flex justify-between">
                  <span className="flex items-center gap-1"><Activity size={12} className="text-amber-500" /> P3 Podium</span> <span className="text-amber-500 ">+15 PTS</span>
                </label>
                <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-md opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                <select aria-label="P3 Podium" value={p3} onChange={e => setP3(e.target.value)} className="relative w-full bg-neutral-950/90 border border-white/10 hover:border-amber-500/50 rounded-md p-3.5 text-white font-bold focus:outline-hidden focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-ui shadow-inner appearance-none cursor-pointer">
                  <option value="">-- Select P3 --</option>
                  {originalDrivers.map(d => <option key={`p3-${driverKey(d)}`} value={driverKey(d)}>{d.name} ({d.team})</option>)}
                </select>
              </div>

              {/* Fastest Lap Input */}
              <div className="relative group">
                <label className="block text-[11px] uppercase font-black text-neutral-400 mb-1.5 tracking-widest flex justify-between">
                  <span className="flex items-center gap-1"><Zap size={12} className="text-purple-500" /> Fastest Lap</span> <span className="text-purple-400 ">+1 PTS</span>
                </label>
                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-md opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                <select aria-label="Fastest Lap" value={fastestLap} onChange={e => setFastestLap(e.target.value)} className="relative w-full bg-neutral-950/90 border border-white/10 hover:border-purple-500/50 rounded-md p-3.5 text-white font-bold focus:outline-hidden focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-ui shadow-inner appearance-none cursor-pointer">
                  <option value="">-- Select Fastest Lap --</option>
                  {originalDrivers.map(d => <option key={`fl-${driverKey(d)}`} value={driverKey(d)}>{d.name} ({d.team})</option>)}
                </select>
              </div>

              {/* Sprint Winner Input — only active at Sprint weekends */}
              <div className="relative group">
                <label className="block text-[11px] uppercase font-black text-neutral-400 mb-1.5 tracking-widest flex justify-between">
                  <span className="flex items-center gap-1"><Timer size={12} className={isSprintWeekend ? 'text-cyan-500' : 'text-neutral-600'} /> Sprint Winner</span>
                  {isSprintWeekend
                    ? <span className="text-cyan-400 ">+8 PTS</span>
                    : <span className="text-neutral-600">NO SPRINT</span>}
                </label>
                <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-md opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                <select aria-label="Sprint Winner" value={sprintWinner} onChange={e => setSprintWinner(e.target.value)} disabled={!isSprintWeekend} className="relative w-full bg-neutral-950/90 border border-white/10 hover:border-cyan-500/50 rounded-md p-3.5 text-white font-bold focus:outline-hidden focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 transition-ui shadow-inner appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="">-- Select Sprint Winner --</option>
                  {originalDrivers.map(d => <option key={`sw-${driverKey(d)}`} value={driverKey(d)}>{d.name} ({d.team})</option>)}
                </select>
                {!isSprintWeekend && (
                  <p className="mt-1.5 text-[11px] text-neutral-500 font-bold uppercase tracking-widest">
                    This Grand Prix has no Sprint session — sprint points do not apply.
                  </p>
                )}
              </div>

              {/* Scenario summary + actions */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-3 text-[11px] font-black uppercase tracking-widest">
                  <span className="text-neutral-500">Scenario Impact</span>
                  <span className={hasPicks ? 'text-purple-400' : 'text-neutral-600'}>
                    {hasPicks ? `+${appliedPoints} pts awarded` : 'No picks yet'}
                  </span>
                </div>

                {/* Point distribution preview */}
                {hasPicks && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {([[p1, 25, 'P1'], [p2, 18, 'P2'], [p3, 15, 'P3'], [fastestLap, 1, 'FL'], [sprintWinner && isSprintWeekend ? sprintWinner : '', 8, 'SPR']] as [string, number, string][])
                      .filter(([id]) => Boolean(id))
                      .map(([id, pts, tag]) => {
                        const d = originalDrivers.find((x) => driverKey(x) === id);
                        return (
                          <span key={tag} className="inline-flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-full pl-1.5 pr-2.5 py-0.5 text-[11px] font-black">
                            <span className="bg-purple-500/30 rounded-full px-1.5 py-0.5 text-[10px]">{tag}</span>
                            <span className="truncate max-w-28 normal-case tracking-normal">{d?.name ?? '—'}</span>
                            <span className="text-purple-200">+{pts}</span>
                          </span>
                        );
                      })}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={runSimulation}
                    disabled={hasConflict || loading}
                    title="Recalculate the standings (or press Enter)"
                    className="flex-1 bg-linear-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black py-4 rounded-md transition-ui flex items-center justify-center gap-2 uppercase tracking-wider text-sm border border-red-400/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-red-600 disabled:hover:to-red-500"
                  >
                    <Calculator size={18} /> Compute
                    <kbd className="hidden sm:inline text-[10px] font-black opacity-70 border border-white/25 rounded-sm px-1.5 py-0.5">ENTER</kbd>
                  </button>
                  <button
                    onClick={reset}
                    disabled={!hasPicks && drivers.length === originalDrivers.length}
                    className="sm:w-1/3 bg-neutral-900/80 hover:bg-neutral-800 text-white font-bold py-4 rounded-md transition-ui flex items-center justify-center gap-2 uppercase tracking-wider text-sm border border-white/10 hover:border-white/30 backdrop-blur-xs disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-neutral-900/80"
                  >
                    <RefreshCw size={16} /> Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

            {/* Title Fight: Max Possible Points / Clinch Scenario */}
            <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-lg p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 blur-[100px] rounded-full pointer-events-none"></div>
              <h3 className="text-2xl font-black mb-4 flex items-center gap-2 uppercase tracking-tight italic border-b border-white/10 pb-4 text-white">
                <Crown className="text-yellow-400 " size={24} />
                Title Fight
              </h3>

              {maxPointsInfo ? (
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between bg-neutral-950/80 border border-white/10 rounded-lg px-4 py-3">
                    <div>
                      <span className="block text-[11px] text-neutral-500 font-black uppercase tracking-widest">Max Possible Points</span>
                      <span className="text-3xl font-black italic text-white">+{maxPointsInfo.available}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[11px] text-neutral-500 font-black uppercase tracking-widest">{remainingRaces.length} rounds left</span>
                      <span className="text-xs font-bold text-neutral-300">
                        {maxPointsInfo.sprintRounds > 0
                          ? `incl. ${maxPointsInfo.sprintRounds} Sprint${maxPointsInfo.sprintRounds > 1 ? 's' : ''} (+8 each)`
                          : 'no Sprint sessions left'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-bold text-neutral-300 leading-relaxed">
                    {maxPointsInfo.clinched ? (
                      <>{maxPointsInfo.leaderName} has clinched the title: even a maximum-score rival cannot catch {maxPointsInfo.leaderPoints} PTS.</>
                    ) : (
                      <>Title fight mathematically open — <span className="text-white">{maxPointsInfo.inContention} drivers</span> can still win. Leader <span className="text-white">{maxPointsInfo.leaderName}</span> is +{maxPointsInfo.gapToSecond} ahead with {maxPointsInfo.available} pts on the table.</>
                    )}
                  </p>

                  <div className="space-y-2">
                    {maxPointsInfo.contenders.map((c, i) => {
                      const progress = maxPointsInfo.leaderPoints > 0 ? (c.maxPossible / maxPointsInfo.leaderPoints) * 100 : 0;
                      return (
                        <div key={c.id} className="flex items-center gap-3 bg-neutral-950/70 border border-white/5 rounded-md px-3 py-2.5">
                          <span className="w-5 text-center text-xs font-black text-neutral-500">{i + 1}</span>
                          <span className="w-1 h-6 rounded-full" style={{ backgroundColor: teamColors[c.team] || '#666' }}></span>
                          <div className="flex-1 min-w-0">
                            <span className="block text-xs font-black uppercase italic truncate text-white">{c.name}</span>
                            <span className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest truncate">{c.team}</span>
                            {/* Max possible progress bar */}
                            <div className="mt-1.5 h-1 bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(progress, 100)}%`,
                                  backgroundColor: c.eliminated ? '#525252' : teamColors[c.team] || '#666'
                                }}
                              ></div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="block text-sm font-black font-mono text-white">{c.points}</span>
                            <span className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest">max {c.maxPossible}</span>
                          </div>
                          <span
                            title={c.eliminated ? 'Eliminated from title contention' : 'Still mathematically in title contention'}
                            className={`text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${c.eliminated ? 'text-neutral-500 border-neutral-700 bg-neutral-900' : 'text-green-400 border-green-500/40 bg-green-500/10'}`}
                          >
                            {c.eliminated ? 'OUT' : 'IN'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-neutral-500 text-xs font-bold tracking-normal relative z-10">Waiting for standings &amp; calendar…</p>
              )}
            </div>
          </div>

          {/* Right Panel: Simulated Standings */}
          <div className="lg:col-span-8">
            <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-lg p-6 md:p-8 flex flex-col h-full">
              
              <div className="flex flex-col xl:flex-row xl:items-center justify-between border-b border-white/10 pb-6 mb-6 gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-2xl font-black flex items-center gap-3 italic uppercase tracking-tight text-white">
                    <Activity className="text-red-500 " size={28} /> 
                    Predicted Standings
                  </h3>
                  {p1 || p2 || p3 || fastestLap || (isSprintWeekend && sprintWinner) ? (
                    <span className="bg-red-500/20 text-red-400 border border-red-500/50 px-3 py-1 rounded-full text-xs font-black tracking-normal motion-safe:animate-pulse flex items-center gap-2 ">
                      <div className="w-2 h-2 bg-red-400 rounded-full "></div>
                      Simulated
                    </span>
                  ) : (
                    <span className="bg-neutral-800/80 border border-white/10 text-neutral-400 px-3 py-1 rounded-full text-xs font-black tracking-normal ">
                      Current
                    </span>
                  )}
                  {selectedRace && (
                    <span className="bg-neutral-800/80 border border-white/10 text-neutral-300 px-3 py-1 rounded-full text-xs font-black tracking-normal ">
                      R{selectedRace.round} {selectedRace.name}{selectedRace.is_sprint ? ' • SPRINT' : ''}
                    </span>
                  )}
                </div>

                {/* View Mode Toggle */}
                <div className="flex bg-neutral-950 border border-neutral-800 rounded-lg p-1 w-full md:w-auto">
                  <button 
                    onClick={() => setViewMode('drivers')}
                    className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-ui flex items-center justify-center gap-2 ${viewMode === 'drivers' ? 'bg-neutral-800 text-white shadow-md' : 'text-neutral-500 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <Flag size={14} /> Drivers
                  </button>
                  <button 
                    onClick={() => setViewMode('constructors')}
                    className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-ui flex items-center justify-center gap-2 ${viewMode === 'constructors' ? 'bg-neutral-800 text-white shadow-md' : 'text-neutral-500 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <Users size={14} /> Constructors
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="space-y-3 motion-safe:animate-pulse flex-1">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-20 bg-neutral-800/50 rounded-lg w-full border border-white/5"></div>
                  ))}
                </div>
              ) : drivers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                  <Activity size={48} className="text-neutral-700 mb-4" />
                  <h4 className="text-xl font-black text-neutral-500 mb-2">No standings data yet</h4>
                  <p className="text-sm text-neutral-600 max-w-sm">Waiting for championship data to load. Check your connection or refresh the page.</p>
                </div>
              ) : (
                <div className="space-y-3 flex-1" role="region" aria-live="polite" aria-label="Simulated championship standings">

                  {/* Drivers View */}
                  {viewMode === 'drivers' && drivers.slice(0, 10).map((d) => {
                    const original = originalDrivers.find(o => driverKey(o) === driverKey(d));
                    const posChange = (original?.position || 0) - (d.position || 0);
                    const ptsGained = (d.points || 0) - (original?.points || 0);
                    const teamColor = teamColors[d.team] || '#666';
                    const teamLogo = teamLogos[d.team];

                    return (
                      <div
                        key={driverKey(d)}
                        className={`group relative bg-neutral-950/80 backdrop-blur-md border ${ptsGained > 0 ? 'border-red-500/40 bg-red-950/30' : 'border-white/5 hover:border-white/10'} rounded-lg p-4 flex items-center gap-4 md:gap-6 transition-ui duration-300 overflow-hidden shadow-lg hover:bg-neutral-900/90`}
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 " style={{ backgroundColor: teamColor, color: teamColor }}></div>

                        <div className="flex flex-col items-center justify-center w-12 md:w-16 ml-2">
                          <span className="text-xl md:text-3xl font-black italic text-white ">{d.position}</span>
                          <div className="flex items-center justify-center mt-0.5">
                            {posChange > 0 ? (
                              <span className="text-green-400 font-bold text-xs flex items-center bg-green-500/20 px-1.5 py-0.5 rounded-sm border border-green-500/40 "><ArrowUp size={12} strokeWidth={3} className="mr-0.5" /> {posChange}</span>
                            ) : posChange < 0 ? (
                              <span className="text-red-500 font-bold text-xs flex items-center bg-red-500/20 px-1.5 py-0.5 rounded-sm border border-red-500/40 "><ArrowDown size={12} strokeWidth={3} className="mr-0.5" /> {Math.abs(posChange)}</span>
                            ) : (
                              <span className="text-neutral-500 font-bold text-xs"><Minus size={12} strokeWidth={3} /></span>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <h4 className="text-lg md:text-2xl font-black uppercase italic truncate text-white drop-shadow-xs group-hover:text-red-400 transition-colors flex items-center gap-2">
                            {d.name}
                            {teamLogo && <img src={teamLogo} alt={d.team} className="h-4 md:h-5 object-contain opacity-70" />}
                          </h4>
                          <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-neutral-400 tracking-normal">
                            <span className="truncate">{d.team}</span>
                            {d.wins ? <span className="text-yellow-500/80">• {d.wins}W</span> : null}
                            {d.podiums ? <span className="text-neutral-500">• {d.podiums}P</span> : null}
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-4">
                          <div className="w-16 md:w-20 text-right">
                            {ptsGained > 0 && (
                              <span className="inline-block bg-purple-500/20 text-purple-400 border border-purple-500/40 px-2 py-0.5 rounded-sm text-xs md:text-sm font-black tracking-wider motion-safe:animate-pulse ">
                                +{ptsGained}
                              </span>
                            )}
                          </div>
                          <div className="w-16 md:w-24">
                            <span className="text-3xl md:text-4xl font-black italic tracking-tighter" style={{ color: ptsGained > 0 ? '#fff' : '#e5e5e5', textShadow: ptsGained > 0 ? '0 0 10px rgba(255,255,255,0.5)' : 'none' }}>
                              {d.points}
                            </span>
                            <span className="block text-[11px] md:text-[11px] text-neutral-500 font-black tracking-widest uppercase -mt-1">PTS</span>
                          </div>
                        </div>
                        {ptsGained > 0 && (
                          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-red-500/10 blur-2xl rounded-full pointer-events-none"></div>
                        )}
                      </div>
                    );
                  })}

                  {/* Constructors View */}
                  {viewMode === 'constructors' && simulatedConstructors.map((team: TeamProfile) => {
                    const original = originalConstructors.find(o => o.id === team.id);
                    const posChange = (original?.position || 0) - (team.position || 0);
                    const ptsGained = (team.points || 0) - (original?.points || 0);
                    const teamColor = teamColors[team.id] || '#666';
                    const logo = teamLogos[team.id];
                    
                    return (
                      <div 
                        key={team.id} 
                        className={`group relative bg-neutral-950/80 backdrop-blur-md border ${ptsGained > 0 ? 'border-red-500/40 bg-red-950/30' : 'border-white/5 hover:border-white/10'} rounded-lg p-4 flex items-center gap-4 md:gap-6 transition-ui duration-300 overflow-hidden shadow-lg hover:bg-neutral-900/90`}
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 " style={{ backgroundColor: teamColor, color: teamColor }}></div>
                        
                        <div className="flex flex-col items-center justify-center w-12 md:w-16 ml-2">
                          <span className="text-xl md:text-3xl font-black italic text-white ">{team.position}</span>
                          <div className="flex items-center justify-center mt-0.5">
                            {posChange > 0 ? (
                              <span className="text-green-400 font-bold text-xs flex items-center bg-green-500/20 px-1.5 py-0.5 rounded-sm border border-green-500/40 "><ArrowUp size={12} strokeWidth={3} className="mr-0.5" /> {posChange}</span>
                            ) : posChange < 0 ? (
                              <span className="text-red-500 font-bold text-xs flex items-center bg-red-500/20 px-1.5 py-0.5 rounded-sm border border-red-500/40 "><ArrowDown size={12} strokeWidth={3} className="mr-0.5" /> {Math.abs(posChange)}</span>
                            ) : (
                              <span className="text-neutral-500 font-bold text-xs"><Minus size={12} strokeWidth={3} /></span>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <h4 className="text-lg md:text-2xl font-black uppercase italic truncate text-white drop-shadow-xs group-hover:text-red-400 transition-colors flex items-center gap-3">
                            {team.name} {logo && <img src={logo} alt={team.name} className="h-5 md:h-6 object-contain opacity-80" />}
                          </h4>
                          <span className="text-xs md:text-sm font-bold text-neutral-400 tracking-normal truncate">
                            {(team.drivers || []).join(' / ')}
                          </span>
                        </div>

                        <div className="text-right flex items-center gap-4">
                          <div className="w-16 md:w-20 text-right">
                            {ptsGained > 0 && (
                              <span className="inline-block bg-purple-500/20 text-purple-400 border border-purple-500/40 px-2 py-0.5 rounded-sm text-xs md:text-sm font-black tracking-wider motion-safe:animate-pulse ">
                                +{ptsGained}
                              </span>
                            )}
                          </div>
                          <div className="w-16 md:w-24">
                            <span className="text-3xl md:text-4xl font-black italic tracking-tighter" style={{ color: ptsGained > 0 ? '#fff' : '#e5e5e5', textShadow: ptsGained > 0 ? '0 0 10px rgba(255,255,255,0.5)' : 'none' }}>
                              {team.points}
                            </span>
                            <span className="block text-[11px] md:text-[11px] text-neutral-500 font-black tracking-widest uppercase -mt-1">PTS</span>
                          </div>
                        </div>
                        {ptsGained > 0 && (
                          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-red-500/10 blur-2xl rounded-full pointer-events-none"></div>
                        )}
                      </div>
                    );
                  })}
                  
                  <div className="pt-4 text-center border-t border-white/5">
                    <p className="text-neutral-500 text-xs font-bold tracking-normal pt-2">
                      * Showing top 10 simulated {viewMode} standings
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          </div> {/* Close grid container */}
        </main>
      </div>
    </>
  );
};

export default SimulatorPage;
