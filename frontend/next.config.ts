import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    const useExternalProxy = process.env.USE_EXTERNAL_API === "1" || process.env.USE_INTERNAL_API === "0";
    if (!useExternalProxy) {
      return [];
    }
    const monolith = process.env.API_BASE_URL || "http://localhost:8000";
    const market = process.env.MARKET_API_URL || monolith;
    const advisor = process.env.ADVISOR_API_URL || monolith;
    const settings = process.env.SETTINGS_API_URL || monolith;

    return [
      {
        source: "/api/market/:path*",
        destination: `${market}/api/market/:path*`,
      },
      {
        source: "/api/advisor/:path*",
        destination: `${advisor}/api/advisor/:path*`,
      },
      {
        source: "/api/settings/:path*",
        destination: `${settings}/api/settings/:path*`,
      },
      {
        source: "/api/ledger/:path*",
        destination: `${settings}/api/ledger/:path*`,
      },
      {
        source: "/api/health",
        destination: `${settings}/api/health`,
      },
      {
        source: "/api/:path*",
        destination: `${monolith}/api/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
