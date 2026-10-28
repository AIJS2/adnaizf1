import '@testing-library/jest-dom';
import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Recharts ResponsiveContainer needs dimension mock in jsdom
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children, ...props }) =>
      React.createElement(
        'div',
        { 'data-testid': 'responsive-container', style: { width: 800, height: 400 }, ...props },
        children
      ),
  };
});


