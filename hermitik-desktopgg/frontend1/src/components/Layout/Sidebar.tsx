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
    <div className={`bg-white dark:bg-hermetik-secondary border-r border-gray-200 dark:border-hermetik-green/20 transition-all duration-300 ${isOpen ? 'w-64' : 'w-16'}`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-hermetik-green/20">
          <div className="flex items-center justify-between">
            {isOpen && (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-hermetik rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm font-heading">H</span>
                </div>
                <span className="text-gray-900 dark:text-white font-semibold font-heading">Hermetik</span>
              </div>
            )}
            <button
              onClick={onToggle}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-hermetik-green/20 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-hermetik-gold transition-colors"
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
                    ? 'bg-gradient-hermetik text-white shadow-hermetik'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-hermetik-green/20 hover:text-gray-900 dark:hover:text-hermetik-gold'
                }`
              }
            >
              <item.icon size={20} />
              {isOpen && <span className="font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200 dark:border-hermetik-green/20">
          {isOpen && user && (
            <div className="mb-3 space-y-2">
              {isViewingAsAdmin && viewedUser && (
                <div className="p-2 bg-hermetik-gold/10 dark:bg-hermetik-gold/20 border border-hermetik-gold/30 dark:border-hermetik-gold/40 rounded-lg">
                  <div className="text-xs font-medium text-hermetik-green dark:text-hermetik-gold mb-1">Viewing as:</div>
                  <div className="text-sm font-medium text-hermetik-green dark:text-white">{viewedUser.name}</div>
                  <button
                    onClick={switchBackToAdmin}
                    className="text-xs text-hermetik-green dark:text-hermetik-gold hover:underline mt-1"
                  >
                    Switch back
                  </button>
                </div>
              )}
              <div className="p-3 bg-gray-100 dark:bg-hermetik-green/10 rounded-lg border dark:border-hermetik-green/20">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                {user.role === 'admin' && (
                  <div className="text-xs text-hermetik-gold dark:text-hermetik-gold mt-1 font-medium">Admin</div>
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
            className="flex items-center space-x-3 w-full px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-hermetik-green/20 hover:text-gray-900 dark:hover:text-hermetik-gold transition-colors"
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