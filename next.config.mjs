import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the tracing root to this project (a stray parent lockfile can confuse Next).
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "img.simkl.in" },
    ],
  },
  // Keep the Node runtime: we use the filesystem (JSON store) and node crypto.
  serverExternalPackages: [],
};

export default nextConfig;
