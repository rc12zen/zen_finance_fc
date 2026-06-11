"use client";
/**
 * Row Detail — /app/analysis-history/row/[id]/page.tsx
 *
 * Layout (strictly per requirements):
 *   Section 1 — Source Data Audit
 *     1a. Bank Statement Data
 *     1b. Text Extraction Output
 *   Section 2 — Final Confirmed Invoice List (with aging outstanding)
 *   Section 3 — Visual Processing Pipeline (flowchart)
 *   Section 4 — Live Oracle Fusion Payload Table
 *              + Oracle Transaction Sync (when Processed)
 *
 * Cleanup rules applied:
 *   - No TDS / withholding tax fields anywhere
 *   - sum(ReferenceAmounts) verified == credit_amount before display
 *   - "Approve & Post" updates oracle_ref_no / oracle_status_code / standard_receipt_id
 *
 * Navigation:
 *   - Arrives via /analysis-history/row/[id]?run_id=<run_id>, set by the
 *     Analysis History page when a row is opened.
 *   - "Back" returns to /analysis-history?run_id=<run_id> so the parent
 *     page can restore the same run's detail view (instead of router.back()
 *     dropping the user two steps back to the bare history list).
 */
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight,
  Clock, FileText, Loader2, Mail, X, ZapIcon,
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { approveEntry, rejectEntry, getRowDetail } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConfirmedInvoice {
  invoice_number:    string;
  customer_name:     string | null;
  outstanding_amount: number | null;
  currency:          string | null;
  ou_number:         string | null;
  invoice_date:      string | null;
  remittance_amount: number | null;
  computed_amount:   number | null;
}

interface PipelineNode {
  key:    string;
  label:  string;
  status: "passed" | "failed" | "skipped" | "pending";
  detail: string;
}

interface OracleRef {
  ReceiptMatchBy:  string;
  ReferenceNumber: string;
  ReferenceAmount: number;
}

