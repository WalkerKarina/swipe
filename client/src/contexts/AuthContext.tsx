import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, ProfileUpdateData } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  photoUrl?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUserProfile: (data: ProfileUpdateData) => Promise<void>;
  updateUserPhoto: (photoFile: File) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage on initial load
    const loadUserFromStorage = () => {
      setLoading(true);
      try {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');
        
        if (storedUser && storedToken) {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
        }
      } catch (error) {
        console.error('Error loading user from localStorage:', error);
        // If there's an error, clean up localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    loadUserFromStorage();
  }, []);

  const login = (userData: User, authToken: string) => {
    try {
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', authToken);
      setUser(userData);
      setToken(authToken);
    } catch (error) {
      console.error('Error saving user to localStorage:', error);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const updateUserProfile = async (data: ProfileUpdateData) => {
    if (!user) return;
    
    try {
      const updatedUser = await authService.updateProfile(user.id, data);
      
      // Update local state and localStorage
      const newUserData = { ...user, ...data };
      setUser(newUserData);
      localStorage.setItem('user', JSON.stringify(newUserData));
      
      return updatedUser;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const updateUserPhoto = async (photoFile: File) => {
    if (!user) return;
    
    try {
      const response = await authService.uploadProfilePhoto(user.id, photoFile);
      
      // Update user with new photo URL
      const newUserData = { ...user, photoUrl: response.photoUrl };
      setUser(newUserData);
      localStorage.setItem('user', JSON.stringify(newUserData));
      
      return response;
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      logout,
      updateUserProfile,
      updateUserPhoto
    }}>
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
