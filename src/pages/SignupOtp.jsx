import { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Loader from "../components/Loader";
import { verifySignupOtp } from "../api/auth";
import { useToast } from "../context/ToastContext";
import getErrorMessage from "../utils/getErrorMessage";
import useRedirectIfAuthenticated from "../hooks/useRedirectIfAuthenticated";
import { AuthContext } from "../context/AuthContext";

export default function SignupOtp() {
  const { state } = useLocation();
  const [otp, setOtp] = useState("");
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const email = state?.email;
  const { login } = useContext(AuthContext);
  useRedirectIfAuthenticated();

  useEffect(() => {
    if (!email) {
      navigate("/", { replace: true });
    }
  }, [email, navigate]);

  const handleVerify = async (event) => {
    event.preventDefault();

    if (!otp.trim()) {
      toast.error("OTP is required");
      return;
    }

    setLoading(true);
    try {
      const res = await verifySignupOtp(email, otp.trim());
      const { user, token } = res.data || {};

      if (user?.fullName && token) {
        login(user, token);
        toast.success("Welcome back! You're logged in");
        navigate("/dashboard", { replace: true });
      } else {
        toast.success("OTP verified");
        navigate("/profile-setup", { state: { ...res.data, email } });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Invalid OTP"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <form onSubmit={handleVerify} className="relative w-96 rounded bg-white p-6 shadow-lg">
        <Loader show={loading} />
        <h1 className="text-xl font-bold mb-4">Enter OTP</h1>
        <p className="mb-4 text-sm text-gray-600">
          We sent a 6 digit code to <span className="font-semibold">{email}</span>
        </p>
        <input
          className="mb-3 w-full rounded border px-3 py-2"
          placeholder="6-digit OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Verifying..." : "Verify OTP"}
        </button>
      </form>
    </div>
  );
}
