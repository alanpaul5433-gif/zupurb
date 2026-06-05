/**
 * Smoke + behaviour test for the Reviews dashboard page.
 *
 * Firebase and the auth context are mocked so the page renders in jsdom with no
 * network. With an empty establishment list the data effects short-circuit, so
 * the render is deterministic — we assert the static chrome and the tab chips
 * (whose counts come from the real `reviewCounts` logic) are present.
 */
import { render, screen } from '@testing-library/react';
import ReviewsPage from '@/app/dashboard/reviews/page';

// --- module mocks (factories so the real firebase ESM never loads) ----------

jest.mock('@/lib/firebase', () => ({ db: {}, app: {} }));

jest.mock('@/lib/owner-auth-context', () => ({
  useOwnerAuth: () => ({ establishmentIds: [], owner: null, loading: false }),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(() => () => {}),
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(() => jest.fn()),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
}));

// recharts pulls in heavy ESM + zero-size container warnings in jsdom — stub it.
jest.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Stub,
    LineChart: Stub,
    Line: Stub,
    XAxis: Stub,
    YAxis: Stub,
    CartesianGrid: Stub,
    Tooltip: Stub,
  };
});

describe('ReviewsPage', () => {
  it('renders the page heading', () => {
    render(<ReviewsPage />);
    expect(screen.getByRole('heading', { name: 'Reviews' })).toBeInTheDocument();
  });

  it('renders all four filter tabs with zero counts when there are no reviews', () => {
    render(<ReviewsPage />);
    for (const label of ['All', 'Positive', 'Negative', 'Responded']) {
      expect(screen.getByRole('button', { name: new RegExp(`${label}\\s*\\(0\\)`) }))
        .toBeInTheDocument();
    }
  });
});
