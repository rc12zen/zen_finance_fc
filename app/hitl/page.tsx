"use client"
import { useEffect, useState } from "react"
import { getPendingHitl, getHitlHistory, approveEntry, rejectEntry, approveBulk } from "@/lib/api"
import StatusBadge from "@/components/StatusBadge"
import { CheckCircle, XCircle, CheckSquare } from "lucide-react"

export default function HitlPage() {
  const [pending, setPending] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [tab, setTab] = useState<"pending" | "history">("pending")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [rejectComment, setRejectComment] = useState<Record<number, string>>({})
  const [processing, setProcessing] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState("")

  const fetchData = async () => {
    try {
      const [p, h] = await Promise.all([getPendingHitl(), getHitlHistory()])
      setPending(p.data.data)
      setHistory(h.data.data)
    } catch {}
  }

  useEffect(() => { fetchData() }, [])

  const handleApprove = async (id: number) => {
    setProcessing(prev => new Set(prev).add(id))
    try {
      const res = await approveEntry(id)
      setMessage(`✓ Approved — Oracle Ref: ${res.data.transaction_ref}`)
      fetchData()
    } catch (e: any) {
      setMessage(`✗ Error: ${e?.response?.data?.detail || "Approval failed"}`)
    }
    setProcessing(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const handleReject = async (id: number) => {
    setProcessing(prev => new Set(prev).add(id))
    try {
      await rejectEntry(id, rejectComment[id])
      setMessage("✓ Rejected and moved to manual queue")
      fetchData()
    } catch (e: any) {
      setMessage(`✗ Error: ${e?.response?.data?.detail || "Rejection failed"}`)
    }
    setProcessing(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const handleBulkApprove = async () => {
    if (selected.size === 0) return
    try {
      await approveBulk(Array.from(selected))
      setMessage(`✓ Bulk approved ${selected.size} entries`)
      setSelected(new Set())
      fetchData()
    } catch { setMessage("✗ Bulk approve failed") }
  }

  const toggleSelect = (id: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const toggleAll = () => {
    if (selected.size === pending.length) setSelected(new Set())
    else setSelected(new Set(pending.map(r => r.id)))
  }

  return (
    <div className="max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">HITL Approval</h1>
        <p className="text-sm text-gray-500 mt-1">Finance SPOC review and approval of matched entries</p>
      </div>

      {message && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          {message}
          <button onClick={() => setMessage("")} className="text-blue-400">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {(["pending","history"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-white shadow text-[#1E3A5F]" : "text-gray-500 hover:text-gray-700"
            }`}>
            {t === "pending" ? `Pending (${pending.length})` : `History (${history.length})`}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <>
          {pending.length > 0 && (
            <div className="flex items-center gap-3 mb-3">
              <button onClick={toggleAll} className="text-xs text-[#2E6DA4] font-medium">
                {selected.size === pending.length ? "Deselect All" : "Select All"}
              </button>
              {selected.size > 0 && (
                <button onClick={handleBulkApprove}
                  className="flex items-center gap-2 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
                  <CheckSquare size={12} /> Bulk Approve ({selected.size})
                </button>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#1E3A5F] text-white">
                <tr>
                  <th className="px-3 py-3 w-8"></th>
                  {["Bank","Date","Narrative","Credit Amt","Currency","Extracted Customer","Extracted Invoice",
                    "Method","Confidence","Matched Customer","Matched Invoice","Outstanding","Inv. Currency","Actions"].map(h => (
                    <th key={h} className="px-3 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr><td colSpan={15} className="text-center py-8 text-gray-400">No pending entries. Run the pipeline first.</td></tr>
                ) : pending.map((r, i) => (
                  <tr key={r.id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${selected.has(r.id) ? "ring-1 ring-inset ring-blue-300" : ""}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="accent-[#1E3A5F]" />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.bank_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.statement_date}</td>
                    <td className="px-3 py-2 max-w-xs truncate" title={r.narrative}>{r.narrative}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.credit_amount?.toLocaleString()}</td>
                    <td className="px-3 py-2">{r.statement_currency}</td>
                    <td className="px-3 py-2 font-medium">{r.extracted_customer_name}</td>
                    <td className="px-3 py-2 font-mono">{r.extracted_invoice_number}</td>
                    <td className="px-3 py-2"><StatusBadge value={r.extraction_method} /></td>
                    <td className="px-3 py-2">{r.confidence_score ? `${(r.confidence_score * 100).toFixed(0)}%` : "—"}</td>
                    <td className="px-3 py-2 font-medium text-green-700">{r.matched_customer_name}</td>
                    <td className="px-3 py-2 font-mono">{r.matched_invoice_number}</td>
                    <td className="px-3 py-2 text-right">{r.outstanding_amount?.toLocaleString()}</td>
                    <td className="px-3 py-2">{r.invoice_currency}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1 min-w-[160px]">
                        <div className="flex gap-1">
                          <button onClick={() => handleApprove(r.id)}
                            disabled={processing.has(r.id)}
                            className="flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-40">
                            <CheckCircle size={10} /> Approve
                          </button>
                          <button onClick={() => handleReject(r.id)}
                            disabled={processing.has(r.id)}
                            className="flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 disabled:opacity-40">
                            <XCircle size={10} /> Reject
                          </button>
                        </div>
                        <input placeholder="Reject comment (optional)"
                          value={rejectComment[r.id] || ""}
                          onChange={e => setRejectComment(prev => ({ ...prev, [r.id]: e.target.value }))}
                          className="border rounded px-1 py-0.5 text-xs w-full outline-none" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "history" && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#1E3A5F] text-white">
              <tr>
                {["ID","Action","Bank","Narrative","Credit Amt","Customer","Invoice","Oracle Ref","Timestamp","Comment"].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">No history yet.</td></tr>
              ) : history.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-2">{r.id}</td>
                  <td className="px-3 py-2"><StatusBadge value={r.spoc_action} /></td>
                  <td className="px-3 py-2">{r.bank_name}</td>
                  <td className="px-3 py-2 max-w-xs truncate" title={r.narrative}>{r.narrative}</td>
                  <td className="px-3 py-2 text-right">{r.credit_amount?.toLocaleString()}</td>
                  <td className="px-3 py-2">{r.matched_customer_name}</td>
                  <td className="px-3 py-2 font-mono">{r.matched_invoice_number}</td>
                  <td className="px-3 py-2 font-mono text-green-700">{r.oracle_transaction_ref || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.action_timestamp?.slice(0,19)}</td>
                  <td className="px-3 py-2 text-gray-500">{r.spoc_comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
