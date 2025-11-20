import axios from "axios";

const API = "http://localhost:5000/projects";

const withAuth = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const fetchProjects = (token) => axios.get(API, withAuth(token));

export const getProjectById = (projectId, token) =>
  axios.get(`${API}/${projectId}`, withAuth(token));

export const fetchProjectColumns = (projectId, token, params = {}) =>
  axios.get(`${API}/${projectId}/columns`, {
    ...withAuth(token),
    params,
  });

export const createProject = (payload, token) =>
  axios.post(API, payload, {
    ...withAuth(token),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

export const updateProject = (projectId, payload, token) =>
  axios.put(`${API}/${projectId}`, payload, {
    ...withAuth(token),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

export const createProjectColumn = (projectId, payload, token) =>
  axios.post(`${API}/${projectId}/columns`, payload, {
    ...withAuth(token),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

export const getProjectColumn = (projectId, columnName, token) =>
  axios.get(`${API}/${projectId}/columns/${encodeURIComponent(columnName)}`, withAuth(token));

export const updateProjectColumn = (projectId, columnName, payload, token) =>
  axios.put(`${API}/${projectId}/columns/${encodeURIComponent(columnName)}`, payload, {
    ...withAuth(token),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

export const deleteProjectColumn = (projectId, columnName, payload = {}, token) =>
  axios.delete(`${API}/${projectId}/columns/${encodeURIComponent(columnName)}`, {
    ...withAuth(token),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    data: payload,
  });

export const fetchProjectInvitations = (token) =>
  axios.get(`${API}/invitations`, withAuth(token));

export const inviteProjectMember = (projectId, payload, token) =>
  axios.post(`${API}/${projectId}/invite`, payload, {
    ...withAuth(token),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

export const acceptProjectInvite = (projectId, token) =>
  axios.post(
    `${API}/${projectId}/accept-invite`,
    {},
    {
      ...withAuth(token),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
