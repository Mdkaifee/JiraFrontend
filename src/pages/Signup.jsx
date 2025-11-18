import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../components/Input";
import Loader from "../components/Loader";
import { checkUserExists, sendSignupOtp } from "../api/auth";
import { useToast } from "../context/ToastContext";
import getErrorMessage from "../utils/getErrorMessage";
import useRedirectIfAuthenticated from "../hooks/useRedirectIfAuthenticated";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  useRedirectIfAuthenticated();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      toast.error("Email is required");
      return;
    }

    setLoading(true);
    let accountExists = false;

    try {
      await checkUserExists(trimmedEmail);
      accountExists = true;
    } catch (error) {
      const status = error?.response?.status;
      if (status && status !== 404) {
        toast.error(getErrorMessage(error, "Failed to check account"));
        setLoading(false);
        return;
      }
    }

    if (accountExists) {
      toast.info("Account already exists. Please login");
      navigate("/login-password", { state: { email: trimmedEmail } });
      setLoading(false);
      return;
    }

    try {
      await sendSignupOtp(trimmedEmail);
      toast.success("OTP sent to your email");
      navigate("/signup-otp", { state: { email: trimmedEmail } });
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send OTP"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <form onSubmit={handleSubmit} className="relative w-96 rounded bg-white p-6 shadow-lg">
        <Loader show={loading} />
        <h1 className="text-xl font-bold mb-4">Signup</h1>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Sending OTP..." : "Continue"}
        </button>
        <p className="mt-4 text-center text-sm">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 font-semibold">
            Login
          </a>
        </p>
      </form>
    </div>
  );
}
