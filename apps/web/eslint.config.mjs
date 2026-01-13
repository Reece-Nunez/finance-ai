import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Accessibility rules (WCAG 2.1 AA)
  // Note: jsx-a11y plugin is already included in eslint-config-next
  {
    rules: {
      // Allow Next.js Link component without nested anchor
      "jsx-a11y/anchor-is-valid": ["error", {
        components: ["Link"],
        specialLink: ["hrefLeft", "hrefRight"],
        aspects: ["invalidHref", "preferButton"],
      }],
      // Ensure all interactive elements are keyboard accessible
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      // Ensure images have alt text
      "jsx-a11y/alt-text": "error",
      // Ensure labels are associated with form controls
      "jsx-a11y/label-has-associated-control": "error",
      // Ensure heading levels are in order
      "jsx-a11y/heading-has-content": "error",
      // React Compiler rules - set to warn for now as they require significant refactoring
      // These are legitimate concerns but common patterns in existing React codebases
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
