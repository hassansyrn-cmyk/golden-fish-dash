import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import GoldenFishRush from '@/game/GoldenFishRush';
import AdDiagnosticsPanel from '@/game/AdDiagnosticsPanel';

const queryClient = new QueryClient();

function Home() {
  return <GoldenFishRush />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        {import.meta.env.VITE_ADMOB_DIAGNOSTICS === 'true' && <AdDiagnosticsPanel />}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
