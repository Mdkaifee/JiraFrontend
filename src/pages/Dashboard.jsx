import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Loader from "../components/Loader";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import getErrorMessage from "../utils/getErrorMessage";
import { createProject, fetchProjects, updateProject } from "../api/projects";
import { useInvites } from "../context/InvitesContext";

const statusOptions = [
  { label: "Created", value: "created" },
  { label: "In Progress", value: "in-progress" },
  { label: "Completed", value: "completed" },
];

const boardTypes = [
  { label: "Scrum", value: "scrum" },
  { label: "Kanban", value: "kanban" },
];

export default function Dashboard() {
  const { user, token } = useContext(AuthContext);
  const { lastAccepted } = useInvites();
  const navigate = useNavigate();
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [updateId, setUpdateId] = useState("");
  const [updateForm, setUpdateForm] = useState({
    name: "",
    description: "",
    status: "",
    currentSprint: "",
    boardType: "scrum",
  });
  const [updating, setUpdating] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const hasAutoNavigated = useRef(false);

  const displayName = user?.fullName || user?.firstName || "User";

  const loadProjects = useCallback(async () => {
    if (!token) return;
    setLoadingProjects(true);
    try {
      const res = await fetchProjects(token);
      setProjects(res.data?.projects || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to fetch projects"));
    } finally {
      setLoadingProjects(false);
    }
  }, [token, toast]);

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    loadProjects();
  }, [token, navigate, loadProjects]);

  useEffect(() => {
    if (!lastAccepted?.at) return;
    loadProjects();
  }, [lastAccepted, loadProjects]);

  useEffect(() => {
    if (!updateId) {
      setUpdateForm({
        name: "",
        description: "",
        status: "",
        currentSprint: "",
        boardType: "scrum",
      });
      return;
    }
    const project = projects.find((item) => item._id === updateId);
    if (project) {
      setUpdateForm({
        name: project.name || "",
        description: project.description || "",
        status: project.status || "",
        currentSprint: project.currentSprint || "",
        boardType: project.boardType || "scrum",
      });
    }
  }, [updateId, projects]);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId("");
      setUpdateId("");
      hasAutoNavigated.current = false;
      return;
    }

    if (!updateId) {
      setUpdateId(projects[0]._id);
    }
  }, [projects, updateId]);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId("");
      hasAutoNavigated.current = false;
      return;
    }
    if (!selectedProjectId) {
      const firstProject = projects[0];
      setSelectedProjectId(firstProject._id);
      if (!hasAutoNavigated.current) {
        navigate(`/projects/${firstProject._id}`, { state: { project: firstProject } });
        hasAutoNavigated.current = true;
      }
    }
  }, [projects, selectedProjectId, navigate]);

  const handleCreateProject = async (event) => {
    event.preventDefault();
    if (!createForm.name.trim()) {
      toast.error("Project name is required");
      return;
    }

    const payload = {
      name: createForm.name.trim(),
      ...(createForm.description.trim()
        ? { description: createForm.description.trim() }
        : {}),
    };

    setCreating(true);
    try {
      const res = await createProject(payload, token);
      const project = res.data?.project;
      if (project) {
        setProjects((prev) => [project, ...prev]);
        setSelectedProjectId(project._id);
        setUpdateId(project._id);
        navigate(`/projects/${project._id}`, { state: { project } });
      }
      toast.success(res.data?.message || "Project created");
      setCreateForm({ name: "", description: "" });
      setShowCreateModal(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create project"));
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateProject = async (event) => {
    event.preventDefault();
    if (!updateId) {
      toast.error("Select a project to update");
      return;
    }

    const payload = {
      ...(updateForm.name.trim() ? { name: updateForm.name.trim() } : {}),
      ...(updateForm.description.trim()
        ? { description: updateForm.description.trim() }
        : {}),
      ...(updateForm.status ? { status: updateForm.status } : {}),
      ...(updateForm.currentSprint.trim()
        ? { currentSprint: updateForm.currentSprint.trim() }
        : {}),
      ...(updateForm.boardType ? { boardType: updateForm.boardType } : {}),
    };

    if (Object.keys(payload).length === 0) {
      toast.info("Nothing to update");
      return;
    }

    setUpdating(true);
    try {
      const res = await updateProject(updateId, payload, token);
      const updated = res.data?.project;
      if (updated) {
        setProjects((prev) =>
          prev.map((project) => (project._id === updated._id ? updated : project))
        );
      }
      toast.success(res.data?.message || "Project updated");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update project"));
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return value;
    }
  };

  const handleOpenBoard = (project) => {
    navigate(`/projects/${project._id}`, { state: { project } });
  };

  const handleSpaceChange = (event) => {
    const projectId = event.target.value;
    setSelectedProjectId(projectId);
    const project = projects.find((item) => item._id === projectId);
    if (project) {
      handleOpenBoard(project);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="mb-8 border-b pb-6">
          <h1 className="text-3xl font-semibold text-gray-900">
            Welcome, {displayName} 👋
          </h1>
          <p className="mt-2 text-gray-600">
            Manage your Jira spaces, create new boards, and keep tabs on every sprint.
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <div className="max-w-xl rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
              <p className="text-lg font-semibold text-gray-900">No spaces yet</p>
              <p className="mt-2 text-sm text-gray-500">
                Spaces keep your Jira boards organized. Create your first one to see the default To
                Do → Done workflow.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="mt-6 rounded bg-blue-600 px-6 py-2 text-sm font-semibold text-white"
              >
                + Add space
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex-1 min-w-[220px]">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Select a space
                </label>
                <select
                  className="w-full rounded border px-3 py-2"
                  value={selectedProjectId}
                  onChange={handleSpaceChange}
                >
                  {projects.map((project) => (
                    <option value={project._id} key={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-gray-500">
                  Changing the selection jumps straight into that board view.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white"
              >
                + Add space
              </button>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <form
                onSubmit={handleUpdateProject}
                className="relative rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <Loader show={updating} />
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Update a space</h2>
                    <p className="text-sm text-gray-500">
                  Rename projects, change sprint info, or adjust their status.
                </p>
              </div>
              <button
                type="button"
                onClick={loadProjects}
                className="text-sm font-medium text-blue-600 hover:underline"
                disabled={loadingProjects}
              >
                Refresh
              </button>
            </div>

            <label className="mt-4 block text-sm font-medium text-gray-700">
              Select project
            </label>
            <select
              className="mb-4 mt-1 w-full rounded border px-3 py-2"
              value={updateId}
              onChange={(e) => setUpdateId(e.target.value)}
            >
              <option value="">Choose a space</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>

            <label className="mb-2 block text-sm font-medium text-gray-700">Name</label>
            <input
              className="mb-4 w-full rounded border px-3 py-2"
              value={updateForm.name}
              onChange={(e) => setUpdateForm((prev) => ({ ...prev, name: e.target.value }))}
            />

            <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              className="mb-4 w-full rounded border px-3 py-2"
              rows={3}
              value={updateForm.description}
              onChange={(e) =>
                setUpdateForm((prev) => ({ ...prev, description: e.target.value }))
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                <select
                  className="w-full rounded border px-3 py-2"
                  value={updateForm.status}
                  onChange={(e) =>
                    setUpdateForm((prev) => ({ ...prev, status: e.target.value }))
                  }
                >
                  <option value="">Auto-detect</option>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Board type
                </label>
                <select
                  className="w-full rounded border px-3 py-2"
                  value={updateForm.boardType}
                  onChange={(e) =>
                    setUpdateForm((prev) => ({ ...prev, boardType: e.target.value }))
                  }
                >
                  {boardTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="mt-4 mb-2 block text-sm font-medium text-gray-700">
              Current sprint
            </label>
            <input
              className="mb-4 w-full rounded border px-3 py-2"
              placeholder="Scrum 2"
              value={updateForm.currentSprint}
              onChange={(e) =>
                setUpdateForm((prev) => ({ ...prev, currentSprint: e.target.value }))
              }
            />

                <button
                  type="submit"
                  disabled={updating || !updateId}
                  className="w-full rounded bg-blue-600 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {updating ? "Saving changes..." : "Save changes"}
                </button>
              </form>
            </div>
          </>
        )}

        {projects.length > 0 && (
          <section className="mt-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Your spaces</h2>
                <p className="text-sm text-gray-500">
                  Boards are sorted by newest first. Click refresh after changes from other tabs.
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

            {loadingProjects ? (
              <p className="py-10 text-center text-gray-500">Loading projects...</p>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <article
                    key={project._id}
                    className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                        <p className="text-sm text-gray-500">
                          {project.description || "No description provided"}
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium capitalize text-blue-700">
                        {project.status || "created"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <span className="font-semibold text-gray-800">Board:</span> {project.boardType || "scrum"}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800">Sprint:</span> {project.currentSprint || "Scrum 1"}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800">Columns:</span>
                        {" "}
                        {project.columns?.length || 0}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800">Updated:</span> {formatDate(project.updatedAt)}
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleOpenBoard(project)}
                        className="rounded border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Open board
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            <form onSubmit={handleCreateProject}>
              <h2 className="text-2xl font-semibold text-gray-900">Create a new space</h2>
              <p className="mb-4 mt-2 text-sm text-gray-500">
                We’ll scaffold the board with To Do, In Progress, QA, Testing, Failed QA, and Done
                columns plus default Scrum 1 cards.
              </p>
              <label className="mb-2 block text-sm font-medium text-gray-700">Name</label>
              <input
                className="mb-4 w-full rounded border px-3 py-2"
                placeholder="Website Revamp"
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Description <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                className="mb-4 w-full rounded border px-3 py-2"
                rows={3}
                placeholder="Marketing site refresh"
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded bg-blue-600 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {creating ? "Creating..." : "Create Space"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
