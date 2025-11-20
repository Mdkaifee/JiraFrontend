export const normalizeInviteEmail = (value) => {
  if (!value || typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

export const extractInviteUserId = (entry) => {
  if (!entry) return "";
  if (typeof entry === "string") return entry;
  if (entry._id) return entry._id;
  if (entry.id) return entry.id;
  if (entry.userId) return entry.userId;
  if (entry.user) return extractInviteUserId(entry.user);
  if (entry.member) return extractInviteUserId(entry.member);
  if (entry.invitedUser) return extractInviteUserId(entry.invitedUser);
  return "";
};

export const extractInviteUserEmail = (entry) => {
  if (!entry) return "";
  if (typeof entry === "string") {
    return entry.includes("@") ? normalizeInviteEmail(entry) : "";
  }
  const candidate =
    entry.email ||
    entry.userEmail ||
    entry.inviteEmail ||
    entry.contactEmail ||
    entry.username ||
    entry.userName ||
    "";
  if (candidate && typeof candidate === "string") {
    return candidate.includes("@") ? normalizeInviteEmail(candidate) : "";
  }
  if (entry.user) return extractInviteUserEmail(entry.user);
  if (entry.member) return extractInviteUserEmail(entry.member);
  if (entry.invitedUser) return extractInviteUserEmail(entry.invitedUser);
  return "";
};

const addEntryToBlocklist = (entry, ids, emails) => {
  const id = extractInviteUserId(entry);
  if (id) ids.add(id);
  const email = extractInviteUserEmail(entry);
  if (email) emails.add(email);
};

export const buildInviteBlocklist = (project) => {
  const ids = new Set();
  const emails = new Set();
  if (!project) return { ids, emails };

  addEntryToBlocklist(project.owner, ids, emails);

  (project.members || []).forEach((member) => {
    addEntryToBlocklist(member?.user || member?.member || member, ids, emails);
  });

  const pendingInvites = project.invites || project.pendingInvites || [];
  pendingInvites.forEach((invite) => {
    addEntryToBlocklist(invite?.user || invite?.invitedUser || invite, ids, emails);
    if (invite?.email) emails.add(normalizeInviteEmail(invite.email));
    if (invite?.inviteEmail) emails.add(normalizeInviteEmail(invite.inviteEmail));
  });

  return { ids, emails };
};

export const filterEligibleInviteUsers = (users, project) => {
  const { ids, emails } = buildInviteBlocklist(project);
  return (users || []).filter((user) => {
    const id = user?._id || user?.id || user?.userId || "";
    const emailCandidate =
      user?.email ||
      user?.userEmail ||
      user?.contactEmail ||
      user?.username ||
      user?.userName ||
      "";
    const email = emailCandidate ? normalizeInviteEmail(emailCandidate) : "";
    const blockedById = Boolean(id && ids.has(id));
    const blockedByEmail = Boolean(email && emails.has(email));
    return !blockedById && !blockedByEmail;
  });
};

export const getInviteUserIdentifier = (user) =>
  extractInviteUserId(user) ||
  user?.email ||
  user?.username ||
  user?.userName ||
  "";

export const getInviteUserEmail = (user) => {
  if (!user) return "";
  const candidate =
    user.email ||
    user.userEmail ||
    user.contactEmail ||
    user.username ||
    user.userName ||
    "";
  return typeof candidate === "string" ? candidate.trim() : "";
};
