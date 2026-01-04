import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy | Sterling',
  description: 'Sterling Privacy Policy - How we collect, use, and protect your data.',
}

export default function PrivacyPolicy() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <Link href="/" className="flex items-center">
              <span className="text-3xl font-semibold text-slate-800 dark:text-white font-[family-name:var(--font-serif)]">
                Sterling
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 py-12">
        <div className="mx-auto max-w-4xl px-4">
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
          <p className="mt-2 text-muted-foreground">Last updated: January 2026</p>

          <div className="mt-8 prose prose-slate dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Sterling (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our personal finance application and related services (collectively, the &quot;Service&quot;).
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                By using Sterling, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">2. Information We Collect</h2>

              <h3 className="text-xl font-medium mt-6 mb-3">2.1 Information You Provide</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong>Account Information:</strong> Email address, password (encrypted), and profile details</li>
                <li><strong>Financial Connections:</strong> When you connect your bank accounts through Plaid, we receive account names, balances, and transaction history</li>
                <li><strong>User Content:</strong> Budgets, categories, notes, and preferences you create</li>
                <li><strong>Communications:</strong> Messages you send to our support team or through the AI chat feature</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">2.2 Information Collected Automatically</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong>Usage Data:</strong> How you interact with our Service, features used, and time spent</li>
                <li><strong>Device Information:</strong> Device type, operating system, browser type, and IP address</li>
                <li><strong>Log Data:</strong> Access times, pages viewed, and error logs</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">2.3 Information from Third Parties</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong>Plaid:</strong> Financial account information including account details, balances, and transactions</li>
                <li><strong>Payment Processors:</strong> Subscription and billing information from Stripe (we do not store full payment card numbers)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">3. How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed">We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>Provide, maintain, and improve our Service</li>
                <li>Display your financial accounts, transactions, and balances</li>
                <li>Generate personalized insights, budgets, and recommendations using AI</li>
                <li>Process your subscription and payments</li>
                <li>Send you service-related communications</li>
                <li>Detect and prevent fraud and unauthorized access</li>
                <li>Comply with legal obligations</li>
                <li>Analyze usage patterns to improve user experience</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">4. How We Share Your Information</h2>
              <p className="text-muted-foreground leading-relaxed">We do not sell your personal information. We may share your information with:</p>

              <h3 className="text-xl font-medium mt-6 mb-3">4.1 Service Providers</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong>Plaid:</strong> To connect and retrieve your financial account data</li>
                <li><strong>Stripe:</strong> To process subscription payments</li>
                <li><strong>Supabase:</strong> For database hosting and authentication</li>
                <li><strong>Anthropic:</strong> To provide AI-powered insights (anonymized data only)</li>
                <li><strong>Cloud Providers:</strong> For infrastructure and hosting services</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">4.2 Legal Requirements</h3>
              <p className="text-muted-foreground leading-relaxed">
                We may disclose your information if required by law, court order, or government request, or to protect our rights, property, or safety.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">4.3 Business Transfers</h3>
              <p className="text-muted-foreground leading-relaxed">
                In connection with a merger, acquisition, or sale of assets, your information may be transferred. We will notify you of any such change.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">5. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">We implement industry-standard security measures to protect your data:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li><strong>Encryption:</strong> All data is encrypted in transit (TLS 1.2+) and at rest (AES-256)</li>
                <li><strong>Access Controls:</strong> Strict role-based access to systems and data</li>
                <li><strong>Secure Authentication:</strong> Passwords are hashed; optional multi-factor authentication available</li>
                <li><strong>No Credential Storage:</strong> We never store your bank login credentials; Plaid handles authentication securely</li>
                <li><strong>Regular Audits:</strong> We conduct regular security assessments and monitoring</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">6. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">We retain your data as follows:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li><strong>Account Data:</strong> Retained while your account is active, plus 30 days after deletion</li>
                <li><strong>Transaction History:</strong> Retained for 7 years to comply with financial regulations</li>
                <li><strong>Usage Logs:</strong> Retained for 1-2 years for security and analytics</li>
                <li><strong>Backups:</strong> Retained for up to 90 days</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                You can request deletion of your data at any time (see Your Rights below).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">7. Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed">Depending on your location, you may have the following rights:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                <li><strong>Deletion:</strong> Request deletion of your personal data</li>
                <li><strong>Portability:</strong> Request your data in a portable format</li>
                <li><strong>Opt-Out:</strong> Opt out of marketing communications</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent for data processing where applicable</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                To exercise these rights, contact us at <a href="mailto:privacy@joinsterling.com" className="text-primary hover:underline">privacy@joinsterling.com</a> or through your account settings.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">8. California Privacy Rights (CCPA)</h2>
              <p className="text-muted-foreground leading-relaxed">If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>Right to know what personal information is collected and how it is used</li>
                <li>Right to delete personal information</li>
                <li>Right to opt-out of the sale of personal information (we do not sell your data)</li>
                <li>Right to non-discrimination for exercising your privacy rights</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">9. Third-Party Links</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our Service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">10. Children&apos;s Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Sterling is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">11. International Data Transfers</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">12. Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the &quot;Last updated&quot; date. Your continued use of the Service after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">13. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <ul className="list-none space-y-2 text-muted-foreground mt-4">
                <li><strong>Email:</strong> <a href="mailto:privacy@joinsterling.com" className="text-primary hover:underline">privacy@joinsterling.com</a></li>
                <li><strong>Website:</strong> <a href="https://joinsterling.com" className="text-primary hover:underline">https://joinsterling.com</a></li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
          <div className="flex justify-center gap-6 mb-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Sterling. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
