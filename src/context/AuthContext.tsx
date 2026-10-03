import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, UserSession } from '../types/project';

interface AuthContextType {
  user: UserSession | null;
  role: UserRole;
  isAuthenticated: boolean;
  switchRole: (role: UserRole) => void;
  signIn: (role?: UserRole) => void;
  signOut: () => void;
  isClerkConfigured: boolean;
}

const PRESET_USERS: Record<UserRole, UserSession> = {
  Admin: {
    userId: 'user_clerk_admin_01',
    name: 'Vikramaditya Sharma',
    email: 'admin.landacq@nic.in',
    role: 'Admin',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    isSimulated: true,
  },
  Officer: {
    userId: 'user_clerk_officer_02',
    name: 'Ananya Deshmukh',
    email: 'officer.revenue@nic.in',
    role: 'Officer',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=faces',
    isSimulated: true,
  },
  Viewer: {
    userId: 'user_clerk_viewer_03',
    name: 'Rajesh Ramanathan',
    email: 'auditor.planning@nic.in',
    role: 'Viewer',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
    isSimulated: true,
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
  const isClerkConfigured = Boolean(
    clerkKey && clerkKey.startsWith('pk_') && !clerkKey.includes('xxxxxxxx')
  );

  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('landacq_user_role');
    if (saved === 'Admin' || saved === 'Officer' || saved === 'Viewer') {
      return saved;
    }
    return 'Admin';
  });

  const [user, setUser] = useState<UserSession | null>(PRESET_USERS['Admin']);

  useEffect(() => {
    setUser(PRESET_USERS[currentRole]);
    localStorage.setItem('landacq_user_role', currentRole);
  }, [currentRole]);

  const switchRole = (newRole: UserRole) => {
    setCurrentRole(newRole);
    setUser(PRESET_USERS[newRole]);
  };

  const signIn = (role: UserRole = 'Admin') => {
    switchRole(role);
  };

  const signOut = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user ? user.role : 'Viewer',
        isAuthenticated: !!user,
        switchRole,
        signIn,
        signOut,
        isClerkConfigured,
      }}
    >
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