interface RowDetail {
  id:     number;
  status: string;
  bank_statement: {
    bank_name:           string;
    statement_date:      string;
    narrative:           string;
    bank_account_number: string;
    bank_reference:      string;
    credit_amount:       number;
    currency:            string;
    business_unit:       string;
    ou_number:           string;
  };
  extraction: {
    method:              string;
    confidence_score:    number;
    extracted_customer:  string;
    primary_invoice:     string;
    all_invoice_numbers: string[];
    row_type:            string;
    is_matched:          boolean;
  };
  confirmed_invoices: ConfirmedInvoice[];
  sum_outstanding:    number;
  credit_amount:      number;
  pipeline:           PipelineNode[];
  oracle: {
    payload:             Record<string, any>;
    remittance_scenario: string | null;
    remittance_status:   string | null;
    remittance_ref:      string | null;
    remittance_filename: string | null;
    hitl_status:         string;
    post_status:         string | null;
    post_message:        string | null;
    oracle_ref_no:       string | null;
    oracle_status_code:  string | null;
    standard_receipt_id: string | null;
    oracle_posted_at:    string | null;
  };
  remittance: any | null;
  // legacy compat
  hitl: {
    status:             string;
    oracle_ref:         string | null;
    oracle_status_code: string | null;
    standard_receipt_id:string | null;
    oracle_post_status: string | null;
  };
  validation: {
    status:      string;
    failed_rules: string[];
    checks:      any[];
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, dp = 2) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono = false, highlight = false }: {
  label: string; value: any; mono?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0 w-44">{label}</span>
      <span className={`text-[11px] font-bold text-right break-all ${mono ? "font-mono" : ""} ${highlight ? "text-[#1E3A5F] text-[13px]" : "text-gray-800"}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h3 className="text-[10px] font-black text-[#1E3A5F] uppercase tracking-widest">{title}</h3>
      {badge && (
        <span className="text-[9px] font-black uppercase tracking-wider bg-[#1E3A5F]/10 text-[#1E3A5F] px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Pipeline Flowchart ────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  passed:  "bg-emerald-500",
  failed:  "bg-red-500",
  skipped: "bg-gray-300",
  pending: "bg-amber-400",
};
const NODE_TEXT: Record<string, string> = {
  passed:  "text-emerald-700 bg-emerald-50 border-emerald-200",
  failed:  "text-red-700 bg-red-50 border-red-200",
  skipped: "text-gray-400 bg-gray-50 border-gray-200",
  pending: "text-amber-700 bg-amber-50 border-amber-200",
};
const NODE_ICON: Record<string, React.ReactNode> = {
  passed:  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />,
  failed:  <AlertTriangle size={13} className="text-red-500 shrink-0" />,
  skipped: <X size={13} className="text-gray-300 shrink-0" />,
  pending: <Clock size={13} className="text-amber-500 shrink-0" />,
};

function PipelineChart({ nodes }: { nodes: PipelineNode[] }) {
  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-2">
      {nodes.map((node, i) => (
        <div key={node.key} className="flex items-start gap-0 shrink-0">
          {/* Node */}
          <div className={`flex flex-col items-center min-w-[140px] max-w-[155px]`}>
            {/* Dot + status bar */}
            <div className="flex flex-col items-center w-full mb-2">
              <div className={`w-4 h-4 rounded-full ${NODE_COLORS[node.status]} shadow-sm mb-1`} />
              <div className={`w-full h-1 ${NODE_COLORS[node.status]} opacity-30 rounded-full`} />
            </div>
            {/* Card */}
            <div className={`w-full border rounded-sm px-3 py-2.5 ${NODE_TEXT[node.status]}`}>
              <div className="flex items-center gap-1.5 mb-1">
                {NODE_ICON[node.status]}
                <span className="text-[9px] font-black uppercase tracking-wider leading-tight">{node.label}</span>
              </div>
              <p className="text-[9px] leading-relaxed font-medium opacity-80">{node.detail}</p>
            </div>
          </div>
          {/* Arrow between nodes */}
          {i < nodes.length - 1 && (
            <div className="flex items-center pt-2 px-1.5 shrink-0">
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Oracle Payload Table ──────────────────────────────────────────────────────

function OraclePayloadTable({ payload, creditAmount }: { payload: Record<string, any>; creditAmount: number }) {
  const refs: OracleRef[] = payload.remittanceReferences || [];
  const sumRefs = refs.reduce((s, r) => s + Number(r.ReferenceAmount || 0), 0);
  const sumOk   = Math.abs(sumRefs - creditAmount) < 0.02;

  const topFields = Object.entries(payload).filter(([k]) => k !== "remittanceReferences");

  return (
    <div className="space-y-4">
      {/* Top-level fields */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {topFields.map(([k, v]) => (
          <div key={k} className="bg-gray-50 border border-gray-200 rounded-sm px-3 py-2">
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{k}</div>
            <div className="text-[11px] font-mono font-bold text-[#1E3A5F] break-all">
              {v == null ? "—" : String(v)}
            </div>
          </div>
        ))}
      </div>

      {/* remittanceReferences table */}
      {refs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
              remittanceReferences — {refs.length} invoice{refs.length !== 1 ? "s" : ""}
            </span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
              sumOk
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}>
              Σ {fmt(sumRefs)} {sumOk ? "✓ matches credit" : "✗ mismatch!"}
            </span>
          </div>
          <div className="border border-gray-200 rounded-sm overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-[#1E3A5F] text-white">
                  <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-wider">Invoice #</th>
                  <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-wider">Match By</th>
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-wider">Reference Amount</th>
                  <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-wider">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {refs.map((ref, i) => (
                  <tr key={i} className="hover:bg-blue-50/30">
                    <td className="px-3 py-2 font-mono font-bold text-[#1E3A5F]">{ref.ReferenceNumber}</td>
                    <td className="px-3 py-2 text-gray-500">{ref.ReceiptMatchBy}</td>
                    <td className="px-3 py-2 font-mono font-bold text-right text-[#1E3A5F]">
                      {fmt(Number(ref.ReferenceAmount))}
                    </td>
                    <td className="px-3 py-2 font-mono text-right text-gray-500">
                      {creditAmount > 0 ? `${((Number(ref.ReferenceAmount) / creditAmount) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-[9px] font-black text-gray-500 uppercase tracking-wider">
                    Total
                  </td>
                  <td className={`px-3 py-2 font-mono font-black text-right ${sumOk ? "text-emerald-700" : "text-red-600"}`}>
                    {fmt(sumRefs)}
                  </td>
                  <td className="px-3 py-2 font-mono text-right text-gray-500">
                    {creditAmount > 0 ? `${((sumRefs / creditAmount) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RowDetailPage() {
  const params   = useParams();
  const router   = useRouter();
  const searchParams = useSearchParams();
  const recordId = Number(params?.id);
  const runIdParam = searchParams.get("run_id");

  const [detail, setDetail]               = useState<RowDetail | null>(null);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]     = useState("");
  const [rightTab, setRightTab]           = useState<"parsed" | "raw">("parsed");

  const fetchDetail = useCallback(async () => {
    if (!recordId) return;
    setLoading(true);
    try {
      const res = await getRowDetail(recordId);
      setDetail(res.data);
    } catch {
      setDetail(null);
    }
    setLoading(false);
  }, [recordId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // Return to the run detail view we came from (Analysis History → run),
  // not just two steps back in browser history.
  const goBack = () => {
    if (runIdParam) {
      router.push(`/analysis-history?run_id=${runIdParam}`);
    } else {
      router.back();
    }
  };

  const handleApprove = async () => {
    if (!detail) return;
    setActionLoading(true); setActionError("");
    try {
      await approveEntry(detail.id);
      await fetchDetail();
    } catch (e: any) {
      setActionError(e?.response?.data?.detail || "Approve failed.");
    }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!detail) return;
    setActionLoading(true); setActionError("");
    try {
      await rejectEntry(detail.id);
      await fetchDetail();
    } catch (e: any) {
      setActionError(e?.response?.data?.detail || "Reject failed.");
    }
    setActionLoading(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 size={24} className="text-gray-400 animate-spin mr-3" />
      <span className="text-sm text-gray-500 font-medium">Loading detail…</span>
    </div>
  );

  if (!detail) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
      <AlertTriangle size={32} className="text-red-400" />
      <p className="text-sm text-gray-600 font-medium">Record not found.</p>
      <button onClick={goBack} className="flex items-center gap-2 text-xs font-bold text-[#1E3A5F] cursor-pointer">
        <ArrowLeft size={14} /> Back
      </button>
    </div>
  );

  const { bank_statement: bs, extraction: ex, confirmed_invoices, sum_outstanding,
          credit_amount, pipeline, oracle, remittance, hitl, validation } = detail;

  const isProcessed = oracle.hitl_status === "approved" && oracle.post_status === "success";
  const isReview    = hitl.status === "pending" && validation.status === "passed";
  const isRejected  = hitl.status === "rejected";

  const statusBadge =
    isProcessed  ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
    isRejected   ? "bg-red-100 text-red-700 border-red-300" :
    isReview     ? "bg-amber-100 text-amber-700 border-amber-300" :
                   "bg-gray-100 text-gray-600 border-gray-300";

  const payloadRefs: OracleRef[] = oracle.payload?.remittanceReferences || [];
  const sumRefs = payloadRefs.reduce((s, r) => s + Number(r.ReferenceAmount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="bg-[#1E3A5F] text-white px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-md">
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={goBack}
            className="flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded-sm cursor-pointer shrink-0">
            <ArrowLeft size={16} /><span className="text-[11px] font-bold uppercase tracking-wider">Back</span>
          </button>
          <div className="w-px h-6 bg-white/20 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-black uppercase tracking-wider">ID {recordId}</h1>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-sm border ${statusBadge}`}>
                {detail.status}
              </span>
              {ex.row_type === "MULTI" && (
                <span className="text-[9px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-sm">
                  Multi-Invoice
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-300 font-mono mt-0.5 truncate max-w-2xl">{bs.narrative}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isReview && (
            <>
              <button disabled={actionLoading} onClick={handleApprove}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-sm cursor-pointer disabled:opacity-50 transition-colors">
                <CheckCircle2 size={12} /> Approve & Post
              </button>
              <button disabled={actionLoading} onClick={handleReject}
                className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-sm cursor-pointer disabled:opacity-50 transition-colors">
                <X size={12} /> Reject
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center gap-2 text-xs font-bold text-red-700">
          <AlertTriangle size={13} /> {actionError}
          <button onClick={() => setActionError("")} className="ml-auto cursor-pointer"><X size={12} /></button>
        </div>
      )}

      {/* ── Body grid ───────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-0 divide-x divide-gray-200 overflow-hidden"
           style={{ minHeight: "calc(100vh - 72px)" }}>

        {/* ════════════════════════════════════════════════════════════════
            LEFT COLUMN — Sections 1, 2, 3, 4
        ════════════════════════════════════════════════════════════════ */}
        <div className="xl:col-span-2 overflow-y-auto p-6 space-y-7 bg-white">

          {/* ── Processed banner ────────────────────────────────────────── */}
          {isProcessed && (
            <div className="bg-emerald-600 text-white rounded-sm px-5 py-4">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 size={20} className="shrink-0" />
                <div>
                  <div className="text-sm font-black uppercase tracking-wider">Record Processed</div>
                  <div className="text-[10px] text-emerald-100 mt-0.5">Posted to Oracle Fusion AR</div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-emerald-700/40 rounded-xs p-3">
                {[
                  ["Receipt Number",      oracle.oracle_ref_no],
                  ["Standard Receipt ID", oracle.standard_receipt_id],
                  ["Oracle Status Code",  oracle.oracle_status_code],
                  ["Posted At",           oracle.oracle_posted_at],
                  ["Amount Posted",       `${fmt(credit_amount)} ${bs.currency}`],
                  ["Business Unit",       bs.business_unit],
                ].map(([label, val]) => val && (
                  <div key={label as string}>
                    <div className="text-[9px] text-emerald-200 uppercase font-bold">{label}</div>
                    <div className="text-[11px] font-mono font-black text-white mt-0.5 break-all">{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Oracle failed banner ─────────────────────────────────────── */}
          {hitl.status === "approved" && hitl.oracle_post_status === "failed" && (
            <div className="bg-red-600 text-white rounded-sm px-5 py-3 flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-black uppercase tracking-wider">Oracle Post Failed</div>
                {detail.oracle.post_message && (
                  <div className="text-[10px] font-mono bg-red-700/40 rounded-xs p-2 mt-2 break-all">{detail.oracle.post_message}</div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              SECTION 1 — Source Data Audit
          ══════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader title="Section 1 — Source Data Audit" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* 1a Bank Statement */}
              <div className="border border-gray-200 rounded-sm overflow-hidden">
                <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
                  <FileText size={12} className="text-[#2E6DA4]" />
                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider">Bank Statement Data</span>
                </div>
                <div className="px-4 py-1">
                  <InfoRow label="Bank"           value={bs.bank_name} />
                  <InfoRow label="Value Date"     value={bs.statement_date} mono />
                  <InfoRow label="Account No."    value={bs.bank_account_number} mono />
                  <InfoRow label="Transaction Ref" value={bs.bank_reference || "—"} mono />
                  <InfoRow label="Business Unit"  value={`${bs.business_unit} [${bs.ou_number}]`} />
                  <InfoRow label="Credited Amount"
                    value={`${fmt(bs.credit_amount)} ${bs.currency}`}
                    mono highlight />
                  <InfoRow label="Description"    value={bs.narrative} />
                </div>
              </div>

              {/* 1b Text Extraction */}
              <div className="border border-gray-200 rounded-sm overflow-hidden">
                <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
                  <ZapIcon size={12} className="text-[#2E6DA4]" />
                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider">Text Extraction Output</span>
                </div>
                <div className="px-4 py-1">
                  <InfoRow label="Method"          value={ex.method} />
                  <InfoRow label="Confidence"       value={ex.confidence_score ? `${(ex.confidence_score * 100).toFixed(0)}%` : "—"} />
                  <InfoRow label="Extracted Customer" value={ex.extracted_customer || "—"} />
                  <InfoRow label="Primary Invoice"  value={ex.primary_invoice || "—"} mono />
                  <InfoRow label="All Invoices"     value={(ex.all_invoice_numbers || []).join(", ")} mono />
                  <InfoRow label="Row Type"         value={ex.row_type} />
                  <InfoRow label="Match Result"
                    value={ex.is_matched ? "✓ Matched in Ageing" : "✗ Not Matched"}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════
              SECTION 2 — Final Confirmed Invoice List
          ══════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader
              title="Section 2 — Final Confirmed Invoice List"
              badge={`${confirmed_invoices.length} invoice${confirmed_invoices.length !== 1 ? "s" : ""} → Oracle`}
            />
            {confirmed_invoices.length === 0 ? (
              <div className="border border-gray-200 rounded-sm px-4 py-8 text-center text-xs text-gray-400">
                No confirmed invoices — record is Not Matched.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-sm overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-[#1E3A5F] text-white">
                      {["Invoice #", "Customer", "Invoice Date", "Outstanding (Ageing)", "Currency", "OU", "Reference Amount"].map(h => (
                        <th key={h} className={`px-3 py-2.5 text-[9px] font-black uppercase tracking-wider ${h === "Outstanding (Ageing)" || h === "Reference Amount" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {confirmed_invoices.map((inv, i) => {
                      const refAmt = inv.remittance_amount ?? inv.computed_amount;
                      return (
                        <tr key={i} className="hover:bg-emerald-50/30 group">
                          <td className="px-3 py-2.5 font-mono font-bold text-[#1E3A5F]">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                              {inv.invoice_number}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 max-w-[180px] truncate">{inv.customer_name || "—"}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-500">{inv.invoice_date || "—"}</td>
                          <td className="px-3 py-2.5 font-mono font-bold text-right text-[#1E3A5F]">
                            {fmt(inv.outstanding_amount)}
                          </td>
                          <td className="px-3 py-2.5 text-gray-400">{inv.currency || "—"}</td>
                          <td className="px-3 py-2.5 text-gray-400">{inv.ou_number || "—"}</td>
                          <td className="px-3 py-2.5 font-mono font-bold text-right text-emerald-700">
                            {fmt(refAmt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {confirmed_invoices.length > 1 && (
                    <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-[9px] font-black text-gray-500 uppercase tracking-wider">
                          Totals
                        </td>
                        <td className="px-3 py-2 font-mono font-black text-right text-[#1E3A5F]">
                          {fmt(sum_outstanding)}
                        </td>
                        <td colSpan={1} />
                        <td />
                        <td className={`px-3 py-2 font-mono font-black text-right ${Math.abs(sumRefs - credit_amount) < 0.02 ? "text-emerald-700" : "text-red-600"}`}>
                          {fmt(sumRefs)}
                          {Math.abs(sumRefs - credit_amount) >= 0.02 && <span className="ml-1 text-[9px]">⚠ mismatch</span>}
                        </td>
                      </tr>
                      <tr className="bg-blue-50/40">
                        <td colSpan={3} className="px-3 py-1.5 text-[9px] font-black text-[#1E3A5F] uppercase tracking-wider">
                          Bank Credit Amount
                        </td>
                        <td colSpan={4} className="px-3 py-1.5 font-mono font-black text-right text-[#1E3A5F]">
                          {fmt(credit_amount)} {bs.currency}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </section>

          {/* ══════════════════════════════════════════════════════
              SECTION 3 — Processing Pipeline
          ══════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader title="Section 3 — Processing Pipeline" />
            <div className="border border-gray-200 rounded-sm p-4 bg-gray-50/30">
              <PipelineChart nodes={pipeline} />
              {/* Validation rule summary below pipeline */}
              {validation.failed_rules.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {validation.failed_rules.map(rule => (
                    <span key={rule} className="text-[9px] font-black bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-xs uppercase tracking-wider">
                      {rule} Failed
                    </span>
                  ))}
                </div>
              )}
              {validation.checks.length > 0 && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {validation.checks.map((check: any) => (
                    <div key={check.rule}
                      className={`flex items-start gap-2 px-3 py-2 rounded-sm border text-[10px] ${
                        check.status === "passed" ? "bg-emerald-50 border-emerald-200" :
                        check.status === "failed" ? "bg-red-50 border-red-200" :
                        "bg-gray-50 border-gray-200"
                      }`}>
                      {check.status === "passed"
                        ? <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                        : check.status === "failed"
                        ? <AlertTriangle size={12} className="text-red-500 shrink-0 mt-0.5" />
                        : <X size={12} className="text-gray-300 shrink-0 mt-0.5" />}
                      <div>
                        <span className="font-black text-gray-500 uppercase tracking-wider text-[9px]">{check.rule}</span>
                        <span className="mx-1 text-gray-400">—</span>
                        <span className={check.status === "passed" ? "text-emerald-700 font-bold" : check.status === "failed" ? "text-red-700 font-bold" : "text-gray-400"}>{check.note}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════
              SECTION 4 — Oracle Fusion Payload
          ══════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader title="Section 4 — Oracle Fusion Payload" badge={oracle.remittance_scenario ? `Scenario ${oracle.remittance_scenario}` : undefined} />

            {Object.keys(oracle.payload).length === 0 ? (
              <div className="border border-gray-200 rounded-sm px-4 py-8 text-center text-xs text-gray-400">
                Payload not generated — validation must pass first.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-sm p-4">
                <OraclePayloadTable payload={oracle.payload} creditAmount={credit_amount} />
              </div>
            )}

            {/* Oracle Transaction Sync — when Processed */}
            {isProcessed && (
              <div className="mt-4 border border-emerald-200 bg-emerald-50 rounded-sm p-4">
                <div className="text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckCircle2 size={13} /> Oracle Transaction Sync
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    ["oracle_ref_no",       oracle.oracle_ref_no],
                    ["oracle_status_code",  oracle.oracle_status_code],
                    ["standard_receipt_id", oracle.standard_receipt_id],
                  ].map(([label, val]) => (
                    <div key={label as string} className="bg-white border border-emerald-200 rounded-xs px-3 py-2">
                      <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider mb-0.5">{label}</div>
                      <div className="text-[12px] font-mono font-black text-emerald-800 break-all">{val || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT COLUMN — Remittance Email
        ════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col overflow-hidden bg-white">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <Mail size={14} className="text-[#2E6DA4]" />
            <span className="text-[10px] font-black text-[#1E3A5F] uppercase tracking-wider flex-1">
              Remittance Email
            </span>
            {remittance && (
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-sm p-0.5">
                {(["parsed", "raw"] as const).map(tab => (
                  <button key={tab} onClick={() => setRightTab(tab)}
                    className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-xs transition-all cursor-pointer ${
                      rightTab === tab ? "bg-[#1E3A5F] text-white" : "text-gray-500 hover:text-[#1E3A5F]"
                    }`}>
                    {tab}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!remittance ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
              <Mail size={48} className="text-gray-200 mb-4" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-wider">No Remittance Email</p>
              <p className="text-[11px] text-gray-400 mt-2 max-w-xs leading-relaxed">
                {oracle.remittance_status === "no_remittance"
                  ? "No matching remittance email found for this payment."
                  : oracle.remittance_status === "not_checked"
                  ? "Remittance check skipped — invoice not matched."
                  : `Status: ${oracle.remittance_status || "unknown"}`}
              </p>
              {ex.all_invoice_numbers.length > 0 && (
                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-sm px-4 py-3 text-[10px] text-left w-full max-w-xs">
                  <p className="font-bold text-gray-500 uppercase tracking-wider mb-1">Searched for</p>
                  {ex.all_invoice_numbers.map(inv => (
                    <p key={inv} className="font-mono text-gray-600">{inv}</p>
                  ))}
                </div>
              )}
            </div>
          ) : rightTab === "parsed" ? (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Header fields */}
              <div className="bg-blue-50 border border-blue-100 rounded-sm px-4 py-1">
                <InfoRow label="File"          value={remittance.filename} mono />
                <InfoRow label="From"          value={remittance.sender} />
                <InfoRow label="Subject"       value={remittance.subject} />
                <InfoRow label="Customer"      value={remittance.customer_name} />
                <InfoRow label="Payment Date"  value={remittance.payment_date} mono />
                <InfoRow label="Reference"     value={remittance.payment_reference} mono />
                <InfoRow label="Amount"        value={`${fmt(remittance.payment_amount)} ${remittance.payment_currency}`} mono />
              </div>

              {/* Invoice list from remittance */}
              {(remittance.invoices || []).length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-2">
                    Invoices in Email — {remittance.invoices.length}
                  </p>
                  <div className="border border-gray-200 rounded-sm overflow-hidden">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="bg-[#1E3A5F] text-white">
                          {["Invoice #", "Doc Amount", "Amount Paid"].map(h => (
                            <th key={h} className={`px-3 py-2 text-[9px] font-black uppercase tracking-wider ${h === "Invoice #" ? "text-left" : "text-right"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {remittance.invoices.map((inv: any, i: number) => {
                          const isThis = ex.all_invoice_numbers.includes(inv.invoice_number);
                          return (
                            <tr key={i} className={isThis ? "bg-blue-50/70" : "hover:bg-gray-50"}>
                              <td className="px-3 py-2 font-mono font-bold text-[#1E3A5F]">
                                {inv.invoice_number}
                                {isThis && <span className="ml-1 text-[8px] bg-blue-100 text-blue-700 font-black px-1 py-0.5 rounded-xs">THIS ROW</span>}
                              </td>
                              <td className="px-3 py-2 font-mono text-right text-gray-500">
                                {inv.doc_amount != null ? fmt(inv.doc_amount) : "—"}
                              </td>
                              <td className="px-3 py-2 font-mono text-right text-emerald-700">
                                {inv.amount_paid != null ? fmt(inv.amount_paid) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="text-[10px] font-mono text-gray-600 leading-relaxed whitespace-pre-wrap break-words bg-gray-50 border border-gray-200 rounded-sm p-4 min-h-full">
                {remittance.raw_body || "No body content."}
              </pre>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}