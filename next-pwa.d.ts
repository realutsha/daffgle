declare module "next-pwa" {
  import type { NextConfig } from "next";
  
  function withPWA(config: any): (nextConfig: NextConfig) => NextConfig;
  export default withPWA;
}
