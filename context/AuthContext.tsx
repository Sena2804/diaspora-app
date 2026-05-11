"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  email: string;
  role: 'sender' | 'receiver';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: 'sender' | 'receiver') => boolean;
  signup: (email: string, password: string, role: 'sender' | 'receiver') => boolean;
  logout: () => void;
  // This is for simulation only, in a real app, do not store plain passwords
  mockUsers: { email: string; password: string; role: 'sender' | 'receiver' }[]; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mockUsers, setMockUsers] = useState<{ email: string; password: string; role: 'sender' | 'receiver' }[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Load from localStorage on initial render
    const storedUser = localStorage.getItem('simulatedUser');
    const storedMockUsers = localStorage.getItem('simulatedMockUsers');

    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
    if (storedMockUsers) {
      setMockUsers(JSON.parse(storedMockUsers));
    } else {
      // Add a default mock user if none exist
      const defaultUser = { email: 'test@example.com', password: 'password', role: 'sender' };
      setMockUsers([defaultUser]);
      localStorage.setItem('simulatedMockUsers', JSON.stringify([defaultUser]));
    }
  }, []);

  const login = (email: string, password: string, role: 'sender' | 'receiver') => {
    const foundUser = mockUsers.find(
      (u) => u.email === email && u.password === password && u.role === role
    );
    if (foundUser) {
      const loggedInUser = { email: foundUser.email, role: foundUser.role };
      setUser(loggedInUser);
      setIsAuthenticated(true);
      localStorage.setItem('simulatedUser', JSON.stringify(loggedInUser));
      return true;
    }
    return false;
  };

  const signup = (email: string, password: string, role: 'sender' | 'receiver') => {
    const userExists = mockUsers.some((u) => u.email === email);
    if (userExists) {
      alert('User with this email already exists!');
      return false;
    }

    const newUser = { email, password, role };
    const updatedMockUsers = [...mockUsers, newUser];
    setMockUsers(updatedMockUsers);
    localStorage.setItem('simulatedMockUsers', JSON.stringify(updatedMockUsers));

    // Automatically log in the new user
    setUser({ email, role });
    setIsAuthenticated(true);
    localStorage.setItem('simulatedUser', JSON.stringify({ email, role }));
    return true;
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('simulatedUser');
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, signup, logout, mockUsers }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
