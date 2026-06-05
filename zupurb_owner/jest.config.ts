import nextJest from 'next/jest';

// next/jest wires up SWC transforms, tsconfig path aliases (@/...), and CSS
// module stubs so tests run against the same compilation the app uses.
const createJestConfig = nextJest({ dir: './' });

const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Pure-logic + component tests live under __tests__.
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  // Mirror the tsconfig "@/*" path alias (next/jest doesn't import it here).
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};

export default createJestConfig(config);
