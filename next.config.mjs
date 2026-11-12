/** @type {import('next').NextConfig} */
const nextConfig = {
  // The site renders card art with plain <img> tags and never uses next/image, so the built-in image
  // optimizer is switched off and allows no remote hosts (several Next.js advisories target that endpoint).
  images: {
    unoptimized: true,
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
