module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/infrastructure'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'infrastructure/lambda/**/*.ts',
    '!infrastructure/lambda/**/*.d.ts',
    '!infrastructure/lambda/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
