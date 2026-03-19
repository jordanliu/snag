import { globalIgnores } from "eslint/config";
import { config } from "@repo/eslint-config/react-internal";

export default [
  ...config,
  globalIgnores([".output/**", ".wxt/**"]),
];
