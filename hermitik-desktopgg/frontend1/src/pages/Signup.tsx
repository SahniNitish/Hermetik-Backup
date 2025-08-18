import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/UI/Button';
import Card from '../components/UI/Card';

const Signup: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signup(name, email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Signup failed');
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
          <h1 className="text-3xl font-bold text-white mb-2 font-heading">Create account</h1>
          <p className="text-gray-400">Start tracking your DeFi portfolio</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-hermetik-secondary border border-hermetik-green/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hermetik-gold/50 focus:border-hermetik-gold transition-all"
                placeholder="Enter your full name"
                required
              />
            </div>

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
                placeholder="Create a password"
                required
              />
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-hermetik-gold hover:text-hermetik-green transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Signup;