import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Loader from "../components/Loader";
import Sidebar from "../components/Sidebar";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useInvites } from "../context/InvitesContext";
import getErrorMessage from "../utils/getErrorMessage";
import formatInviteResults from "../utils/formatInviteResults";
import {
  getInviteUserIdentifier,
  getInviteUserEmail,
  normalizeInviteEmail,
} from "../utils/inviteEligibility";
import {
  createProject,
  createProjectColumn,
  deleteProjectColumn,
  fetchProjectColumns,
  fetchProjects,
  getProjectById,
  inviteProjectMember,
  revokeProjectInvite,
  updateProjectColumn,
} from "../api/projects";
import { fetchUsers } from "../api/users";

export default function Board() {
  const { projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { lastAccepted } = useInvites();
  const { token, user } = useContext(AuthContext);

  const [project, setProject] = useState(location.state?.project || null);
  const [columns, setColumns] = useState(location.state?.project?.columns || []);
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [settingsTab, setSettingsTab] = useState("columns");
  const [pendingInviteAddIds, setPendingInviteAddIds] = useState([]);
  const [pendingInviteRemovalIds, setPendingInviteRemovalIds] = useState([]);
  const [invitingMember, setInvitingMember] = useState(false);
  const [users, setUsers] = useState([]);
  const [newColumnForm, setNewColumnForm] = useState({ name: "", order: "" });
  const [quickColumnForm, setQuickColumnForm] = useState({ name: "", order: "" });
  const [showQuickColumnForm, setShowQuickColumnForm] = useState(false);
  const [columnEdits, setColumnEdits] = useState({});
  const [deletePrompt, setDeletePrompt] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [draggingCard, setDraggingCard] = useState(null);
  const [draggingColumn, setDraggingColumn] = useState(null);
  const [columnMenu, setColumnMenu] = useState(null);
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [renameColumnModal, setRenameColumnModal] = useState({
    open: false,
    column: null,
    value: "",
  });
  const [newSpaceForm, setNewSpaceForm] = useState({
    name: "",
    description: "",
    boardType: "scrum",
    status: "created",
  });
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [cardModal, setCardModal] = useState({
    open: false,
    columnId: null,
    cardIndex: null,
  });
  const [cardForm, setCardForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    status: "",
    assignee: "",
  });
  const [selectedAssignees, setSelectedAssignees] = useState([]);

  const fetchProject = useCallback(async () => {
    if (!token || !projectId) return;
    setLoading(true);
    try {
      const res = await getProjectById(projectId, token);
      const fetchedProject = res.data?.project || null;
      setProject(fetchedProject);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load board"));
    } finally {
      setLoading(false);
    }
  }, [token, projectId, toast]);

  const loadColumns = useCallback(async () => {
    if (!token || !projectId) return;
    setColumnsLoading(true);
    try {
      const res = await fetchProjectColumns(projectId, token);
      setColumns(res.data?.columns || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load board columns"));
    } finally {
      setColumnsLoading(false);
    }
  }, [token, projectId, toast]);

  const loadSpaces = useCallback(async () => {
    if (!token) return;
    setSpacesLoading(true);
    try {
      const res = await fetchProjects(token);
      setSpaces(res.data?.projects || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load spaces"));
    } finally {
      setSpacesLoading(false);
    }
  }, [token, toast]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchUsers(token);
      setUsers(res.data?.users || []);
    } catch (error) {
      // users are optional, so silently fail but log toast once.
      toast.error(getErrorMessage(error, "Failed to load users"));
    }
  }, [token, toast]);

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    fetchProject();
    loadColumns();
    loadUsers();
    loadSpaces();
  }, [token, fetchProject, loadColumns, loadUsers, loadSpaces, navigate]);

  useEffect(() => {
    if (!lastAccepted?.at) return;
    loadSpaces();
    if (lastAccepted.projectId === projectId) {
      fetchProject();
      loadColumns();
    }
  }, [lastAccepted, projectId, loadSpaces, fetchProject, loadColumns]);

  useEffect(() => {
    setColumnEdits((prev) => {
      const validKeys = new Set(columns.map((column) => column._id || column.name));
      let changed = false;
      const next = {};
      Object.entries(prev).forEach(([key, value]) => {
        if (validKeys.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    if (deletePrompt && !columns.some((column) => column.name === deletePrompt.name)) {
      setDeletePrompt(null);
    }
  }, [columns, deletePrompt]);

  useEffect(() => {
    if (!cardModal.open || !columns.length)
      return;

    const statusExists = columns.some(
      (column) => column.name.toLowerCase() === (cardForm.status || "").toLowerCase()
    );

    if (!statusExists) {
      setCardForm((prev) => ({
        ...prev,
        status: columns[0]?.name || "",
      }));
    }
  }, [cardModal.open, cardForm.status, columns]);

  const formatDate = (value) => {
    if (!value) return "No due date";
    try {
      return new Date(value).toLocaleDateString();
    } catch (error) {
      return value;
    }
  };

  const columnKey = (column) => column._id || column.name;

  const getUserLabel = (userId) => {
    if (!userId) return "Unassigned";
    const user = users.find((item) => item._id === userId);
    if (!user) return userId;
    if (user.fullName) return user.fullName;
    const pieces = [user.firstName, user.lastName].filter(Boolean);
    if (pieces.length) return pieces.join(" ");
    return user.email || user.username || userId;
  };

  const getUserInitial = (userId) => {
    const label = getUserLabel(userId);
    return label ? label.trim().charAt(0).toUpperCase() : "?";
  };

  const extractUserId = (value) => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (value._id) return value._id;
    if (value.id) return value.id;
    if (value.userId) return value.userId;
    if (value.user) return extractUserId(value.user);
    return null;
  };

  const getMemberDisplay = (member) => {
    if (!member) return { id: "", name: "Unknown user", email: "" };
    if (typeof member === "string") {
      const match = users.find((item) => item._id === member);
      return {
        id: member,
        name: match ? getUserLabel(member) : member,
        email: match?.email || "",
      };
    }
    if (member.user) return getMemberDisplay(member.user);
    const id = member._id || member.id || member.userId || member.email || member.username || "";
    const name =
      member.fullName ||
      [member.firstName, member.lastName].filter(Boolean).join(" ") ||
      member.email ||
      member.username ||
      id ||
      "Member";
    const email = member.email || member.userEmail || member.username || "";
    return { id, name, email };
  };

  const columnCount = columns.length;
  const filteredColumns = useMemo(() => {
    if (!selectedAssignees.length) return columns;
    return columns.map((column) => ({
      ...column,
      cards: (column.cards || []).filter((card) => {
        const assigneeId = card.assignee || "unassigned";
        return selectedAssignees.includes(assigneeId);
      }),
    }));
  }, [columns, selectedAssignees]);
  const boardBusy = loading || saving || columnsLoading;
  const rawMembers = Array.isArray(project?.members) ? project.members : [];
  const userId = user?._id || null;
  const resolvedOwnerId = useMemo(() => {
    const direct = extractUserId(project?.owner);
    if (direct) return direct;
    const ownerMember = rawMembers.find((entry) => {
      const role =
        entry?.role ||
        entry?.user?.role ||
        entry?.member?.role ||
        "";
      return typeof role === "string" && role.toLowerCase() === "owner";
    });
    if (ownerMember) {
      const target = ownerMember?.user || ownerMember?.member || ownerMember;
      return extractUserId(target);
    }
    return null;
  }, [project, rawMembers]);
  const ownerId = resolvedOwnerId;
  const isOwner = Boolean(userId && ownerId && userId === ownerId);
  const isCollaborator = Boolean(
    userId &&
      rawMembers.some((entry) => {
        const target = entry?.user || entry?.member || entry;
        return extractUserId(target) === userId;
      })
  );
  const canAccessSettings = isOwner || isCollaborator;
  const canInviteMembers = isOwner;
  const memberEntries = (() => {
    const entries = [];
    const seen = new Set();
    if (project?.owner) {
      const info = getMemberDisplay(project.owner);
      const key = ownerId || info.id || `owner-${projectId || "current"}`;
      seen.add(key);
      entries.push({
        key,
        ...info,
        role: "Owner",
        joinedAt: project?.createdAt || project?.createdOn || null,
        status: "active",
      });
    }
    rawMembers.forEach((entry, index) => {
      const target = entry?.user || entry?.member || entry;
      if (!target) return;
      const info = getMemberDisplay(target);
      const key = info.id || info.email || `member-${index}`;
      if (seen.has(key)) return;
      seen.add(key);
      const joinedAt =
        entry?.joinedAt || entry?.acceptedAt || entry?.addedAt || entry?.invitedAt || null;
      const status =
        entry?.status ||
        (entry?.joinedAt || entry?.acceptedAt
          ? "active"
          : entry?.invitedAt
          ? "pending invite"
          : "");
      entries.push({
        key,
        ...info,
        role:
          entry?.role && entry.role.toLowerCase() === "owner" ? "Owner" : entry?.role || "Collaborator",
        joinedAt,
        status,
      });
    });
    return entries;
  })();

  const currentUserId = getInviteUserIdentifier(user);
  const projectOwnerId = useMemo(() => getInviteUserIdentifier(project?.owner), [project]);
  const workspaceUsers = useMemo(
    () =>
      (users || []).filter((entry) => {
        const id = getInviteUserIdentifier(entry);
        return id && id !== currentUserId;
      }),
    [users, currentUserId]
  );

  const memberMap = useMemo(() => {
    const map = new Map();
    if (!project) return map;
    (project.members || []).forEach((entry) => {
      const target = entry?.user || entry?.member || entry;
      const id = getInviteUserIdentifier(target);
      if (!id) return;
      map.set(id, entry);
    });
    if (project.owner) {
      const ownerKey = getInviteUserIdentifier(project.owner);
      if (ownerKey) map.set(ownerKey, { ...project.owner, role: "Owner" });
    }
    return map;
  }, [project]);

  const inviteMaps = useMemo(() => {
    const byId = new Map();
    const byEmail = new Map();
    if (!project) return { byId, byEmail };
    const inviteList = project.invites || project.pendingInvites || [];
    inviteList.forEach((invite) => {
      const target = invite?.user || invite?.invitedUser || invite;
      const id = getInviteUserIdentifier(target);
      if (id) byId.set(id, invite);
      const emailCandidate =
        invite?.email || invite?.inviteEmail || getInviteUserEmail(target) || invite?.username;
      const normalized = normalizeInviteEmail(emailCandidate);
      if (normalized) byEmail.set(normalized, invite);
    });
    return { byId, byEmail };
  }, [project]);

  const inviteEntries = useMemo(() => {
    return workspaceUsers.map((entry) => {
      const id = getInviteUserIdentifier(entry);
      const email = getInviteUserEmail(entry);
      const normalizedEmail = normalizeInviteEmail(email);
      const isOwner = Boolean(projectOwnerId && id && id === projectOwnerId);
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
  }, [workspaceUsers, projectOwnerId, memberMap, inviteMaps]);

  const pendingInviteAddSet = useMemo(() => new Set(pendingInviteAddIds), [pendingInviteAddIds]);
  const pendingInviteRemovalSet = useMemo(
    () => new Set(pendingInviteRemovalIds),
    [pendingInviteRemovalIds]
  );
  const hasInviteTeammates = inviteEntries.length > 0;
  const availableInviteEntries = useMemo(
    () => inviteEntries.filter((entry) => entry.status === "available"),
    [inviteEntries]
  );
  const allAvailableInviteesSelected = availableInviteEntries.length
    ? availableInviteEntries.every((entry) => pendingInviteAddSet.has(entry.id))
    : false;
  const hasPendingInviteChanges =
    pendingInviteAddIds.length > 0 || pendingInviteRemovalIds.length > 0;

  useEffect(() => {
    setPendingInviteAddIds([]);
    setPendingInviteRemovalIds([]);
  }, [projectId, project?.members?.length, project?.invites?.length]);

  useEffect(() => {
    if (!canAccessSettings && showColumnManager) {
      setShowColumnManager(false);
    }
  }, [canAccessSettings, showColumnManager]);

  const updateColumnCards = useCallback(
    async (columnName, cards, successMessage = "Board updated", options = {}) => {
      const { notify = true } = options;
      if (!projectId || !token) return;
      setSaving(true);
      try {
        const res = await updateProjectColumn(projectId, columnName, { cards }, token);
        setColumns(res.data?.columns || []);
        if (notify)
          toast.success(res.data?.message || successMessage);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to update column"));
      } finally {
        setSaving(false);
      }
    },
    [projectId, token, toast]
  );

  const openCardModal = (columnId, cardIndex) => {
    const column = columns.find((item) => columnKey(item) === columnId);
    const card = column?.cards?.[cardIndex];
    setCardForm({
      title: card?.title || "",
      description: card?.description || "",
      dueDate: card?.dueDate ? card.dueDate.slice(0, 10) : "",
      status: card?.status || column?.name || "",
      assignee: card?.assignee || "",
    });
    setCardModal({ open: true, columnId, cardIndex });
    setActiveMenu(null);
  };

  const closeCardModal = () => {
    setCardModal({ open: false, columnId: null, cardIndex: null });
    setCardForm({
      title: "",
      description: "",
      dueDate: "",
      status: "",
      assignee: "",
    });
  };

  const handleCardFormChange = (event) => {
    const { name, value } = event.target;
    setCardForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCardFormSubmit = async (event) => {
    event.preventDefault();
    const { columnId, cardIndex } = cardModal;
    if (!columnId) return;
    const column = columns.find((item) => columnKey(item) === columnId);
    if (!column) return;
    const targetStatus = cardForm.status || column.name;
    const targetColumn = columns.find(
      (item) => item.name.toLowerCase() === targetStatus.toLowerCase()
    );

    if (!targetColumn) {
      toast.error("Select a valid column");
      return;
    }

    const cards = [...(column.cards || [])];
    const existingCard = cards[cardIndex] || {};
    const isNewCard = cardIndex >= cards.length || !cards[cardIndex];
    const updatedCard = {
      ...existingCard,
      title: cardForm.title || "Untitled task",
      description: cardForm.description,
      dueDate: cardForm.dueDate ? new Date(cardForm.dueDate).toISOString() : null,
      status: targetColumn.name,
      assignee: cardForm.assignee || null,
    };

    if (targetColumn.name === column.name) {
      cards[cardIndex] = updatedCard;
      await updateColumnCards(column.name, cards, isNewCard ? "Card created" : "Card updated");
    } else {
      if (!isNewCard) {
        const filteredCards = (column.cards || []).filter((_, idx) => idx !== cardIndex);
        await updateColumnCards(column.name, filteredCards, "Card moved", { notify: false });
      }

      const destinationCards = [...(targetColumn.cards || []), updatedCard];
      await updateColumnCards(targetColumn.name, destinationCards, "Card moved");
    }

    closeCardModal();
  };

  const handleDeleteCard = async (columnId, cardIndex) => {
    const column = columns.find((item) => columnKey(item) === columnId);
    if (!column) return;
    const cards = (column.cards || []).filter((_, idx) => idx !== cardIndex);
    await updateColumnCards(column.name, cards, "Card removed");
    setActiveMenu(null);
  };

  const toggleCardMenu = (columnId, cardIndex) => {
    if (activeMenu && activeMenu.columnId === columnId && activeMenu.cardIndex === cardIndex) {
      setActiveMenu(null);
      return;
    }
    setActiveMenu({ columnId, cardIndex });
  };

  const handleRefreshBoard = useCallback(() => {
    fetchProject();
    loadColumns();
  }, [fetchProject, loadColumns]);

  const persistColumnOrder = useCallback(
    async (columnName, order, successMessage = "Column reordered") => {
      if (!projectId || !token) return;
      setSaving(true);
      try {
        const res = await updateProjectColumn(projectId, columnName, { order }, token);
        setColumns(res.data?.columns || []);
        toast.success(res.data?.message || successMessage);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to reorder column"));
      } finally {
        setSaving(false);
      }
    },
    [projectId, token, toast]
  );

  const moveColumnToIndex = useCallback(
    async (sourceIndex, insertIndex) => {
      if (sourceIndex < 0)
        return;

      const column = columns[sourceIndex];
      if (!column)
        return;

      let targetIndex = Math.max(0, Math.min(insertIndex, columns.length));
      if (targetIndex > sourceIndex)
        targetIndex -= 1;
      targetIndex = Math.max(0, Math.min(targetIndex, columns.length - 1));

      if (targetIndex === sourceIndex)
        return;

      await persistColumnOrder(column.name, targetIndex + 1);
    },
    [columns, persistColumnOrder]
  );

  const moveDraggedCard = useCallback(
    async (targetColumnId, insertIndex) => {
      if (!draggingCard)
        return;

      const { columnId, cardIndex } = draggingCard;
      const sourceColumn = columns.find((item) => columnKey(item) === columnId);
      const targetColumn = columns.find((item) => columnKey(item) === targetColumnId);

      if (!sourceColumn || !targetColumn) {
        setDraggingCard(null);
        return;
      }

      const sourceCards = sourceColumn.cards || [];
      const card = sourceCards[cardIndex];

      if (!card) {
        setDraggingCard(null);
        return;
      }

      const targetCards = targetColumn.cards || [];
      const rawIndex =
        typeof insertIndex === "number" ? insertIndex : targetCards.length;

      if (sourceColumn.name === targetColumn.name) {
        const reordered = sourceCards.slice();
        reordered.splice(cardIndex, 1);
        let targetPosition = rawIndex;
        if (targetPosition > cardIndex)
          targetPosition -= 1;
        targetPosition = Math.max(0, Math.min(targetPosition, reordered.length));
        reordered.splice(targetPosition, 0, {
          ...card,
          status: targetColumn.name,
        });
        await updateColumnCards(targetColumn.name, reordered, "Card moved");
      } else {
        const sourceNext = sourceCards.filter((_, idx) => idx !== cardIndex);
        await updateColumnCards(sourceColumn.name, sourceNext, "Card moved", { notify: false });

        const destinationCards = [...targetCards];
        const safeIndex = Math.max(0, Math.min(rawIndex, destinationCards.length));
        destinationCards.splice(safeIndex, 0, {
          ...card,
          status: targetColumn.name,
        });
        await updateColumnCards(targetColumn.name, destinationCards, "Card moved");
      }

      setDraggingCard(null);
      setActiveMenu(null);
    },
    [columns, draggingCard, updateColumnCards]
  );

  const handleCardDragStart = (event, columnId, cardIndex) => {
    setDraggingColumn(null);
    setDraggingCard({ columnId, cardIndex });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify({ columnId, cardIndex }));
  };

  const handleCardDragEnd = () => {
    setDraggingCard(null);
  };

  const handleColumnDragOver = (event) => {
    if (!draggingCard) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleColumnDrop = async (event, targetColumnId) => {
    event.preventDefault();
    if (!draggingCard) return;

    const targetColumn = columns.find((item) => columnKey(item) === targetColumnId);
    const nextIndex = targetColumn?.cards?.length || 0;
    await moveDraggedCard(targetColumnId, nextIndex);
  };

  const handleCardDragOver = (event) => {
    if (!draggingCard) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
  };

  const handleCardDrop = async (event, targetColumnId, targetIndex) => {
    if (!draggingCard) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const dropAfter = event.clientY > rect.top + rect.height / 2;
    const insertIndex = dropAfter ? targetIndex + 1 : targetIndex;
    await moveDraggedCard(targetColumnId, insertIndex);
  };

  const handleColumnReorderDragStart = (event, columnId, columnIndex) => {
    if (draggingCard) return;
    setDraggingCard(null);
    setDraggingColumn({ columnId, index: columnIndex });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", columnId);
  };

  const handleColumnReorderDragEnd = () => {
    setDraggingColumn(null);
  };

  const handleColumnReorderDragOver = (event) => {
    if (!draggingColumn) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
  };

  const handleColumnReorderDrop = async (event, targetIndex) => {
    if (!draggingColumn) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const dropAfter = event.clientX > rect.left + rect.width / 2;
    const insertIndex = dropAfter ? targetIndex + 1 : targetIndex;
    await moveColumnToIndex(draggingColumn.index, insertIndex);
    setDraggingColumn(null);
  };

  const handleNewColumnInputChange = (event) => {
    const { name, value } = event.target;
    setNewColumnForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleInlineColumnInputChange = (event) => {
    const { name, value } = event.target;
    setQuickColumnForm((prev) => ({ ...prev, [name]: value }));
  };

  const createColumnEntry = async ({ name, order, cards }) => {
    if (!projectId || !token) return false;
    const trimmedName = (name || "").trim();
    if (!trimmedName) {
      toast.error("Column name is required");
      return false;
    }
    const duplicate = columns.some(
      (column) => column.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      toast.error("Column already exists");
      return false;
    }

    if (cards !== undefined && !Array.isArray(cards)) {
      toast.error("Cards must be an array");
      return false;
    }

    const payload = { name: trimmedName };
    if (order) {
      const parsedOrder = Number(order);
      if (!Number.isFinite(parsedOrder) || parsedOrder < 1) {
        toast.error("Order must be a positive number");
        return false;
      }
      payload.order = Math.floor(parsedOrder);
    }
    if (cards)
      payload.cards = cards;

    setSaving(true);
    try {
      const res = await createProjectColumn(projectId, payload, token);
      setColumns(res.data?.columns || []);
      toast.success(res.data?.message || "Column created");
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create column"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCreateColumn = async (event) => {
    event.preventDefault();
    const created = await createColumnEntry(newColumnForm);
    if (created)
      setNewColumnForm({ name: "", order: "" });
  };

  const handleQuickColumnSubmit = async (event) => {
    event.preventDefault();
    const created = await createColumnEntry(quickColumnForm);
    if (created) {
      setQuickColumnForm({ name: "", order: "" });
      setShowQuickColumnForm(false);
    }
  };

  const cancelQuickColumnForm = () => {
    setQuickColumnForm({ name: "", order: "" });
    setShowQuickColumnForm(false);
  };

  const toggleInviteeSelection = (entry) => {
    if (!entry?.id || entry.isOwner || !canInviteMembers) return;
    if (entry.status === "available") {
      setPendingInviteRemovalIds((prev) => prev.filter((id) => id !== entry.id));
      setPendingInviteAddIds((prev) =>
        prev.includes(entry.id) ? prev.filter((id) => id !== entry.id) : [...prev, entry.id]
      );
      return;
    }
    setPendingInviteAddIds((prev) => prev.filter((id) => id !== entry.id));
    setPendingInviteRemovalIds((prev) =>
      prev.includes(entry.id) ? prev.filter((id) => id !== entry.id) : [...prev, entry.id]
    );
  };

  const handleSelectAllInvitees = () => {
    if (!hasInviteTeammates || !canInviteMembers) return;
    const inviteIds = inviteEntries.filter((entry) => entry.id && !entry.isOwner).map((entry) => entry.id);
    setPendingInviteAddIds(inviteIds);
    setPendingInviteRemovalIds([]);
  };

  const handleClearInviteSelections = () => {
    const removalIds = inviteEntries.filter((entry) => entry.id && !entry.isOwner).map((entry) => entry.id);
    setPendingInviteAddIds([]);
    setPendingInviteRemovalIds(removalIds);
  };

  const handleInviteMember = async (event) => {
    event.preventDefault();
    if (!projectId || !token) {
      toast.error("Project not loaded");
      return;
    }
    if (!canInviteMembers) {
      toast.error("Only project owners can manage invitations");
      return;
    }

    const additions = inviteEntries.filter((entry) => pendingInviteAddSet.has(entry.id));
    const removals = inviteEntries.filter((entry) => pendingInviteRemovalSet.has(entry.id));

    if (additions.length === 0 && removals.length === 0) {
      toast.error("Select at least one change to apply");
      return;
    }

    const additionEmails = additions
      .map((entry) => normalizeInviteEmail(entry.email))
      .filter(Boolean);
    if (additions.length > 0 && additionEmails.length !== additions.length) {
      toast.error("Some teammates do not have valid email addresses");
      return;
    }

    const removalEmails = removals
      .map((entry) => normalizeInviteEmail(entry.email))
      .filter(Boolean);
    if (removals.length > 0 && removalEmails.length !== removals.length) {
      toast.error("Cannot revoke access for teammates without email addresses");
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

    setInvitingMember(true);
    try {
      if (additionEmails.length > 0) {
        const payload =
          additionEmails.length === 1 ? { email: additionEmails[0] } : { emails: additionEmails };
        const res = await inviteProjectMember(projectId, payload, token);
        toast.success(
          formatInviteResults(res.data?.results, res.data?.message || "Invitations updated")
        );
      }

      if (removalEmails.length > 0) {
        const payload = removalEmails.length === 1 ? { email: removalEmails[0] } : { emails: removalEmails };
        const res = await revokeProjectInvite(projectId, payload, token);
        toast.success(formatInviteResults(res.data?.results, res.data?.message || "Updated project access"));
      }

      setPendingInviteAddIds([]);
      setPendingInviteRemovalIds([]);
      await fetchProject();
      await loadSpaces();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update teammates"));
    } finally {
      setInvitingMember(false);
    }
  };

  const toggleColumnMenu = (columnId) => {
    setColumnMenu((prev) => (prev === columnId ? null : columnId));
  };

  const handleColumnRenameInline = async (column) => {
    setColumnMenu(null);
    setRenameColumnModal({
      open: true,
      column,
      value: column.name,
    });
  };

  const closeRenameColumnModal = () =>
    setRenameColumnModal({ open: false, column: null, value: "" });

  const submitRenameColumn = async (event) => {
    event.preventDefault();
    if (!projectId || !token) {
      toast.error("Project not loaded");
      return;
    }

    const { column, value } = renameColumnModal;
    if (!column) {
      closeRenameColumnModal();
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("Column name cannot be empty");
      return;
    }

    if (trimmed.toLowerCase() === column.name.toLowerCase()) {
      closeRenameColumnModal();
      return;
    }

    const duplicate = columns.some(
      (item) => item.name.toLowerCase() === trimmed.toLowerCase() && item.name !== column.name
    );
    if (duplicate) {
      toast.error("Another column already uses this name");
      return;
    }

    setSaving(true);
    try {
      const res = await updateProjectColumn(projectId, column.name, { name: trimmed }, token);
      setColumns(res.data?.columns || []);
      toast.success(res.data?.message || "Column renamed");
      closeRenameColumnModal();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to rename column"));
    } finally {
      setSaving(false);
    }
  };

  const handleColumnDeleteInline = async (column) => {
    if (!projectId || !token) {
      toast.error("Project not loaded");
      return;
    }
    if (Array.isArray(column.cards) && column.cards.length) {
      toast.error("Move cards to another column before deleting this one");
      setColumnMenu(null);
      return;
    }

    setSaving(true);
    try {
      const res = await deleteProjectColumn(projectId, column.name, {}, token);
      setColumns(res.data?.columns || []);
      toast.success(res.data?.message || "Column deleted");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete column"));
    } finally {
      setSaving(false);
      setColumnMenu(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setColumnMenu(null);
      setActiveMenu(null);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleNewSpaceInputChange = (event) => {
    const { name, value } = event.target;
    setNewSpaceForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateSpace = async (event) => {
    event.preventDefault();
    if (!token) return;

    const trimmed = newSpaceForm.name.trim();
    if (!trimmed) {
      toast.error("Space name is required");
      return;
    }

    setCreatingSpace(true);
    try {
      const payload = {
        name: trimmed,
        description: newSpaceForm.description,
        boardType: newSpaceForm.boardType,
        status: newSpaceForm.status,
      };
      const res = await createProject(payload, token);
      const created = res.data?.project;
      toast.success(res.data?.message || "Space created");
      setNewSpaceForm({ name: "", description: "", boardType: "scrum", status: "created" });
      setShowSpaceModal(false);

      if (created?._id) {
        setSpaces((prev) => [...prev, created]);
        navigate(`/projects/${created._id}`, { state: { project: created } });
      } else {
        loadSpaces();
        fetchProject();
        loadColumns();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create space"));
    } finally {
      setCreatingSpace(false);
    }
  };

  const handleRenameInputChange = (columnId, value) => {
    setColumnEdits((prev) => ({ ...prev, [columnId]: value }));
  };

  const handleRenameColumn = async (column) => {
    const columnId = column._id || column.name;
    const desiredName = (columnEdits[columnId] ?? column.name).trim();
    if (!desiredName) {
      toast.error("Column name cannot be empty");
      return;
    }
    if (desiredName.toLowerCase() === column.name.toLowerCase()) {
      toast.error("Update the column name before saving");
      return;
    }
    const duplicate = columns.some(
      (item) => item.name.toLowerCase() === desiredName.toLowerCase() && item.name !== column.name
    );
    if (duplicate) {
      toast.error("Another column already uses this name");
      return;
    }

    setSaving(true);
    try {
      const res = await updateProjectColumn(projectId, column.name, { name: desiredName }, token);
      setColumns(res.data?.columns || []);
      toast.success(res.data?.message || "Column renamed");
      setColumnEdits((prev) => {
        const next = { ...prev };
        delete next[columnId];
        return next;
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to rename column"));
    } finally {
      setSaving(false);
    }
  };

  const handleMoveColumn = async (column, direction) => {
    const delta = direction === "up" ? -1 : 1;
    const fallbackOrder = columns.findIndex((item) => columnKey(item) === columnKey(column)) + 1;
    const currentOrder = typeof column.order === "number" ? column.order : fallbackOrder;
    const targetOrder = currentOrder + delta;
    if (targetOrder < 1 || targetOrder > columns.length) return;

    await persistColumnOrder(column.name, targetOrder);
  };

  const startDeleteColumn = (column) => {
    const hasCards = Array.isArray(column.cards) && column.cards.length > 0;
    if (hasCards) {
      const alternatives = columns.filter((item) => item.name !== column.name);
      if (!alternatives.length) {
        toast.error("Move cards to another column before deleting this one");
        return;
      }
      setDeletePrompt({
        name: column.name,
        requiresTarget: true,
        targetColumn: alternatives[0].name,
      });
      return;
    }
    setDeletePrompt({ name: column.name, requiresTarget: false, targetColumn: "" });
  };

  const cancelDeleteColumn = () => setDeletePrompt(null);

  const handleDeleteTargetChange = (value) => {
    setDeletePrompt((prev) => (prev ? { ...prev, targetColumn: value } : prev));
  };

  const confirmDeleteColumn = async () => {
    if (!deletePrompt) return;
    if (deletePrompt.requiresTarget && !deletePrompt.targetColumn) {
      toast.error("Select a destination column first");
      return;
    }

    setSaving(true);
    try {
      const payload = deletePrompt.requiresTarget
        ? { targetColumn: deletePrompt.targetColumn }
        : {};
      const res = await deleteProjectColumn(projectId, deletePrompt.name, payload, token);
      setColumns(res.data?.columns || []);
      toast.success(res.data?.message || "Column deleted");
      setDeletePrompt(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete column"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="relative flex-1 overflow-y-auto">
        <Loader show={boardBusy} />
        <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur px-6 py-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-gray-500">Space</p>
              <h1 className="text-2xl font-semibold text-gray-900">
                {project?.name || "Loading board..."}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  isOwner
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-orange-50 text-orange-600"
                }`}
              >
                {isOwner ? "Owner" : "Collaborator"}
              </span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium capitalize text-blue-700">
                {project?.status || "created"}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                {project?.boardType || "scrum"}
              </span>
              <button
                type="button"
                onClick={handleRefreshBoard}
                className="rounded border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Refresh board
              </button>
            </div>
          </div>

          {spaces.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {spaces.map((space) => {
                const isActive = space._id === projectId;
                const spaceOwnerId = (() => {
                  const direct = extractUserId(space.owner);
                  if (direct) return direct;
                  const ownerMember = (space.members || []).find((member) => {
                    const role =
                      member?.role ||
                      member?.user?.role ||
                      member?.member?.role ||
                      "";
                    return typeof role === "string" && role.toLowerCase() === "owner";
                  });
                  if (ownerMember) {
                    const target = ownerMember?.user || ownerMember?.member || ownerMember;
                    return extractUserId(target);
                  }
                  return null;
                })();
                const spaceRoleLabel =
                  spaceOwnerId && userId && spaceOwnerId === userId ? "Owner" : "Collaborator";
                return (
                  <button
                    key={space._id}
                    type="button"
                    onClick={() =>
                      navigate(`/projects/${space._id}`, { state: { project: space } })
                    }
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                      isActive
                        ? "border-violet-300 bg-violet-100 text-violet-800"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span>{space.name}</span>
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                        spaceRoleLabel === "Owner"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {spaceRoleLabel}
                    </span>
                  </button>
                );
              })}
              {spacesLoading && (
                <span className="text-xs text-gray-500">Loading spaces...</span>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <div className="flex items-center rounded-full border border-gray-200 bg-white px-3 py-1">
              <span className="font-medium text-gray-800">Sprint:</span>
              <span className="ml-2">{project?.currentSprint || "Scrum 1"}</span>
            </div>
            <div className="flex items-center rounded-full border border-gray-200 bg-white px-3 py-1">
              <span className="font-medium text-gray-800">Columns:</span>
              <span className="ml-2">{columnCount}</span>
            </div>
            <button
              type="button"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Complete sprint
            </button>
            <button
              type="button"
              onClick={() => setShowSpaceModal(true)}
              className={`rounded border px-4 py-2 text-sm font-semibold ${
                showSpaceModal
                  ? "border-violet-200 bg-violet-100 text-violet-800"
                  : "border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
              }`}
            >
              + Create space
            </button>
            {/* {canAccessSettings && (
              <button
                type="button"
                onClick={() => setShowColumnManager((prev) => !prev)}
                className={`rounded border px-4 py-2 text-sm font-semibold transition ${
                  showColumnManager
                    ? "border-blue-200 bg-blue-100 text-blue-800"
                    : "border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                {showColumnManager ? "Hide project settings" : "Project settings"}
              </button>
            )} */}
          </div>
        </div>

        <div className="px-6 py-6">
          <header className="mb-6 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-gray-600">Assignees:</span>
            <div className="flex items-center pl-3">
              <div
                className={`relative group -ml-3 first:ml-0 ${
                  selectedAssignees.includes("unassigned") ? "z-10" : "z-0"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setSelectedAssignees((prev) =>
                      prev.includes("unassigned")
                        ? prev.filter((id) => id !== "unassigned")
                        : [...prev, "unassigned"]
                    )
                  }
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition ${
                    selectedAssignees.includes("unassigned")
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 bg-white text-gray-600"
                  }`}
                >
                  ?
                </button>
                <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
                  Unassigned
                </span>
              </div>
              {users.map((user) => {
                const name =
                  user.fullName ||
                  [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                  user.email ||
                  user.username ||
                  "User";
                const initial = name.trim().charAt(0).toUpperCase();
                const isSelected = selectedAssignees.includes(user._id);
                return (
                  <div
                    className={`relative group -ml-3 ${
                      isSelected ? "z-10" : "z-0"
                    }`}
                    key={user._id}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedAssignees((prev) =>
                          isSelected ? prev.filter((id) => id !== user._id) : [...prev, user._id]
                        )
                      }
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition ${
                        isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-600"
                      }`}
                    >
                      {initial || "U"}
                    </button>
                    <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
            {selectedAssignees.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedAssignees([])}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </header>

          {showColumnManager && canAccessSettings && (
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Project settings</h2>
                  <p className="text-sm text-gray-500">
                    Configure board columns and manage collaborators.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-full border border-gray-200 p-1">
                    <button
                      type="button"
                      onClick={() => setSettingsTab("columns")}
                      className={`rounded-full px-4 py-1 text-sm font-semibold ${
                        settingsTab === "columns"
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      Columns
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsTab("members")}
                      className={`rounded-full px-4 py-1 text-sm font-semibold ${
                        settingsTab === "members"
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      Members
                    </button>
                  </div>
                  {settingsTab === "columns" ? (
                    <button
                      type="button"
                      onClick={loadColumns}
                      disabled={columnsLoading}
                      className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-700 disabled:opacity-60"
                    >
                      Refresh columns
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={fetchProject}
                      disabled={loading}
                      className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-700 disabled:opacity-60"
                    >
                      Refresh members
                    </button>
                  )}
                </div>
              </div>

              {settingsTab === "columns" ? (
                <>
                  <form
                    onSubmit={handleCreateColumn}
                    className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_auto]"
                  >
                    <input
                      name="name"
                      value={newColumnForm.name}
                      onChange={handleNewColumnInputChange}
                      placeholder="New column name"
                      className="rounded border px-3 py-2 text-sm"
                    />
                    <input
                      name="order"
                      type="number"
                      min="1"
                      value={newColumnForm.order}
                      onChange={handleNewColumnInputChange}
                      placeholder="Order (optional)"
                      className="rounded border px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                      disabled={saving}
                    >
                      Add column
                    </button>
                  </form>

                  <div className="mt-4 divide-y divide-gray-100">
                    {columns.length === 0 ? (
                      <p className="py-4 text-sm text-gray-500">
                        Columns will appear here once created.
                      </p>
                    ) : (
                      columns.map((column, index) => {
                        const colId = columnKey(column);
                        const editName = columnEdits[colId] ?? column.name;
                        const deleting = deletePrompt?.name === column.name;
                        const otherColumns = columns.filter((item) => item.name !== column.name);
                        return (
                          <div key={colId} className="py-4">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="min-w-[180px] flex-1">
                                <label className="text-xs font-medium uppercase text-gray-500">
                                  Column name
                                </label>
                                <input
                                  value={editName}
                                  onChange={(event) =>
                                    handleRenameInputChange(colId, event.target.value)
                                  }
                                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                                />
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                                  onClick={() => handleRenameColumn(column)}
                                  disabled={saving}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                                  onClick={() => handleMoveColumn(column, "up")}
                                  disabled={saving || index === 0}
                                >
                                  Move up
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                                  onClick={() => handleMoveColumn(column, "down")}
                                  disabled={saving || index === columns.length - 1}
                                >
                                  Move down
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                                  onClick={() => startDeleteColumn(column)}
                                  disabled={saving}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            {deleting && (
                              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                                {deletePrompt?.requiresTarget ? (
                                  <>
                                    <p className="mb-2">
                                      Move {column.cards?.length || 0} card(s) into another column:
                                    </p>
                                    <select
                                      className="w-full rounded border border-red-200 bg-white px-3 py-2 text-sm text-gray-700"
                                      value={deletePrompt.targetColumn}
                                      onChange={(event) => handleDeleteTargetChange(event.target.value)}
                                    >
                                      {otherColumns.map((item) => (
                                        <option key={item.name} value={item.name}>
                                          {item.name}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        className="rounded bg-red-600 px-3 py-2 text-white disabled:opacity-70"
                                        onClick={confirmDeleteColumn}
                                        disabled={saving}
                                      >
                                        Move & delete
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded border border-red-200 px-3 py-2 text-red-700"
                                        onClick={cancelDeleteColumn}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-3">
                                    <p className="text-sm">
                                      Delete this column and its empty lane permanently?
                                    </p>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        className="rounded bg-red-600 px-3 py-2 text-white disabled:opacity-70"
                                        onClick={confirmDeleteColumn}
                                        disabled={saving}
                                      >
                                        Delete
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded border border-red-200 px-3 py-2 text-red-700"
                                        onClick={cancelDeleteColumn}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-4 space-y-4">
                  <form className="space-y-3" onSubmit={handleInviteMember}>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">Teammates</p>
                        <div className="flex items-center gap-2">
                          {hasInviteTeammates && (
                            <>
                              <button
                                type="button"
                                className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-40"
                                onClick={handleSelectAllInvitees}
                                disabled={!canInviteMembers || invitingMember}
                              >
                                Select all
                              </button>
                              <span className="text-gray-300">|</span>
                              <button
                                type="button"
                                className="text-xs font-semibold text-gray-500 hover:underline disabled:opacity-40"
                                onClick={handleClearInviteSelections}
                                disabled={!canInviteMembers || invitingMember}
                              >
                                Deselect all
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-gray-200">
                        {hasInviteTeammates ? (
                          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                            {inviteEntries.map((inviteUser) => {
                              const label =
                                inviteUser.user.fullName ||
                                [inviteUser.user.firstName, inviteUser.user.lastName]
                                  .filter(Boolean)
                                  .join(" ") ||
                                inviteUser.user.email ||
                                inviteUser.user.username ||
                                "Teammate";
                              const email = inviteUser.email;
                              const baseChecked =
                                inviteUser.status === "owner" ||
                                inviteUser.status === "member" ||
                                inviteUser.status === "invited";
                              const isChecked =
                                inviteUser.status === "available"
                                  ? pendingInviteAddSet.has(inviteUser.id)
                                  : baseChecked && !pendingInviteRemovalSet.has(inviteUser.id);
                              const disableToggle = inviteUser.isOwner || !canInviteMembers || invitingMember;
                              const statusLabel =
                                inviteUser.status === "owner"
                                  ? "Owner"
                                  : inviteUser.status === "member"
                                  ? "Member"
                                  : inviteUser.status === "invited"
                                  ? "Invited"
                                  : pendingInviteAddSet.has(inviteUser.id)
                                  ? "Pending invite"
                                  : pendingInviteRemovalSet.has(inviteUser.id)
                                  ? "Will be removed"
                                  : "";
                              return (
                                <label
                                  key={inviteUser.id}
                                  className="flex cursor-pointer items-center gap-3 px-4 py-3"
                                >
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    checked={isChecked}
                                    disabled={disableToggle}
                                    onChange={() => toggleInviteeSelection(inviteUser)}
                                  />
                                  <div className="flex flex-1 items-center justify-between">
                                    <div>
                                      <p className="text-sm font-semibold text-gray-800">{label}</p>
                                      {email && <p className="text-xs text-gray-500">{email}</p>}
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
                        ) : (
                          <p className="p-4 text-sm text-gray-500">
                            No other teammates are available in this workspace.
                          </p>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Checked teammates already have access or pending invites. Uncheck to revoke,
                        or check available teammates to invite them.
                      </p>
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={!canInviteMembers || invitingMember || !hasPendingInviteChanges}
                    >
                      {invitingMember ? "Updating..." : "Update access"}
                    </button>
                  </form>
                  {!canInviteMembers ? (
                    <p className="text-xs text-gray-500">
                      Only project owners can send invitations.
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Selected teammates already have accounts, so they&apos;ll see the space right
                      after the invite.
                    </p>
                  )}
                  <div className="rounded-lg border border-gray-100">
                    {memberEntries.length === 0 ? (
                      <p className="p-4 text-sm text-gray-500">
                        Members will show up once they join this space.
                      </p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {memberEntries.map((member) => (
                          <li
                            key={member.key}
                            className="flex flex-wrap items-center justify-between gap-3 p-4"
                          >
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                              <p className="text-xs text-gray-500">
                                {member.email || "No email provided"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-700">{member.role}</p>
                              {member.joinedAt && (
                                <p className="text-xs text-gray-500">
                                  Since {formatDate(member.joinedAt)}
                                </p>
                              )}
                              {member.status && member.status !== "active" && (
                                <p className="text-xs font-medium text-amber-600 capitalize">
                                  {member.status.replace(/-/g, " ")}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {filteredColumns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
              No columns yet. Create a space or refresh the board.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {filteredColumns.map((column, columnIndex) => {
                const colId = columnKey(column);
                return (
                  <section
                    key={colId}
                    className={`flex min-h-[520px] w-full max-w-xs flex-shrink-0 flex-col rounded-2xl border border-gray-300 bg-gray-50 p-4 shadow-lg ${
                      draggingCard ? "border-dashed border-blue-200" : ""
                    }`}
                    onDragOver={handleColumnDragOver}
                    onDrop={(event) => handleColumnDrop(event, colId)}
                  >
                    <div
                      className="mb-4 flex cursor-move items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600"
                      draggable
                      onDragStart={(event) => handleColumnReorderDragStart(event, colId, columnIndex)}
                      onDragEnd={handleColumnReorderDragEnd}
                      onDragOver={handleColumnReorderDragOver}
                      onDrop={(event) => handleColumnReorderDrop(event, columnIndex)}
                      title="Drag to reorder column"
                    >
                      <div className="flex flex-col">
                        <span>{column.name}</span>
                        <span className="text-[11px] font-normal text-gray-400">
                          {column.cards?.length || 0} cards
                        </span>
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-gray-400 transition hover:bg-gray-100"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleColumnMenu(colId);
                          }}
                        >
                          ⋮
                        </button>
                        {columnMenu === colId && (
                          <div
                            className="absolute right-0 top-8 z-30 w-40 rounded-lg border border-gray-200 bg-white shadow-lg"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                              onClick={() => handleColumnRenameInline(column)}
                            >
                              Rename column
                            </button>
                            <button
                              type="button"
                              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                              onClick={() => handleColumnDeleteInline(column)}
                            >
                              Delete column
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
                      {column.cards?.length ? (
                        column.cards.map((card, cardIndex) => (
                          <div className="relative" key={card._id || cardIndex}>
                            <article
                              className="rounded-2xl border border-gray-300 bg-gray-100 px-4 py-3 shadow-sm"
                              draggable
                              onDragStart={(event) => handleCardDragStart(event, colId, cardIndex)}
                              onDragEnd={handleCardDragEnd}
                              onDragOver={handleCardDragOver}
                              onDrop={(event) => handleCardDrop(event, colId, cardIndex)}
                            >
                              <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-gray-900">
                                  {card.title || "Untitled task"}
                                </h3>
                                  <button
                                    className="rounded px-2 py-1 text-gray-400 transition hover:bg-gray-100"
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleCardMenu(colId, cardIndex);
                                    }}
                                  >
                                  ···
                                </button>
                              </div>
                              <p className="mt-2 text-sm text-gray-600">
                                {card.description || "No description"}
                              </p>
                              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-medium text-gray-500">
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1">
                                  <span role="img" aria-hidden>
                                    📅
                                  </span>
                                  {formatDate(card.dueDate)}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1">
                                  <span role="img" aria-hidden>
                                    🏷️
                                  </span>
                                  {card.status || column.name}
                                </span>
                                <div className="relative group">
                                  <button
                                    type="button"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700"
                                    onClick={() => openCardModal(colId, cardIndex)}
                                  >
                                    {card.assignee ? getUserInitial(card.assignee) : "?"}
                                  </button>
                                  <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
                                    {getUserLabel(card.assignee)}
                                  </span>
                                </div>
                              </div>
                            </article>
                            {activeMenu?.columnId === colId &&
                              activeMenu?.cardIndex === cardIndex && (
                                <div
                                  className="absolute right-0 top-10 z-20 w-40 rounded-lg border border-gray-200 bg-white shadow-lg"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                                    onClick={() => openCardModal(colId, cardIndex)}
                                  >
                                    Edit card
                                  </button>
                                  <button
                                    type="button"
                                    className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                    onClick={() => handleDeleteCard(colId, cardIndex)}
                                  >
                                    Delete card
                                  </button>
                                </div>
                              )}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-100 p-4 text-center text-sm text-gray-500">
                          No cards yet
                        </div>
                      )}

                    <button
                      type="button"
                      className="mt-3 w-full rounded border border-dashed border-gray-300 py-2 text-sm font-medium text-gray-500"
                      onClick={() => openCardModal(colId, column.cards?.length || 0)}
                    >
                      + Create
                    </button>
                  </div>
                  </section>
                );
              })}
              <section className="flex min-h-[520px] w-full max-w-xs flex-shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 p-4 text-center shadow-sm">
                {showQuickColumnForm ? (
                  <form className="w-full space-y-3" onSubmit={handleQuickColumnSubmit}>
                    <input
                      name="name"
                      value={quickColumnForm.name}
                      onChange={handleInlineColumnInputChange}
                      className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                      placeholder="Column name"
                    />
                    <input
                      name="order"
                      value={quickColumnForm.order}
                      onChange={handleInlineColumnInputChange}
                      type="number"
                      min="1"
                      className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                      placeholder="Position (optional)"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-70"
                        disabled={saving}
                      >
                        Add column
                      </button>
                      <button
                        type="button"
                        onClick={cancelQuickColumnForm}
                        className="flex-1 rounded-lg border border-transparent px-3 py-2 text-sm font-semibold text-violet-700 hover:text-violet-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowQuickColumnForm(true)}
                    className="flex flex-col items-center gap-2 text-violet-700"
                  >
                    <span className="text-4xl leading-none">+</span>
                    <span className="text-sm font-semibold">Add column</span>
                  </button>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
      {showSpaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <button
              type="button"
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              onClick={() => setShowSpaceModal(false)}
            >
              ×
            </button>
            <form onSubmit={handleCreateSpace} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-800">Space name</label>
                <input
                  name="name"
                  value={newSpaceForm.name}
                  onChange={handleNewSpaceInputChange}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-violet-400 focus:outline-none"
                  placeholder="e.g. Marketing board"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-800">Description</label>
                <textarea
                  name="description"
                  value={newSpaceForm.description}
                  onChange={handleNewSpaceInputChange}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-violet-400 focus:outline-none"
                  placeholder="Optional context for this space"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-800">Board type</label>
                  <select
                    name="boardType"
                    value={newSpaceForm.boardType}
                    onChange={handleNewSpaceInputChange}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-violet-400 focus:outline-none"
                  >
                    <option value="scrum">Scrum</option>
                    <option value="kanban">Kanban</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-800">Status</label>
                  <select
                    name="status"
                    value={newSpaceForm.status}
                    onChange={handleNewSpaceInputChange}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-violet-400 focus:outline-none"
                  >
                    <option value="created">Created</option>
                    <option value="in-progress">In progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                  disabled={creatingSpace}
                >
                  {creatingSpace ? "Creating..." : "Create space"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSpaceModal(false)}
                  className="rounded-lg border border-transparent px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {renameColumnModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <button
              type="button"
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              onClick={closeRenameColumnModal}
            >
              ×
            </button>
            <form onSubmit={submitRenameColumn}>
              <h2 className="text-xl font-semibold text-gray-900">Rename column</h2>
              <p className="text-sm text-gray-500">
                Update the column name. Cards assigned to this column will follow the new label.
              </p>
              <input
                className="mt-4 w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
                value={renameColumnModal.value}
                onChange={(event) =>
                  setRenameColumnModal((prev) => ({ ...prev, value: event.target.value }))
                }
                placeholder="Column name"
                autoFocus
              />
              <div className="mt-4 flex gap-3">
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                  disabled={saving}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  onClick={closeRenameColumnModal}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {cardModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={closeCardModal}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            <form onSubmit={handleCardFormSubmit}>
              <h2 className="text-2xl font-semibold text-gray-900">Edit card</h2>
              <p className="mb-4 mt-2 text-sm text-gray-500">
                Update title, description, due date, status, or assignee. Changes save to the board
                immediately.
              </p>
              <label className="mb-2 block text-sm font-medium text-gray-700">Title</label>
              <input
                className="mb-4 w-full rounded border px-3 py-2"
                name="title"
                value={cardForm.title}
                onChange={handleCardFormChange}
                placeholder="Task name"
              />

              <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
              <textarea
                className="mb-4 w-full rounded border px-3 py-2"
                rows={3}
                name="description"
                value={cardForm.description}
                onChange={handleCardFormChange}
                placeholder="What needs to be done?"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Due date</label>
                  <input
                    type="date"
                    className="w-full rounded border px-3 py-2"
                    name="dueDate"
                    value={cardForm.dueDate}
                    onChange={handleCardFormChange}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                  <select
                    className="w-full rounded border px-3 py-2"
                    name="status"
                    value={cardForm.status}
                    onChange={handleCardFormChange}
                    disabled={!columns.length}
                  >
                    {columns.map((column) => (
                      <option key={columnKey(column)} value={column.name}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="mt-4 mb-2 block text-sm font-medium text-gray-700">Assignee</label>
              <select
                className="mb-6 w-full rounded border px-3 py-2"
                name="assignee"
                value={cardForm.assignee}
                onChange={handleCardFormChange}
              >
                <option value="">Unassigned</option>
                {users.map((user) => {
                  const fullName =
                    user.fullName ||
                    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                    user.email ||
                    user.username ||
                    "User";
                  return (
                    <option value={user._id} key={user._id}>
                      {fullName}
                    </option>
                  );
                })}
              </select>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded bg-blue-600 py-2 text-white disabled:opacity-70"
                  disabled={saving}
                >
                  Save changes
                </button>
                <button
                  type="button"
                  onClick={closeCardModal}
                  className="flex-1 rounded border border-gray-200 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
