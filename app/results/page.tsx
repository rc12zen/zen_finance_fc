"use client"
import { useEffect, useState } from "react"
import { getMatched } from "@/lib/api"
import axios from "axios"
import StatusBadge from "@/components/StatusBadge"
import { Download, Search, Building2, X, CheckCircle2, XCircle, MinusCircle, ChevronRight } from "lucide-react"

const API = axios.create({ baseURL: "http://localhost:8000" })
const getValidationDetail = (id: number) => API.get(`/api/results/matched/${id}/validation-detail`)

// ── Types ─────────────────────────────────────────────────────────────────────
interface Check {
  rule: string
  label: string
  status: "passed" | "failed" | "skipped"
  bank_label: string
  bank_value: string | null
  aging_label: string
  aging_value: string | null
  note: string
}
interface ValidationDetail {
  id: number
  validation_status: string
  failed_rules: string[]
  bank_name: string
  statement_date: string
  narrative: string
  extraction_method: string
  confidence_score: number
  checks: Check[]
}

// ── Status icon ───────────────────────────────────────────────────────────────
function CheckIcon({ status }: { status: string }) {
  if (status === "passed")  return <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
  if (status === "failed")  return <XCircle      size={16} className="text-red-500 shrink-0" />
  return                           <MinusCircle  size={16} className="text-gray-300 shrink-0" />
}

