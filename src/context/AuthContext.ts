import { createContext, useContext } from 'react';

interface AuthContextType {
  isLoggedIn: boolean;
  login:  () => void;  // call after token saved
  logout: () => void;  // call after token removed
}

export const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  login:  () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);