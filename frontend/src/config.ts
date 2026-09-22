const envApiUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;

export const API_BASE = envApiUrl
  ? `${envApiUrl.replace(/\/+$/, "")}/api`
  : "http://localhost:8000/api";
