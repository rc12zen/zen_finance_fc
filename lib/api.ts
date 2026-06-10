import axios from "axios"

const API = axios.create({ baseURL: "http://localhost:8000" })

// ── Run ───────────────────────────────────────────────────────────────────────
export const getFiles        = ()                        => API.get("/api/run/files")
export const startRun        = (selectedFiles: string[]) => API.post("/api/run/start", { selected_files: selectedFiles })
export const getStatus       = ()                        => API.get("/api/run/status")
export const resetRun        = ()                        => API.post("/api/run/reset")

// Upload handlers
// POST /api/run/upload           — bank statement (multipart)
// DELETE /api/run/files/{filename} — remove a statement from the active queue
export const deleteFile = (filename: string) =>
  API.delete(`/api/run/files/${encodeURIComponent(filename)}`)

export const uploadStatement = (file: File) => {
  const form = new FormData()
  form.append("file", file)
  return API.post("/api/run/upload", form, { headers: { "Content-Type": "multipart/form-data" } })
}

// POST /api/config/upload-aging  — aging report (multipart)
// Backend: add a new endpoint under /api/config or reuse /api/run/upload with type flag.
// The simplest approach: place aging file in data/aging_report/ via a dedicated endpoint.
export const uploadAgingReport = (file: File) => {
  const form = new FormData()
  form.append("file", file)
  return API.post("/api/config/upload-aging", form, { headers: { "Content-Type": "multipart/form-data" } })
}

// Run history
// GET /api/run/history           — paginated list of all runs
export const getRunHistory = (
  page     = 1,
  pageSize = 50,
  dateFrom?: string,   // ISO date e.g. "2026-06-10"
  dateTo?:   string,
) => {
  const params: Record<string, string | number> = { page, page_size: pageSize }
  if (dateFrom) params.date_from = dateFrom
  if (dateTo)   params.date_to   = dateTo
  return API.get("/api/run/history", { params })
}

// GET /api/run/history/{run_id}  — single run detail
export const getRunDetail   = (runId: number) => API.get(`/api/run/history/${runId}`)
// GET /api/results/run-summary/{run_id}
// Returns metrics + tab rows (matched/not_found/review_approve/processed)
export const getRunSummary  = (runId: number) => API.get(`/api/results/run-summary/${runId}`)
// GET /api/results/row-detail/{record_id} — full analysis for one row
export const getRowDetail   = (recordId: number) => API.get(`/api/results/row-detail/${recordId}`)

// ── Results ───────────────────────────────────────────────────────────────────
// GET /api/results/metrics?run_id=X   — pass run_id to scope to one run
export const getMetrics = (
  runId?:    number,
  dateFrom?: string,   // ISO date e.g. "2026-06-10"
  dateTo?:   string,
) => {
  const params: Record<string, string | number> = {}
  if (runId)    params.run_id    = runId
  if (dateFrom) params.date_from = dateFrom
  if (dateTo)   params.date_to   = dateTo
  return API.get("/api/results/metrics", { params })
}
export const getMatched          = (params?: object)  => API.get("/api/results/matched",  { params })
export const getNotFound         = (params?: object)  => API.get("/api/results/not-found",{ params })
export const getValidationFailures = ()               => API.get("/api/results/validation-failures")

// ── HITL ──────────────────────────────────────────────────────────────────────
export const getPendingHitl     = ()                              => API.get("/api/hitl/pending")
export const getApprovalPreview = (id: number)                    => API.get(`/api/hitl/preview/${id}`)
//export const approveEntry       = (id: number, comment?: string)  => API.post(`/api/hitl/approve/${id}`, { comment })
export const rejectEntry        = (id: number, comment?: string)  => API.post(`/api/hitl/reject/${id}`,  { comment })
export const approveBulk        = (ids: number[])                 => API.post("/api/hitl/approve-bulk",  { ids })
export const getHitlHistory     = ()                              => API.get("/api/hitl/history")

// ── Config ────────────────────────────────────────────────────────────────────
export const getBankConfig        = ()                      => API.get("/api/config/banks")
export const getAbbreviations     = ()                      => API.get("/api/config/abbreviations")
export const updateAbbreviations  = (abbreviations: object) => API.put("/api/config/abbreviations", { abbreviations })
export const getAgingStatus       = ()                      => API.get("/api/config/aging-status")
export const refreshAging         = ()                      => API.post("/api/config/refresh-aging")

// ── Filters ───────────────────────────────────────────────────────────────────
// GET /api/filters/options?run_id=X
// Returns { banks: string[], business_units: string[], users: string[] }
export const getFilterOptions = (runId?: number) =>
  API.get("/api/filters/options", { params: runId ? { run_id: runId } : {} })



export const getFilePreview = (
  filename: string,
  bucket:   string = "active",
  maxRows:  number = 200,
) =>
  API.get(`/api/run/file-preview/${encodeURIComponent(filename)}`, {
    params: { bucket, max_rows: maxRows },
  })

// POST /api/hitl/retry-oracle/{id}
// Retry Oracle POST for a failed approved row
// Returns { message, transaction_ref, oracle_post_status, oracle_post_message, payload }
export const retryOracle = (id: number) =>
  API.post(`/api/hitl/retry-oracle/${id}`)



// GET /api/hitl/breakup-analysis/{id}
// Returns { needs_breakup, reason, invoices, credit_amount, tds_pct, auto_approved, breakup_source }
export const getBreakupAnalysis = (id: number) =>
  API.get(`/api/hitl/breakup-analysis/${id}`)


// UPDATE approveEntry to accept invoice_breakup
// Replace the existing approveEntry line with:
export const approveEntry = (
  id:             number,
  comment?:       string,
  invoiceBreakup?: { invoice_number: string; reference_amount: number }[],
) =>
  API.post(`/api/hitl/approve/${id}`, {
    comment,
    invoice_breakup: invoiceBreakup,
  })