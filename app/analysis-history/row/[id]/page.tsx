"use client";
/**
 * /app/analysis-history/row/[id]/page.tsx
 *
 * Full-page detail view for one matched_results row.
 * LEFT  — Bank info, AI extraction, aging match, validation rule checks
 * RIGHT — Remittance email (parsed view + raw body toggle)
 */

import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	FileText,
	Mail,
	MinusCircle,
	RefreshCw,
	ShieldCheck,
	X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { approveEntry, rejectEntry, getRowDetail } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Check {
	rule:   string;
	label:  string;
	status: "passed" | "failed" | "skipped";
	left:   { label: string; value: string | null };
	right:  { label: string; value: string | null };
	extra?: Record<string, any>;
	note:   string;
}

interface RemittanceInvoice {
	invoice_number: string;
	doc_amount:     number | null;
	tds_withheld:   number | null;
	amount_paid:    number | null;
	tds_deducted:   number | null;
}

interface Remittance {
	filename:         string;
	sender:           string;
	subject:          string;
	customer_name:    string;
	payment_amount:   number;
	payment_currency: string;
	payment_date:     string;
	payment_reference:string;
	invoices:         RemittanceInvoice[];
	raw_body:         string;
}

interface RowDetail {
	id: number;
	bank_info: {
		bank_name: string; statement_date: string; narrative: string;
		bank_account_number: string; bank_reference: string;
		credit_amount: number; currency: string;
	};
	extraction: {
		method: string; confidence_score: number;
		extracted_customer: string; extracted_invoice: string;
		all_invoice_numbers: string[]; row_type: string;
	};
	aging_match: {
		matched_customer: string; matched_invoice: string;
		customer_account: string; outstanding_amount: number;
		invoice_currency: string; business_unit: string;
		ou_number: string; aging_ou_number: string;
		matched_invoices: any[];
	};
	validation: {
		status: string; failed_rules: string[];
		result_group: string; checks: Check[];
	};
	remittance: Remittance | null;
	hitl: {
		status: string; oracle_ref: string | null;
		oracle_posted_at: string | null;
		remittance_status: string | null;
		remittance_ref: string | null;
		remittance_filename: string | null;
	};
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono = false }: { label: string; value: any; mono?: boolean }) {
	return (
		<div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
			<span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0 w-40">{label}</span>
			<span className={`text-[11px] font-bold text-primary text-right break-all ${mono ? "font-mono" : ""}`}>
				{value ?? "—"}
			</span>
		</div>
	);
}

