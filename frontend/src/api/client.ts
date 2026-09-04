import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const API_KEY = import.meta.env.VITE_API_KEY || '';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
  },
});

export default client;
