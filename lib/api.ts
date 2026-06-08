import axios from "axios"

const API = axios.create({ baseURL: "http://localhost:8000" })

export const getFiles = () => API.get("/api/run/files")
export const startRun = (selectedFiles: string[]) => API.post("/api/run/start", { selected_files: selectedFiles })
export const getStatus = () => API.get("/api/run/status")
export const resetRun = () => API.post("/api/run/reset")

export const getMetrics = () => API.get("/api/results/metrics")
export const getMatched = (params?: object) => API.get("/api/results/matched", { params })
export const getNotFound = (params?: object) => API.get("/api/results/not-found", { params })
export const getValidationFailures = () => API.get("/api/results/validation-failures")

export const getPendingHitl = () => API.get("/api/hitl/pending")
export const getApprovalPreview = (id: number) => API.get(`/api/hitl/preview/${id}`)
export const approveEntry = (id: number, comment?: string) => API.post(`/api/hitl/approve/${id}`, { comment })
export const rejectEntry = (id: number, comment?: string) => API.post(`/api/hitl/reject/${id}`, { comment })
export const approveBulk = (ids: number[]) => API.post("/api/hitl/approve-bulk", { ids })
export const getHitlHistory = () => API.get("/api/hitl/history")

export const getBankConfig = () => API.get("/api/config/banks")
export const getAbbreviations = () => API.get("/api/config/abbreviations")
export const updateAbbreviations = (abbreviations: object) => API.put("/api/config/abbreviations", { abbreviations })
export const getAgingStatus = () => API.get("/api/config/aging-status")
export const refreshAging = () => API.post("/api/config/refresh-aging")