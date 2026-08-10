import { apiFetch, getAccessToken, setAccessToken } from "../../shared/lib/apiFetch";

export const getWorkerAccessToken = getAccessToken;
export const setWorkerAccessToken = setAccessToken;

type WorkerFetchOptions = RequestInit & { params?: Record<string, string | number | boolean | null | undefined> };

export const workerApiFetch: typeof apiFetch = apiFetch;
