import { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Loader from "../components/Loader";
import { verifyLoginOtp } from "../api/auth";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import getErrorMessage from "../utils/getErrorMessage";
import useRedirectIfAuthenticated from "../hooks/useRedirectIfAuthenticated";

export default function LoginOtp() {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const { state } = useLocation();
  const email = state?.email;
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const toast = useToast();
  useRedirectIfAuthenticated();

  useEffect(() => {
    if (!email) {
      navigate("/login", { replace: true });
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
      const res = await verifyLoginOtp(email, otp.trim());
      const { user, token } = res.data || {};

      if (user?.fullName) {
        login(user, token);
        toast.success("Logged in successfully");
        navigate("/dashboard", { replace: true });
      } else {
        toast.info("Please complete your profile");
        navigate("/profile-setup", {
          state: {
            token,
            email,
            user,
          },
        });
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
          We sent a login code to <span className="font-semibold">{email}</span>
        </p>

        <input
          className="mb-4 w-full rounded border px-3 py-2"
          placeholder="6-digit OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Verifying..." : "Verify & Continue"}
        </button>
      </form>
    </div>
  );
}
