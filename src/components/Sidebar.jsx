import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "./Loader";
import { logoutUser } from "../api/auth";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import getErrorMessage from "../utils/getErrorMessage";

const NAV_LINKS = [
  { label: "Dashboard", path: "/dashboard", icon: "🏠" },
  { label: "Spaces", path: "/dashboard", icon: "🗂️" },
  { label: "Reports", path: "/dashboard", icon: "📊" },
  { label: "Team", path: "/dashboard", icon: "👥" },
];

const ACTIONS = [
  { label: "Create space", icon: "＋" },
  { label: "Invite teammate", icon: "✉️" },
];

export default function Sidebar() {
  const { token, user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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
      setShowLogoutModal(false);
    }
  };

  return (
    <>
      <aside className="relative flex h-screen w-72 flex-col border-r border-gray-100 bg-white/80 p-6 backdrop-blur md:w-64">
        <Loader show={loading} />
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-violet-100 px-3 py-2 text-sm font-bold uppercase text-violet-700">
            {user?.fullName?.slice(0, 2) || "JD"}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400"> {user?.fullName}</p>
            <p className="text-base font-semibold text-gray-900">Atlas Workbench</p>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-r from-violet-500 to-blue-500 p-4 text-white shadow-lg">
          <p className="text-xs uppercase tracking-widest text-white/70">Focus sprint</p>
          <p className="mt-1 text-lg font-semibold">Sprint 12 · Alpha</p>
          <p className="text-xs text-white/70">Estimated wrap in 4 days</p>
        </div>
      </div>

      <nav className="mt-6 flex-1 space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Navigation
          </p>
          <ul className="space-y-1">
            {NAV_LINKS.map((link, index) => (
              <li key={link.label}>
                <button
                  type="button"
                  onClick={() => navigate(link.path)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    index === 0
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-violet-50 hover:text-violet-700"
                  }`}
                >
                  <span className="text-lg">{link.icon}</span>
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 rounded-2xl border border-dashed border-gray-200 p-3">
          <p className="text-sm font-semibold text-gray-800">Quick actions</p>
          {ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
            >
              <span className="text-lg">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="space-y-3">
        <div className="rounded-2xl bg-gray-50 p-3 text-xs text-gray-500">
          <p className="font-semibold text-gray-700">Workspace tips</p>
          <p>Drag columns to reorder, or use the ⋮ menu to rename and delete.</p>
        </div>
        <button
          onClick={() => setShowLogoutModal(true)}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Signing out..." : "Logout"}
        </button>
      </div>
      </aside>
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-lg font-semibold text-gray-900">Are you sure you want to logout?</p>
            <p className="mt-1 text-sm text-gray-500">Your session will end immediately.</p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
              >
                {loading ? "Signing out..." : "Yes, logout"}
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
