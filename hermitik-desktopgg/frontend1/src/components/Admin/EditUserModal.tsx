import React, { useState, useEffect } from 'react';
import { X, User, Mail, Key, Wallet, Save } from 'lucide-react';
import Button from '../UI/Button';

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt?: string;
  wallets?: string[];
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: UserAccount | null;
}

interface UserFormData {
  name: string;
  email: string;
  role: 'user' | 'admin';
  wallets: string[];
}

const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, onSuccess, user }) => {
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    role: 'user',
    wallets: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role as 'user' | 'admin',
        wallets: user.wallets || []
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Note: Since there's no update endpoint in the backend,
    // this is a placeholder for future implementation
    setError('User editing functionality requires backend support. Contact your developer to implement the update user endpoint.');
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit User: {user.name}</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <User size={16} className="inline mr-2" />
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Name editing not available</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Mail size={16} className="inline mr-2" />
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email editing not available</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Role
            </label>
            <select
              value={formData.role}
              disabled
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Role editing not available</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Wallet size={16} className="inline mr-2" />
              Wallet Addresses ({formData.wallets.length})
            </label>
            {formData.wallets.length > 0 ? (
              <div className="space-y-2">
                {formData.wallets.map((wallet, index) => (
                  <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                      {wallet}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No wallet addresses</p>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-blue-800 dark:text-blue-200 font-medium mb-2">User Information</h4>
            <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <p><strong>Created:</strong> {new Date(user.createdAt).toLocaleDateString()}</p>
              {user.updatedAt && (
                <p><strong>Updated:</strong> {new Date(user.updatedAt).toLocaleDateString()}</p>
              )}
              <p><strong>User ID:</strong> {user.id}</p>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              <strong>Note:</strong> User editing features require additional backend endpoints. 
              Currently, you can only view user information. To enable editing, implement:
            </p>
            <ul className="text-yellow-700 dark:text-yellow-300 text-xs mt-2 list-disc list-inside">
              <li>PUT /api/auth/update-user/:id</li>
              <li>DELETE /api/auth/delete-user/:id</li>
              <li>DELETE /api/auth/remove-wallet</li>
            </ul>
          </div>

          <div className="flex space-x-4 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              className="flex-1"
            >
              Close
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled
              className="flex-1 opacity-50 cursor-not-allowed"
            >
              <Save size={16} className="mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditUserModal;