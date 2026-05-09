import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './auth/AuthProvider';
import IndexPage from './pages/IndexPage';
import CallbackPage from './pages/CallbackPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<IndexPage />} />
            <Route path="/callback" element={<CallbackPage />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0d1421',
              color: '#f0f0f0',
              border: '1px solid #1e2d3d',
              borderRadius: '0.5rem',
              fontFamily: 'system-ui, sans-serif',
            },
            success: { iconTheme: { primary: '#00ff88', secondary: '#050810' } },
            error: { iconTheme: { primary: '#ff3b3b', secondary: '#050810' } },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
