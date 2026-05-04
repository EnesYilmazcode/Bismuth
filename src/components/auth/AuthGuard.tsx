import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { session, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !session && !user) {
      // Capture current path for redirect after authentication
      // Only include pathname and search to avoid security issues
      const currentPath = location.pathname + location.search;

      // Only add redirect parameter if it's not the home page
      const redirectParam =
        currentPath !== '/'
          ? `?redirect=${encodeURIComponent(currentPath)}`
          : '';

      navigate(`/signin${redirectParam}`);
    }
  }, [session, user, navigate, isLoading, location.pathname, location.search]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!session || !user) {
    return null;
  }

  return <>{children}</>;
}
