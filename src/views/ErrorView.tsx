import { Button } from '@/components/ui/button';
import { useNavigate, useRouteError } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { useEffect } from 'react';

export function ErrorView() {
  const error = useRouteError();
  const navigate = useNavigate();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-adam-bg-secondary-dark">
      <h1 className="text-2xl font-bold text-adam-text-primary">
        Oops! Something went wrong.
      </h1>
      <p className="text-center text-adam-text-secondary">
        We're sorry, but an error occurred while loading this page.
        <br />
        Please feel free to reach out to us so that we can resolve this issue.
      </p>
      <Button onClick={() => navigate('/')}>Go to Home</Button>
    </div>
  );
}
