// Shared lib/api — re-exports apiFetch from the student-management module
// so that modules under src/modules/shared/** can import "../lib/api" consistently.
export { apiFetch, getAccessToken, setAccessToken, setBusinessApiScope } from "../../student-management/lib/api";
export type { BusinessApiScope } from "../../student-management/lib/api";
