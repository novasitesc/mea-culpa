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
    // Scripts utilitarios sueltos (CommonJS), fuera de la app:
    "update-spells.js",
  ]),
  {
    rules: {
      // Estilo establecido del repo: los accesos a filas de Supabase usan
      // `(row as any)` en todas partes. Se mantiene visible como warning
      // para migrarlo gradualmente a tipos, sin bloquear el lint.
      "@typescript-eslint/no-explicit-any": "warn",
      // Reglas nuevas del compilador de React (eslint-config-next 16):
      // avisos útiles, pero el código existente aún no las cumple.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
      // Textos en español con comillas/acentos dentro de JSX.
      "react/no-unescaped-entities": "off",
    },
  },
]);

export default eslintConfig;
