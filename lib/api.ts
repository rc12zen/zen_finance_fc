import axios from "axios";

const API = axios.create({ baseURL: "http://localhost:8000" });

// ── Run ───────────────────────────────────────────────────────────────────────
export const getFiles        = ()                         => API.get("/api/run/files");
export const startRun        = (selectedFiles: string[])  => API.post("/api/run/start", { selected_files: selectedFiles });
export const getStatus       = ()                         => API.get("/api/run/status");
export const resetRun        = ()                         => API.post("/api/run/reset");

export const deleteFile = (filename: string) =>
  API.delete(`/api/run/files/${encodeURIComponent(filename)}`);

export const uploadStatement = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return API.post("/api/run/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
};

export const uploadAgingReport = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return API.post("/api/config/upload-aging", form, { headers: { "Content-Type": "multipart/form-data" } });
};

// ── Run history ───────────────────────────────────────────────────────────────
export const getRunHistory = (
  page     = 1,
  pageSize = 50,
  dateFrom?: string,
  dateTo?:   string,
) => {
  const params: Record<string, string | number> = { page, page_size: pageSize };
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo)   params.date_to   = dateTo;
  return API.get("/api/run/history", { params });
};

// ── Results ───────────────────────────────────────────────────────────────────

/**
 * Dashboard KPI metrics.
 *
 * PATH 1: run_id provided   → live query scoped to that run
 * PATH 2: date range        → aggregate from run_metrics
 * PATH 3: no params         → all completed runs
 *
 * Response shape (maps directly to Dashboard KPI cards):
 *   total_rows_ingested  → "Total Rows Ingested"
 *   found                → "Found" (is_matched = true)
 *   not_found            → "Not Found"
 *   passed_validation    → "Passed Validation"
 *   failed_validation    → "Failed Validation"
 *   pending_hitl         → "Pending HITL"
 *   approved             → "Approved"
 *   rejected             → "Rejected"
 *   posted_to_oracle     → "Approved & Posted"
 */
export const getMetrics = (
  runId?:    number,
  dateFrom?: string,
  dateTo?:   string,
) => {
  const params: Record<string, string | number> = {};
  if (runId)    params.run_id    = runId;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo)   params.date_to   = dateTo;
  return API.get("/api/results/metrics", { params });
};

/**
 * Analysis History detail view.
 * Returns metrics + 4 tabs: matched / not_found / review_approve / processed
 *
 * Each row has:
 *   is_matched, passed_validation, status  — the three key flags
 *   _source: "matched" | "not_found"
 */
export const getRunSummary = (runId: number) =>
  API.get(`/api/results/run-summary/${runId}`);

/**
 * Full row detail (row detail page).
 * Response sections:
 *   bank_statement  — parsed bank statement fields (bank_name, statement_date,
 *                     narrative, bank_account_number, bank_reference,
 *                     credit_amount, currency, business_unit, ou_number)
 *   extraction      — AI extraction output (method, confidence_score,
 *                     extracted_customer, primary_invoice, all_invoice_numbers,
 *                     row_type, is_matched)
 *   confirmed_invoices — Final invoice list for Oracle, each with full aging data
 *                        (invoice_number, customer_name, outstanding_amount,
 *                         currency, ou_number, invoice_date,
 *                         remittance_amount, computed_amount)
 *   sum_outstanding — Sum of outstanding across all confirmed invoices
 *   credit_amount   — Bank credited amount
 *   pipeline        — Ordered nodes for visual flowchart
 *                     [{key, label, status: passed|failed|skipped|pending, detail}]
 *   oracle          — Payload + Oracle response fields after Processed:
 *                     {payload, remittance_scenario, hitl_status, post_status,
 *                      oracle_ref_no, oracle_status_code, standard_receipt_id,
 *                      oracle_posted_at, post_message}
 *   remittance      — Matched remittance email (null if not found)
 */
export const getRowDetail = (recordId: number) =>
  API.get(`/api/results/row-detail/${recordId}`);

export const getNotFound           = (params?: object) => API.get("/api/results/not-found", { params });
export const getValidationFailures = ()                => API.get("/api/results/validation-failures");

