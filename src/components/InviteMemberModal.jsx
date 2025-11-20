import { useCallback, useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import getErrorMessage from "../utils/getErrorMessage";
import { fetchProjects, inviteProjectMember } from "../api/projects";
import { fetchUsers } from "../api/users";

export default function InviteMemberModal({ open, onClose }) {
  const { token, user } = useContext(AuthContext);
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [sending, setSending] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!token) return;
    setLoadingProjects(true);
    try {
      const res = await fetchProjects(token);
      const list = res.data?.projects || [];
      setProjects(list);
      setSelectedProjectId((prev) => {
        if (prev && list.some((project) => project._id === prev)) {
          return prev;
        }
        return list[0]?._id || "";
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load projects"));
    } finally {
      setLoadingProjects(false);
    }
  }, [token, toast]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoadingUsers(true);
    try {
      const res = await fetchUsers(token);
      const list = (res.data?.users || []).filter((item) => item._id !== user?._id);
      setUsers(list);
      setSelectedUserId((prev) => {
        if (prev && list.some((user) => user._id === prev)) {
          return prev;
        }
        return list[0]?._id || "";
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load users"));
    } finally {
      setLoadingUsers(false);
    }
  }, [token, toast]);

  useEffect(() => {
    if (!open) return;
    loadProjects();
    loadUsers();
  }, [open, loadProjects, loadUsers]);

  useEffect(() => {
    if (open) return;
    setSelectedUserId("");
    setSelectedProjectId("");
  }, [open]);

  if (!open) return null;

  const hasProjects = projects.length > 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProjectId) {
      toast.error("Select a project");
      return;
    }
    if (!selectedUserId) {
      toast.error("Select a user");
      return;
    }

    const user = users.find((item) => item._id === selectedUserId);
    const email =
      user?.email ||
      user?.username ||
      user?.userName ||
      user?.contactEmail ||
      user?._id ||
      null;

    if (!email) {
      toast.error("Selected user does not have an email");
      return;
    }

    setSending(true);
    try {
      const payload = { email: email.trim().toLowerCase() };
      const res = await inviteProjectMember(selectedProjectId, payload, token);
      toast.success(res.data?.message || "Invitation sent");
      setSelectedUserId("");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send invite"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          onClick={onClose}
        >
          x
        </button>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Invite a teammate</h2>
            <p className="text-sm text-gray-500">
              Pick a project and send an invite. Registered users are added immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={loadProjects}
            className="text-sm font-medium text-blue-600 hover:underline"
            disabled={loadingProjects}
          >
            {loadingProjects ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {hasProjects && users.length > 0 ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-800">Project</label>
              <select
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
              >
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-800">Teammate</label>
              <select
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                {users.map((user) => {
                  const name =
                    user.fullName ||
                    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                    user.email ||
                    user.username ||
                    "User";
                  return (
                    <option key={user._id} value={user._id}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>
            <p className="text-xs text-gray-500">
              Selected teammates already have accounts, so they&apos;ll see the space instantly in
              their dashboard after the invite.
            </p>
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                disabled={sending}
              >
                {sending ? "Sending..." : "Send invite"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            {hasProjects
              ? "No teammates available yet. Ask them to create an account first."
              : "You don't have any spaces yet. Create a project first, then invite teammates."}
            <div className="mt-3 text-xs text-gray-500">
              <p>
                {loadingProjects || loadingUsers
                  ? "Loading data..."
                  : "Use the refresh button to reload projects and teammates."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
