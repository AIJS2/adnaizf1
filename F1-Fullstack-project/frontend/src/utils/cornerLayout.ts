/**
 * Pure cartographic badge placement algorithm for circuit turn numbers.
 *
 * Eliminates overlapping badges and track-ribbon occlusions on complex layouts
 * (such as Mexico's stadium chicane T13-T16, Monaco's swimming pool T13-T16,
 * and Jeddah's high-density 27-corner sequence) by evaluating multi-tier
 * radial distances and angular candidate slots with coordinate descent.
 */

export interface CornerItem {
  number: number;
  letter?: string;
  d: number;
}

export interface CornerLayoutInput {
  corners: CornerItem[];
  sample: (d: number) => { x: number; y: number };
  trackPoints: Array<{ x: number; y: number }>;
  viewBox: { x: number; y: number; width: number; height: number };
  trackWidth: number;
  badgeRadius?: number;
  minClearance?: number;
}

export interface PlacedCornerBadge {
  number: number;
  letter?: string;
  d: number;
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  leaderEndX: number;
  leaderEndY: number;
  radius: number;
}

export function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function segmentsIntersect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): boolean {
  function ccw(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
    return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
  }
  return (
    ccw(x1, y1, x3, y3, x4, y4) !== ccw(x2, y2, x3, y3, x4, y4) &&
    ccw(x1, y1, x2, y2, x3, y3) !== ccw(x1, y1, x2, y2, x4, y4)
  );
}

interface CandidateSlot {
  x: number;
  y: number;
  dist: number;
  aOff: number;
  theta: number;
  isInward: boolean;
  baseCost: number;
}

interface CornerData extends CornerItem {
  anchorX: number;
  anchorY: number;
  outAngle: number;
  nx: number;
  ny: number;
}

