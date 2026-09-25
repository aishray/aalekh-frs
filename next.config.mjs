/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdfjs optionally requires the native canvas module; it is not needed in the browser.
    config.resolve.alias.canvas = false;
    // Sample source documents are imported as plain strings.
    config.module.rules.push({ test: /\.txt$/, type: 'asset/source' });
    return config;
  },
};
export default nextConfig;
