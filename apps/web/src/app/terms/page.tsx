import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service | Sterling',
  description: 'Sterling Terms of Service - Terms and conditions for using our service.',
}

export default function TermsOfService() {
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
          <h1 className="text-4xl font-bold">Terms of Service</h1>
          <p className="mt-2 text-muted-foreground">Last updated: January 2026</p>

          <div className="mt-8 prose prose-slate dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using Sterling (&quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the Service.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We may modify these Terms at any time. Your continued use of the Service after changes constitutes acceptance of the modified Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                Sterling is a personal finance management application that allows you to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>Connect your financial accounts through Plaid</li>
                <li>View and categorize transactions</li>
                <li>Set and track budgets</li>
                <li>Receive AI-powered financial insights</li>
                <li>Analyze spending patterns</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                The Service is provided for personal, non-commercial use only.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">3. Account Registration</h2>
              <p className="text-muted-foreground leading-relaxed">
                To use the Service, you must:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>Be at least 18 years of age</li>
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Accept responsibility for all activities under your account</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">4. Financial Data and Third-Party Services</h2>

              <h3 className="text-xl font-medium mt-6 mb-3">4.1 Plaid Integration</h3>
              <p className="text-muted-foreground leading-relaxed">
                Sterling uses Plaid to connect to your financial accounts. By using this feature, you:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>Authorize Plaid to access your financial account information</li>
                <li>Agree to Plaid&apos;s End User Privacy Policy</li>
                <li>Acknowledge that we receive read-only access to your account data</li>
                <li>Understand that we never store your bank login credentials</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">4.2 Data Accuracy</h3>
              <p className="text-muted-foreground leading-relaxed">
                We strive to display accurate financial information, but we do not guarantee the accuracy, completeness, or timeliness of data received from financial institutions. You should verify important financial information directly with your financial institutions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">5. Subscription and Payments</h2>

              <h3 className="text-xl font-medium mt-6 mb-3">5.1 Free and Premium Plans</h3>
              <p className="text-muted-foreground leading-relaxed">
                Sterling offers both free and premium subscription plans. Premium features require a paid subscription.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">5.2 Billing</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Subscriptions are billed in advance on a monthly or annual basis</li>
                <li>Payments are processed through Stripe</li>
                <li>Prices are subject to change with notice</li>
                <li>You are responsible for all applicable taxes</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">5.3 Cancellation and Refunds</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>You may cancel your subscription at any time</li>
                <li>Cancellation takes effect at the end of the current billing period</li>
                <li>No refunds are provided for partial billing periods</li>
                <li>We may offer refunds at our discretion</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">6. Acceptable Use</h2>
              <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>Use the Service for any unlawful purpose</li>
                <li>Attempt to gain unauthorized access to any systems</li>
                <li>Interfere with or disrupt the Service</li>
                <li>Upload malicious code or content</li>
                <li>Impersonate others or provide false information</li>
                <li>Use the Service for commercial purposes without authorization</li>
                <li>Scrape, copy, or redistribute content from the Service</li>
                <li>Use automated systems to access the Service without permission</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">7. AI Features Disclaimer</h2>
              <p className="text-muted-foreground leading-relaxed">
                Sterling uses artificial intelligence to provide financial insights and recommendations. You acknowledge that:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>AI-generated content is for informational purposes only</li>
                <li>AI insights do not constitute financial, investment, tax, or legal advice</li>
                <li>You should consult qualified professionals for financial decisions</li>
                <li>AI recommendations may not account for your complete financial situation</li>
                <li>We do not guarantee the accuracy of AI-generated content</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">8. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                The Service, including all content, features, and functionality, is owned by Sterling and protected by intellectual property laws. You may not:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>Copy, modify, or distribute our content without permission</li>
                <li>Use our trademarks without authorization</li>
                <li>Reverse engineer or decompile the Service</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                You retain ownership of your financial data. By using the Service, you grant us a license to use your data to provide and improve the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">9. Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your use of the Service is subject to our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, which describes how we collect, use, and protect your information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">10. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground leading-relaxed">
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES INCLUDING:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE</li>
                <li>ACCURACY, RELIABILITY, OR COMPLETENESS OF CONTENT</li>
                <li>UNINTERRUPTED OR ERROR-FREE OPERATION</li>
                <li>SECURITY OF YOUR DATA</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">11. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, STERLING SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>LOSS OF PROFITS, DATA, OR GOODWILL</li>
                <li>SERVICE INTERRUPTION OR COMPUTER DAMAGE</li>
                <li>COST OF SUBSTITUTE SERVICES</li>
                <li>ANY DAMAGES EXCEEDING THE AMOUNT PAID BY YOU IN THE PAST 12 MONTHS</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">12. Indemnification</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to indemnify and hold harmless Sterling and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses arising from:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>Your use of the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any third-party rights</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">13. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may suspend or terminate your access to the Service at any time for any reason, including violation of these Terms. Upon termination:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>Your right to use the Service immediately ceases</li>
                <li>We may delete your account and data per our retention policy</li>
                <li>Provisions that should survive termination will remain in effect</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">14. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms are governed by the laws of the State of California, without regard to conflict of law principles. Any disputes shall be resolved in the courts of California.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">15. Dispute Resolution</h2>
              <p className="text-muted-foreground leading-relaxed">
                Before filing a claim, you agree to attempt to resolve disputes informally by contacting us at <a href="mailto:legal@joinsterling.com" className="text-primary hover:underline">legal@joinsterling.com</a>. If informal resolution fails, disputes may be resolved through binding arbitration.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">16. General Provisions</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong>Entire Agreement:</strong> These Terms constitute the entire agreement between you and Sterling.</li>
                <li><strong>Severability:</strong> If any provision is found unenforceable, the remaining provisions remain in effect.</li>
                <li><strong>Waiver:</strong> Failure to enforce any right does not constitute a waiver.</li>
                <li><strong>Assignment:</strong> You may not assign these Terms without our consent.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mt-8 mb-4">17. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                For questions about these Terms, please contact us:
              </p>
              <ul className="list-none space-y-2 text-muted-foreground mt-4">
                <li><strong>Email:</strong> <a href="mailto:legal@joinsterling.com" className="text-primary hover:underline">legal@joinsterling.com</a></li>
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
