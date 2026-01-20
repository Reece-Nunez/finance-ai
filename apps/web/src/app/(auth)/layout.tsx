// Force dynamic rendering for all auth pages to prevent Supabase client
// initialization during static build (env vars not available at build time)
export const dynamic = 'force-dynamic'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
