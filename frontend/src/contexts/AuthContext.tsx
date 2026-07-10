import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  login: (username: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check if user is saved in localStorage
    const savedUser = localStorage.getItem('campusnet-user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('campusnet-user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, role: UserRole): Promise<boolean> => {
    setIsLoading(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    const mockUser: User = {
      id: Math.random().toString(36).substring(7),
      username: username || 'Admin User',
      email: `${username || 'admin'}@campusnet.ai`.toLowerCase(),
      role: role,
      token: 'mock-jwt-token-' + Math.random().toString(36).substring(7),
    };
    
    setUser(mockUser);
    localStorage.setItem('campusnet-user', JSON.stringify(mockUser));
    setIsLoading(false);
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('campusnet-user');
  };

  const role = user ? user.role : null;

  return (
    <AuthContext.Provider value={{ user, role, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
