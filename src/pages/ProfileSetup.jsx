import { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Loader from "../components/Loader";
import { updateProfile } from "../api/auth";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import getErrorMessage from "../utils/getErrorMessage";
import useRedirectIfAuthenticated from "../hooks/useRedirectIfAuthenticated";

export default function ProfileSetup() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const toast = useToast();
  useRedirectIfAuthenticated();

  const email = state?.email;
  const token = state?.token;
  const [fullName, setFullName] = useState(state?.user?.fullName || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!email || !token) {
      navigate("/login", { replace: true });
    }
  }, [email, token, navigate]);

  const handleUpdate = async (event) => {
    event.preventDefault();

    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }

    if (!password.trim()) {
      toast.error("Password is required");
      return;
    }

    const payload = {
      fullName: fullName.trim(),
      password: password.trim(),
    };

    setLoading(true);
    try {
      const res = await updateProfile(payload, token);
      const updatedUser =
        res.data?.user || {
          email,
          fullName: payload.fullName,
        };
      const authToken = res.data?.token || token;

      login(updatedUser, authToken);
      toast.success("Profile updated");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update profile"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <form onSubmit={handleUpdate} className="relative w-96 rounded bg-white p-6 shadow-lg">
        <Loader show={loading} />
        <h1 className="text-xl font-bold mb-2">Complete Profile</h1>
        <p className="mb-4 text-sm text-gray-500">
          Finish setting up your account for <span className="font-semibold">{email}</span>
        </p>

        <input
          className="mb-3 w-full rounded border px-3 py-2"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <input
          className="mb-4 w-full rounded border px-3 py-2"
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
          {loading ? "Saving..." : "Finish"}
        </button>
      </form>
    </div>
  );
}
