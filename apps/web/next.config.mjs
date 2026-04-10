/** @type {import("next").NextConfig} */
const nextConfig = {
  // Activé uniquement lors du build Docker (NEXT_BUILD_STANDALONE=true)
  ...(process.env.NEXT_BUILD_STANDALONE === 'true' && { output: 'standalone' }),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  },
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