/**
 * Shortage & Reconciliation Audit — finance team post-processing view.
 * Returns all Processed records split into two buckets:
 *   shortage     → credit < outstanding (88–99.9% range, residual balance remains in Oracle)
 *   full_payment → credit == outstanding (100%, fully closed, no action needed)
 *
 * Each row includes:
 *   variance, ratio_pct, is_full_payment, oracle_ref_no, standard_receipt_id
 *   applications: per-invoice apply telemetry from oracle_receipt_applications table
 *     [{invoice_number, amount_outstanding, amount_applied, shortage_amount,
 *       is_full_payment, status, application_id, error}]
 */
export const getProcessedShortages = (
  runId?:    number,
  dateFrom?: string,
  dateTo?:   string,
) => {
  const params: Record<string, string | number> = {};
  if (runId)    params.run_id    = runId;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo)   params.date_to   = dateTo;
  return API.get("/api/results/processed-shortage-summary", { params });
};

// ── HITL ──────────────────────────────────────────────────────────────────────
export const getPendingHitl     = ()                             => API.get("/api/hitl/pending");
export const getApprovalPreview = (id: number)                   => API.get(`/api/hitl/preview/${id}`);
export const rejectEntry        = (id: number, comment?: string) => API.post(`/api/hitl/reject/${id}`, { comment });
export const approveBulk        = (ids: number[])                => API.post("/api/hitl/approve-bulk", { ids });
export const getHitlHistory     = ()                             => API.get("/api/hitl/history");
export const retryOracle        = (id: number)                   => API.post(`/api/hitl/retry-oracle/${id}`);

/**
 * Approve a record.
 * invoice_breakup: optional per-invoice confirmed amounts from SPOC modal.
 *   [{invoice_number, reference_amount}]
 * Oracle stores oracle_ref_no, oracle_status_code, standard_receipt_id on success.
 * Response also includes per-invoice apply telemetry in `applications[]`.
 */
export const approveEntry = (
  id:              number,
  comment?:        string,
  invoiceBreakup?: { invoice_number: string; reference_amount: number }[],
) =>
  API.post(`/api/hitl/approve/${id}`, {
    comment,
    invoice_breakup: invoiceBreakup,
  });

/**
 * Get per-invoice breakup for SPOC confirmation modal.
 * Returns: { needs_breakup, scenario, credit_amount, invoices, auto_approved }
 * invoices: [{ invoice_number, outstanding, remittance_amount, computed_amount, suggested_reference_amount }]
 */
export const getBreakupAnalysis = (id: number) =>
  API.get(`/api/hitl/breakup-analysis/${id}`);

// ── Config ────────────────────────────────────────────────────────────────────
export const getBankConfig       = ()                      => API.get("/api/config/banks");
export const getAbbreviations    = ()                      => API.get("/api/config/abbreviations");
export const updateAbbreviations = (abbreviations: object) => API.put("/api/config/abbreviations", { abbreviations });
export const getAgingStatus      = ()                      => API.get("/api/config/aging-status");
export const refreshAging        = ()                      => API.post("/api/config/refresh-aging");

/**
 * Preview the currently loaded aging report (first N rows).
 * Returns { filename, total_rows, columns, rows } — same shape as getFilePreview
 * so both can be rendered with the same table component.
 * Uses max_rows param (not limit — backend reads max_rows).
 */
export const getAgingPreview = (maxRows: number = 200) =>
  API.get("/api/config/aging-preview", { params: { max_rows: maxRows } });

// ── Filters ───────────────────────────────────────────────────────────────────
export const getFilterOptions = (runId?: number) =>
  API.get("/api/filters/options", { params: runId ? { run_id: runId } : {} });

// ── File preview ──────────────────────────────────────────────────────────────
export const getFilePreview = (
  filename: string,
  bucket:   string = "active",
  maxRows:  number = 200,
) =>
  API.get(`/api/run/file-preview/${encodeURIComponent(filename)}`, {
    params: { bucket, max_rows: maxRows },
  });

// ── Remittance ────────────────────────────────────────────────────────────────
export const uploadRemittance = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return API.post("/api/remittance/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
};
export const loadRemittanceFolder = () => API.post("/api/remittance/load-folder");
export const getRemittances       = () => API.get("/api/remittance/");