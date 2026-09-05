import js from "@eslint/js";
import tseslint from "typescript-eslint";
import expoConfig from "eslint-config-expo/flat.js";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.expo/**",
      "**/expo-env.d.ts",
      "**/.claude/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/mobile/**/*.{ts,tsx}"],
    extends: [expoConfig],
  },
  {
    files: ["apps/mobile/*.config.js", "apps/mobile/jest.setup.js"],
    languageOptions: { globals: globals.node },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // jest.mock() factories may only reference `mock`-prefixed variables declared
    // before the module they mock is imported — that ordering trips import/first,
    // and a lazy require() inside a factory is the standard way to dodge a hoisting
    // cycle with the real module.
    files: ["apps/mobile/**/*.test.{ts,tsx}"],
    rules: {
      "import/first": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["apps/server/**/*.ts", "packages/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["packages/api/src/client/**/*.ts", "packages/api/src/types.ts"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [{ name: "zod", allowTypeImports: true }],
          patterns: [{ group: ["**/schemas.js"], allowTypeImports: true }],
        },
      ],
    },
  },
  prettierConfig,
);
