const normalizeCount = (value) => {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value && typeof value === "object" && "count" in value) {
    return normalizeCount(value.count);
  }
  return 0;
};

const formatPart = (count, label) => (count > 0 ? `${count} ${label}` : "");

export default function formatInviteResults(results, fallbackMessage = "Invitations processed") {
  if (!results || typeof results !== "object") return fallbackMessage;

  const added = normalizeCount(results.added);
  const invited = normalizeCount(results.invited || results.newInvites);
  const alreadyMembers = normalizeCount(results.alreadyMembers);
  const alreadyInvited = normalizeCount(results.alreadyInvited);
  const invalid = normalizeCount(results.invalid);
  const removed = normalizeCount(
    results.removed || results.removedMembers || results.removedMember || results.membersRemoved
  );
  const cancelled = normalizeCount(
    results.cancelled ||
      results.cancelledInvites ||
      results.revoked ||
      results.revokedInvites ||
      results.invitesCancelled
  );

  const parts = [
    formatPart(added, "added"),
    formatPart(invited, "invited"),
    formatPart(alreadyMembers, "already members"),
    formatPart(alreadyInvited, "already invited"),
    formatPart(invalid, "invalid"),
    formatPart(removed, "removed"),
    formatPart(cancelled, "invites cancelled"),
  ].filter(Boolean);

  if (!parts.length) {
    return fallbackMessage;
  }

  return parts.join(", ");
}