export function computeCornerLayout(options: CornerLayoutInput): PlacedCornerBadge[] {
  const {
    corners,
    sample,
    trackPoints,
    viewBox,
    trackWidth,
    badgeRadius: explicitRadius,
    minClearance: explicitClearance,
  } = options;

  if (!corners || corners.length === 0) return [];

  const span = Math.max(viewBox.width, viewBox.height, 1);
  const badgeRadius = explicitRadius ?? span * 0.026;
  const trackRadius = trackWidth / 2;
  const minClearance =
    explicitClearance ?? badgeRadius + trackRadius + Math.max(2, span * 0.005);

  const M = trackPoints.length;
  if (M === 0) return [];

  // Compute track centroid
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < M; i++) {
    cx += trackPoints[i].x;
    cy += trackPoints[i].y;
  }
  cx /= M;
  cy /= M;

  function minDistanceToTrack(x: number, y: number): number {
    let minD = Infinity;
    for (let i = 0; i < M; i++) {
      const p1 = trackPoints[i];
      const p2 = trackPoints[(i + 1) % M];
      const d = distToSegment(x, y, p1.x, p1.y, p2.x, p2.y);
      if (d < minD) minD = d;
    }
    return minD;
  }

  // Pre-calculate corner anchors and outward normals
  const delta = 0.004;
  const cornerData: CornerData[] = corners.map((c) => {
    const pt = sample(c.d);
    const before = sample((c.d - delta + 1) % 1);
    const after = sample((c.d + delta) % 1);
    let tx = after.x - before.x;
    let ty = after.y - before.y;
    const tLen = Math.hypot(tx, ty) || 1;
    tx /= tLen;
    ty /= tLen;
    let nx = -ty;
    let ny = tx;
    if ((pt.x - cx) * nx + (pt.y - cy) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const outAngle = Math.atan2(ny, nx);
    return {
      ...c,
      anchorX: pt.x,
      anchorY: pt.y,
      outAngle,
      nx,
      ny,
    };
  });

  // Staggered distance tiers (compact to keep badges close to the apex without long gaps)
  const distances = [
    minClearance + span * 0.002,
    minClearance + badgeRadius * 0.8,
    minClearance + badgeRadius * 1.6,
    minClearance + badgeRadius * 2.5,
  ];

  // Radial fan-out offsets, plus inward fallback for dense chicanes
  const angleOffsets = [
    0,
    (20 * Math.PI) / 180,
    (-20 * Math.PI) / 180,
    (42 * Math.PI) / 180,
    (-42 * Math.PI) / 180,
    (68 * Math.PI) / 180,
    (-68 * Math.PI) / 180,
    (90 * Math.PI) / 180,
    (-90 * Math.PI) / 180,
    Math.PI,
    Math.PI + (25 * Math.PI) / 180,
    Math.PI - (25 * Math.PI) / 180,
  ];

  const candidatesPerCorner: CandidateSlot[][] = cornerData.map((c) => {
    const candidates: CandidateSlot[] = [];
    for (const dist of distances) {
      for (const aOff of angleOffsets) {
        const theta = c.outAngle + aOff;
        const x = c.anchorX + Math.cos(theta) * dist;
        const y = c.anchorY + Math.sin(theta) * dist;

        // ViewBox safety bounds
        if (
          x - badgeRadius < viewBox.x ||
          x + badgeRadius > viewBox.x + viewBox.width ||
          y - badgeRadius < viewBox.y ||
          y + badgeRadius > viewBox.y + viewBox.height
        ) {
          continue;
        }

        // Track clearance guarantee
        const dTrack = minDistanceToTrack(x, y);
        if (dTrack < minClearance) {
          continue;
        }

        const isInward = Math.abs(aOff) > Math.PI / 2;
        const baseCost =
          (dist / minClearance) * 16 +
          Math.abs(aOff) * 12 +
          (isInward ? 35 : 0);
        candidates.push({ x, y, dist, aOff, theta, isInward, baseCost });
      }
    }

    if (candidates.length === 0) {
      candidates.push({
        x: c.anchorX + c.nx * (minClearance + 2),
        y: c.anchorY + c.ny * (minClearance + 2),
        dist: minClearance + 2,
        aOff: 0,
        theta: c.outAngle,
        isInward: false,
        baseCost: 200,
      });
    }

    candidates.sort((a, b) => a.baseCost - b.baseCost);
    return candidates;
  });

  const N = cornerData.length;
  const currentSlots = new Array<number>(N).fill(0);
  const minBadgeDist = 2 * badgeRadius + Math.max(2, span * 0.005);

  function evaluatePairCost(i: number, j: number, slotI: number, slotJ: number): number {
    const ci = cornerData[i];
    const cj = cornerData[j];
    const posI = candidatesPerCorner[i][slotI];
    const posJ = candidatesPerCorner[j][slotJ];

    let cost = 0;
    const distBadges = Math.hypot(posI.x - posJ.x, posI.y - posJ.y);

    if (distBadges < minBadgeDist) {
      const overlap = minBadgeDist - distBadges;
      cost += 1000000 + overlap * 100000;
    }

    if (
      segmentsIntersect(
        ci.anchorX,
        ci.anchorY,
        posI.x,
        posI.y,
        cj.anchorX,
        cj.anchorY,
        posJ.x,
        posJ.y,
      )
    ) {
      cost += 150000;
    }

    return cost;
  }

  function evaluateCornerCost(i: number, slotI: number, slots: number[]): number {
    let cost = candidatesPerCorner[i][slotI].baseCost;
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      cost += evaluatePairCost(i, j, slotI, slots[j]);
    }
    return cost;
  }

  // Initial greedy assignment
  for (let i = 0; i < N; i++) {
    let bestSlot = 0;
    let bestCost = Infinity;
    const cands = candidatesPerCorner[i];
    for (let s = 0; s < cands.length; s++) {
      let cost = cands[s].baseCost;
      for (let j = 0; j < i; j++) {
        cost += evaluatePairCost(i, j, s, currentSlots[j]);
      }
      if (cost < bestCost) {
        bestCost = cost;
        bestSlot = s;
      }
    }
    currentSlots[i] = bestSlot;
  }

  // Coordinate descent refinement (5 passes)
  for (let pass = 0; pass < 5; pass++) {
    let improved = false;
    for (let i = 0; i < N; i++) {
      let bestSlot = currentSlots[i];
      let bestCost = evaluateCornerCost(i, bestSlot, currentSlots);
      const cands = candidatesPerCorner[i];
      for (let s = 0; s < cands.length; s++) {
        if (s === currentSlots[i]) continue;
        const cost = evaluateCornerCost(i, s, currentSlots);
        if (cost < bestCost - 1e-4) {
          bestCost = cost;
          bestSlot = s;
          improved = true;
        }
      }
      currentSlots[i] = bestSlot;
    }
    if (!improved) break;
  }

  return cornerData.map((c, i) => {
    const slot = candidatesPerCorner[i][currentSlots[i]];
    const dx = slot.x - c.anchorX;
    const dy = slot.y - c.anchorY;
    const dist = Math.hypot(dx, dy) || 1;
    const leaderEndX = slot.x - (dx / dist) * badgeRadius;
    const leaderEndY = slot.y - (dy / dist) * badgeRadius;

    return {
      number: c.number,
      letter: c.letter,
      d: c.d,
      anchorX: c.anchorX,
      anchorY: c.anchorY,
      x: slot.x,
      y: slot.y,
      leaderEndX,
      leaderEndY,
      radius: badgeRadius,
    };
  });
}
