import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function UpdatePasswordView() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { toast } = useToast();
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const { mutate: handleUpdatePassword, isPending: isUpdatingPassword } =
    useMutation({
      mutationFn: updatePassword,
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Password updated successfully',
        });
        navigate('/');
      },
      onError: () => {
        toast({
          title: 'Error',
          description: 'Failed to update password',
          variant: 'destructive',
        });
      },
    });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }
    handleUpdatePassword(password);
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
              Update Password
            </h1>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">
                New Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-gray-700 bg-adam-bg-dark text-white placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="border-gray-700 bg-adam-bg-dark text-white placeholder:text-gray-400"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isUpdatingPassword}
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
