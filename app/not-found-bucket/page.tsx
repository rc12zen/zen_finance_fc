"use client"
import { useEffect, useState } from "react"
import { getNotFound } from "@/lib/api"
import StatusBadge from "@/components/StatusBadge"
import { Download } from "lucide-react"

export default function NotFoundPage() {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [reasonFilter, setReasonFilter] = useState("")
  const PAGE_SIZE = 50

  const fetchData = async () => {
    try {
      const res = await getNotFound({ page, page_size: PAGE_SIZE, ...(reasonFilter && { reason: reasonFilter }) })
      setData(res.data.data)
      setTotal(res.data.total)
    } catch {}
  }

  useEffect(() => { fetchData() }, [page, reasonFilter])

  const exportCSV = () => {
    if (!data.length) return
    const headers = Object.keys(data[0]).join(",")
    const rows = data.map(r => Object.values(r).map(v => `"${v ?? ""}"`).join(",")).join("\n")
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "not_found.csv"; a.click()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const REASONS = ["no_customer","no_invoice","low_confidence","validation_failed","spoc_rejected","empty_narrative"]

  return (
    <div className="max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Not Found — Manual Review</h1>
          <p className="text-sm text-gray-500 mt-1">{total} records require manual Oracle Fusion entry</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 text-sm bg-[#1E3A5F] text-white px-4 py-2 rounded-lg hover:bg-[#2E6DA4]">
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg mb-4">
        These transactions could not be automatically matched. The Finance team should process them manually in Oracle Fusion using the existing process.
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex gap-3">
        <select value={reasonFilter} onChange={e => { setReasonFilter(e.target.value); setPage(1) }}
          className="border rounded-lg px-3 py-2 text-sm text-gray-600 outline-none">
          <option value="">All Reasons</option>
          {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[#1E3A5F] text-white">
            <tr>
              {["ID","Bank","Date","Narrative","Bank Account","Credit Amount","Currency","Reason"].map(h => (
                <th key={h} className="px-3 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">No unmatched records. Great!</td></tr>
            ) : data.map((r, i) => (
              <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2">{r.id}</td>
                <td className="px-3 py-2">{r.bank_name}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.statement_date}</td>
                <td className="px-3 py-2 max-w-sm truncate" title={r.narrative}>{r.narrative}</td>
                <td className="px-3 py-2 font-mono">{r.bank_account_number}</td>
                <td className="px-3 py-2 text-right">{r.credit_amount?.toLocaleString()}</td>
                <td className="px-3 py-2">{r.currency}</td>
                <td className="px-3 py-2"><StatusBadge value={r.reason} /></td>
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
    </div>
  )
}
