import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ArrowLeft } from 'lucide-react';
import { useUserView } from '../../contexts/UserViewContext';

const AdminViewBanner: React.FC = () => {
  const navigate = useNavigate();
  const { viewedUser, isViewingAsAdmin, switchBackToAdmin } = useUserView();

  if (!isViewingAsAdmin || !viewedUser) {
    return null;
  }

  return (
    <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <User className="text-blue-400" size={20} />
          <div>
            <p className="text-blue-200 font-medium">
              Admin View: Viewing as {viewedUser.name}
            </p>
            <p className="text-blue-300 text-sm">{viewedUser.email}</p>
          </div>
        </div>
        <button
          onClick={() => {
            switchBackToAdmin();
            navigate('/users');
          }}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center space-x-2"
        >
          <ArrowLeft size={16} />
          <span>Back to Admin Panel</span>
        </button>
      </div>
    </div>
  );
};

export default AdminViewBanner;