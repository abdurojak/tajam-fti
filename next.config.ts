import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "ssh2"],
  devIndicators: false,
};
export default config;
