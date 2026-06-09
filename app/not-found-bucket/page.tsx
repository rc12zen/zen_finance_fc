"use client";
import {
	AlertCircle,
	CheckSquare,
	ChevronDown,
	Download,
	Landmark,
	Layers,
	RefreshCw,
	Search,
	ShieldAlert,
	Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import { getNotFound } from "@/lib/api";

export default function NotFoundPage() {
	const [data, setData] = useState<any[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [reasonFilter, setReasonFilter] = useState("");
	const [loading, setLoading] = useState(false);
	const PAGE_SIZE = 50;

	const fetchData = useCallback(async () => {
		setLoading(true);
		try {
			const res = await getNotFound({
				page,
				page_size: PAGE_SIZE,
				...(reasonFilter && { reason: reasonFilter }),
			});
			setData(res.data.data);
			setTotal(res.data.total);
		} catch {}
		setLoading(false);
	}, [page, reasonFilter]);

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
		a.download = "not_found.csv";
		a.click();
	};

	const totalPages = Math.ceil(total / PAGE_SIZE);
	const REASONS = [
		"no_customer",
		"no_invoice",
		"low_confidence",
		"validation_failed",
		"spoc_rejected",
		"empty_narrative",
	];

	return (
		<div className="space-y-6">
			{/* PROCEDURAL HERO BANNER */}
			<div className="bg-white border border-gray-200 p-6 shadow-xs relative overflow-hidden">
				<div className="absolute top-0 right-0 p-4 opacity-5 text-[#1E3A5F] pointer-events-none">
					<ShieldAlert size={100} />
				</div>
				<div className="max-w-4xl">
					<h2 className="text-sm font-black text-[#1E3A5F] uppercase tracking-wider flex items-center gap-2">
						Not Found — Manual Review
					</h2>
					<p className="text-xs text-gray-600 mt-2 leading-relaxed">
						These transactions could not be automatically matched by the system
						algorithms. The finance operations team should process them manually
						within Oracle Fusion using your established standard operating
						procedures.
					</p>
				</div>
			</div>

			{/* MULTI-KPI TRACKING SEGMENT GRID */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{/* KPI: Total Unresolved Exceptions */}
				<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30 flex flex-col justify-between">
					<div>
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<Layers size={13} className="text-[#1E3A5F]" />
							<span className="text-[10px] font-bold uppercase tracking-wider">
								Unresolved Exceptions
							</span>
						</div>
						<div className="text-xl font-black text-primary">{total}</div>
					</div>
					<div className="mt-2 pt-1.5 border-t border-gray-100 text-[10px] text-gray-400 font-medium leading-normal">
						Total ledger execution records remaining that currently require
						manual entry provisioning in Oracle Fusion.
					</div>
				</div>

				{/* KPI: Action Block State */}
				<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30 flex flex-col justify-between">
					<div>
						<div className="flex items-center gap-1.5 text-amber-600 mb-1">
							<AlertCircle size={13} />
							<span className="text-[10px] font-bold uppercase tracking-wider">
								Processing Window
							</span>
						</div>
						<div className="text-xl font-black text-primary">Active Queue</div>
					</div>
					<div className="mt-2 pt-1.5 border-t border-gray-100 text-[10px] text-gray-400 font-medium leading-normal">
						Isolated system footprint containing target files with unmatched
						status indicators.
					</div>
				</div>

				{/* KPI: Functional Clearance Target */}
				<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30 flex flex-col justify-between">
					<div>
						<div className="flex items-center gap-1.5 text-emerald-600 mb-1">
							<CheckSquare size={13} />
							<span className="text-[10px] font-bold uppercase tracking-wider">
								Target Ledger State
							</span>
						</div>
						<div className="text-xl font-black text-emerald-600">
							Oracle Sync
						</div>
					</div>
					<div className="mt-2 pt-1.5 border-t border-gray-100 text-[10px] text-gray-400 font-medium leading-normal">
						Cleared line entries map instantly into central ledger parameters
						following direct console updates.
					</div>
				</div>
			</div>

			{/* FILTER CONTROL PANEL SPACE */}
			<div className="bg-white border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
				<div className="relative w-full sm:w-72">
					<Landmark
						size={13}
						className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
					/>
					<select
						value={reasonFilter}
						onChange={(e) => {
							setReasonFilter(e.target.value);
							setPage(1);
						}}
						className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-9 pr-8 py-2 rounded-sm appearance-none focus:outline-none focus:border-[#4A90E2] cursor-pointer uppercase tracking-wider"
					>
						<option value="">All Reasons</option>
						{REASONS.map((r) => (
							<option key={r} value={r}>
								{r.replace("_", " ")}
							</option>
						))}
					</select>
					<ChevronDown
						size={13}
						className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
					/>
				</div>

				<div className="flex items-center gap-2 w-full sm:w-auto justify-end">
					<button
						onClick={fetchData}
						className="flex items-center justify-center gap-1.5 border border-gray-300 hover:border-primary px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-primary rounded-sm transition-colors hover:bg-gray-50 cursor-pointer"
						title="Refresh Ledger Dataset"
					>
						<RefreshCw size={12} className={loading ? "animate-spin" : ""} />
						<span>Refresh</span>
					</button>

					<button
						onClick={exportCSV}
						disabled={data.length === 0}
						className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-[#1E3A5F] hover:bg-[#2E6DA4] disabled:opacity-30 disabled:cursor-not-allowed text-white px-4 py-2 rounded-sm transition-colors cursor-pointer"
					>
						<Download size={13} /> Export CSV
					</button>
				</div>
			</div>

			{/* ISOLATED COMPOSITE SCROLL CONTAINER VIEWPORT FOR FIXED DATA MATRIX LAYOUT */}
			<div className="bg-white border border-gray-200 rounded-sm shadow-xs flex flex-col h-[520px]">
				<div className="flex-1 overflow-auto">
					<table className="w-full text-left border-collapse relative">
						{/* HEADERS RIGIDLY FIXED VIA STICKY DIRECTIVES */}
						<thead className="sticky top-0 z-10 shadow-[0_1px_0_0_rgba(23,46,76,1)]">
							<tr className="bg-[#1E3A5F] text-white">
								{[
									"ID",
									"Bank",
									"Date",
									"Narrative",
									"Bank Account",
									"Credit Amount",
									"Currency",
									"Reason",
								].map((h) => (
									<th
										key={h}
										className={`px-3 py-2.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap bg-[#1E3A5F] ${
											h === "Credit Amount" ? "text-right" : ""
										}`}
									>
										{h}
									</th>
								))}
							</tr>
						</thead>

						{/* DATA ROW MATRIX COMPONENT */}
						<tbody className="text-[11px] divide-y divide-gray-200 font-medium text-gray-700 bg-white">
							{loading ? (
								<tr>
									<td
										colSpan={8}
										className="text-center py-24 text-xs text-gray-400 font-semibold uppercase tracking-wider bg-gray-50/30"
									>
										Querying Exception Data Elements...
									</td>
								</tr>
							) : data.length === 0 ? (
								<tr>
									<td
										colSpan={8}
										className="text-center py-24 text-xs text-gray-400 font-semibold uppercase tracking-wider bg-gray-50/30"
									>
										No unmatched records. Great!
									</td>
								</tr>
							) : (
								data.map((r, i) => (
									<tr
										key={r.id}
										className="hover:bg-gray-50/80 transition-colors"
									>
										<td className="px-3 py-3 font-bold font-mono text-primary">
											{r.id}
										</td>
										<td className="px-3 py-3 whitespace-nowrap font-bold text-primary">
											{r.bank_name}
										</td>
										<td className="px-3 py-3 whitespace-nowrap font-mono">
											{r.statement_date}
										</td>
										<td
											className="px-3 py-3 max-w-sm truncate font-mono text-gray-500"
											title={r.narrative}
										>
											{r.narrative}
										</td>
										<td className="px-3 py-3 font-mono text-xs tracking-tight text-gray-600">
											{r.bank_account_number}
										</td>
										<td className="px-3 py-3 text-right font-black font-mono text-primary">
											{r.credit_amount?.toLocaleString(undefined, {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2,
											})}
										</td>
										<td className="px-3 py-3 font-bold text-gray-500">
											{r.currency}
										</td>
										<td className="px-3 py-3 whitespace-nowrap">
											<StatusBadge value={r.reason} />
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* IMMUTABLE STRUCTURAL PAGINATION ENGINE */}
			{totalPages > 1 && (
				<div className="flex items-center justify-between border-t border-gray-200 pt-4 bg-transparent">
					<span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
						Page {page} of {totalPages}{" "}
						<span className="text-gray-300 px-1">|</span> Total Execution Items:{" "}
						{total} Logs Loaded
					</span>
					<div className="flex items-center gap-1.5">
						<button
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={page === 1 || loading}
							className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider border border-gray-300 rounded-sm hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors bg-white cursor-pointer"
						>
							Previous
						</button>
						<button
							onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							disabled={page === totalPages || loading}
							className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider border border-gray-300 rounded-sm hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors bg-white cursor-pointer"
						>
							Next
						</button>
					</div>
				</div>
			)}
		</div>
	);
}