function RuleCard({ check, allInvoiceNumbers }: { check: Check; allInvoiceNumbers: string[] }) {
	const statusColor =
		check.status === "passed"  ? "border-emerald-200 bg-emerald-50/60" :
		check.status === "failed"  ? "border-red-200 bg-red-50/60" :
		                              "border-gray-200 bg-gray-50";
	const icon =
		check.status === "passed"  ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" /> :
		check.status === "failed"  ? <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" /> :
		                              <MinusCircle size={15} className="text-gray-300 shrink-0 mt-0.5" />;
	const noteColor =
		check.status === "passed"  ? "text-emerald-700" :
		check.status === "failed"  ? "text-red-600" : "text-gray-400";

	return (
		<div className={`border rounded-sm p-4 ${statusColor}`}>
			<div className="flex items-start gap-3">
				{icon}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-2">
						<span className="text-[10px] font-black text-gray-400 uppercase tracking-wider bg-white/70 px-1.5 py-0.5 rounded-xs border border-gray-200">{check.rule}</span>
						<span className="text-[12px] font-bold text-primary">{check.label}</span>
					</div>

					<div className="grid grid-cols-2 gap-3 mb-2">
						<div className="bg-white/60 rounded-xs p-2 border border-white/80">
							<span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">{check.left.label}</span>
							<span className="text-[11px] font-mono font-bold text-primary break-all">{check.left.value || "—"}</span>
						</div>
						<div className="bg-white/60 rounded-xs p-2 border border-white/80">
							<span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">{check.right.label}</span>
							<span className="text-[11px] font-mono font-bold text-primary break-all">{check.right.value || "—"}</span>
						</div>
					</div>

					{/* VAL-003 extra detail */}
					{check.extra && check.rule === "VAL-003" && (
						<div className="flex flex-wrap gap-3 mb-2 bg-white/50 rounded-xs p-2 border border-white/80">
							{check.extra.diff_pct != null && (
								<div className="text-center">
									<div className="text-[9px] text-gray-400 uppercase tracking-wider">Diff</div>
									<div className={`text-[13px] font-black ${check.status === "failed" ? "text-red-600" : "text-emerald-700"}`}>{check.extra.diff_pct}%</div>
								</div>
							)}
							{check.extra.tds_pct_computed != null && (
								<div className="text-center">
									<div className="text-[9px] text-gray-400 uppercase tracking-wider">TDS%</div>
									<div className={`text-[13px] font-black ${check.extra.tds_pct_computed >= 88 && check.extra.tds_pct_computed <= 92 ? "text-emerald-700" : "text-red-600"}`}>
										{Number(check.extra.tds_pct_computed).toFixed(2)}%
									</div>
									<div className="text-[9px] text-gray-400">valid 88–92%</div>
								</div>
							)}
							<div className="text-center">
								<div className="text-[9px] text-gray-400 uppercase tracking-wider">Remittance</div>
								<div className={`text-[11px] font-bold ${check.extra.remittance_status === "matched" ? "text-emerald-700" : "text-amber-600"}`}>
									{check.extra.remittance_status || "not checked"}
								</div>
							</div>
							{check.extra.confirmed_count != null && (
								<div className="text-center">
									<div className="text-[9px] text-gray-400 uppercase tracking-wider">Confirmed invoices</div>
									<div className="text-[13px] font-black text-emerald-700">{check.extra.confirmed_count}</div>
								</div>
							)}
							{check.extra.missing_count > 0 && (
								<div className="text-center">
									<div className="text-[9px] text-gray-400 uppercase tracking-wider">Missing</div>
									<div className="text-[13px] font-black text-red-600">{check.extra.missing_count}</div>
								</div>
							)}
						</div>
					)}

					{/* VAL-006 invoice lists */}
					{check.rule === "VAL-006" && check.extra?.confirmed_invoices?.length > 0 && (
						<div className="flex flex-wrap gap-1 mb-2">
							{check.extra.confirmed_invoices.map((inv: string) => (
								<span key={inv} className="text-[9px] font-mono bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-xs">{inv}</span>
							))}
						</div>
					)}
					{check.rule === "VAL-006" && check.extra?.missing_invoices?.length > 0 && (
						<div className="flex flex-wrap gap-1 mb-2">
							{check.extra.missing_invoices.map((inv: string) => (
								<span key={inv} className="text-[9px] font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded-xs">{inv} ✗</span>
							))}
						</div>
					)}

					<p className={`text-[11px] font-medium ${noteColor}`}>{check.note}</p>
				</div>
			</div>
		</div>
	);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RowDetailPage() {
	const params   = useParams();
	const router   = useRouter();
	const recordId = Number(params?.id);

	const [detail, setDetail]           = useState<RowDetail | null>(null);
	const [loading, setLoading]         = useState(true);
	const [actionLoading, setActionLoading] = useState(false);
	const [rightTab, setRightTab]       = useState<"parsed" | "raw">("parsed");
	const [error, setError]             = useState("");

	const fetchDetail = useCallback(async () => {
		if (!recordId) return;
		setLoading(true);
		setError("");
		try {
			const res = await getRowDetail(recordId);
			setDetail(res.data);
		} catch {
			setError("Could not load row detail. The record may no longer exist.");
		}
		setLoading(false);
	}, [recordId]);

	useEffect(() => { fetchDetail(); }, [fetchDetail]);

	const handleApprove = async () => {
		if (!detail) return;
		setActionLoading(true);
		try { await approveEntry(detail.id); await fetchDetail(); } catch {}
		setActionLoading(false);
	};

	const handleReject = async () => {
		if (!detail) return;
		setActionLoading(true);
		try { await rejectEntry(detail.id); await fetchDetail(); } catch {}
		setActionLoading(false);
	};

	const canApprove = detail?.hitl.status !== "approved" && detail?.validation.status === "passed";
	const canReject  = detail?.hitl.status !== "rejected";

	const hitlStatusColor =
		detail?.hitl.status === "approved" ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
		detail?.hitl.status === "rejected" ? "bg-red-100 text-red-700 border-red-300" :
		                                      "bg-amber-100 text-amber-700 border-amber-300";

	// ── Loading / error states ─────────────────────────────────────────────────
	if (loading) return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50">
			<RefreshCw size={24} className="text-gray-400 animate-spin mr-3" />
			<span className="text-sm text-gray-500 font-medium">Loading row detail…</span>
		</div>
	);

	if (error || !detail) return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
			<AlertTriangle size={32} className="text-red-400" />
			<p className="text-sm text-gray-600 font-medium">{error || "Record not found."}</p>
			<button onClick={() => router.back()}
				className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1E3A5F] hover:text-[#2E6DA4] cursor-pointer">
				<ArrowLeft size={14} /> Back
			</button>
		</div>
	);

	// ── Enrich VAL-006 check with full invoice lists ───────────────────────────
	const enrichedChecks = detail.validation.checks.map((check) => {
		if (check.rule === "VAL-006") {
			return {
				...check,
				left:  { label: "Confirmed in aging", value: String(detail.validation.checks.find(c => c.rule === "VAL-006")?.left.value ?? 0) },
				right: { label: "Missing from aging",  value: String(detail.validation.checks.find(c => c.rule === "VAL-006")?.right.value ?? 0) },
				extra: {
					...check.extra,
					confirmed_invoices: detail.aging_match.matched_invoices?.map((m: any) => m.invoice) || [],
					missing_invoices:   [],
				},
			};
		}
		return check;
	});

	return (
		<div className="min-h-screen bg-gray-50 flex flex-col">

			{/* ── Top nav bar ──────────────────────────────────────────────────── */}
			<div className="bg-[#1E3A5F] text-white px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-md">
				<div className="flex items-center gap-4">
					<button onClick={() => router.back()}
						className="flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded-sm transition-colors cursor-pointer">
						<ArrowLeft size={16} />
						<span className="text-[11px] font-bold uppercase tracking-wider">Back</span>
					</button>
					<div className="w-px h-6 bg-white/20" />
					<div>
						<h1 className="text-sm font-black uppercase tracking-wider">Row Detail — ID {recordId}</h1>
						<p className="text-[10px] text-gray-300 font-mono mt-0.5 max-w-2xl truncate">
							{detail.bank_info.narrative}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-sm border ${hitlStatusColor}`}>
						{detail.hitl.status}
					</span>
					{canApprove && (
						<button disabled={actionLoading} onClick={handleApprove}
							className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-sm transition-colors cursor-pointer disabled:opacity-50">
							<CheckCircle2 size={12} /> Approve & Post to Oracle
						</button>
					)}
					{canReject && (
						<button disabled={actionLoading} onClick={handleReject}
							className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-sm transition-colors cursor-pointer disabled:opacity-50">
							<X size={12} /> Reject
						</button>
					)}
				</div>
			</div>

			{/* ── Body — 2 column split ─────────────────────────────────────────── */}
			<div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-x divide-gray-200 overflow-hidden" style={{ minHeight: "calc(100vh - 72px)" }}>

				{/* ════════════════════════════════════════════════════════════════
				    LEFT — Statement + Extraction + Aging + Validation
				    ════════════════════════════════════════════════════════════════ */}
				<div className="overflow-y-auto p-6 space-y-6 bg-white">

					{/* Bank Statement */}
					<section>
						<h3 className="text-[10px] font-black text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
							<FileText size={13} className="text-[#2E6DA4]" /> Bank Statement
						</h3>
						<div className="bg-gray-50 border border-gray-200 rounded-sm px-4 py-1">
							<InfoRow label="Bank"           value={detail.bank_info.bank_name} />
							<InfoRow label="Statement Date" value={detail.bank_info.statement_date} mono />
							<InfoRow label="Account No."    value={detail.bank_info.bank_account_number} mono />
							<InfoRow label="Reference No."  value={detail.bank_info.bank_reference || "—"} mono />
							<InfoRow label="Credit Amount"  value={`${Number(detail.bank_info.credit_amount || 0).toLocaleString(undefined,{minimumFractionDigits:2})} ${detail.bank_info.currency}`} mono />
							<InfoRow label="Currency"       value={detail.bank_info.currency} />
							<InfoRow label="Narrative"      value={detail.bank_info.narrative} />
						</div>
					</section>

					{/* AI Extraction */}
					<section>
						<h3 className="text-[10px] font-black text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
							<ShieldCheck size={13} className="text-[#2E6DA4]" /> AI Extraction
						</h3>
						<div className="bg-gray-50 border border-gray-200 rounded-sm px-4 py-1">
							<InfoRow label="Method"        value={detail.extraction.method} />
							<InfoRow label="Confidence"    value={detail.extraction.confidence_score ? `${(detail.extraction.confidence_score * 100).toFixed(0)}%` : "—"} />
							<InfoRow label="Customer"      value={detail.extraction.extracted_customer} />
							<InfoRow label="Invoice(s)"    value={(detail.extraction.all_invoice_numbers || []).join(", ")} mono />
							<InfoRow label="Row Type"      value={detail.extraction.row_type} />
						</div>
					</section>

					{/* Aging Match */}
					<section>
						<h3 className="text-[10px] font-black text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
							<ShieldCheck size={13} className="text-[#2E6DA4]" /> Aging Match
						</h3>
						<div className="bg-gray-50 border border-gray-200 rounded-sm px-4 py-1">
							<InfoRow label="Customer"      value={detail.aging_match.matched_customer} />
							<InfoRow label="Cust. Account" value={detail.aging_match.customer_account} mono />
							<InfoRow label="Invoice"       value={detail.aging_match.matched_invoice} mono />
							<InfoRow label="Outstanding"   value={detail.aging_match.outstanding_amount != null ? `${Number(detail.aging_match.outstanding_amount).toLocaleString(undefined,{minimumFractionDigits:2})} ${detail.aging_match.invoice_currency}` : "—"} mono />
							<InfoRow label="Business Unit" value={detail.aging_match.business_unit} />
							<InfoRow label="OU / SEGMENT1" value={`${detail.aging_match.ou_number || "—"} → aging: ${detail.aging_match.aging_ou_number || "—"}`} mono />
						</div>

						{detail.aging_match.matched_invoices?.length > 1 && (
							<div className="mt-3 border border-gray-200 rounded-sm overflow-hidden">
								<div className="bg-gray-100 px-3 py-2 text-[9px] font-black text-gray-500 uppercase tracking-wider">
									Multi-invoice breakdown ({detail.aging_match.matched_invoices.length} invoices)
								</div>
								<table className="w-full text-[10px]">
									<thead>
										<tr className="bg-gray-50 border-b border-gray-200">
											{["Invoice","Customer","Outstanding","CCY","OU"].map((h) => (
												<th key={h} className="px-3 py-1.5 text-left text-[9px] font-black text-gray-400 uppercase tracking-wider">{h}</th>
											))}
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100">
										{detail.aging_match.matched_invoices.map((inv: any, i: number) => (
											<tr key={i} className="hover:bg-gray-50">
												<td className="px-3 py-1.5 font-mono font-bold text-primary">{inv.invoice}</td>
												<td className="px-3 py-1.5 text-gray-600 max-w-[160px] truncate">{inv.customer}</td>
												<td className="px-3 py-1.5 font-mono text-right">{Number(inv.outstanding||0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
												<td className="px-3 py-1.5 text-gray-400">{inv.currency}</td>
												<td className="px-3 py-1.5 text-gray-500">{inv.ou_number}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</section>

					{/* Validation Rules */}
					<section>
						<h3 className="text-[10px] font-black text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
							<ShieldCheck size={13} className="text-[#2E6DA4]" />
							Validation Rules
							<span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
								detail.validation.status === "passed"
									? "bg-emerald-50 text-emerald-700 border-emerald-200"
									: "bg-red-50 text-red-700 border-red-200"
							}`}>
								{detail.validation.status.toUpperCase()}
								{detail.validation.failed_rules.length > 0 && ` — failed: ${detail.validation.failed_rules.join(", ")}`}
							</span>
						</h3>
						<div className="space-y-3">
							{enrichedChecks.map((check) => (
								<RuleCard key={check.rule} check={check} allInvoiceNumbers={detail.extraction.all_invoice_numbers || []} />
							))}
						</div>
					</section>

					{/* Oracle posted */}
					{detail.hitl.oracle_ref && (
						<section>
							<h3 className="text-[10px] font-black text-primary uppercase tracking-wider mb-3">Oracle Fusion Receipt</h3>
							<div className="bg-emerald-50 border border-emerald-200 rounded-sm px-4 py-1">
								<InfoRow label="Transaction Ref" value={detail.hitl.oracle_ref} mono />
								<InfoRow label="Posted At"       value={detail.hitl.oracle_posted_at} mono />
							</div>
						</section>
					)}
				</div>

				{/* ════════════════════════════════════════════════════════════════
				    RIGHT — Remittance Email
				    ════════════════════════════════════════════════════════════════ */}
				<div className="flex flex-col overflow-hidden bg-white">
					{/* Right panel header */}
					<div className="flex items-center gap-2 px-6 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
						<Mail size={14} className="text-[#2E6DA4]" />
						<span className="text-[10px] font-black text-primary uppercase tracking-wider flex-1">
							Remittance Email
						</span>

						{detail.remittance && (
							<div className="flex items-center gap-1 bg-white border border-gray-200 rounded-sm p-0.5">
								<button onClick={() => setRightTab("parsed")}
									className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-xs transition-all cursor-pointer ${rightTab === "parsed" ? "bg-[#1E3A5F] text-white" : "text-gray-500 hover:text-primary"}`}>
									Parsed View
								</button>
								<button onClick={() => setRightTab("raw")}
									className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-xs transition-all cursor-pointer ${rightTab === "raw" ? "bg-[#1E3A5F] text-white" : "text-gray-500 hover:text-primary"}`}>
									Raw Body
								</button>
							</div>
						)}
					</div>

					{/* No remittance state */}
					{!detail.remittance ? (
						<div className="flex-1 flex flex-col items-center justify-center text-center p-10">
							<Mail size={48} className="text-gray-200 mb-4" />
							<p className="text-sm font-black text-gray-400 uppercase tracking-wider">No Remittance Email Found</p>
							<p className="text-[11px] text-gray-400 mt-2 max-w-sm leading-relaxed">
								{detail.hitl.remittance_status === "no_remittance"
									? "No matching remittance email was found for this payment during processing. Upload one via the Remittance tab to enable TDS validation."
									: detail.hitl.remittance_status === "not_checked"
									? "Remittance check was skipped because the invoice was not found in the aging report."
									: `Remittance status: ${detail.hitl.remittance_status || "unknown"}`}
							</p>
							<div className="mt-4 text-[10px] text-gray-400">
								<p className="font-bold">Searched by:</p>
								<p className="font-mono mt-1">{(detail.extraction.all_invoice_numbers || []).join(", ") || "—"}</p>
							</div>
						</div>
					) : rightTab === "parsed" ? (
						/* Parsed remittance */
						<div className="flex-1 overflow-y-auto p-6 space-y-5">
							{/* Metadata */}
							<div className="bg-blue-50 border border-blue-100 rounded-sm px-4 py-1">
								<InfoRow label="File"         value={detail.remittance.filename} mono />
								<InfoRow label="From"         value={detail.remittance.sender} />
								<InfoRow label="Subject"      value={detail.remittance.subject} />
								<InfoRow label="Customer"     value={detail.remittance.customer_name} />
								<InfoRow label="Payment Date" value={detail.remittance.payment_date} mono />
								<InfoRow label="Reference"    value={detail.remittance.payment_reference} mono />
								<InfoRow label="Amount"       value={`${Number(detail.remittance.payment_amount||0).toLocaleString(undefined,{minimumFractionDigits:2})} ${detail.remittance.payment_currency}`} mono />
							</div>

							{/* Invoice breakdown table */}
							{detail.remittance.invoices?.length > 0 && (
								<section>
									<h4 className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-2">
										Invoice Breakdown — {detail.remittance.invoices.length} invoice{detail.remittance.invoices.length !== 1 ? "s" : ""}
									</h4>
									<div className="border border-gray-200 rounded-sm overflow-hidden">
										<table className="w-full text-[10px]">
											<thead>
												<tr className="bg-[#1E3A5F] text-white">
													{["Invoice #","Doc Amount","TDS Withheld","Amount Paid","TDS Deducted"].map((h) => (
														<th key={h} className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-wider">{h}</th>
													))}
												</tr>
											</thead>
											<tbody className="divide-y divide-gray-100">
												{detail.remittance.invoices.map((inv, i) => {
													const isThisRow = (detail.extraction.all_invoice_numbers || []).includes(inv.invoice_number);
													return (
														<tr key={i} className={isThisRow ? "bg-blue-50/70" : "hover:bg-gray-50"}>
															<td className="px-3 py-2 font-mono font-bold text-primary">
																{inv.invoice_number}
																{isThisRow && <span className="ml-1.5 text-[8px] bg-blue-100 text-blue-700 font-black px-1 py-0.5 rounded-xs">THIS ROW</span>}
															</td>
															<td className="px-3 py-2 font-mono text-right">{inv.doc_amount != null ? Number(inv.doc_amount).toLocaleString(undefined,{minimumFractionDigits:2}) : "—"}</td>
															<td className="px-3 py-2 font-mono text-right text-amber-700">{inv.tds_withheld != null ? Number(inv.tds_withheld).toLocaleString(undefined,{minimumFractionDigits:2}) : "—"}</td>
															<td className="px-3 py-2 font-mono text-right text-emerald-700">{inv.amount_paid != null ? Number(inv.amount_paid).toLocaleString(undefined,{minimumFractionDigits:2}) : "—"}</td>
															<td className="px-3 py-2 font-mono text-right text-red-600">{inv.tds_deducted != null ? Number(inv.tds_deducted).toLocaleString(undefined,{minimumFractionDigits:2}) : "—"}</td>
														</tr>
													);
												})}
											</tbody>
											<tfoot className="border-t-2 border-gray-300 bg-gray-50">
												<tr>
													<td className="px-3 py-2 text-[9px] font-black text-gray-500 uppercase tracking-wider">Total</td>
													<td className="px-3 py-2 font-mono font-black text-right text-primary">
														{detail.remittance.invoices.reduce((s, i) => s + (i.doc_amount || 0), 0).toLocaleString(undefined,{minimumFractionDigits:2})}
													</td>
													<td className="px-3 py-2 font-mono font-black text-right text-amber-700">
														{detail.remittance.invoices.reduce((s, i) => s + (i.tds_withheld || 0), 0).toLocaleString(undefined,{minimumFractionDigits:2})}
													</td>
													<td className="px-3 py-2 font-mono font-black text-right text-emerald-700">
														{detail.remittance.invoices.reduce((s, i) => s + (i.amount_paid || 0), 0).toLocaleString(undefined,{minimumFractionDigits:2})}
													</td>
													<td className="px-3 py-2 font-mono font-black text-right text-red-600">
														{detail.remittance.invoices.reduce((s, i) => s + (i.tds_deducted || 0), 0).toLocaleString(undefined,{minimumFractionDigits:2})}
													</td>
												</tr>
											</tfoot>
										</table>
									</div>
								</section>
							)}
						</div>
					) : (
						/* Raw email body */
						<div className="flex-1 overflow-y-auto p-6">
							<pre className="text-[10px] font-mono text-gray-600 leading-relaxed whitespace-pre-wrap break-words bg-gray-50 border border-gray-200 rounded-sm p-4 min-h-full">
								{detail.remittance.raw_body || "No body content available."}
							</pre>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}