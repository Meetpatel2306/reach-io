import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata = {
  title: "Terms of Service — Email Blaster Pro",
  description: "Terms governing the use of Email Blaster Pro",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-violet-300 hover:border-violet-500/30 transition-all">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <FileText size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Terms of Service</h1>
            <p className="text-xs text-slate-500">Last updated: April 26, 2026</p>
          </div>
        </div>
      </div>

      <div className="glass-card !border-amber-500/20">
        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Acceptance of Terms</h2>
            <p>
              By using Email Blaster Pro (&quot;the service&quot;), you agree to these Terms of Service.
              If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Description of Service</h2>
            <p>
              Email Blaster Pro is a tool that lets you send bulk emails from your own email account
              (via SMTP or Gmail OAuth). The service does not provide its own email infrastructure —
              it uses credentials or OAuth tokens you provide.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. Acceptable Use</h2>
            <p>You agree to use the service only for lawful purposes. You will not:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-slate-400 mt-2">
              <li>Send unsolicited bulk email (spam) in violation of CAN-SPAM, GDPR, or other applicable laws</li>
              <li>Send phishing, fraudulent, harassing, or malicious content</li>
              <li>Impersonate another person or entity</li>
              <li>Send emails without the recipient&apos;s consent where consent is required</li>
              <li>Attempt to circumvent rate limits or other technical safeguards</li>
              <li>Use the service to violate any third party&apos;s rights, including privacy and intellectual property</li>
              <li>Reverse engineer, decompile, or attempt to extract source code beyond what is publicly available</li>
            </ul>
            <p className="mt-3">Violation may result in immediate account termination.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. User Account</h2>
            <p>
              You are responsible for keeping your password secure and for all activity under your account.
              Notify us immediately of any unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. Email Sending Limits</h2>
            <p>
              When using SMTP or Gmail OAuth, your email provider&apos;s rate limits apply (e.g., Gmail allows
              ~500 emails/day for personal accounts). The app does not impose its own limits but recommends
              delays between sends to avoid spam-filter triggers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">6. Intellectual Property</h2>
            <p>
              The app&apos;s code, design, and branding are the property of the developers.
              Content you create (email subjects, bodies, recipient lists) remains your property.
              You retain all rights to your content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">7. Privacy</h2>
            <p>
              Your use of the service is also governed by our{" "}
              <Link href="/privacy" className="text-violet-400 hover:text-violet-300 underline">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">8. Disclaimers</h2>
            <p className="uppercase text-xs text-slate-400">
              The service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind,
              either express or implied. We do not guarantee that emails will be delivered, that the service
              will be uninterrupted, or that it will be error-free.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, the developers shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, or any loss of profits or revenues,
              whether incurred directly or indirectly, arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">10. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time for violations of these
              Terms. You may delete your account at any time by contacting the admin.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">11. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the service after changes constitutes
              acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">12. Governing Law</h2>
            <p>
              These Terms are governed by the laws of India. Any disputes will be resolved in the courts of
              Ahmedabad, Gujarat, India.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">13. Contact</h2>
            <p>
              Questions about these Terms? Contact:{" "}
              <a href="mailto:meetpatel4384@gmail.com" className="text-violet-400 hover:text-violet-300 underline">meetpatel4384@gmail.com</a>
            </p>
          </section>
        </div>
      </div>

      <div className="text-center mt-6">
        <Link href="/privacy" className="text-xs text-slate-500 hover:text-violet-300">View Privacy Policy →</Link>
      </div>
    </div>
  );
}
