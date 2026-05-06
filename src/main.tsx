import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createBrowserRouter,
  createRoutesFromChildren,
  matchRoutes,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import React from 'react';
import { ErrorView } from './views/ErrorView.tsx';
import { SignInView } from './views/SignInView.tsx';
import { SignUpView } from './views/SignUpView.tsx';
import { SignUpEmailView } from './views/SignUpEmailView.tsx';
import { ResetPasswordView } from './views/ResetPasswordView.tsx';
import { PrivacyPolicyView } from './views/PrivacyPolicyView.tsx';
import { UpdatePasswordView } from './views/UpdatePasswordView.tsx';
import { TermsOfServiceView } from './views/TermsOfServiceView.tsx';
import EmailConfirmation from './views/EmailConfirmation.tsx';
import { PromptView } from './views/PromptView.tsx';
import { SubscriptionView } from './views/SubscriptionView.tsx';
import { HistoryView } from './views/HistoryView.tsx';
import { BenchmarkView } from './views/BenchmarkView.tsx';
import { AuthGuard } from './components/auth/AuthGuard.tsx';
import { Layout } from './components/Layout.tsx';
import ShareView from './views/ShareView.tsx';
import EditorView from './views/EditorView.tsx';
import SettingsView from './views/SettingsView.tsx';
import { isSupabaseConfigMissing } from './lib/supabase.ts';

// Sentry stays installed so existing captureException callsites are valid,
// but we skip init when no DSN is configured — otherwise the SDK warns
// loudly in the console on every page load in local mode.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect: React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? 'local',
    tracesSampleRate: 1.0,
  });
}

const sentryCreateBrowserRouter =
  Sentry.wrapCreateBrowserRouterV6(createBrowserRouter);

const MissingConfig = () => (
  <div className="flex min-h-screen items-center justify-center bg-adam-bg-secondary-dark">
    <div className="max-w-xl px-4 text-center text-red-500">
      Missing API Keys. Please copy .env.local.template to .env.local and
      restart.
    </div>
  </div>
);

const router = sentryCreateBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      errorElement: <ErrorView />,
      children: [
        { path: '/signin', element: <SignInView /> },
        { path: '/signup', element: <SignUpView /> },
        { path: '/signup-email', element: <SignUpEmailView /> },
        { path: '/reset-password', element: <ResetPasswordView /> },
        { path: '/confirm-email', element: <EmailConfirmation /> },
        { path: '/privacy-policy', element: <PrivacyPolicyView /> },
        { path: '/terms-of-service', element: <TermsOfServiceView /> },
        { path: '/update-password', element: <UpdatePasswordView /> },
        {
          element: <Layout />,
          children: [
            {
              path: '/',
              element: <PromptView />,
              errorElement: <ErrorView />,
            },
            {
              path: '/share/:id',
              element: <ShareView />,
              errorElement: <ErrorView />,
            },
            {
              element: (
                <AuthGuard>
                  <Outlet />
                </AuthGuard>
              ),
              children: [
                {
                  path: '/editor/:id',
                  element: <EditorView />,
                  errorElement: <ErrorView />,
                },
                {
                  path: '/history',
                  errorElement: <ErrorView />,
                  element: <HistoryView />,
                },
                {
                  path: '/benchmark',
                  errorElement: <ErrorView />,
                  element: <BenchmarkView />,
                },
                {
                  path: '/subscription',
                  errorElement: <ErrorView />,
                  element: <SubscriptionView />,
                },
                {
                  path: '/settings',
                  errorElement: <ErrorView />,
                  element: <SettingsView />,
                },
              ],
            },
            { path: '*', element: <Navigate to="/" replace /> },
          ],
        },
      ],
    },
  ],
  { future: { v7_relativeSplatPath: true }, basename: '/bismuth' },
);

createRoot(document.getElementById('root')!).render(
  isSupabaseConfigMissing ? (
    <MissingConfig />
  ) : (
    <StrictMode>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </StrictMode>
  ),
);
