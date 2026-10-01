import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Test mocks here model partial shapes of Supabase's chained query
    // builder (`.from().update().eq().eq().select()`, etc.) — typing each
    // link in that chain precisely isn't worth the upkeep for a mock, so
    // `any` is allowed here but nowhere else. `_`-prefixed params are this
    // codebase's established "intentionally unused" convention (e.g. a
    // mocked `.eq(_col, value)` that only cares about `value`).
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
]);

export default eslintConfig;
