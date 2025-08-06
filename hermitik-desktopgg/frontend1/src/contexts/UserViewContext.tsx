import React, { createContext, useContext, useState, ReactNode } from 'react';

interface UserAccount {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt?: string;
  wallets?: string[];
}

interface UserViewContextType {
  viewedUser: UserAccount | null;
  setViewedUser: (user: UserAccount | null) => void;
  isViewingAsAdmin: boolean;
  switchToUser: (user: UserAccount) => void;
  switchBackToAdmin: () => void;
}

const UserViewContext = createContext<UserViewContextType | undefined>(undefined);

interface UserViewProviderProps {
  children: ReactNode;
}

export const UserViewProvider: React.FC<UserViewProviderProps> = ({ children }) => {
  const [viewedUser, setViewedUser] = useState<UserAccount | null>(null);

  const switchToUser = (user: UserAccount) => {
    setViewedUser(user);
  };

  const switchBackToAdmin = () => {
    setViewedUser(null);
  };

  const isViewingAsAdmin = viewedUser !== null;

  return (
    <UserViewContext.Provider
      value={{
        viewedUser,
        setViewedUser,
        isViewingAsAdmin,
        switchToUser,
        switchBackToAdmin,
      }}
    >
      {children}
    </UserViewContext.Provider>
  );
};

export const useUserView = (): UserViewContextType => {
  const context = useContext(UserViewContext);
  if (context === undefined) {
    throw new Error('useUserView must be used within a UserViewProvider');
  }
  return context;
};