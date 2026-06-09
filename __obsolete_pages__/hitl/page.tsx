"use client"
import { useEffect, useState } from "react"
import { getPendingHitl, getHitlHistory, getApprovalPreview, approveEntry, rejectEntry, approveBulk } from "@/lib/api"
import StatusBadge from "@/components/StatusBadge"
import { CheckCircle, XCircle, CheckSquare, Building2, X, AlertTriangle, FileCheck } from "lucide-react"

interface OraclePayload {
  ReceiptNumber: string
  ReceiptMethod: string
  BusinessUnit: string
  CustomerAccountNumber: string
  RemittanceBankAccountNumber: string
  ConversionRateType: string
  ConversionDate: string
  ConversionRate: number
  Amount: number
  Currency: string
  AccountingDate: string
  ReceiptDate: string
  remittanceReferences: { ReceiptMatchBy: string; ReferenceNumber: string; ReferenceAmount: string }[]
}

// ── Confirmation Modal ─────────────────────────────────────────────────────
function ConfirmationModal({
  payload,
  entryId,
  onConfirm,
  onCancel,
  processing,
}: {
  payload: OraclePayload
  entryId: number
  onConfirm: (id: number) => void
  onCancel: () => void
  processing: boolean
}) {
  const fields: [string, string | number | undefined][] = [
    ["Receipt Number", payload.ReceiptNumber],
    ["Receipt Method", payload.ReceiptMethod],
    ["Business Unit", payload.BusinessUnit],
    ["Customer Account No.", payload.CustomerAccountNumber],
    ["Remittance Bank Account", payload.RemittanceBankAccountNumber],
    ["Conversion Rate Type", payload.ConversionRateType],
    ["Conversion Date", payload.ConversionDate],
    ["Conversion Rate", payload.ConversionRate],
    ["Amount", payload.Amount],
    ["Currency", payload.Currency],
    ["Accounting Date", payload.AccountingDate],
    ["Receipt Date", payload.ReceiptDate],
  ]

  const ref = payload.remittanceReferences?.[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-[#1E3A5F] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <FileCheck size={18} />
            <span className="font-semibold text-sm">Oracle Fusion Receipt — Confirm & Post</span>
          </div>
          <button onClick={onCancel} className="text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Warning */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Review all fields carefully. This will post a receipt to Oracle Fusion AR and cannot be undone.
          </p>
        </div>

        {/* Fields */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {fields.map(([label, value]) => (
              <div key={label}>
                <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                <div className={`text-sm font-medium text-gray-800 ${
                  label === "Business Unit" ? "text-[#2E6DA4]" :
                  label === "Receipt Number" ? "font-mono text-xs" : ""
                }`}>
                  {value !== undefined && value !== null && value !== "" ? String(value) : <span className="text-gray-300">—</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Remittance Reference */}
          {ref && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Remittance Reference</div>
              <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Match By</div>
                  <div className="text-xs font-medium">{ref.ReceiptMatchBy}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Invoice Number</div>
                  <div className="text-xs font-mono font-medium text-[#1E3A5F]">{ref.ReferenceNumber}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Reference Amount</div>
                  <div className="text-xs font-medium">{ref.ReferenceAmount}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(entryId)}
            disabled={processing}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors font-semibold">
            <CheckCircle size={14} />
            {processing ? "Posting to Oracle..." : "Confirm & Post to Oracle"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main HITL Page ─────────────────────────────────────────────────────────
export default function HitlPage() {
  const [pending, setPending] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [tab, setTab] = useState<"pending" | "history">("pending")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [rejectComment, setRejectComment] = useState<Record<number, string>>({})
  const [processing, setProcessing] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error">("success")

  // Confirmation modal state
  const [confirmEntry, setConfirmEntry] = useState<{ id: number; payload: OraclePayload } | null>(null)
  const [previewLoading, setPreviewLoading] = useState<number | null>(null)

  const fetchData = async () => {
    try {
      const [p, h] = await Promise.all([getPendingHitl(), getHitlHistory()])
      setPending(p.data.data)
      setHistory(h.data.data)
    } catch {}
  }

  useEffect(() => { fetchData() }, [])

  const showMsg = (msg: string, type: "success" | "error" = "success") => {
    setMessage(msg); setMessageType(type)
  }

  // Step 1: SPOC clicks Approve → fetch preview → show modal
  const handleApproveClick = async (id: number) => {
    setPreviewLoading(id)
    try {
      const res = await getApprovalPreview(id)
      if (res.data.success) {
        setConfirmEntry({ id, payload: res.data.payload })
      } else {
        showMsg(`✗ Could not load preview: ${res.data.error}`, "error")
      }
    } catch (e: any) {
      showMsg(`✗ Preview failed: ${e?.response?.data?.detail || "Unknown error"}`, "error")
    }
    setPreviewLoading(null)
  }

  // Step 2: SPOC confirms → actually post to Oracle
  const handleConfirmApprove = async (id: number) => {
    setProcessing(prev => new Set(prev).add(id))
    try {
      const res = await approveEntry(id)
      showMsg(`✓ Approved — Oracle Ref: ${res.data.transaction_ref}`, "success")
      setConfirmEntry(null)
      fetchData()
    } catch (e: any) {
      showMsg(`✗ Error: ${e?.response?.data?.detail || "Approval failed"}`, "error")
    }
    setProcessing(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const handleReject = async (id: number) => {
    setProcessing(prev => new Set(prev).add(id))
    try {
      await rejectEntry(id, rejectComment[id])
      showMsg("✓ Rejected and moved to manual queue", "success")
      fetchData()
    } catch (e: any) {
      showMsg(`✗ Error: ${e?.response?.data?.detail || "Rejection failed"}`, "error")
    }
    setProcessing(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const handleBulkApprove = async () => {
    if (selected.size === 0) return
    try {
      await approveBulk(Array.from(selected))
      showMsg(`✓ Bulk approved ${selected.size} entries`, "success")
      setSelected(new Set())
      fetchData()
    } catch { showMsg("✗ Bulk approve failed", "error") }
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
      {/* Confirmation Modal */}
      {confirmEntry && (
        <ConfirmationModal
          payload={confirmEntry.payload}
          entryId={confirmEntry.id}
          onConfirm={handleConfirmApprove}
          onCancel={() => setConfirmEntry(null)}
          processing={processing.has(confirmEntry.id)}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">HITL Approval</h1>
        <p className="text-sm text-gray-500 mt-1">Finance SPOC review and approval of matched entries</p>
      </div>

      {message && (
        <div className={`mb-4 border px-4 py-3 rounded-lg text-sm flex items-center justify-between ${
          messageType === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {message}
          <button onClick={() => setMessage("")} className="opacity-60 hover:opacity-100 ml-4">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {(["pending", "history"] as const).map(t => (
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
                  {["Bank","BU","Date","Narrative","Credit Amt","Currency",
                    "Extracted Customer","Extracted Invoice","Method","Confidence",
                    "Matched Customer","Matched Invoice","Outstanding","Inv. Currency","Actions"].map(h => (
                    <th key={h} className="px-3 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr><td colSpan={16} className="text-center py-8 text-gray-400">No pending entries. Run the pipeline first.</td></tr>
                ) : pending.map((r, i) => (
                  <tr key={r.id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${selected.has(r.id) ? "ring-1 ring-inset ring-blue-300" : ""}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="accent-[#1E3A5F]" />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.bank_name}</td>
                    {/* BU Column */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.business_unit ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 font-medium">
                          <Building2 size={9} /> {r.business_unit}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.statement_date}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate" title={r.narrative}>{r.narrative}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{r.credit_amount?.toLocaleString()}</td>
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
                      <div className="flex flex-col gap-1.5 min-w-[180px]">
                        <div className="flex gap-1">
                          {/* Approve triggers preview first */}
                          <button
                            onClick={() => handleApproveClick(r.id)}
                            disabled={processing.has(r.id) || previewLoading === r.id}
                            className="flex items-center gap-1 bg-green-600 text-white px-2 py-1.5 rounded text-xs hover:bg-green-700 disabled:opacity-40 font-medium">
                            {previewLoading === r.id ? (
                              <span className="animate-spin">⟳</span>
                            ) : (
                              <CheckCircle size={10} />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(r.id)}
                            disabled={processing.has(r.id)}
                            className="flex items-center gap-1 bg-red-500 text-white px-2 py-1.5 rounded text-xs hover:bg-red-600 disabled:opacity-40 font-medium">
                            <XCircle size={10} /> Reject
                          </button>
                        </div>
                        <input
                          placeholder="Reject comment (optional)"
                          value={rejectComment[r.id] || ""}
                          onChange={e => setRejectComment(prev => ({ ...prev, [r.id]: e.target.value }))}
                          className="border rounded px-1.5 py-1 text-xs w-full outline-none focus:border-[#2E6DA4]"
                        />
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
                {["ID","Action","Bank","BU","Narrative","Credit Amt","Customer","Invoice","Oracle Ref","Timestamp","Comment"].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-8 text-gray-400">No history yet.</td></tr>
              ) : history.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-2">{r.id}</td>
                  <td className="px-3 py-2"><StatusBadge value={r.spoc_action} /></td>
                  <td className="px-3 py-2">{r.bank_name}</td>
                  <td className="px-3 py-2">
                    {r.business_unit ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                        <Building2 size={9} /> {r.business_unit}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate" title={r.narrative}>{r.narrative}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.credit_amount?.toLocaleString()}</td>
                  <td className="px-3 py-2">{r.matched_customer_name}</td>
                  <td className="px-3 py-2 font-mono">{r.matched_invoice_number}</td>
                  <td className="px-3 py-2 font-mono text-green-700 text-xs">{r.oracle_transaction_ref || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.action_timestamp?.slice(0, 19)}</td>
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