import '@testing-library/jest-dom';
import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom does not implement browser scrolling APIs used by navigation effects.
window.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

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

