const preset = require("jest-expo/jest-preset");

// better-auth and its ESM-only dependencies ship .mjs with no CJS build;
// reuse the preset's TS/JS transformer so Jest can convert them too.
const jsTransform = preset.transform["\\.[jt]sx?$"];

module.exports = {
  ...preset,
  setupFiles: [...(preset.setupFiles ?? []), "<rootDir>/jest.setup.js"],
  transform: {
    ...preset.transform,
    "^.+\\.mjs$": jsTransform,
  },
  transformIgnorePatterns: [
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/",
  ],
};
