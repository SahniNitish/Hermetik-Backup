import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Coins, 
  TrendingUp, 
  BarChart3, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  Calculator
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUserView } from '../../contexts/UserViewContext';
import ThemeToggle from '../UI/ThemeToggle';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const { user, logout } = useAuth();
  const { isViewingAsAdmin, viewedUser, switchBackToAdmin } = useUserView();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Coins, label: 'Tokens', path: '/tokens' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: Calculator, label: 'NAV Calculator', path: '/nav-calculator' },
    { icon: TrendingUp, label: 'Positions', path: '/positions' },
    ...(user?.role === 'admin' ? [{ icon: Users, label: 'Users', path: '/users' }] : []),
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className={`bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ${isOpen ? 'w-64' : 'w-16'}`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            {isOpen && (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">H</span>
                </div>
                <span className="text-gray-900 dark:text-white font-semibold">Hermetik</span>
              </div>
            )}
            <button
              onClick={onToggle}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <item.icon size={20} />
              {isOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          {isOpen && user && (
            <div className="mb-3 space-y-2">
              {isViewingAsAdmin && viewedUser && (
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <div className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">Viewing as:</div>
                  <div className="text-sm font-medium text-blue-900 dark:text-blue-100">{viewedUser.name}</div>
                  <button
                    onClick={switchBackToAdmin}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                  >
                    Switch back
                  </button>
                </div>
              )}
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                {user.role === 'admin' && (
                  <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Admin</div>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center space-x-2 mb-3">
            <ThemeToggle className="flex-shrink-0" />
            {isOpen && <span className="text-sm text-gray-600 dark:text-gray-300">Theme</span>}
          </div>
          <button
            onClick={logout}
            className="flex items-center space-x-3 w-full px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <LogOut size={20} />
            {isOpen && <span>Logout</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;