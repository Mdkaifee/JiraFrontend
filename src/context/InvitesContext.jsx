import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./AuthContext";
import { useToast } from "./ToastContext";
import getErrorMessage from "../utils/getErrorMessage";
import { acceptProjectInvite, fetchProjectInvitations } from "../api/projects";

const InvitesContext = createContext({
  invites: [],
  loading: false,
  refreshInvites: () => {},
  acceptInvite: () => Promise.resolve(false),
  lastAccepted: null,
});

export function InvitesProvider({ children }) {
  const { token } = useContext(AuthContext);
  const toast = useToast();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastAccepted, setLastAccepted] = useState(null);

  const refreshInvites = useCallback(async () => {
    if (!token) {
      setInvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchProjectInvitations(token);
      setInvites(res.data?.invites || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load invitations"));
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    if (!token) {
      setInvites([]);
      setLastAccepted(null);
      return;
    }
    refreshInvites();
  }, [token, refreshInvites]);

  const acceptInvite = useCallback(
    async (projectId) => {
      if (!token || !projectId) return false;
      let previousInvites = null;
      setInvites((prev) => {
        previousInvites = prev;
        return prev.filter((invite) => invite.projectId !== projectId);
      });
      try {
        const res = await acceptProjectInvite(projectId, token);
        setLastAccepted({ projectId, at: Date.now() });
        toast.success(res.data?.message || "Invitation accepted");
        refreshInvites();
        return true;
      } catch (error) {
        setInvites(previousInvites ? [...previousInvites] : []);
        toast.error(getErrorMessage(error, "Failed to accept invite"));
        return false;
      }
    },
    [token, toast, refreshInvites]
  );

  const value = useMemo(
    () => ({
      invites,
      loading,
      refreshInvites,
      acceptInvite,
      lastAccepted,
    }),
    [invites, loading, refreshInvites, acceptInvite, lastAccepted]
  );

  return <InvitesContext.Provider value={value}>{children}</InvitesContext.Provider>;
}

export const useInvites = () => useContext(InvitesContext);
