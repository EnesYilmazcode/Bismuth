import { ScrollArea } from '@/components/ui/scroll-area';

export function PrivacyPolicyView() {
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
              Privacy Policy
            </h1>
            <p className="mt-2 text-gray-400">
              Effective Date: February 7, 2025
            </p>
          </div>

          <ScrollArea className="h-[70vh]">
            <div className="space-y-6 pr-6">
              <section>
                <h2 className="mb-3 text-xl font-semibold text-white">
                  Overview
                </h2>
                <p className="text-gray-400">
                  This Privacy Policy describes how AdamCAD ("we," "our," or
                  "us") collects, uses, and shares information about you when
                  you use our website and services. By using AdamCAD, you agree
                  to the collection and use of information in accordance with
                  this policy.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-semibold text-white">
                  Information We Collect
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 text-lg font-medium text-white">
                      Information You Provide
                    </h3>
                    <p className="mb-2 text-gray-400">
                      When you register for and use AdamCAD, we collect
                      information that you provide directly to us, including:
                    </p>
                    <ul className="ml-4 list-inside list-disc text-gray-400">
                      <li>Account information (name, email address)</li>
                      <li>
                        Authentication information when you sign in with Google
                      </li>
                      <li>Content you create using our services</li>
                      <li>Communications with us</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="mb-2 text-lg font-medium text-white">
                      Information We Collect Automatically
                    </h3>
                    <p className="mb-2 text-gray-400">
                      When you use our services, we automatically collect
                      certain information, including:
                    </p>
                    <ul className="ml-4 list-inside list-disc text-gray-400">
                      <li>
                        Log data (IP address, browser type, pages visited)
                      </li>
                      <li>Device information</li>
                      <li>Usage information</li>
                      <li>Cookies and similar tracking technologies</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Continue with other sections following the same pattern */}
              {/* Each section should follow the same structure with proper heading hierarchy and spacing */}

              <section className="mb-8">
                <h2 className="mb-3 text-xl font-semibold text-white">
                  Contact Us
                </h2>
                <p className="text-gray-400">
                  If you have questions about this Privacy Policy, please
                  contact us at:
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
