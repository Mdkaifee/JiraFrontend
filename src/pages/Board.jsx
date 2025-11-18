import { useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Loader from "../components/Loader";
import Sidebar from "../components/Sidebar";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import getErrorMessage from "../utils/getErrorMessage";
import {
  createProjectColumn,
  deleteProjectColumn,
  fetchProjectColumns,
  getProjectById,
  updateProjectColumn,
} from "../api/projects";
import { fetchUsers } from "../api/users";

export default function Board() {
  const { projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { token } = useContext(AuthContext);

  const [project, setProject] = useState(location.state?.project || null);
  const [columns, setColumns] = useState(location.state?.project?.columns || []);
  const [loading, setLoading] = useState(false);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [users, setUsers] = useState([]);
  const [newColumnForm, setNewColumnForm] = useState({ name: "", order: "" });
  const [columnEdits, setColumnEdits] = useState({});
  const [deletePrompt, setDeletePrompt] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [draggingCard, setDraggingCard] = useState(null);
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
  }, [token, fetchProject, loadColumns, loadUsers, navigate]);

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

  const columnCount = columns.length;
  const boardBusy = loading || saving || columnsLoading;

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

  const handleCardDragStart = (event, columnId, cardIndex) => {
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

    const { columnId, cardIndex } = draggingCard;
    const sourceColumn = columns.find((item) => columnKey(item) === columnId);
    const targetColumn = columns.find((item) => columnKey(item) === targetColumnId);

    if (!sourceColumn || !targetColumn) {
      setDraggingCard(null);
      return;
    }

    if (columnKey(sourceColumn) === columnKey(targetColumn)) {
      setDraggingCard(null);
      return;
    }

    const sourceCards = sourceColumn.cards || [];
    const card = sourceCards[cardIndex];

    if (!card) {
      setDraggingCard(null);
      return;
    }

    const updatedSourceCards = sourceCards.filter((_, idx) => idx !== cardIndex);
    await updateColumnCards(sourceColumn.name, updatedSourceCards, "Card moved", { notify: false });

    const destinationCards = [
      ...(targetColumn.cards || []),
      { ...card, status: targetColumn.name },
    ];
    await updateColumnCards(targetColumn.name, destinationCards, "Card moved");

    setDraggingCard(null);
    setActiveMenu(null);
  };

  const handleNewColumnInputChange = (event) => {
    const { name, value } = event.target;
    setNewColumnForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateColumn = async (event) => {
    event.preventDefault();
    if (!projectId || !token) return;
    const trimmedName = newColumnForm.name.trim();
    if (!trimmedName) {
      toast.error("Column name is required");
      return;
    }
    const duplicate = columns.some(
      (column) => column.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      toast.error("Column already exists");
      return;
    }
    const payload = { name: trimmedName };
    if (newColumnForm.order) {
      const parsedOrder = Number(newColumnForm.order);
      if (!Number.isFinite(parsedOrder) || parsedOrder < 1) {
        toast.error("Order must be a positive number");
        return;
      }
      payload.order = Math.floor(parsedOrder);
    }

    setSaving(true);
    try {
      const res = await createProjectColumn(projectId, payload, token);
      setColumns(res.data?.columns || []);
      toast.success(res.data?.message || "Column created");
      setNewColumnForm({ name: "", order: "" });
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create column"));
    } finally {
      setSaving(false);
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

    setSaving(true);
    try {
      const res = await updateProjectColumn(projectId, column.name, { order: targetOrder }, token);
      setColumns(res.data?.columns || []);
      toast.success(res.data?.message || "Column reordered");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to reorder column"));
    } finally {
      setSaving(false);
    }
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
              onClick={() => setShowColumnManager((prev) => !prev)}
              className="rounded border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
            >
              {showColumnManager ? "Hide column manager" : "Manage columns"}
            </button>
          </div>
        </div>

        <div className="px-6 py-6">
          <header className="mb-6 flex flex-wrap items-center gap-3">
            <input
              className="w-full rounded border px-4 py-2 text-sm text-gray-700 sm:max-w-xs"
              placeholder="Search board"
              disabled
            />
            <button className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-700" type="button">
              Filter
            </button>
            <button className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-700" type="button">
              Clear filters
            </button>
          </header>

          {showColumnManager && (
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Manage board columns</h2>
                  <p className="text-sm text-gray-500">
                    Create new statuses, rename existing ones, or reorder the board.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadColumns}
                  disabled={columnsLoading}
                  className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-700 disabled:opacity-60"
                >
                  Refresh list
                </button>
              </div>

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
            </div>
          )}

          {columns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
              No columns yet. Create a space or refresh the board.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {columns.map((column) => {
                const colId = columnKey(column);
                return (
                  <section
                    key={colId}
                    className={`rounded-xl bg-white p-4 shadow-sm ${
                      draggingCard ? "border border-dashed border-blue-200" : ""
                    }`}
                    onDragOver={handleColumnDragOver}
                    onDrop={(event) => handleColumnDrop(event, colId)}
                  >
                    <div className="mb-4 flex items-center justify-between uppercase tracking-wide text-gray-500">
                      <span>{column.name}</span>
                      <span className="text-xs font-semibold text-gray-400">
                        {column.cards?.length || 0} of 1
                      </span>
                    </div>

                    <div className="space-y-4">
                      {column.cards?.length ? (
                        column.cards.map((card, cardIndex) => (
                          <div className="relative" key={card._id || cardIndex}>
                            <article
                              className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
                              draggable
                              onDragStart={(event) => handleCardDragStart(event, colId, cardIndex)}
                              onDragEnd={handleCardDragEnd}
                            >
                              <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-gray-900">
                                  {card.title || "Untitled task"}
                                </h3>
                                <button
                                  className="rounded px-2 py-1 text-gray-400 hover:bg-gray-100"
                                  type="button"
                                  onClick={() => toggleCardMenu(colId, cardIndex)}
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
                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700"
                                  title={getUserLabel(card.assignee)}
                                  onClick={() => openCardModal(colId, cardIndex)}
                                >
                                  {card.assignee ? getUserInitial(card.assignee) : "?"}
                                </button>
                              </div>
                            </article>
                            {activeMenu?.columnId === colId &&
                              activeMenu?.cardIndex === cardIndex && (
                                <div className="absolute right-0 top-10 z-20 w-40 rounded-lg border border-gray-200 bg-white shadow-lg">
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
                        <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
                          No cards yet
                        </div>
                      )}

                    <button
                      type="button"
                      className="mt-2 w-full rounded border border-dashed border-gray-300 py-2 text-sm font-medium text-gray-500"
                      onClick={() => openCardModal(colId, column.cards?.length || 0)}
                    >
                      + Create
                    </button>
                  </div>
                </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
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
