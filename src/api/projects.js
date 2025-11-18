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
