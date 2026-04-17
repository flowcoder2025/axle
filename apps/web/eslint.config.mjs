import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const relaxedReactRules = {
  // React 19 hook rules are strict; existing code predates them.
  // Downgrade to warn so CI passes while surfacing issues to developers.
  "react-hooks/static-components": "warn",
  "react-hooks/purity": "warn",
  "react-hooks/refs": "warn",
};

export default [
  ...nextCoreWebVitals,
  {
    rules: relaxedReactRules,
  },
  {
    ignores: [".next/**", "node_modules/**", "dist/**", "build/**", "__tests__/**"],
  },
];
