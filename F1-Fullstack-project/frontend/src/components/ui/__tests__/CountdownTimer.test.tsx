import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import CountdownTimer from '../CountdownTimer';
import React from 'react';

const getMockCountdownTimerProps = (overrides?: any) => ({
  targetDate: new Date('2030-01-01T12:00:00Z').toISOString(),
  ...overrides,
});

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render component with default props', () => {
      const props = getMockCountdownTimerProps();
      render(<CountdownTimer {...props} />);
      
      expect(screen.getByText('02')).toBeTruthy();
      expect(screen.getAllByText('00').length).toBe(3);
    });

    it('should render "RACE IS LIVE!" when target date is reached', () => {
      const props = getMockCountdownTimerProps({ targetDate: new Date('2029-12-31T10:00:00Z').toISOString() });
      render(<CountdownTimer {...props} />);
      
      expect(screen.getByText('RACE IS LIVE!')).toBeTruthy();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty data gracefully', () => {
      const props = getMockCountdownTimerProps({ targetDate: '' });
      render(<CountdownTimer {...props} />);
      
      expect(screen.getByText('RACE IS LIVE!')).toBeTruthy();
    });

    it('should handle invalid date gracefully', () => {
      const props = getMockCountdownTimerProps({ targetDate: 'invalid-date' });
      render(<CountdownTimer {...props} />);
      
      expect(screen.getByText('RACE IS LIVE!')).toBeTruthy();
    });
  });

  describe('User interactions & Timer behavior', () => {
    it('should update countdown every second', () => {
      const props = getMockCountdownTimerProps({ targetDate: new Date('2030-01-01T10:00:10Z').toISOString() });
      render(<CountdownTimer {...props} />);
      
      expect(screen.getByText('10')).toBeTruthy();
      
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      expect(screen.getByText('09')).toBeTruthy();
    });
  });
});
