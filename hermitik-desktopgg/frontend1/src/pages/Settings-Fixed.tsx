import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, walletApi } from '../services/api';
import { Download, Plus, Trash2, RefreshCw, Wallet, User, Settings as SettingsIcon } from 'lucide-react';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import { useAuth } from '../contexts/AuthContext';

const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const [newWallet, setNewWallet] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: wallets, isLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: walletApi.getWallets,
  });

  const addWalletMutation = useMutation({
    mutationFn: (address: string) => authApi.addWallet(address),
    onSuccess: () => {
      setNewWallet('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Failed to add wallet');
    },
  });

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWallet.trim()) return;

    // Basic validation
    if (!newWallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Please enter a valid Ethereum address');
      return;
    }

    addWalletMutation.mutate(newWallet.trim());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
      </div>

      {/* User Profile */}
      <Card>
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">{user?.username || 'Unknown User'}</h2>
            <p className="text-gray-400">{user?.email}</p>
            {user?.role && (
              <span className="inline-block px-2 py-1 bg-blue-600 text-blue-100 text-xs rounded-full">
                {user.role}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex space-x-4">
          <Button
            onClick={logout}
            variant="secondary"
            className="bg-red-600 hover:bg-red-700"
          >
            Logout
          </Button>
        </div>
      </Card>

      {/* Add Wallet */}
      <Card>
        <h2 className="text-xl font-semibold text-white mb-6">Add Wallet</h2>
        <form onSubmit={handleAddWallet} className="space-y-4">
          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          <div>
            <label htmlFor="wallet" className="block text-sm font-medium text-gray-300 mb-2">
              Wallet Address
            </label>
            <input
              type="text"
              id="wallet"
              value={newWallet}
              onChange={(e) => setNewWallet(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0x..."
              required
            />
          </div>
          
          <Button
            type="submit"
            loading={addWalletMutation.isPending}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Wallet
          </Button>
        </form>
      </Card>

      {/* Connected Wallets */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Connected Wallets</h2>
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['wallets'] })}
            variant="secondary"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-400">Loading wallets...</p>
          </div>
        ) : !wallets || wallets.length === 0 ? (
          <div className="text-center py-8">
            <Wallet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No wallets connected</p>
          </div>
        ) : (
          <div className="space-y-4">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{wallet.name}</p>
                    <p className="text-sm text-gray-400">{wallet.address}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">
                    ${wallet.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-sm text-gray-400">
                    {wallet.tokens?.length || 0} tokens
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Export Data */}
      <Card>
        <h2 className="text-xl font-semibold text-white mb-6">Export Data</h2>
        <div className="space-y-4">
          <p className="text-gray-400">Export your portfolio data for external analysis.</p>
          <Button variant="secondary" disabled>
            <Download className="w-4 h-4 mr-2" />
            Export to Excel (Coming Soon)
          </Button>
        </div>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <h2 className="text-xl font-semibold text-white mb-6">Advanced</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Data Collection</p>
              <p className="text-sm text-gray-400">Automatically collect portfolio snapshots</p>
            </div>
            <Button variant="secondary" disabled>
              <SettingsIcon className="w-4 h-4 mr-2" />
              Configure
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Settings;