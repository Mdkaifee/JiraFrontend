import axios from "axios";

const API = "http://localhost:5000/auth";

export const sendSignupOtp = (email) =>
  axios.post(`${API}/signup/send-otp`, { email });

export const verifySignupOtp = (email, otp) =>
  axios.post(`${API}/signup/verify`, { email, otp });

export const updateProfile = (data, token) =>
  axios.put(`${API}/update-profile`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const checkUserExists = (email) =>
  axios.post(`${API}/login/check-email`, { email });

export const sendLoginOtp = (email, password) =>
  axios.post(`${API}/login/send-otp`, { email, password });

export const verifyLoginOtp = (email, otp) =>
  axios.post(`${API}/login/verify`, { email, otp });

export const logoutUser = (token) =>
  axios.post(`${API}/logout`, {}, { headers: { Authorization: `Bearer ${token}` } });
