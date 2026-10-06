import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory confuses root detection.
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
};

export default nextConfig;
