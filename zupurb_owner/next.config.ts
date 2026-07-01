import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The owner portal is a 100% client-rendered SPA (Firebase Auth + Firestore
  // rules enforce access), so it ships as static files — no Node/SSR runtime.
  // `next build` emits ./out for Firebase Hosting (deploy target: owner).
  output: "export",
  trailingSlash: true, // clean static routing + correct deep-link files on Firebase
  images: { unoptimized: true }, // static export has no Image Optimization server
};

export default nextConfig;
