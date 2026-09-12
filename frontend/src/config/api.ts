/**
 * API configuration and helper for PaperWise frontend.
 * Resolves API URL based on REACT_APP_API_URL environment variable
 * with fallback to http://localhost:8081 for local development.
 */
export const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8081').replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}
