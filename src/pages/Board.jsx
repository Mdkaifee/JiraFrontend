import { useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Loader from "../components/Loader";
import Sidebar from "../components/Sidebar";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import getErrorMessage from "../utils/getErrorMessage";
import { getProjectById, updateProject } from "../api/projects";
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
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [activeMenu, setActiveMenu] = useState(null);
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
      setColumns(fetchedProject?.columns || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load board"));
    } finally {
      setLoading(false);
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
    if (!project) {
      fetchProject();
    }
    loadUsers();
  }, [token, project, fetchProject, navigate, loadUsers]);

  useEffect(() => {
    setColumns(project?.columns || []);
  }, [project]);

  const columnCount = columns.length;

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

  const persistColumns = async (nextColumns, successMessage = "Board updated") => {
    if (!projectId || !token) return;
    setSaving(true);
    try {
      const res = await updateProject(projectId, { columns: nextColumns }, token);
      const updatedProject = res.data?.project;
      if (updatedProject) {
        setProject(updatedProject);
        setColumns(updatedProject.columns || nextColumns);
      } else {
        setColumns(nextColumns);
      }
      toast.success(res.data?.message || successMessage);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update board"));
    } finally {
      setSaving(false);
    }
  }

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
    const nextColumns = columns.map((column) => {
      if (columnKey(column) !== columnId) return column;
      const cards = [...(column.cards || [])];
      const existingCard = cards[cardIndex] || {};
      cards[cardIndex] = {
        ...existingCard,
        title: cardForm.title || "Untitled task",
        description: cardForm.description,
        dueDate: cardForm.dueDate ? new Date(cardForm.dueDate).toISOString() : null,
        status: cardForm.status || column.name,
        assignee: cardForm.assignee || null,
      };
      return { ...column, cards };
    });
    await persistColumns(nextColumns, "Card updated");
    closeCardModal();
  };

  const handleDeleteCard = async (columnId, cardIndex) => {
    const nextColumns = columns.map((column) => {
      if (columnKey(column) !== columnId) return column;
      const cards = (column.cards || []).filter((_, idx) => idx !== cardIndex);
      return { ...column, cards };
    });
    await persistColumns(nextColumns, "Card removed");
    setActiveMenu(null);
  };

  const toggleCardMenu = (columnId, cardIndex) => {
    if (activeMenu && activeMenu.columnId === columnId && activeMenu.cardIndex === cardIndex) {
      setActiveMenu(null);
      return;
    }
    setActiveMenu({ columnId, cardIndex });
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="relative flex-1 overflow-y-auto">
        <Loader show={loading || saving} />
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
                onClick={fetchProject}
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

          {columns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
              No columns yet. Create a space or refresh the board.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {columns.map((column) => {
                const colId = columnKey(column);
                return (
                  <section key={colId} className="rounded-xl bg-white p-4 shadow-sm">
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
                            <article className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
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
                  <input
                    className="w-full rounded border px-3 py-2"
                    name="status"
                    value={cardForm.status}
                    onChange={handleCardFormChange}
                    placeholder="Status label"
                  />
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
