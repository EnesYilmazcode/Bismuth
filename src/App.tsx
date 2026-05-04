import { AuthProvider } from '@/contexts/AuthProvider';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/toaster';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet } from 'react-router-dom';
import { MeshFilesProvider } from '@/contexts/MeshFilesContext';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MeshFilesProvider>
          <TooltipProvider delayDuration={0}>
            <Toaster />
            <Outlet />
          </TooltipProvider>
        </MeshFilesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
