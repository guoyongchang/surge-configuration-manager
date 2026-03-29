// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      boundaries,
    },
    settings: {
      "boundaries/elements": [
        { type: "pages", pattern: "src/pages/**/*" },
        { type: "components", pattern: ["src/components/**/*", "!src/components/ui/**/*"] },
        { type: "ui-lib", pattern: "src/components/ui/**/*" },
        { type: "service", pattern: "src/lib/**/*" },
        { type: "types", pattern: "src/types/**/*" },
      ],
      "boundaries/ignore": ["**/*.test.*", "**/*.spec.*", "src/test/**/*"],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: ["pages"], allow: ["components", "ui-lib", "service", "types"] },
            { from: ["components"], allow: ["ui-lib", "service", "types"] },
            { from: ["ui-lib"], allow: ["ui-lib"] },
            { from: ["service"], allow: ["types"] },
            { from: ["types"], allow: [] },
          ],
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@tauri-apps/api/core",
              message: "Do not import from @tauri-apps/api/core directly. Use src/lib/api.ts instead.",
            },
          ],
          patterns: [
            {
              group: ["@tauri-apps/plugin-*"],
              message: "Do not import Tauri plugins directly. Wrap them in src/lib/api.ts.",
            },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Service layer is allowed to import @tauri-apps directly
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // shadcn generated files: exempt from all boundaries
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "boundaries/element-types": "off",
      "no-restricted-imports": "off",
    },
  },
  {
    // Test files: exempt from boundaries and import restrictions
    files: ["src/**/*.test.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    rules: {
      "boundaries/element-types": "off",
      "no-restricted-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Root-level app files (main.tsx, App.tsx, i18n.ts, vite-env.d.ts) — not in any layer, so boundaries don't apply
    files: ["src/*.{ts,tsx}"],
    rules: {
      "boundaries/element-types": "off",
    },
  }
);
