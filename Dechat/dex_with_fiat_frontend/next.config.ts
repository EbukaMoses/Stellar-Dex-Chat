import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  // `disableLogger` is deprecated in @sentry/nextjs v10; use the
  // webpack.treeshake option instead (#1490).
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
