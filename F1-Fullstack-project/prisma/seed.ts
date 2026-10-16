import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface TeamJson {
  name: string;
  points: number;
  wins?: number;
  podiums?: number;
  dnfs?: number;
  points_last_race?: number;
  position?: number;
  id?: string;
}

interface DriverJson {
  name: string;
  team: string;
  points: number;
  driver_number?: number;
  abbreviation?: string;
  wins?: number;
  podiums?: number;
  dnfs?: number;
  points_last_race?: number;
  position?: number;
  id?: string;
}

const TEAM_COLORS: Record<string, string> = {
  Mercedes: '#27F4D2',
  Ferrari: '#E8002D',
  McLaren: '#FF8000',
  'Red Bull Racing': '#3671C6',
  'Racing Bulls': '#6692FF',
  Alpine: '#0090FF',
  'Haas F1 Team': '#B6BABD',
  Audi: '#F51917',
  Williams: '#00A3E0',
  'Aston Martin': '#229971',
  Cadillac: '#FFD700',
};

async function main() {
  console.log('🏁 Starting F1 2026 Championship Seed...');

  const cachePath = path.resolve(__dirname, '../Backend/championship_cache_2026.json');
  let data: { teams: TeamJson[]; drivers: DriverJson[] } | null = null;

  if (fs.existsSync(cachePath)) {
    try {
      const raw = fs.readFileSync(cachePath, 'utf-8');
      data = JSON.parse(raw);
      console.log(`Loaded ${data?.teams?.length ?? 0} teams and ${data?.drivers?.length ?? 0} drivers from cache.`);
    } catch (e) {
      console.warn('Could not read championship cache, using default dataset:', e);
    }
  }

  const teams = data?.teams ?? [];
  const drivers = data?.drivers ?? [];

  // Seed Teams
  for (const t of teams) {
    const teamId = t.id || t.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const color = TEAM_COLORS[t.name] || '#EF4444';

    await prisma.team.upsert({
      where: { id: teamId },
      update: {
        name: t.name,
        color,
      },
      create: {
        id: teamId,
        name: t.name,
        color,
      },
    });

    if (t.position) {
      await prisma.standing.upsert({
        where: {
          year_type_position: {
            year: 2026,
            type: 'CONSTRUCTOR',
            position: t.position,
          },
        },
        update: {
          points: t.points ?? 0,
          wins: t.wins ?? 0,
          podiums: t.podiums ?? 0,
          dnfs: t.dnfs ?? 0,
          pointsLastRace: t.points_last_race ?? 0,
          teamId,
        },
        create: {
          year: 2026,
          type: 'CONSTRUCTOR',
          position: t.position,
          points: t.points ?? 0,
          wins: t.wins ?? 0,
          podiums: t.podiums ?? 0,
          dnfs: t.dnfs ?? 0,
          pointsLastRace: t.points_last_race ?? 0,
          teamId,
        },
      });
    }
  }

  // Seed Drivers
  for (const d of drivers) {
    const driverId = d.id || d.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const teamId = d.team ? d.team.toLowerCase().replace(/[^a-z0-9]+/g, '_') : null;

    await prisma.driver.upsert({
      where: { id: driverId },
      update: {
        name: d.name,
        abbreviation: d.abbreviation,
        driverNumber: d.driver_number,
        teamId,
      },
      create: {
        id: driverId,
        name: d.name,
        abbreviation: d.abbreviation,
        driverNumber: d.driver_number,
        teamId,
      },
    });

    if (d.position) {
      await prisma.standing.upsert({
        where: {
          year_type_position: {
            year: 2026,
            type: 'DRIVER',
            position: d.position,
          },
        },
        update: {
          points: d.points ?? 0,
          wins: d.wins ?? 0,
          podiums: d.podiums ?? 0,
          dnfs: d.dnfs ?? 0,
          pointsLastRace: d.points_last_race ?? 0,
          driverId,
          teamId,
        },
        create: {
          year: 2026,
          type: 'DRIVER',
          position: d.position,
          points: d.points ?? 0,
          wins: d.wins ?? 0,
          podiums: d.podiums ?? 0,
          dnfs: d.dnfs ?? 0,
          pointsLastRace: d.points_last_race ?? 0,
          driverId,
          teamId,
        },
      });
    }
  }

  console.log('✅ 2026 Championship Standings seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
