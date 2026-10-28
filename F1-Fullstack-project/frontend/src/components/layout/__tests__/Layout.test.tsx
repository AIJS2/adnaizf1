import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Layout from '../Layout';

describe('Layout component page transitions', () => {
  it('renders outlet and smoothly transitions between pages on route change', async () => {
    const router = createMemoryRouter(
      [
        {
          element: <Layout />,
          children: [
            { path: '/', element: <div>Home Page Content</div> },
            { path: '/dashboard', element: <div>Dashboard Page Content</div> },
            { path: '/stats', element: <div>Stats Page Content</div> },
          ],
        },
      ],
      { initialEntries: ['/'] }
    );

    render(<RouterProvider router={router} />);

    // Initial page renders
    expect(screen.getByText('Home Page Content')).toBeInTheDocument();

    // Navigate to dashboard
    await router.navigate('/dashboard');

    await waitFor(() => {
      expect(screen.getByText('Dashboard Page Content')).toBeInTheDocument();
    });

    // Navigate to stats
    await router.navigate('/stats');

    await waitFor(() => {
      expect(screen.getByText('Stats Page Content')).toBeInTheDocument();
    });
  });

  it('provides a Skip to Content link for accessibility', () => {
    const router = createMemoryRouter(
      [
        {
          element: <Layout />,
          children: [{ path: '/', element: <div>Page</div> }],
        },
      ],
      { initialEntries: ['/'] }
    );

    render(<RouterProvider router={router} />);

    const skipLink = screen.getByRole('link', { name: /skip to content/i });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });
});
