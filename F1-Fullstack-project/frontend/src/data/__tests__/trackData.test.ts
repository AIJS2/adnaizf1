import { describe, it, expect } from 'vitest';
import { getTrackMap, trackMaps, type TrackMapLookup } from '../trackData';

// Factory pattern for creating test race data
const getMockRaceInfo = (overrides: Partial<TrackMapLookup> = {}): TrackMapLookup => {
  return {
    location: '',
    country: '',
    name: '',
    ...overrides,
  };
};

describe('getTrackMap Data Utility', () => {
  describe('Happy Paths - Exact Matches', () => {
    it('returns the correct track map when location matches exactly', () => {
      const raceInfo = getMockRaceInfo({ location: 'Abu Dhabi' });
      expect(getTrackMap(raceInfo)).toBe(trackMaps['Abu Dhabi']);
    });

    it('returns the correct track map when country matches exactly', () => {
      const raceInfo = getMockRaceInfo({ country: 'Japan' });
      expect(getTrackMap(raceInfo)).toBe(trackMaps['Japan']);
    });

    it('returns the correct track map when race name matches exactly', () => {
      const raceInfo = getMockRaceInfo({ name: 'Australian Grand Prix' });
      expect(getTrackMap(raceInfo)).toBe(trackMaps['Australian Grand Prix']);
    });
  });

  describe('Happy Paths - Fuzzy Matches', () => {
    it('returns the correct track map when location contains a known key', () => {
      const raceInfo = getMockRaceInfo({ location: 'City of Melbourne' });
      expect(getTrackMap(raceInfo)).toBe(trackMaps['Melbourne']);
    });

    it('returns the correct track map when name contains a known key', () => {
      const raceInfo = getMockRaceInfo({ name: 'Formula 1 Grand Prix de Monaco 2024' });
      expect(getTrackMap(raceInfo)).toBe(trackMaps['Monaco']);
    });

    it('ignores fuzzy matches that are 3 characters or shorter', () => {
      // UAE is 3 chars. "UAE" in trackMaps maps to Abu Dhabi.
      // If we pass "Location UAE XYZ", does it match? 
      // The logic says `kLower.length > 3`, so "uae" length is 3, it should skip fuzzy matching for "uae".
      const raceInfo = getMockRaceInfo({ location: 'Location UAE XYZ' });
      // It shouldn't match "UAE" via fuzzy match because length is 3. 
      // It shouldn't match anything else either.
      expect(getTrackMap(raceInfo)).toBeNull();
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('returns null when raceInfo is null or undefined', () => {
      expect(getTrackMap(null)).toBeNull();
      expect(getTrackMap(undefined)).toBeNull();
    });

    it('returns null when raceInfo is an empty object', () => {
      const raceInfo = {};
      expect(getTrackMap(raceInfo)).toBeNull();
    });

    it('handles missing properties gracefully without throwing errors', () => {
      const raceInfo = { location: 'Unknown Place' };
      // Does not have country or name
      expect(() => getTrackMap(raceInfo)).not.toThrow();
      expect(getTrackMap(raceInfo)).toBeNull();
    });

    it('returns null when no matching track is found', () => {
      const raceInfo = getMockRaceInfo({ location: 'Mars', country: 'Space', name: 'Galactic Grand Prix' });
      expect(getTrackMap(raceInfo)).toBeNull();
    });

    it('returns null safely with falsy property values', () => {
      const safeRaceInfo: TrackMapLookup = { location: '', country: undefined, name: '' };
      expect(getTrackMap(safeRaceInfo)).toBeNull();
    });
  });
});
