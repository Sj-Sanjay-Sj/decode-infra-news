import path from "node:path";
import type { NextConfig } from "next";
const config: NextConfig = {
  output: "export",
  outputFileTracingRoot: path.resolve(process.cwd()),
};
export default config;
