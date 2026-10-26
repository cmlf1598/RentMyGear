import type { NextConfig } from "next";

const bucket = process.env.GCS_BUCKET_NAME;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // AI-generated images persisted by storageService.
      { protocol: "https", hostname: "storage.googleapis.com", pathname: bucket ? `/${bucket}/**` : "/**" },
    ],
  },
};

export default nextConfig;
