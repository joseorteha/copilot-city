import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-config-prettier";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: directory });

const eslintConfig = [
  {
    ignores: ["**/.next*/**", "out/**", "build/**", "coverage/**", ".artifacts/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Formatting belongs to Prettier; ESLint keeps the correctness rules.
  prettier,
];

export default eslintConfig;
