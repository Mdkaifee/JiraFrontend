import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../components/Loader";
import { checkUserExists } from "../api/auth";
import { useToast } from "../context/ToastContext";
import getErrorMessage from "../utils/getErrorMessage";
import useRedirectIfAuthenticated from "../hooks/useRedirectIfAuthenticated";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  useRedirectIfAuthenticated();

  const handleContinue = async (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      toast.error("Email is required");
      return;
    }

    setLoading(true);
    try {
      await checkUserExists(trimmedEmail);
      toast.success("Account found. Enter your password");
      navigate("/login-password", { state: { email: trimmedEmail } });
    } catch (error) {
      toast.error(getErrorMessage(error, "Account not found"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <form onSubmit={handleContinue} className="relative w-96 rounded bg-white p-6 shadow-lg">
        <Loader show={loading} />
        <h1 className="text-xl font-bold mb-4">Login</h1>

        <input
          className="mb-3 w-full rounded border px-3 py-2"
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Checking..." : "Continue"}
        </button>

        <p className="mt-4 text-center text-sm">
          Don’t have an account?{" "}
          <a href="/" className="text-blue-600 font-semibold">
            Signup
          </a>
        </p>
      </form>
    </div>
  );
}
