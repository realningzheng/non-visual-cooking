module.exports = {
  preset: "ts-jest/presets/default-esm", // This preset is for ES Modules
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"], // Treat .ts files as ESM
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true }] // Enable ESM for ts-jest
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1" // Map .js imports to .ts imports
  },
  globals: {
    "ts-jest": {
      useESM: true, // Enable ESM processing
    }
  }
};
