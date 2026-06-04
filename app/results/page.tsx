"use client"
import { useEffect, useState } from "react"
import { getMatched } from "@/lib/api"
import StatusBadge from "@/components/StatusBadge"
import { Download, Search } from "lucide-react"

export default function ResultsPage() {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [valFilter, setValFilter] = useState("")
  const [hitlFilter, setHitlFilter] = useState("")
  const [methodFilter, setMethodFilter] = useState("")
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
          { label: "Method", value: methodFilter, setter: setMethodFilter, options: ["cache", "regex", "fuzzy"] },
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
              {["ID","Bank","Date","Narrative","Credit Amt","Currency","Extracted Customer","Extracted Invoice",
                "Method","Confidence","Matched Customer","Matched Invoice","Outstanding","Val. Status","HITL Status","Oracle Ref"].map(h => (
                <th key={h} className="px-3 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={16} className="text-center py-8 text-gray-400">No data. Run the pipeline first.</td></tr>
            ) : data.map((r, i) => (
              <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2">{r.id}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.bank_name}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.statement_date}</td>
                <td className="px-3 py-2 max-w-xs truncate" title={r.narrative}>{r.narrative}</td>
                <td className="px-3 py-2 text-right">{r.credit_amount?.toLocaleString()}</td>
                <td className="px-3 py-2">{r.statement_currency}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.extracted_customer_name}</td>
                <td className="px-3 py-2">{r.extracted_invoice_number}</td>
                <td className="px-3 py-2"><StatusBadge value={r.extraction_method} /></td>
                <td className="px-3 py-2">{r.confidence_score ? `${(r.confidence_score * 100).toFixed(0)}%` : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.matched_customer_name}</td>
                <td className="px-3 py-2">{r.matched_invoice_number}</td>
                <td className="px-3 py-2 text-right">{r.outstanding_amount?.toLocaleString()}</td>
                <td className="px-3 py-2"><StatusBadge value={r.validation_status} /></td>
                <td className="px-3 py-2"><StatusBadge value={r.hitl_status} /></td>
                <td className="px-3 py-2 font-mono text-xs">{r.oracle_transaction_ref || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40">← Prev</button>
          <span className="px-3 py-1 text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  )
}
