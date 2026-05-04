import { ScrollArea } from '@/components/ui/scroll-area';

export function TermsOfServiceView() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-adam-bg-dark p-4">
      <div className="w-full max-w-4xl">
        <div className="rounded-lg bg-adam-bg-secondary-dark p-8 shadow-md">
          <div className="mb-8 flex flex-col items-center justify-center">
            <img
              src={`${import.meta.env.BASE_URL}/adam-logo.svg`}
              alt="Adam Logo"
              className="mb-4 h-8 w-8"
            />
            <h1 className="text-center text-3xl font-semibold text-white">
              Terms of Service
            </h1>
            <p className="mt-2 text-gray-400">
              Effective Date: February 7, 2025
            </p>
          </div>

          <ScrollArea className="h-[70vh]">
            <div className="space-y-6 pr-6">
              <section>
                <h2 className="mb-3 text-xl font-semibold text-white">
                  1. Acceptance of Terms
                </h2>
                <p className="text-gray-400">
                  By accessing and using AdamCAD ("the Service"), you agree to
                  be bound by these Terms of Service. If you do not agree to
                  these terms, please do not use the Service.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-semibold text-white">
                  2. Description of Service
                </h2>
                <p className="text-gray-400">
                  AdamCAD is a web-based 3D modeling platform that allows users
                  to create, modify, and generate 3D models. The Service
                  includes all features, updates, and new releases as they
                  become available.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-semibold text-white">
                  3. User Accounts
                </h2>
                <div className="space-y-3 text-gray-400">
                  <p>
                    3.1. You must create an account to use certain features of
                    the Service.
                  </p>
                  <p>
                    3.2. You are responsible for maintaining the confidentiality
                    of your account credentials.
                  </p>
                  <p>
                    3.3. You agree to provide accurate and complete information
                    when creating your account.
                  </p>
                  <p>
                    3.4. You are solely responsible for all activities that
                    occur under your account.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-semibold text-white">
                  4. User Content
                </h2>
                <div className="space-y-3 text-gray-400">
                  <p>
                    4.1. You retain ownership of any intellectual property
                    rights in content you create using the Service.
                  </p>
                  <p>
                    4.2. By using the Service, you grant AdamCAD a worldwide
                    license to host and display your content.
                  </p>
                  <p>
                    4.3. You are responsible for ensuring you have the necessary
                    rights to any content you create or share.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-semibold text-white">
                  5. Acceptable Use
                </h2>
                <div className="space-y-3 text-gray-400">
                  <p>You agree not to:</p>
                  <ul className="ml-4 list-inside list-disc space-y-2">
                    <li>Use the Service for any illegal purpose</li>
                    <li>Violate any intellectual property rights</li>
                    <li>Attempt to gain unauthorized access to the Service</li>
                    <li>Interfere with or disrupt the Service</li>
                    <li>Share malicious code or content</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-semibold text-white">
                  6. Subscription and Payments
                </h2>
                <div className="space-y-3 text-gray-400">
                  <p>
                    6.1. Some features of the Service require a paid
                    subscription.
                  </p>
                  <p>
                    6.2. Subscription fees are non-refundable except where
                    required by law.
                  </p>
                  <p>
                    6.3. We reserve the right to modify subscription pricing
                    with notice.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-semibold text-white">
                  7. Termination
                </h2>
                <div className="space-y-3 text-gray-400">
                  <p>
                    7.1. We may terminate or suspend your access to the Service
                    at any time for violations of these terms.
                  </p>
                  <p>
                    7.2. You may terminate your account at any time by following
                    the instructions on the Service.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-semibold text-white">
                  8. Disclaimer of Warranties
                </h2>
                <p className="text-gray-400">
                  The Service is provided "as is" without any warranties,
                  express or implied. We do not guarantee that the Service will
                  be uninterrupted or error-free.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-semibold text-white">
                  9. Limitation of Liability
                </h2>
                <p className="text-gray-400">
                  To the maximum extent permitted by law, AdamCAD shall not be
                  liable for any indirect, incidental, special, consequential,
                  or punitive damages resulting from your use of the Service.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-semibold text-white">
                  10. Changes to Terms
                </h2>
                <p className="text-gray-400">
                  We reserve the right to modify these terms at any time. We
                  will notify users of any material changes via email or through
                  the Service.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-semibold text-white">
                  11. Contact Information
                </h2>
                <p className="text-gray-400">
                  For questions about these Terms of Service, please contact us
                  at:
                </p>
                <div className="mt-2 text-gray-400">
                  <p>AdamCAD</p>
                  <p>Email: hello@adamcad.com</p>
                </div>
              </section>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
