import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Loader from "../components/Loader";
import { sendLoginOtp } from "../api/auth";
import { useToast } from "../context/ToastContext";
import getErrorMessage from "../utils/getErrorMessage";
import useRedirectIfAuthenticated from "../hooks/useRedirectIfAuthenticated";

export default function LoginPassword() {
  const { state } = useLocation();
  const email = state?.email;
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  useRedirectIfAuthenticated();

  useEffect(() => {
    if (!email) {
      navigate("/login", { replace: true });
    }
  }, [email, navigate]);

  const handleSendOtp = async (event) => {
    event.preventDefault();

    if (!password.trim()) {
      toast.error("Password is required");
      return;
    }

    setLoading(true);
    try {
      await sendLoginOtp(email, password.trim());
      toast.success("OTP sent to your email");
      navigate("/login-otp", { state: { email } });
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send OTP"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <form onSubmit={handleSendOtp} className="relative w-96 rounded bg-white p-6 shadow-lg">
        <Loader show={loading} />
        <h1 className="text-xl font-bold mb-4">Enter Password</h1>
        <p className="mb-4 text-sm text-gray-600">Logging in as {email}</p>

        <input
          className="mb-3 w-full rounded border px-3 py-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Sending OTP..." : "Send OTP"}
        </button>
      </form>
    </div>
  );
}
