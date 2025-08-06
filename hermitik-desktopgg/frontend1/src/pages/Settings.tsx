import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, walletApi, analyticsApi } from '../services/api';
import { Download, Plus, RefreshCw, Wallet, User, Settings as SettingsIcon } from 'lucide-react';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import AdminViewBanner from '../components/Admin/AdminViewBanner';
import { useAuth } from '../contexts/AuthContext';
import { useUserView } from '../contexts/UserViewContext';

const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const [newWallet, setNewWallet] = useState('');
  const [error, setError] = useState('');
  const [exportingNav, setExportingNav] = useState(false);
  const queryClient = useQueryClient();

  const { viewedUser, isViewingAsAdmin } = useUserView();

  const { data: wallets, isLoading } = useQuery({
    queryKey: ['wallets', viewedUser?.id],
    queryFn: () => {
      // If admin is viewing as a user, fetch that user's wallets
      if (viewedUser) {
        return walletApi.getUserWallets(viewedUser.id);
      }
      return walletApi.getWallets();
    },
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

  const handleMonthlyNavExport = async () => {
    try {
      setExportingNav(true);
      setError('');
      
      console.log('Starting monthly NAV export...');
      console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);
      console.log('Use Mock API:', import.meta.env.VITE_USE_MOCK_API);
      
      // Export current month by default
      const now = new Date();
      const currentMonth = now.getMonth(); // 0-based (0 = January)
      const currentYear = now.getFullYear();
      
      console.log(`Exporting for month: ${currentMonth + 1}/${currentYear}`);
      
      const blob = await analyticsApi.exportMonthlyNav(currentMonth, currentYear);
      
      console.log('Received blob:', blob);
      console.log('Blob size:', blob?.size);
      console.log('Blob type:', blob?.type);
      
      if (!blob || blob.size === 0) {
        throw new Error('Received empty blob from server');
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      console.log('Created blob URL:', url);
      
      const link = document.createElement('a');
      link.href = url;
      const filename = `Monthly_NAV_Report_${currentYear}_${String(currentMonth + 1).padStart(2, '0')}.xlsx`;
      link.download = filename;
      
      console.log('Download filename:', filename);
      console.log('Link href:', link.href);
      
      // Trigger download
      document.body.appendChild(link);
      console.log('Link added to DOM, triggering click...');
      link.click();
      console.log('Click triggered');
      
      // Small delay before cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        console.log('Cleanup completed');
      }, 100);
      
      console.log('Export completed successfully');
      
    } catch (err) {
      console.error('Error exporting monthly NAV report:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError(`Failed to export monthly NAV report: ${err.message}. Please try again.`);
    } finally {
      setExportingNav(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminViewBanner />
      
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">
          {isViewingAsAdmin && viewedUser ? `${viewedUser.name}'s Settings` : 'Settings'}
        </h1>
      </div>

      {/* User Profile */}
      <Card>
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              {(isViewingAsAdmin && viewedUser) ? viewedUser.name : (user?.username || 'Unknown User')}
            </h2>
            <p className="text-gray-400">
              {(isViewingAsAdmin && viewedUser) ? viewedUser.email : user?.email}
            </p>
            {((isViewingAsAdmin && viewedUser) ? viewedUser.role : user?.role) && (
              <span className="inline-block px-2 py-1 bg-blue-600 text-blue-100 text-xs rounded-full">
                {(isViewingAsAdmin && viewedUser) ? viewedUser.role : user?.role}
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

      {/* Add Wallet - Only show for the user themselves, not when admin is viewing */}
      {!isViewingAsAdmin && (
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
      )}

      {/* Export Data - Also only show for the user themselves */}
      {!isViewingAsAdmin && (
        <Card>
        <h2 className="text-xl font-semibold text-white mb-6">Export Data</h2>
        <div className="space-y-4">
          <p className="text-gray-400">Export your portfolio data for external analysis.</p>
          
          <div className="space-y-3">
            <Button variant="secondary" disabled>
              <Download className="w-4 h-4 mr-2" />
              Export to Excel (Coming Soon)
            </Button>
            
            <Button 
              variant="primary"
              onClick={handleMonthlyNavExport}
              disabled={exportingNav}
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              {exportingNav ? 'Generating Report...' : 'Export Monthly NAV Report'}
            </Button>
            
            <p className="text-sm text-gray-500">
              Downloads a monthly NAV report with assets, liabilities, and performance fee calculations.
            </p>
          </div>
        </div>
      </Card>
      )}

      {/* Wallets Display - Show for both admin and user, but read-only for admin */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            {isViewingAsAdmin ? `${viewedUser?.name}'s Wallets` : 'Connected Wallets'}
          </h2>
          {!isViewingAsAdmin && (
            <Button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['wallets'] })}
              variant="secondary"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          )}
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
              <div key={wallet.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Wallet className="w-6 h-6 text-blue-400" />
                  <div>
                    <p className="font-medium text-white">{wallet.name}</p>
                    <p className="text-sm text-gray-400">{wallet.address}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">${wallet.totalValue.toLocaleString()}</p>
                  <p className="text-sm text-gray-400">{wallet.tokens?.length || 0} tokens</p>
                </div>
              </div>
            ))}
          </div>
        )}
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