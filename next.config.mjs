/** @type {import('next').NextConfig} */
const nextConfig = {
  //导出静态
  output: "export",
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
