/** @type {import("next").NextConfig} */
const nextConfig = {
  // Activé uniquement lors du build Docker (NEXT_BUILD_STANDALONE=true)
  ...(process.env.NEXT_BUILD_STANDALONE === 'true' && { output: 'standalone' }),
  transpilePackages: [
    '@fullcalendar/core',
    '@fullcalendar/react',
    '@fullcalendar/daygrid',
    '@fullcalendar/timegrid',
    '@fullcalendar/list',
    '@fullcalendar/interaction',
    '@fullcalendar/rrule',
  ],
}
export default nextConfig
