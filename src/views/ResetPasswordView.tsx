import { useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

export function ResetPasswordView() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const { resetPassword } = useAuth();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await resetPassword(email);
      setIsSuccess(true);
      toast({
        title: 'Success',
        description: 'Password reset instructions have been sent to your email',
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send reset instructions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-adam-bg-dark p-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-adam-bg-secondary-dark p-8 shadow-md">
          <div className="mb-4 flex flex-col items-center justify-center gap-2">
            <img
              src={`${import.meta.env.BASE_URL}/adam-logo.svg`}
              alt="Adam Logo"
              className="mr-2 h-8 w-8"
            />
            <h1 className="text-2xl font-semibold text-white">
              Reset Password
            </h1>
          </div>
          {!isSuccess ? (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-gray-700 bg-adam-bg-dark text-white placeholder:text-gray-400"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending instructions...
                  </>
                ) : (
                  'Send Reset Instructions'
                )}
              </Button>

              <Link
                to="/signin"
                className="flex w-full items-center justify-center text-adam-blue hover:text-adam-blue/80"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                <p className="text-sm">Back to Sign In</p>
              </Link>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-green-400">
                Check your email for password reset instructions.
              </p>
              <Link
                to="/signin"
                className="flex w-full items-center justify-center text-adam-blue hover:text-adam-blue/80"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                <p className="text-sm">Back to Sign In</p>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
