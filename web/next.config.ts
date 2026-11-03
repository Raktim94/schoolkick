import type { NextConfig } from 'next';
// The build script runs tsc --noEmit first; this avoids Next 16's redundant
// --showConfig subprocess while keeping app and Vite code typechecked.
const config: NextConfig = { output: 'export', distDir: 'next-build', images: { unoptimized: true }, trailingSlash: true, typescript: { ignoreBuildErrors: true } };
export default config;
