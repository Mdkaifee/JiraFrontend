import axios from "axios";

const API = "http://localhost:5000/users";

const withAuth = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const fetchUsers = (token) => axios.get(API, withAuth(token));
