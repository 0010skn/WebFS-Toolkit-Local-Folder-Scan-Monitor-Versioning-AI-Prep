/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : undefined,
  },
};

export default nextConfig;
