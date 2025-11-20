import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import getErrorMessage from "../utils/getErrorMessage";
import {
  fetchProjects,
  getProjectById,
  inviteProjectMember,
  revokeProjectInvite,
} from "../api/projects";
import { fetchUsers } from "../api/users";
import formatInviteResults from "../utils/formatInviteResults";
import {
  getInviteUserIdentifier,
  getInviteUserEmail,
  normalizeInviteEmail,
} from "../utils/inviteEligibility";

export default function InviteMemberModal({ open, onClose }) {
  const { token, user } = useContext(AuthContext);
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [pendingAddIds, setPendingAddIds] = useState([]);
  const [pendingRemovalIds, setPendingRemovalIds] = useState([]);
  const [projectDetails, setProjectDetails] = useState(null);
  const [projectDetailsLoading, setProjectDetailsLoading] = useState(false);
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
      setUsers(res.data?.users || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load users"));
    } finally {
      setLoadingUsers(false);
    }
  }, [token, toast]);

  const loadProjectDetails = useCallback(
    async (projectId) => {
      if (!token || !projectId) {
        setProjectDetails(null);
        return;
      }
      setProjectDetailsLoading(true);
      try {
        const res = await getProjectById(projectId, token);
        setProjectDetails(res.data?.project || res.data || null);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load project details"));
      } finally {
        setProjectDetailsLoading(false);
      }
    },
    [token, toast]
  );

  useEffect(() => {
    if (!open) return;
    loadProjects();
    loadUsers();
  }, [open, loadProjects, loadUsers]);

  useEffect(() => {
    if (!selectedProjectId) return;
    loadProjectDetails(selectedProjectId);
  }, [selectedProjectId, loadProjectDetails]);

  useEffect(() => {
    setPendingAddIds([]);
    setPendingRemovalIds([]);
  }, [selectedProjectId]);

  useEffect(() => {
    setPendingAddIds([]);
    setPendingRemovalIds([]);
  }, [projectDetails]);

  useEffect(() => {
    if (open) return;
    setPendingAddIds([]);
    setPendingRemovalIds([]);
    setSelectedProjectId("");
    setProjectDetails(null);
  }, [open]);

  if (!open) return null;

  const hasProjects = projects.length > 0;
  const currentUserId = getInviteUserIdentifier(user);
  const resolveProjectOwnerId = useCallback((projectData) => {
    if (!projectData) return "";
    const direct = getInviteUserIdentifier(projectData.owner);
    if (direct) return direct;
    const ownerMember = (projectData.members || []).find((member) => {
      const role =
        member?.role ||
        member?.user?.role ||
        member?.member?.role ||
        "";
      return typeof role === "string" && role.toLowerCase() === "owner";
    });
    if (ownerMember) {
      const target = ownerMember?.user || ownerMember?.member || ownerMember;
      return getInviteUserIdentifier(target);
    }
    return "";
  }, []);
  const selectedProject = useMemo(
    () => projects.find((proj) => proj._id === selectedProjectId),
    [projects, selectedProjectId]
  );
  const ownerIdFromDetails = useMemo(
    () => resolveProjectOwnerId(projectDetails),
    [projectDetails, resolveProjectOwnerId]
  );
  const ownerIdFallback = useMemo(
    () => resolveProjectOwnerId(selectedProject),
    [selectedProject, resolveProjectOwnerId]
  );
  const ownerId = ownerIdFromDetails || ownerIdFallback || "";
  const canManageAccess = Boolean(ownerId && currentUserId && ownerId === currentUserId);

  const workspaceUsers = useMemo(
    () =>
      (users || []).filter((entry) => {
        const entryId = getInviteUserIdentifier(entry);
        return entryId && entryId !== currentUserId;
      }),
    [users, currentUserId]
  );

  const memberMap = useMemo(() => {
    const map = new Map();
    if (!projectDetails) return map;
    (projectDetails.members || []).forEach((entry) => {
      const target = entry?.user || entry?.member || entry;
      const id = getInviteUserIdentifier(target);
      if (!id) return;
      map.set(id, entry);
    });
    if (projectDetails.owner) {
      const ownerKey = getInviteUserIdentifier(projectDetails.owner);
      if (ownerKey) {
        map.set(ownerKey, { ...projectDetails.owner, role: "Owner" });
      }
    }
    return map;
  }, [projectDetails]);

  const inviteMaps = useMemo(() => {
    const byId = new Map();
    const byEmail = new Map();
    if (!projectDetails) return { byId, byEmail };
    const invites = projectDetails.invites || projectDetails.pendingInvites || [];
    invites.forEach((invite) => {
      const target = invite?.user || invite?.invitedUser || invite;
      const id = getInviteUserIdentifier(target);
      if (id) byId.set(id, invite);
      const emailCandidate =
        invite?.email || invite?.inviteEmail || getInviteUserEmail(target) || invite?.username;
      const normalized = normalizeInviteEmail(emailCandidate);
      if (normalized) byEmail.set(normalized, invite);
    });
    return { byId, byEmail };
  }, [projectDetails]);

  const teammateEntries = useMemo(() => {
    return workspaceUsers.map((entry) => {
      const id = getInviteUserIdentifier(entry);
      const email = getInviteUserEmail(entry);
      const normalizedEmail = normalizeInviteEmail(email);
      const isOwner = Boolean(ownerId && id && id === ownerId);
      const memberInfo = id && memberMap.get(id) && !isOwner ? memberMap.get(id) : null;
      const inviteInfo =
        (id && inviteMaps.byId.get(id)) || (normalizedEmail && inviteMaps.byEmail.get(normalizedEmail));
      let status = "available";
      if (isOwner) status = "owner";
      else if (memberInfo) status = "member";
      else if (inviteInfo) status = "invited";
      return {
        id,
        email,
        normalizedEmail,
        user: entry,
        status,
        isOwner,
        memberInfo,
        inviteInfo,
      };
    });
  }, [workspaceUsers, ownerId, memberMap, inviteMaps]);

  const pendingAddSet = useMemo(() => new Set(pendingAddIds), [pendingAddIds]);
  const pendingRemovalSet = useMemo(() => new Set(pendingRemovalIds), [pendingRemovalIds]);
  const hasTeammates = teammateEntries.length > 0;
  const hasPendingChanges = pendingAddIds.length > 0 || pendingRemovalIds.length > 0;
  const allAvailableSelected = teammateEntries.some((entry) => entry.status === "available")
    ? teammateEntries
        .filter((entry) => entry.status === "available")
        .every((entry) => pendingAddSet.has(entry.id))
    : false;

  const toggleUserSelection = (entry) => {
    if (!entry?.id || entry.isOwner || !canManageAccess) return;
    if (entry.status === "available") {
      setPendingRemovalIds((prev) => prev.filter((id) => id !== entry.id));
      setPendingAddIds((prev) =>
        prev.includes(entry.id) ? prev.filter((id) => id !== entry.id) : [...prev, entry.id]
      );
      return;
    }
    setPendingAddIds((prev) => prev.filter((id) => id !== entry.id));
    setPendingRemovalIds((prev) =>
      prev.includes(entry.id) ? prev.filter((id) => id !== entry.id) : [...prev, entry.id]
    );
  };

  const handleSelectAll = () => {
    if (!hasTeammates || !canManageAccess) return;
    const inviteIds = teammateEntries
      .filter((entry) => entry.id && !entry.isOwner)
      .map((entry) => entry.id);
    setPendingAddIds(inviteIds);
    setPendingRemovalIds([]);
  };

  const handleDeselectAll = () => {
    if (!hasTeammates || !canManageAccess) return;
    const removalIds = teammateEntries.filter((entry) => entry.id && !entry.isOwner).map((entry) => entry.id);
    setPendingAddIds([]);
    setPendingRemovalIds(removalIds);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProjectId) {
      toast.error("Select a project");
      return;
    }
    if (!canManageAccess) {
      toast.error("Only the project owner can manage invitations");
      return;
    }

    const additions = teammateEntries.filter((entry) => pendingAddSet.has(entry.id));
    const removals = teammateEntries.filter((entry) => pendingRemovalSet.has(entry.id));

    if (additions.length === 0 && removals.length === 0) {
      toast.error("Select at least one teammate to invite or remove");
      return;
    }

    const inviteEmails = additions
      .map((entry) => normalizeInviteEmail(entry.email))
      .filter(Boolean);
    if (additions.length > 0 && inviteEmails.length !== additions.length) {
      toast.error("Some selected teammates do not have an email address");
      return;
    }

    const removalEmails = removals
      .map((entry) => normalizeInviteEmail(entry.email))
      .filter(Boolean);
    if (removals.length > 0 && removalEmails.length !== removals.length) {
      toast.error("Cannot revoke access for teammates without an email address");
      return;
    }

    const aggregateResults = (resultList) => {
      const totals = {};
      resultList.forEach((result) => {
        if (!result || typeof result !== "object") return;
        Object.entries(result).forEach(([key, value]) => {
          if (typeof value === "number") {
            totals[key] = (totals[key] || 0) + value;
          } else if (value === true) {
            totals[key] = (totals[key] || 0) + 1;
          }
        });
      });
      return totals;
    };

    setSending(true);
    try {
      if (inviteEmails.length > 0) {
        const payload = inviteEmails.length === 1 ? { email: inviteEmails[0] } : { emails: inviteEmails };
        const res = await inviteProjectMember(selectedProjectId, payload, token);
        const message = formatInviteResults(res.data?.results, res.data?.message || "Invitations updated");
        toast.success(message);
      }

      if (removalEmails.length > 0) {
        const payload = removalEmails.length === 1 ? { email: removalEmails[0] } : { emails: removalEmails };
        const res = await revokeProjectInvite(selectedProjectId, payload, token);
        const message = formatInviteResults(res.data?.results, res.data?.message || "Updated project access");
        toast.success(message);
      }

      setPendingAddIds([]);
      setPendingRemovalIds([]);
      await loadProjectDetails(selectedProjectId);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update teammates"));
    } finally {
      setSending(false);
    }
  };

  const renderTeammateList = () => {
    if (projectDetailsLoading || loadingUsers) {
      return (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          Loading teammates...
        </p>
      );
    }
    if (!hasTeammates) {
      return (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          No teammates found.
        </p>
      );
    }
    return (
      <div className="max-h-60 overflow-y-auto rounded-xl border border-gray-200">
        {teammateEntries.map((entry) => {
          const label =
            entry.user.fullName ||
            [entry.user.firstName, entry.user.lastName].filter(Boolean).join(" ") ||
            entry.user.email ||
            entry.user.username ||
            "Teammate";
          const isBaseChecked = entry.status === "owner" || entry.status === "member" || entry.status === "invited";
          const isChecked =
            entry.status === "available"
              ? pendingAddSet.has(entry.id)
              : isBaseChecked && !pendingRemovalSet.has(entry.id);
          const disableToggle = entry.isOwner || sending || !canManageAccess;
          const statusLabel =
            entry.status === "owner"
              ? "Owner"
              : entry.status === "member"
              ? "Member"
              : entry.status === "invited"
              ? "Invited"
              : pendingAddSet.has(entry.id)
              ? "Pending invite"
              : pendingRemovalSet.has(entry.id)
              ? "Will be removed"
              : "";
          return (
            <label
              key={entry.id}
              className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={isChecked}
                disabled={disableToggle}
                onChange={() => toggleUserSelection(entry)}
              />
              <div className="flex flex-1 items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{label}</p>
                  {entry.email && <p className="text-xs text-gray-500">{entry.email}</p>}
                </div>
                {statusLabel && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                    {statusLabel}
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    );
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
        {hasProjects ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-800">Project</label>
              <select
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
              >
                {projects.map((project) => {
                  const projectOwnerId = resolveProjectOwnerId(project);
                  const roleLabel =
                    projectOwnerId && currentUserId && projectOwnerId === currentUserId
                      ? "Owner"
                      : "Collaborator";
                  return (
                    <option key={project._id} value={project._id}>
                      {project.name} ({roleLabel})
                    </option>
                  );
                })}
              </select>
            </div>
            {canManageAccess ? (
              <>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-800">Teammates</label>
                    <div className="flex items-center gap-2">
                      {hasTeammates && (
                        <>
                          <button
                            type="button"
                            className="text-xs font-semibold text-blue-600 hover:underline"
                            onClick={handleSelectAll}
                            disabled={sending}
                          >
                            Select all
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-gray-500 hover:underline"
                            onClick={handleDeselectAll}
                            disabled={sending}
                          >
                            Deselect all
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {renderTeammateList()}
                  <p className="mt-2 text-xs text-gray-500">
                    Checked teammates already have access or a pending invite. Uncheck to revoke, or
                    check available teammates to invite them.
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  Selected teammates already have accounts, so they&apos;ll see the space instantly in
                  their dashboard after the invite.
                </p>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                    disabled={sending || !hasPendingChanges}
                  >
                    {sending ? "Updating..." : "Update access"}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-600">
                <p className="font-semibold text-gray-800">You&apos;re a collaborator</p>
                <p className="mt-1">
                  Only project owners can send or revoke invitations. You still have access to this
                  space but cannot manage teammates.
                </p>
              </div>
            )}
          </form>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            {"You don't have any spaces yet. Create a project first, then invite teammates."}
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
