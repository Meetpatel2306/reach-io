import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Email Blaster Pro",
  description: "How Email Blaster Pro handles your data",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-violet-300 hover:border-violet-500/30 transition-all">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Shield size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Privacy Policy</h1>
            <p className="text-xs text-slate-500">Last updated: April 26, 2026</p>
          </div>
        </div>
      </div>

      <div className="glass-card !border-violet-500/20 prose prose-invert max-w-none">
        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Overview</h2>
            <p>
              Email Blaster Pro (&quot;we&quot;, &quot;the app&quot;) is a tool that helps you send bulk emails from your own email account.
              This Privacy Policy explains what information we collect, how we use it, and your rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Information We Collect</h2>
            <p className="mb-2">When you use the app, we collect:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-slate-400">
              <li><strong className="text-white">Account information:</strong> your email address and name (provided during registration)</li>
              <li><strong className="text-white">Password:</strong> stored as a bcrypt hash, never in plaintext</li>
              <li><strong className="text-white">Send history:</strong> records of emails sent through the app (subject, recipients, timestamps, success/failure)</li>
              <li><strong className="text-white">Email content:</strong> drafts and sent message bodies are stored to enable resending and history viewing</li>
              <li><strong className="text-white">SMTP credentials:</strong> if you choose to send via SMTP, we store these in your browser&apos;s local storage only</li>
              <li><strong className="text-white">Google OAuth tokens:</strong> if you sign in with Google, tokens are stored locally and used only to send mail via the Gmail API</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1 ml-2 text-slate-400">
              <li>To authenticate you and maintain your session</li>
              <li>To send emails on your behalf using your provided credentials or OAuth tokens</li>
              <li>To display your sending history</li>
              <li>To help administrators manage the user base</li>
            </ul>
            <p className="mt-3">We do <strong className="text-white">not</strong> sell, rent, or share your data with any third party.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. Google API Services</h2>
            <p>
              When you sign in with Google, the app requests access only to send email on your behalf
              (<code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">gmail.send</code> scope) and basic profile information
              (email and name).
            </p>
            <p className="mt-2">
              Email Blaster Pro&apos;s use of information received from Google APIs adheres to the
              {" "}<a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">Google API Services User Data Policy</a>,
              including the Limited Use requirements.
            </p>
            <p className="mt-2">We do not:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-slate-400 mt-1">
              <li>Read your inbox or any received emails</li>
              <li>Use your Gmail data for advertising</li>
              <li>Transfer your data to a third party</li>
              <li>Use your data for any purpose other than sending the emails you compose in the app</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. Data Storage</h2>
            <ul className="list-disc list-inside space-y-1 ml-2 text-slate-400">
              <li><strong className="text-white">Server-side:</strong> account data and send history are stored in Vercel KV (Upstash Redis), encrypted in transit and at rest</li>
              <li><strong className="text-white">Browser local storage:</strong> SMTP credentials, OAuth tokens, drafts, and resume files are stored only in your browser. They never leave your device unless you actively send an email</li>
              <li><strong className="text-white">Sessions:</strong> stored in encrypted httpOnly cookies, signed with iron-session</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">6. Data Retention</h2>
            <p>
              Your account data is retained until you delete your account or request deletion.
              Send history is kept indefinitely unless you clear it.
              You can clear browser-stored data at any time by clearing site data in your browser settings or by signing out.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-slate-400 mt-1">
              <li>Access the data we hold about you (visible in your account)</li>
              <li>Delete your account (contact the admin)</li>
              <li>Revoke Google OAuth access at any time at{" "}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">myaccount.google.com/permissions</a>
              </li>
              <li>Export your data (contact the admin)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">8. Security</h2>
            <p>
              Passwords are hashed with bcrypt (10 rounds). Sessions use signed, encrypted cookies.
              All connections use HTTPS. OAuth secrets are kept on the server and never exposed to the browser.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">9. Children&apos;s Privacy</h2>
            <p>This service is not intended for users under 13 years old. We do not knowingly collect data from children.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">10. Changes to This Policy</h2>
            <p>We may update this policy from time to time. The &quot;Last updated&quot; date at the top will reflect any changes.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">11. Contact</h2>
            <p>For privacy concerns, data deletion requests, or any questions, contact:</p>
            <p className="mt-2">
              <a href="mailto:meetpatel4384@gmail.com" className="text-violet-400 hover:text-violet-300 underline">meetpatel4384@gmail.com</a>
            </p>
          </section>
        </div>
      </div>

      <div className="text-center mt-6">
        <Link href="/terms" className="text-xs text-slate-500 hover:text-violet-300">View Terms of Service →</Link>
      </div>
    </div>
  );
}
