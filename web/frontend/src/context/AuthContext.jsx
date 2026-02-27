import React, { createContext, useContext, useState, useEffect } from 'react';
import { authInit, getToken, logout as apiLogout } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState({ role: null, myStudentId: null, loading: true });

  const refresh = async () => {
    if (!getToken()) {
      setUser({ role: 'guest', myStudentId: null, loading: false });
      return;
    }
    try {
      const res = await authInit();
      if (res.success) setUser({ role: res.role, myStudentId: res.myStudentId || null, loading: false });
      else setUser({ role: 'guest', myStudentId: null, loading: false });
    } catch (e) {
      setUser({ role: 'guest', myStudentId: null, loading: false });
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const logout = () => {
    apiLogout();
    setUser({ role: 'guest', myStudentId: null, loading: false });
  };

  return (
    <AuthContext.Provider value={{ ...user, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
