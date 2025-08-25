import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { UserViewProvider } from './contexts/UserViewContext';
import { NAVProvider } from './contexts/NAVContext';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/UI/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Tokens from './pages/Tokens';
import Positions from './pages/Positions';
import Analytics from './pages/Analytics';
import NAVCalculator from './pages/NAVCalculator';
import Users from './pages/Users';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
      <Route path="/signup" element={!isAuthenticated ? <Signup /> : <Navigate to="/" />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="tokens" element={<Tokens />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="nav-calculator" element={<NAVCalculator />} />
        <Route path="positions" element={<Positions />} />
        <Route path="users" element={<Users />} />
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <UserViewProvider>
            <NAVProvider>
              <Router>
                <AppRoutes />
              </Router>
            </NAVProvider>
          </UserViewProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;