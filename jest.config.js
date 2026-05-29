/**
 * Jest config for pure-logic unit tests that run on Node (Windows-friendly).
 *
 * These tests deliberately avoid React Native / Expo native modules so they
 * can run anywhere without a device or simulator. Modules that touch
 * expo-sqlite or native APIs are kept behind interfaces and tested with
 * in-memory fakes.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Dedicated tsconfig keeps pure-logic tests loose and sets an explicit
        // rootDir (required by TypeScript 6 / ts-jest).
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
};
