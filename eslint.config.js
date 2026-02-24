// @ts-check

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintPluginAstro from "eslint-plugin-astro";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintPluginAstro.configs["flat/recommended"],
  // TODO: install eslint-plugin-jsx-a11y once it supports eslint 10
  // eslintPluginAstro.configs["flat/jsx-a11y-recommended"],
  { ignores: ["*.d.ts"] },
);
