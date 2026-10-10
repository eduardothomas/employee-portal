import { createApiClient } from "@ep/shared"

// Real API or in-browser demo backend, depending on VITE_BACKEND (see web/.env.production).
export const api = createApiClient("ep.employee.refresh")
