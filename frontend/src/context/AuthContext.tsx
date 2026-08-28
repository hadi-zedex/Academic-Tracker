import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Student, StudentLogin, StudentCreate } from '../types';
import { login as apiLogin, signup as apiSignup, getStudent, parseJwt } from '../api/auth';

interface AuthContextType {
  student: Student | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (credentials: StudentLogin) => Promise<void>;
  signup: (data: StudentCreate) => Promise<void>;
  logout: () => void;
  refreshStudent: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [student, setStudent] = useState<Student | null>(() => {
    const saved = localStorage.getItem('student');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchStudentProfile = useCallback(async (jwtToken: string) => {
    try {
      const decoded = parseJwt(jwtToken);
      if (decoded && decoded.sub) {
        const studentId = parseInt(decoded.sub, 10);
        const profile = await getStudent(studentId);
        setStudent(profile);
        localStorage.setItem('student', JSON.stringify(profile));
      }
    } catch (err) {
      console.error('Failed to fetch student profile:', err);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        const decoded = parseJwt(storedToken);
        // Check if expired
        if (decoded && decoded.exp * 1000 > Date.now()) {
          setToken(storedToken);
          await fetchStudentProfile(storedToken);
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('student');
          setToken(null);
          setStudent(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();

    const handleExpired = () => {
      setToken(null);
      setStudent(null);
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [fetchStudentProfile]);

  const login = async (credentials: StudentLogin) => {
    const authRes = await apiLogin(credentials);
    const newToken = authRes.access_token;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    await fetchStudentProfile(newToken);
  };

  const signup = async (data: StudentCreate) => {
    await apiSignup(data);
    await login({ email: data.email, password: data.password });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('student');
    setToken(null);
    setStudent(null);
  };

  const refreshStudent = async () => {
    if (token) {
      await fetchStudentProfile(token);
    }
  };

  const isAdmin = Boolean(student?.is_admin);

  return (
    <AuthContext.Provider
      value={{
        student,
        token,
        isLoading,
        isAdmin,
        login,
        signup,
        logout,
        refreshStudent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