// ── Validation Drawer ─────────────────────────────────────────────────────────
function ValidationDrawer({ rowId, onClose }: { rowId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<ValidationDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getValidationDetail(rowId)
      .then(r => setDetail(r.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [rowId])

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[520px] bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-[#1E3A5F]">
          <div>
            <p className="text-white font-semibold text-sm">Validation Detail — ID #{rowId}</p>
            {detail && (
              <p className="text-blue-200 text-xs mt-0.5">
                {detail.bank_name} · {detail.statement_date} ·{" "}
                <span className="uppercase">{detail.extraction_method}</span>{" "}
                {detail.confidence_score ? `· ${(detail.confidence_score * 100).toFixed(0)}% confidence` : ""}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Loading...
          </div>
        ) : !detail ? (
          <div className="flex-1 flex items-center justify-center text-red-400 text-sm">
            Failed to load detail.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Narrative */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-400 font-medium mb-1">NARRATIVE</p>
              <p className="text-xs text-gray-700 break-all leading-relaxed">{detail.narrative}</p>
            </div>

            {/* Failed rules summary */}
            {detail.failed_rules.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex flex-wrap gap-2">
                <span className="text-xs text-red-600 font-medium mr-1">Failed:</span>
                {detail.failed_rules.map(r => (
                  <span key={r} className="text-xs bg-red-100 text-red-700 border border-red-300 rounded px-2 py-0.5 font-mono font-semibold">
                    {r}
                  </span>
                ))}
              </div>
            )}

            {/* Checks */}
            <div className="space-y-3">
              {detail.checks.map((check) => (
                <div
                  key={check.rule}
                  className={`rounded-xl border p-4 ${
                    check.status === "failed"  ? "border-red-200 bg-red-50/50" :
                    check.status === "passed"  ? "border-emerald-200 bg-emerald-50/40" :
                    "border-gray-100 bg-gray-50/50"
                  }`}
                >
                  {/* Rule header */}
                  <div className="flex items-center gap-2 mb-3">
                    <CheckIcon status={check.status} />
                    <span className="text-xs font-mono font-bold text-gray-500">{check.rule}</span>
                    <span className="text-xs font-semibold text-gray-700">{check.label}</span>
                    <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                      check.status === "failed"  ? "bg-red-100 text-red-700" :
                      check.status === "passed"  ? "bg-emerald-100 text-emerald-700" :
                      "bg-gray-100 text-gray-400"
                    }`}>
                      {check.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Side-by-side comparison */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {/* Bank side */}
                    <div className="bg-white rounded-lg border border-blue-100 p-3">
                      <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide mb-1">
                        {check.bank_label}
                      </p>
                      <p className={`text-xs font-mono break-all ${
                        check.bank_value ? "text-gray-800" : "text-gray-300 italic"
                      }`}>
                        {check.bank_value ?? "—"}
                      </p>
                    </div>

                    {/* Arrow */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden" />

                    {/* Aging side */}
                    <div className="bg-white rounded-lg border border-purple-100 p-3">
                      <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wide mb-1">
                        {check.aging_label}
                      </p>
                      <p className={`text-xs font-mono break-all ${
                        check.aging_value ? "text-gray-800" : "text-gray-300 italic"
                      }`}>
                        {check.aging_value ?? "—"}
                      </p>
                    </div>
                  </div>

                  {/* Note */}
                  <p className={`text-xs px-2 py-1 rounded ${
                    check.status === "failed"  ? "bg-red-100 text-red-700" :
                    check.status === "passed"  ? "bg-emerald-100 text-emerald-700" :
                    "bg-gray-100 text-gray-400"
                  }`}>
                    {check.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Main Results Page ─────────────────────────────────────────────────────────
export default function ResultsPage() {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [valFilter, setValFilter] = useState("")
  const [hitlFilter, setHitlFilter] = useState("")
  const [methodFilter, setMethodFilter] = useState("")
  const [drawerRowId, setDrawerRowId] = useState<number | null>(null)
  const PAGE_SIZE = 50

  const fetchData = async () => {
    try {
      const res = await getMatched({
        page, page_size: PAGE_SIZE,
        ...(search && { search }),
        ...(valFilter && { validation_status: valFilter }),
        ...(hitlFilter && { hitl_status: hitlFilter }),
        ...(methodFilter && { extraction_method: methodFilter }),
      })
      setData(res.data.data)
      setTotal(res.data.total)
    } catch {}
  }

  useEffect(() => { fetchData() }, [page, search, valFilter, hitlFilter, methodFilter])

  const exportCSV = () => {
    if (!data.length) return
    const headers = Object.keys(data[0]).join(",")
    const rows = data.map(r => Object.values(r).map(v => `"${v ?? ""}"`).join(",")).join("\n")
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "matched_results.csv"; a.click()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Matched Results</h1>
          <p className="text-sm text-gray-500 mt-1">{total} records</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 text-sm bg-[#1E3A5F] text-white px-4 py-2 rounded-lg hover:bg-[#2E6DA4]">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm flex-1 min-w-48">
          <Search size={14} className="text-gray-400" />
          <input placeholder="Search customer, invoice, narrative..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="outline-none w-full text-sm" />
        </div>
        {[
          { label: "Validation", value: valFilter, setter: setValFilter, options: ["passed", "failed"] },
          { label: "HITL Status", value: hitlFilter, setter: setHitlFilter, options: ["pending", "approved", "rejected"] },
          { label: "Method", value: methodFilter, setter: setMethodFilter, options: ["regex", "token_exact", "token_fuzzy", "token_scan"] },
        ].map(({ label, value, setter, options }) => (
          <select key={label} value={value} onChange={e => { setter(e.target.value); setPage(1) }}
            className="border rounded-lg px-3 py-2 text-sm text-gray-600 outline-none">
            <option value="">All {label}</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[#1E3A5F] text-white">
            <tr>
              {["ID","Bank","BU","Date","Narrative","Credit Amt","Currency",
                "Extracted Customer","Extracted Invoice","Method","Confidence",
                "Matched Customer","Matched Invoice","Outstanding","Val. Status","HITL Status","Oracle Ref"].map(h => (
                <th key={h} className="px-3 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={17} className="text-center py-8 text-gray-400">No data. Run the pipeline first.</td></tr>
            ) : data.map((r, i) => (
              <tr
                key={r.id}
                className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${
                  r.validation_status === "failed"
                    ? "cursor-pointer hover:bg-red-50 group"
                    : ""
                }`}
                onClick={() => r.validation_status === "failed" && setDrawerRowId(r.id)}
              >
                <td className="px-3 py-2">{r.id}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.bank_name}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.business_unit ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 font-medium">
                      <Building2 size={9} /> {r.business_unit}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{r.statement_date}</td>
                <td className="px-3 py-2 max-w-xs truncate" title={r.narrative}>
                  <span>{r.narrative}</span>
                  {r.validation_status === "failed" && (
                    <ChevronRight size={12} className="inline ml-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono">{r.credit_amount?.toLocaleString()}</td>
                <td className="px-3 py-2">{r.statement_currency}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.extracted_customer_name}</td>
                <td className="px-3 py-2 font-mono">{r.extracted_invoice_number}</td>
                <td className="px-3 py-2"><StatusBadge value={r.extraction_method} /></td>
                <td className="px-3 py-2">{r.confidence_score ? `${(r.confidence_score * 100).toFixed(0)}%` : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.matched_customer_name}</td>
                <td className="px-3 py-2 font-mono">{r.matched_invoice_number}</td>
                <td className="px-3 py-2 text-right">{r.outstanding_amount?.toLocaleString()}</td>
                <td className="px-3 py-2"><StatusBadge value={r.validation_status} /></td>
                <td className="px-3 py-2"><StatusBadge value={r.hitl_status} /></td>
                <td className="px-3 py-2 font-mono text-xs text-green-700">{r.oracle_transaction_ref || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40">← Prev</button>
          <span className="px-3 py-1 text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40">Next →</button>
        </div>
      )}

      {/* Validation Detail Drawer */}
      {drawerRowId !== null && (
        <ValidationDrawer
          rowId={drawerRowId}
          onClose={() => setDrawerRowId(null)}
        />
      )}
    </div>
  )
}