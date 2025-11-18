import { BrowserRouter, Routes, Route } from "react-router-dom";
import Signup from "./pages/Signup";
import SignupOtp from "./pages/SignupOtp";
import ProfileSetup from "./pages/ProfileSetup";
import Login from "./pages/Login";
import LoginOtp from "./pages/LoginOtp";
import LoginPassword from "./pages/LoginPassword";
import Dashboard from "./pages/Dashboard";
import Board from "./pages/Board";
import AuthProvider from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
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
