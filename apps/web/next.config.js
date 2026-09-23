/** @type {import('next').NextConfig} */
/* eslint-disable no-undef, turbo/no-undeclared-env-vars */
const nextConfig = {
  // Keep production builds from replacing the route manifest used by `next dev`.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
};

export default nextConfig;
