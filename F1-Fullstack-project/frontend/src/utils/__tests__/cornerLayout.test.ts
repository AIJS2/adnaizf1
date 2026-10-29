import { describe, expect, it } from 'vitest';
import {
  computeCornerLayout,
  distToSegment,
  segmentsIntersect,
} from '../cornerLayout';
import { CIRCUIT_CORNERS } from '../../data/circuitCorners';
import { CANONICAL_CIRCUITS, sampleCircuitPosition } from '../../data/circuitPaths';

describe('cornerLayout utility', () => {
  it('returns empty array when corners list is empty', () => {
    const result = computeCornerLayout({
      corners: [],
      sample: () => ({ x: 0, y: 0 }),
      trackPoints: [{ x: 0, y: 0 }],
      viewBox: { x: 0, y: 0, width: 500, height: 500 },
      trackWidth: 18,
    });
    expect(result).toEqual([]);
  });

  it('correctly detects segment intersections', () => {
    expect(segmentsIntersect(0, 0, 10, 10, 0, 10, 10, 0)).toBe(true);
    expect(segmentsIntersect(0, 0, 10, 0, 0, 10, 10, 10)).toBe(false);
  });

  it('computes point to segment distance correctly', () => {
    expect(distToSegment(5, 5, 0, 0, 10, 0)).toBe(5);
    expect(distToSegment(-5, 0, 0, 0, 10, 0)).toBe(5);
    expect(distToSegment(15, 0, 0, 0, 10, 0)).toBe(5);
  });

  it('places badges on Mexico (Round 19) with 0 overlaps and 0 track collisions', () => {
    const mexicoGeom = CANONICAL_CIRCUITS.find((c) => c.round === 19);
    expect(mexicoGeom).toBeDefined();
    if (!mexicoGeom) return;

    const mexicoCorners = CIRCUIT_CORNERS.find((c) => c.round === 19)?.corners ?? [];
    expect(mexicoCorners.length).toBe(17);

    const refXs = mexicoGeom.points.map((p) => p.x);
    const refYs = mexicoGeom.points.map((p) => p.y);
    const minX = Math.min(...refXs);
    const maxX = Math.max(...refXs);
    const minY = Math.min(...refYs);
    const maxY = Math.max(...refYs);
    const w = maxX - minX;
    const h = maxY - minY;
    const maxDim = Math.max(w, h, 1);
    const padding = maxDim * 0.1;
    const viewBox = {
      x: minX - padding,
      y: minY - padding,
      width: w + padding * 2,
      height: h + padding * 2,
    };

    const trackWidth = Math.max(12, maxDim * 0.015);
    const badgeRadius = maxDim * 0.024;

    const placed = computeCornerLayout({
      corners: mexicoCorners,
      sample: (d) => sampleCircuitPosition(mexicoGeom, d),
      trackPoints: mexicoGeom.points,
      viewBox,
      trackWidth,
      badgeRadius,
    });

    expect(placed).toHaveLength(17);

    // 1. Assert no badge overlaps any other badge
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const dist = Math.hypot(placed[i].x - placed[j].x, placed[i].y - placed[j].y);
        expect(dist).toBeGreaterThanOrEqual(2 * badgeRadius);
      }
    }

    // 2. Assert no badge covers the track ribbon
    const trackRadius = trackWidth / 2;
    for (const p of placed) {
      let minD = Infinity;
      for (let k = 0; k < mexicoGeom.points.length; k++) {
        const p1 = mexicoGeom.points[k];
        const p2 = mexicoGeom.points[(k + 1) % mexicoGeom.points.length];
        const d = distToSegment(p.x, p.y, p1.x, p1.y, p2.x, p2.y);
        if (d < minD) minD = d;
      }
      expect(minD).toBeGreaterThanOrEqual(badgeRadius + trackRadius);
    }

    // 3. Assert all badges are strictly within viewBox
    for (const p of placed) {
      expect(p.x - badgeRadius).toBeGreaterThanOrEqual(viewBox.x);
      expect(p.x + badgeRadius).toBeLessThanOrEqual(viewBox.x + viewBox.width);
      expect(p.y - badgeRadius).toBeGreaterThanOrEqual(viewBox.y);
      expect(p.y + badgeRadius).toBeLessThanOrEqual(viewBox.y + viewBox.height);
    }

    // 4. Specifically check turns 13, 14, 15, 16 are staggered cleanly
    const t13 = placed.find((p) => p.number === 13);
    const t14 = placed.find((p) => p.number === 14);
    const t15 = placed.find((p) => p.number === 15);
    expect(t13).toBeDefined();
    expect(t14).toBeDefined();
    expect(t15).toBeDefined();
    if (t13 && t14 && t15) {
      const d1314 = Math.hypot(t13.x - t14.x, t13.y - t14.y);
      const d1415 = Math.hypot(t14.x - t15.x, t14.y - t15.y);
      expect(d1314).toBeGreaterThanOrEqual(2 * badgeRadius);
      expect(d1415).toBeGreaterThanOrEqual(2 * badgeRadius);
    }
  });

  it('guarantees 0 overlaps and 0 track collisions across all 25 bundled circuits', () => {
    for (const cornerSet of CIRCUIT_CORNERS) {
      const geom = CANONICAL_CIRCUITS.find((c) => c.round === cornerSet.round);
      if (!geom || cornerSet.corners.length === 0) continue;

      const refXs = geom.points.map((p) => p.x);
      const refYs = geom.points.map((p) => p.y);
      const minX = Math.min(...refXs);
      const maxX = Math.max(...refXs);
      const minY = Math.min(...refYs);
      const maxY = Math.max(...refYs);
      const w = maxX - minX;
      const h = maxY - minY;
      const maxDim = Math.max(w, h, 1);
      const padding = maxDim * 0.1;
      const viewBox = {
        x: minX - padding,
        y: minY - padding,
        width: w + padding * 2,
        height: h + padding * 2,
      };

      const trackWidth = Math.max(12, maxDim * 0.015);
      const badgeRadius = maxDim * 0.024;

      const placed = computeCornerLayout({
        corners: cornerSet.corners,
        sample: (d) => sampleCircuitPosition(geom, d),
        trackPoints: geom.points,
        viewBox,
        trackWidth,
        badgeRadius,
      });

      expect(placed).toHaveLength(cornerSet.corners.length);

      // Verify no overlaps
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const dist = Math.hypot(placed[i].x - placed[j].x, placed[i].y - placed[j].y);
          expect(dist).toBeGreaterThanOrEqual(2 * badgeRadius);
        }
      }

      // Verify track clearance
      const trackRadius = trackWidth / 2;
      for (const p of placed) {
        let minD = Infinity;
        for (let k = 0; k < geom.points.length; k++) {
          const p1 = geom.points[k];
          const p2 = geom.points[(k + 1) % geom.points.length];
          const d = distToSegment(p.x, p.y, p1.x, p1.y, p2.x, p2.y);
          if (d < minD) minD = d;
        }
        expect(minD).toBeGreaterThanOrEqual(badgeRadius + trackRadius);
      }
    }
  });
});
