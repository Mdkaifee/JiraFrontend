import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useContext, useEffect, useRef } from "react";
import axios from "axios";
import Signup from "./pages/Signup";
import SignupOtp from "./pages/SignupOtp";
import ProfileSetup from "./pages/ProfileSetup";
import Login from "./pages/Login";
import LoginOtp from "./pages/LoginOtp";
import LoginPassword from "./pages/LoginPassword";
import Dashboard from "./pages/Dashboard";
import Board from "./pages/Board";
import AuthProvider, { AuthContext } from "./context/AuthContext";
import { ToastProvider, useToast } from "./context/ToastContext";

function SessionWatcher() {
  const { logout } = useContext(AuthContext);
  const toast = useToast();
  const isHandlingRef = useRef(false);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        const message = `${error?.response?.data?.message || ""}`.toLowerCase();
        const shouldLogout =
          status === 401 ||
          status === 419 ||
          message.includes("session expired") ||
          message.includes("login again");

        if (shouldLogout && !isHandlingRef.current) {
          isHandlingRef.current = true;
          toast.error(error?.response?.data?.message || "Session expired, please login again.");
          logout();
          window.location.href = "/login";
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
      isHandlingRef.current = false;
    };
  }, [logout, toast]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SessionWatcher />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Signup />} />
            <Route path="/signup-otp" element={<SignupOtp />} />
            <Route path="/profile-setup" element={<ProfileSetup />} />

            <Route path="/login" element={<Login />} />
            <Route path="/login-password" element={<LoginPassword />} />
            <Route path="/login-otp" element={<LoginOtp />} />

            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects/:projectId" element={<Board />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
