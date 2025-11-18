import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "./Loader";
import { logoutUser } from "../api/auth";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import getErrorMessage from "../utils/getErrorMessage";

export default function Sidebar() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      if (token) {
        await logoutUser(token);
      }
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to logout"));
    } finally {
      logout();
      navigate("/login", { replace: true });
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-60 bg-blue-600 p-5 text-white">
      <Loader show={loading} />
      <h2 className="text-xl font-bold mb-6">Dashboard</h2>

      <button
        onClick={handleLogout}
        disabled={loading}
        className="mt-10 rounded bg-white px-4 py-2 text-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Logging out..." : "Logout"}
      </button>
    </div>
  );
}
