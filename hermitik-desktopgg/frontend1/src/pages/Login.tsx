import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/UI/Button';
import Card from '../components/UI/Card';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hermetik-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-hermetik rounded-xl flex items-center justify-center mx-auto mb-4 shadow-hermetik">
            <span className="text-white font-bold text-2xl font-heading">H</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 font-heading">Welcome back</h1>
          <p className="text-gray-400">Sign in to your Hermetik account</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-hermetik-secondary border border-hermetik-green/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hermetik-gold/50 focus:border-hermetik-gold transition-all"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-hermetik-secondary border border-hermetik-green/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hermetik-gold/50 focus:border-hermetik-gold transition-all"
                placeholder="Enter your password"
                required
              />
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              Sign In
            </Button>
          </form>

          {!user || user.role === 'user' ? (
            <div className="mt-6 text-center">
              <p className="text-gray-400">
                Don't have an account?{' '}
                <Link to="/signup" className="text-blue-400 hover:text-blue-300">
                  Sign up
                </Link>
              </p>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
};

export default Login;