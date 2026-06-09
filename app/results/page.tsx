"use client";
import axios from "axios";
import {
	Building2,
	CheckCircle2,
	ChevronRight,
	Download,
	Filter,
	MinusCircle,
	Search,
	X,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import { getMatched } from "@/lib/api";

const API = axios.create({ baseURL: "http://localhost:8000" });
const getValidationDetail = (id: number) =>
	API.get(`/api/results/matched/${id}/validation-detail`);

// ── Types ─────────────────────────────────────────────────────────────────────
interface Check {
	rule: string;
	label: string;
	status: "passed" | "failed" | "skipped";
	bank_label: string;
	bank_value: string | null;
	aging_label: string;
	aging_value: string | null;
	note: string;
}
interface ValidationDetail {
	id: number;
	validation_status: string;
	failed_rules: string[];
	bank_name: string;
	statement_date: string;
	narrative: string;
	extraction_method: string;
	confidence_score: number;
	checks: Check[];
}

// Global Color Matrix Configuration
const COLOR_CONFIG = {
	passed: {
		border: "border-[#4A90E2]/30",
		bg: "bg-[#4A90E2]/5",
		text: "text-[#4A90E2]",
	},
	failed: {
		border: "border-[#e11d48]/30",
		bg: "bg-[#e11d48]/5",
		text: "text-[#e11d48]",
	},
	skipped: {
		border: "border-gray-200",
		bg: "bg-gray-50",
		text: "text-gray-400",
	},
};

function CheckIcon({ status }: { status: string }) {
	if (status === "passed")
		return <CheckCircle2 size={14} className="text-[#4A90E2] shrink-0" />;
	if (status === "failed")
		return <XCircle size={14} className="text-[#e11d48] shrink-0" />;
	return <MinusCircle size={14} className="text-gray-300 shrink-0" />;
}

// ── Validation Drawer ─────────────────────────────────────────────────────────
function ValidationDrawer({
	rowId,
	onClose,
}: {
	rowId: number;
	onClose: () => void;
}) {
	const [detail, setDetail] = useState<ValidationDetail | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		getValidationDetail(rowId)
			.then((r) => setDetail(r.data))
			.catch(() => setDetail(null))
			.finally(() => setLoading(false));
	}, [rowId]);

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity"
				onClick={onClose}
			/>

			{/* Drawer */}
			<div className="fixed right-0 top-0 h-full w-[540px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200 animate-slide-in">
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-[#172e4c] bg-[#1E3A5F]">
					<div>
						<p className="text-white font-black text-xs uppercase tracking-wider">
							Validation Audit · ID #{rowId}
						</p>
						{detail && (
							<p className="text-gray-300 text-[11px] mt-0.5">
								{detail.bank_name} · {detail.statement_date} ·{" "}
								<span className="uppercase font-bold text-blue-300">
									{detail.extraction_method}
								</span>{" "}
								{detail.confidence_score
									? `· ${(detail.confidence_score * 100).toFixed(0)}% accuracy`
									: ""}
							</p>
						)}
					</div>
					<button
						onClick={onClose}
						className="text-gray-300 hover:text-white transition-colors"
					>
						<X size={16} />
					</button>
				</div>

				{loading ? (
					<div className="flex-1 flex items-center justify-center text-gray-400 text-xs font-semibold uppercase tracking-wider">
						Loading audit workspace...
					</div>
				) : !detail ? (
					<div className="flex-1 flex items-center justify-center text-[#e11d48] text-xs font-semibold uppercase tracking-wider">
						Failed to fetch validation telemetry records.
					</div>
				) : (
					<div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 bg-gray-50/30">
						{/* Narrative Box */}
						<div className="bg-white border border-gray-200 p-3.5 rounded-sm shadow-2xs">
							<p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1.5">
								Parsed Statement Narrative
							</p>
							<p className="text-xs text-primary font-mono bg-gray-50 p-2 border border-gray-100 break-all leading-relaxed whitespace-pre-wrap">
								{detail.narrative}
							</p>
						</div>

						{/* Failed Rules Alerts */}
						{detail.failed_rules.length > 0 && (
							<div className="bg-[#e11d48]/5 border border-[#e11d48]/20 p-3 rounded-sm flex flex-col gap-2">
								<span className="text-[10px] text-[#e11d48] font-black uppercase tracking-wider">
									Violated Processing Constraints
								</span>
								<div className="flex flex-wrap gap-1.5">
									{detail.failed_rules.map((r) => (
										<span
											key={r}
											className="text-[10px] bg-white text-[#e11d48] border border-[#e11d48]/20 px-2 py-0.5 font-mono font-bold rounded-xs"
										>
											{r}
										</span>
									))}
								</div>
							</div>
						)}

						{/* Dynamic Rule Checks Execution Stack */}
						<div className="space-y-4">
							<h4 className="text-[10px] font-black text-primary uppercase tracking-wider">
								Rule Verification Stack
							</h4>
							{detail.checks.map((check) => {
								const config =
									COLOR_CONFIG[check.status as keyof typeof COLOR_CONFIG] ||
									COLOR_CONFIG.skipped;
								return (
									<div
										key={check.rule}
										className={`bg-white border-l-4 ${config.border} border-y border-r border-gray-200 p-4 rounded-sm shadow-2xs space-y-3`}
									>
										{/* Check Header */}
										<div className="flex items-center gap-2">
											<CheckIcon status={check.status} />
											<span className="text-xs font-mono font-black text-primary tracking-tight">
												{check.rule}
											</span>
											<span className="text-xs font-bold text-gray-600">
												— {check.label}
											</span>
											<span
												className={`ml-auto text-[9px] font-black tracking-widest px-2 py-0.5 rounded-xs ${config.bg} ${config.text}`}
											>
												{check.status.toUpperCase()}
											</span>
										</div>

										{/* Comparative Node Fields */}
										<div className="grid grid-cols-2 gap-3">
											<div className="bg-gray-50 border border-gray-200 p-2.5 rounded-sm">
												<p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">
													{check.bank_label}
												</p>
												<p
													className={`text-xs font-mono break-all font-semibold ${check.bank_value ? "text-primary" : "text-gray-300 italic"}`}
												>
													{check.bank_value ?? "NOT PROVIDED"}
												</p>
											</div>

											<div className="bg-gray-50 border border-gray-200 p-2.5 rounded-sm">
												<p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">
													{check.aging_label}
												</p>
												<p
													className={`text-xs font-mono break-all font-semibold ${check.aging_value ? "text-primary" : "text-gray-300 italic"}`}
												>
													{check.aging_value ?? "NOT PROVIDED"}
												</p>
											</div>
										</div>

										{/* Operational Note */}
										<p
											className={`text-[11px] p-2 rounded-xs font-medium border ${config.bg} ${config.text} ${config.border}`}
										>
											{check.note}
										</p>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</div>
		</>
	);
}

// ── Main Results Page ─────────────────────────────────────────────────────────
export default function ResultsPage() {
	const [data, setData] = useState<any[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [valFilter, setValFilter] = useState("");
	const [hitlFilter, setHitlFilter] = useState("");
	const [methodFilter, setMethodFilter] = useState("");
	const [drawerRowId, setDrawerRowId] = useState<number | null>(null);
	const PAGE_SIZE = 50;

	const fetchData = useCallback(async () => {
		try {
			const res = await getMatched({
				page,
				page_size: PAGE_SIZE,
				...(search && { search }),
				...(valFilter && { validation_status: valFilter }),
				...(hitlFilter && { hitl_status: hitlFilter }),
				...(methodFilter && { extraction_method: methodFilter }),
			});
			setData(res.data.data);
			setTotal(res.data.total);
		} catch {}
	}, [page, search, valFilter, hitlFilter, methodFilter]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const exportCSV = () => {
		if (!data.length) return;
		const headers = Object.keys(data[0]).join(",");
		const rows = data
			.map((r) =>
				Object.values(r)
					.map((v) => `"${v ?? ""}"`)
					.join(","),
			)
			.join("\n");
		const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `ledger_matches_${new Date().toISOString().split("T")[0]}.csv`;
		a.click();
	};

	const totalPages = Math.ceil(total / PAGE_SIZE);

	return (
		<div className="space-y-6">
			{/* HEADER META MATRIX */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
				<div>
					<h1 className="text-base font-black text-primary uppercase tracking-tight">
						Matched Results Matrix
					</h1>
					<p className="text-xs text-gray-500 mt-0.5">
						Automated extraction logs and pipeline validation audits across
						synced accounting cycles.
					</p>
				</div>
				<div className="flex items-center gap-3">
					<div className="text-right hidden sm:block">
						<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
							Total Database Scope
						</span>
						<span className="text-xs font-black text-primary">
							{total.toLocaleString()} Records Loaded
						</span>
					</div>
					<button
						onClick={exportCSV}
						className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-[#1E3A5F] hover:bg-[#2E6DA4] text-white px-4 py-2.5 rounded-sm shadow-xs transition-all"
					>
						<Download size={12} /> Export CSV Ledger
					</button>
				</div>
			</div>

			{/* FILTER CONTROL HUB */}
			<div className="bg-white border border-gray-200 p-4 rounded-sm flex flex-col md:flex-row gap-3 items-center">
				{/* Search Field */}
				<div className="flex items-center gap-2 border border-gray-300 px-3 py-2 text-xs rounded-sm w-full md:flex-1 bg-white focus-within:border-accent transition-colors">
					<Search size={13} className="text-gray-400 shrink-0" />
					<input
						placeholder="Search account naming vectors, tracking tokens, narrations..."
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
						className="outline-none w-full text-xs font-medium text-primary placeholder-gray-400 bg-transparent"
					/>
				</div>

				{/* Dropdowns Filters */}
				<div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
					{[
						{
							label: "Validation Filter",
							value: valFilter,
							setter: setValFilter,
							options: ["passed", "failed"],
						},
						{
							label: "HITL Status Filter",
							value: hitlFilter,
							setter: setHitlFilter,
							options: ["pending", "approved", "rejected"],
						},
						{
							label: "Extraction Vector",
							value: methodFilter,
							setter: setMethodFilter,
							options: ["regex", "token_exact", "token_fuzzy", "token_scan"],
						},
					].map(({ label, value, setter, options }) => (
						<div
							key={label}
							className="relative flex-1 sm:flex-initial min-w-[150px]"
						>
							<select
								value={value}
								onChange={(e) => {
									setter(e.target.value);
									setPage(1);
								}}
								className="w-full bg-white border border-gray-300 text-xs font-bold text-gray-600 px-3 py-2 rounded-sm appearance-none focus:outline-none focus:border-accent cursor-pointer pr-8"
							>
								<option value="">All {label.split(" ")[0]}</option>
								{options.map((o) => (
									<option key={o} value={o} className="capitalize">
										{o.replace("_", " ")}
									</option>
								))}
							</select>
							<Filter
								size={10}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
							/>
						</div>
					))}
				</div>
			</div>

			{/* TABULAR METRIC MATRIX */}
			<div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-xs">
				<div className="overflow-x-auto">
					<table className="w-full text-left border-collapse">
						<thead>
							<tr className="bg-[#1E3A5F] border-b border-[#172e4c] text-white">
								{[
									"ID",
									"Institution Source",
									"Operating Unit",
									"Posting Date",
									"Statement Narrative Summary",
									"Credit Amount",
									"CCY",
									"Extracted Entity",
									"Extracted Invoice",
									"Parsing Path",
									"Conf.",
									"Matched Entity",
									"Matched Ledger Invoice",
									"Outstanding Balance",
									"Validation",
									"HITL State",
									"Oracle Tracker Ref",
								].map((h) => (
									<th
										key={h}
										className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap"
									>
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody className="text-[11px] divide-y divide-gray-200 font-medium text-gray-700">
							{data.length === 0 ? (
								<tr>
									<td
										colSpan={17}
										className="text-center py-12 text-xs text-gray-400 font-semibold uppercase tracking-wider bg-gray-50/30"
									>
										No matching ledger artifacts located. Initiate matching
										engine pipeline run.
									</td>
								</tr>
							) : (
								data.map((r) => (
									<tr
										key={r.id}
										onClick={() => setDrawerRowId(r.id)}
										className={`hover:bg-gray-50/80 cursor-pointer group transition-colors ${
											r.validation_status === "failed" ? "bg-red-50/20" : ""
										}`}
									>
										<td className="px-3 py-3 font-bold font-mono text-primary">
											{r.id}
										</td>
										<td className="px-3 py-3 whitespace-nowrap font-bold text-primary">
											{r.bank_name}
										</td>
										<td className="px-3 py-3处理 whitespace-nowrap">
											{r.business_unit ? (
												<span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-[#1E3A5F] border border-blue-200 rounded-xs px-1.5 py-0.5 font-bold">
													<Building2 size={10} className="text-[#2E6DA4]" />{" "}
													{r.business_unit}
												</span>
											) : (
												<span className="text-gray-300">—</span>
											)}
										</td>
										<td className="px-3 py-3 whitespace-nowrap font-mono">
											{r.statement_date}
										</td>
										<td
											className="px-3 py-3 max-w-xs truncate font-mono text-gray-500 relative pr-6"
											title={r.narrative}
										>
											<span>{r.narrative}</span>
											<ChevronRight
												size={12}
												className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
											/>
										</td>
										<td className="px-3 py-3 text-right font-black font-mono text-primary">
											{(r.credit_amount ?? 0).toLocaleString()}
										</td>
										<td className="px-3 py-3 font-bold text-gray-500">
											{r.statement_currency}
										</td>
										<td className="px-3 py-3 whitespace-nowrap font-bold text-primary">
											{r.extracted_customer_name || (
												<span className="text-gray-300">—</span>
											)}
										</td>
										<td className="px-3 py-3 font-mono font-bold text-gray-600">
											{r.extracted_invoice_number || (
												<span className="text-gray-300">—</span>
											)}
										</td>
										<td className="px-3 py-3 whitespace-nowrap">
											<StatusBadge value={r.extraction_method} />
										</td>
										<td className="px-3 py-3 font-mono font-bold text-primary">
											{r.confidence_score
												? `${(r.confidence_score * 100).toFixed(0)}%`
												: "—"}
										</td>
										<td className="px-3 py-3 whitespace-nowrap text-gray-600">
											{r.matched_customer_name || (
												<span className="text-gray-300">—</span>
											)}
										</td>
										<td className="px-3 py-3 font-mono font-bold text-gray-600">
											{r.matched_invoice_number || (
												<span className="text-gray-300">—</span>
											)}
										</td>
										<td className="px-3 py-3 text-right font-mono text-gray-500">
											{(r.outstanding_amount ?? 0).toLocaleString()}
										</td>
										<td className="px-3 py-3 whitespace-nowrap">
											<StatusBadge value={r.validation_status} />
										</td>
										<td className="px-3 py-3 whitespace-nowrap">
											<StatusBadge value={r.hitl_status} />
										</td>
										<td className="px-3 py-3 font-mono text-[10px] font-black text-emerald-700 whitespace-nowrap">
											{r.oracle_transaction_ref || (
												<span className="text-gray-300 font-normal">—</span>
											)}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* COMPACT INFRASTRUCTURE PAGINATION */}
			{totalPages > 1 && (
				<div className="flex items-center justify-between border-t border-gray-200 pt-4">
					<span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
						Page {page} of {totalPages}{" "}
						<span className="text-gray-300 px-1">|</span> Total Batch Stack
						Size: {total.toLocaleString()} Rows
					</span>
					<div className="flex items-center gap-1.5">
						<button
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={page === 1}
							className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider border border-gray-300 rounded-sm hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
						>
							Previous
						</button>
						<button
							onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							disabled={page === totalPages}
							className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider border border-gray-300 rounded-sm hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
						>
							Next
						</button>
					</div>
				</div>
			)}

			{/* Validation Detail Sliding Drawer */}
			{drawerRowId !== null && (
				<ValidationDrawer
					rowId={drawerRowId}
					onClose={() => setDrawerRowId(null)}
				/>
			)}
		</div>
	);
}