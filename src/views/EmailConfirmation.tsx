import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

function EmailConfirmation() {
  const location = useLocation();
  const email = location.state?.email || 'your email';
  const [isResending, setIsResending] = useState(false);
  const { toast } = useToast();

  const handleResend = async () => {
    if (!email || email === 'your email') {
      toast({
        title: 'Whoopsies',
        description: 'No email address found. Please try signing up again.',
        variant: 'destructive',
      });
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) throw error;

      toast({
        title: 'Email Sent!',
        description: "We've sent another verification email to your inbox.",
      });
    } catch (error) {
      console.error('Error resending verification email:', error);
      toast({
        title: 'Whoopsies',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to resend verification email',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-adam-bg-dark p-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-adam-bg-secondary-dark p-8 shadow-md">
          {/* Icon and Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-adam-neutral-800">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <h1 className="mb-4 text-2xl font-semibold text-white">
              Check Your Email
            </h1>
            <p className="text-gray-400">
              We've sent a verification link to{' '}
              <span className="text-white">{email}</span>. Click the link to
              verify your account.
            </p>
            <p className="mt-2 text-center text-gray-400">
              (Make sure to check your spam folder)
            </p>
          </div>

          {/* Instructions */}
          <div className="space-y-6">
            {/* Alert for spam warning and sign in link */}
            <Alert className="border-adam-neutral-700 bg-adam-neutral-800">
              <AlertDescription className="text-center text-gray-400">
                Already verified your email?{' '}
                <Link
                  to="/signin"
                  className="font-medium text-adam-text-primary transition-colors duration-200 hover:text-adam-text-primary/80"
                >
                  Sign in here
                </Link>
              </AlertDescription>
            </Alert>

            {/* Resend Email button */}
            <Button
              type="button"
              className="w-full p-6 text-adam-blue transition-colors duration-200 hover:bg-adam-neutral-950 hover:text-adam-blue/80"
              onClick={handleResend}
              disabled={isResending}
            >
              {isResending ? 'Sending...' : 'Resend Verification Email'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailConfirmation;
