import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Search, Crown, ArrowLeft, Wallet, ExternalLink, Plus, Download, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserView } from '../contexts/UserViewContext';
import { authApi, analyticsApi } from '../services/api';
import CreateUserModal from '../components/Admin/CreateUserModal';

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt?: string;
  wallets?: string[];
}

const Users: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { switchToUser, switchBackToAdmin, isViewingAsAdmin } = useUserView();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [exportingUser, setExportingUser] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<UserAccount | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await authApi.getAllUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user: UserAccount) => {
    setSelectedUser(user);
  };

  const handleCreateUserSuccess = () => {
    fetchUsers(); // Refresh the user list
    setShowCreateModal(false);
  };

  const handleExportUserExcel = async (user: UserAccount) => {
    try {
      setExportingUser(user.id);
      setError(null);
      
      const blob = await analyticsApi.exportUserExcel(user.id);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${user.name.replace(/\s+/g, '_')}_Portfolio_Export.xlsx`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error exporting user Excel:', err);
      setError(`Failed to export data for ${user.name}. Please try again.`);
    } finally {
      setExportingUser(null);
    }
  };

  const handleExportUserMonthlyNav = async (user: UserAccount) => {
    try {
      setExportingUser(user.id);
      setError(null);
      
      // Export current month by default
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const blob = await analyticsApi.exportUserMonthlyNav(user.id, currentMonth, currentYear);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${user.name.replace(/\s+/g, '_')}_Monthly_NAV_Report_${currentYear}_${String(currentMonth + 1).padStart(2, '0')}.xlsx`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error exporting user monthly NAV:', err);
      setError(`Failed to export monthly NAV for ${user.name}. Please try again.`);
    } finally {
      setExportingUser(null);
    }
  };

  const handleDeleteUser = async (user: UserAccount) => {
    try {
      setDeletingUser(user.id);
      setError(null);
      
      await authApi.deleteUser(user.id);
      
      // Refresh the user list
      await fetchUsers();
      
      // Clear selected user if it was the deleted one
      if (selectedUser?.id === user.id) {
        setSelectedUser(null);
      }
      
      setShowDeleteConfirm(null);
      
    } catch (err) {
      console.error('Error deleting user:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(`Failed to delete user ${user.name}: ${apiError || errorMessage}`);
    } finally {
      setDeletingUser(null);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="text-red-800 dark:text-red-200 font-medium">Access Denied</h3>
          <p className="text-red-600 dark:text-red-300 mt-1">
            You don't have permission to access this page. Admin access required.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">User Management</h1>
            <p className="text-gray-600 dark:text-gray-400">View and manage user accounts</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <Plus size={16} />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading users...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-300">{error}</p>
          <button
            onClick={fetchUsers}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Users List */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  All Users ({filteredUsers.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                      selectedUser?.id === user.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => handleUserSelect(user)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                          {user.role === 'admin' ? (
                            <Crown className="text-yellow-600" size={20} />
                          ) : (
                            <User className="text-gray-500 dark:text-gray-400" size={20} />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.name}
                            </h3>
                            {user.role === 'admin' && (
                              <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                          {user.wallets && user.wallets.length > 0 && (
                            <div className="flex items-center space-x-1 mt-1">
                              <Wallet size={12} className="text-gray-400" />
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {user.wallets.length} wallet{user.wallets.length > 1 ? 's' : ''}
                                {user.wallets.length > 0 && (
                                  <span className="ml-1 font-mono">
                                    {user.wallets[0].slice(0, 6)}...{user.wallets[0].slice(-4)}
                                    {user.wallets.length > 1 && ` +${user.wallets.length - 1}`}
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('🚀 Users page: Opening profile for user:', user);
                          switchToUser(user);
                          // Navigate to user's dashboard to show their profile
                          navigate('/');
                        }}
                        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-1"
                        title="Open user profile"
                      >
                        <ExternalLink size={12} />
                        <span>Open Profile</span>
                      </button>
                    </div>
                  </div>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="p-8 text-center">
                    <User className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No users found</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {searchTerm ? 'Try adjusting your search terms.' : 'No users available.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User Details Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 sticky top-6">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Details</h2>
              </div>
              {selectedUser ? (
                <div className="p-4 space-y-4">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      {selectedUser.role === 'admin' ? (
                        <Crown className="text-yellow-600" size={24} />
                      ) : (
                        <User className="text-gray-500 dark:text-gray-400" size={24} />
                      )}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {selectedUser.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedUser.email}</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Role</label>
                      <div className="mt-1">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          selectedUser.role === 'admin' 
                            ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}>
                          {selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Created At</label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {new Date(selectedUser.createdAt).toLocaleDateString()}
                      </p>
                    </div>


                    {selectedUser.wallets && selectedUser.wallets.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Wallet Addresses ({selectedUser.wallets.length})
                        </label>
                        <div className="mt-1 space-y-1">
                          {selectedUser.wallets.slice(0, 3).map((wallet, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                              <span className="font-mono text-gray-900 dark:text-white">
                                {wallet.slice(0, 8)}...{wallet.slice(-8)}
                              </span>
                            </div>
                          ))}
                          {selectedUser.wallets.length > 3 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              +{selectedUser.wallets.length - 3} more wallet{selectedUser.wallets.length - 3 > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 space-y-2">
                    <button
                      onClick={() => {
                        switchToUser(selectedUser);
                        navigate('/');
                      }}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <ExternalLink size={16} />
                      <span>Open Profile</span>
                    </button>
                    
                    {/* Admin Export Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleExportUserExcel(selectedUser)}
                        disabled={exportingUser === selectedUser.id}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-1 text-sm disabled:opacity-50"
                      >
                        <Download size={14} />
                        <span>{exportingUser === selectedUser.id ? 'Exporting...' : 'Excel'}</span>
                      </button>
                      
                      <button
                        onClick={() => handleExportUserMonthlyNav(selectedUser)}
                        disabled={exportingUser === selectedUser.id}
                        className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-1 text-sm disabled:opacity-50"
                      >
                        <Download size={14} />
                        <span>{exportingUser === selectedUser.id ? 'Exporting...' : 'NAV'}</span>
                      </button>
                    </div>
                    
                    {/* Delete User Button */}
                    {selectedUser.role !== 'admin' && (
                      <button
                        onClick={() => setShowDeleteConfirm(selectedUser)}
                        disabled={deletingUser === selectedUser.id}
                        className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                        <span>{deletingUser === selectedUser.id ? 'Deleting...' : 'Delete User'}</span>
                      </button>
                    )}
                    
                    {isViewingAsAdmin && (
                      <button
                        onClick={() => {
                          switchBackToAdmin();
                          alert('Switched back to admin view');
                        }}
                        className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2"
                      >
                        <ArrowLeft size={16} />
                        <span>Back to Admin View</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <User className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No user selected</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Select a user from the list to view details.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateUserSuccess}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete User</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300">
                Are you sure you want to delete <strong>{showDeleteConfirm.name}</strong>? 
                This will permanently delete their account and all associated data including:
              </p>
              <ul className="mt-2 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                <li>Portfolio snapshots</li>
                <li>Wallet data</li>
                <li>Account information</li>
              </ul>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(showDeleteConfirm)}
                disabled={deletingUser === showDeleteConfirm.id}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <Trash2 size={16} />
                <span>{deletingUser === showDeleteConfirm.id ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;