import { useMemo, useState } from "react";
import { useInvites } from "../context/InvitesContext";

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
};

const getInviterLabel = (invitedBy) => {
  if (!invitedBy) return "Unknown user";
  if (typeof invitedBy === "string") return invitedBy;
  const name =
    invitedBy.fullName ||
    [invitedBy.firstName, invitedBy.lastName].filter(Boolean).join(" ") ||
    invitedBy.email ||
    invitedBy.username;
  return name || "Unknown user";
};

export default function InvitesModal({ open, onClose }) {
  const { invites, loading, refreshInvites, acceptInvite } = useInvites();
  const [workingId, setWorkingId] = useState("");

  const visibleInvites = useMemo(() => invites || [], [invites]);

  if (!open) return null;

  const handleAccept = async (invite) => {
    if (!invite?.projectId) return;
    setWorkingId(invite.projectId);
    try {
      await acceptInvite(invite.projectId);
    } finally {
      setWorkingId("");
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
            <h2 className="text-xl font-semibold text-gray-900">Project invitations</h2>
            <p className="text-sm text-gray-500">Accept to add the space to your dashboard.</p>
          </div>
          <button
            type="button"
            className="text-sm font-medium text-blue-600 hover:underline"
            onClick={() => refreshInvites()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {visibleInvites.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
            No pending invitations. You will see upcoming invites here.
          </p>
        ) : (
          <ul className="space-y-4">
            {visibleInvites.map((invite) => (
              <li
                key={invite.inviteId || invite.projectId}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-gray-900">
                      {invite.projectName || "Untitled project"}
                    </p>
                    <p className="text-sm text-gray-500">
                      Invited by {getInviterLabel(invite.invitedBy)} on {formatDate(invite.invitedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                    onClick={() => handleAccept(invite)}
                    disabled={workingId === invite.projectId}
                  >
                    {workingId === invite.projectId ? "Accepting..." : "Accept"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
