import { createContext, useMemo, useState } from "react";

export const AuthContext = createContext();

const parseStoredUser = () => {
  try {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn("Failed to parse stored user. Clearing cache.", error);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    return null;
  }
};

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(parseStoredUser);
  const [token, setToken] = useState(localStorage.getItem("token") || null);

  const login = (userData, jwt) => {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", jwt);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  const value = useMemo(
    () => ({ user, token, login, logout }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
