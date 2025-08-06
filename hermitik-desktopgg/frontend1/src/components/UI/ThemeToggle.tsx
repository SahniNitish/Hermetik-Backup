import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, toggleTheme, isDark } = useTheme();
  
  const handleToggle = () => {
    console.log('Theme toggle clicked. Current theme:', theme);
    toggleTheme();
    console.log('Theme should now be:', theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      onClick={handleToggle}
      className={`
        relative inline-flex items-center justify-center w-10 h-10 rounded-lg 
        transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 
        ${isDark 
          ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 focus:ring-yellow-400/50' 
          : 'bg-gray-100 hover:bg-gray-200 text-blue-600 focus:ring-blue-500/50'
        }
        ${className}
      `}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <div className="relative w-5 h-5">
        {/* Sun Icon */}
        <Sun 
          className={`
            absolute inset-0 w-5 h-5 transition-all duration-300 transform
            ${isDark 
              ? 'opacity-0 rotate-90 scale-50' 
              : 'opacity-100 rotate-0 scale-100'
            }
          `}
        />
        
        {/* Moon Icon */}
        <Moon 
          className={`
            absolute inset-0 w-5 h-5 transition-all duration-300 transform
            ${isDark 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 -rotate-90 scale-50'
            }
          `}
        />
      </div>
    </button>
  );
};

export default ThemeToggle;