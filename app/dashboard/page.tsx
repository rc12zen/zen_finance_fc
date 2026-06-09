"use client";
import {
	AlertTriangle,
	ArrowRight,
	Building2,
	CheckCircle,
	CloudLightning,
	FileSpreadsheet,
	FileText,
	FolderSearch,
	Layers,
	Play,
	RefreshCw,
	ShieldCheck,
	Sparkles,
	UploadCloud,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import MetricCard from "@/components/MetricCard";
import StatusBadge from "@/components/StatusBadge";
import {
	getAgingStatus,
	getFiles,
	getMetrics,
	getStatus,
	refreshAging,
	resetRun,
	startRun,
} from "@/lib/api";

interface FileInfo {
	filename: string;
	bank_name: string;
	size_mb: number;
	business_unit: string;
	ou_number: string;
}

interface Metrics {
	total_rows_ingested: number;
	found: number;
	not_found: number;
	passed_validation: number;
	failed_validation: number;
	pending_hitl: number;
	approved: number;
	rejected: number;
	posted_to_oracle: number;
	extraction_method_breakdown: Record<string, number>;
	aging_report_loaded: boolean;
	aging_report_row_count: number;
}

const METHOD_COLORS: Record<string, string> = {
	cache: "#1E3A5F",
	regex: "#2E6DA4",
	fuzzy: "#4A90E2",
	token_exact: "#0ea5e9",
	token_fuzzy: "#6366f1",
	token_scan: "#a855f7",
};

function groupByBU(files: FileInfo[]): Record<string, FileInfo[]> {
	return files.reduce(
		(acc, f) => {
			const bu = f.business_unit || "Unassigned Business Unit";
			if (!acc[bu]) acc[bu] = [];
			acc[bu].push(f);
			return acc;
		},
		{} as Record<string, FileInfo[]>,
	);
}

export default function Dashboard() {
	const [files, setFiles] = useState<FileInfo[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [runStatus, setRunStatus] = useState<{
		status: string;
		message: string;
		progress_current: number;
	}>({
		status: "idle",
		message: "",
		progress_current: 0,
	});
	const [metrics, setMetrics] = useState<Metrics | null>(null);
	const [agingStatus, setAgingStatus] = useState<{
		loaded: boolean;
		row_count: number;
		filename: string | null;
	}>({
		loaded: false,
		row_count: 0,
		filename: null,
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [groupedView, setGroupedView] = useState(true);

	const [userDisplayName, setUserDisplayName] = useState("Admin User");

	const fetchFiles = useCallback(async () => {
		try {
			const res = await getFiles();
			setFiles(res.data.files);
		} catch {
			setError(
				"Could not connect to backend system. Verify server configuration.",
			);
		}
	}, []);

	const fetchMetrics = useCallback(async () => {
		try {
			const [m, a] = await Promise.all([getMetrics(), getAgingStatus()]);
			setMetrics(m.data);
			setAgingStatus(a.data);
		} catch {}
	}, []);

	const fetchStatus = useCallback(async () => {
		try {
			const res = await getStatus();
			setRunStatus(res.data);
			if (res.data.status === "completed" || res.data.status === "error")
				fetchMetrics();
		} catch {}
	}, [fetchMetrics]);

	useEffect(() => {
		fetchFiles();
		fetchMetrics();

		const match = document.cookie.match(
			/(?:^|; )login_user_email_stub=([^;]*)/,
		);
		if (match && match[1]) {
			const email = decodeURIComponent(match[1]);
			setUserDisplayName(email.split("@")[0]);
		}
	}, [fetchFiles, fetchMetrics]);

	useEffect(() => {
		if (runStatus.status !== "running") return;
		const interval = setInterval(fetchStatus, 2000);
		return () => clearInterval(interval);
	}, [runStatus.status, fetchStatus]);

	const toggleFile = (fname: string) => {
		setSelected((prev) => {
			const n = new Set(prev);
			n.has(fname) ? n.delete(fname) : n.add(fname);
			return n;
		});
	};

	const toggleAll = () => {
		if (selected.size === files.length) setSelected(new Set());
		else setSelected(new Set(files.map((f) => f.filename)));
	};

	const toggleBU = (buFiles: FileInfo[]) => {
		const names = buFiles.map((f) => f.filename);
		const allSelected = names.every((n) => selected.has(n));
		setSelected((prev) => {
			const n = new Set(prev);
			if (allSelected) names.forEach((name) => n.delete(name));
			else names.forEach((name) => n.add(name));
			return n;
		});
	};

	const handleStart = async () => {
		if (!agingStatus.loaded) {
			setError(
				"Required validation context missing: Please load aging ledger data first.",
			);
			return;
		}
		if (selected.size === 0) {
			setError(
				"No statement batches specified: Select a collection target down below.",
			);
			return;
		}
		setError("");
		setLoading(true);
		try {
			await startRun(Array.from(selected));
			fetchStatus();
		} catch (e: any) {
			setError(
				e?.response?.data?.detail ||
					"Failed to initiate automated extraction pipeline",
			);
		}
		setLoading(false);
	};

	const handleRefreshAging = async () => {
		try {
			await refreshAging();
			fetchMetrics();
		} catch (e: any) {
			setError(e?.response?.data?.detail || "Ledger context fetch failed");
		}
	};

	const isRunning = runStatus.status === "running";
	const methodChartData = metrics
		? Object.entries(metrics.extraction_method_breakdown).map(
				([method, count]) => ({ method, count }),
			)
		: [];

	const buGroups = groupByBU(files);
	const selectedBUs = Array.from(
		new Set(
			files
				.filter((f) => selected.has(f.filename))
				.map((f) => f.business_unit)
				.filter(Boolean),
		),
	);

	return (
		<div className="space-y-6">
			{/* ONBOARDING HERO BANNER */}
			<div className="bg-white border border-gray-200 p-6 shadow-sm relative overflow-hidden">
				<div className="absolute top-0 right-0 p-4 opacity-5 text-primary pointer-events-none">
					<CloudLightning size={120} />
				</div>
				<div className="max-w-3xl">
					<h2 className="text-xl font-bold text-primary capitalize flex items-center gap-2">
						Welcome back, {userDisplayName}
					</h2>
					<p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
						Your workspace is ready. Files synced from SharePoint are loaded
						automatically each morning. You can also upload additional
						statements or the aging report manually at any time before starting
						analysis.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
					<div className="flex gap-3">
						<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-accent font-mono">
							1
						</div>
						<div>
							<h4 className="text-xs font-bold text-primary uppercase tracking-wide">
								Review or add files
							</h4>
							<p className="text-[11px] text-gray-500 mt-0.5">
								Check the files loaded below. Upload a new bank statement or
								aging report if needed.
							</p>
						</div>
					</div>
					<div className="flex gap-3">
						<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-accent font-mono">
							2
						</div>
						<div>
							<h4 className="text-xs font-bold text-primary uppercase tracking-wide">
								Start matching
							</h4>
							<p className="text-[11px] text-gray-500 mt-0.5">
								Select the bank statement files you want to run and click Run
								matching.
							</p>
						</div>
					</div>
					<div className="flex gap-3">
						<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-accent font-mono">
							3
						</div>
						<div>
							<h4 className="text-xs font-bold text-primary uppercase tracking-wide">
								Review results
							</h4>
							<p className="text-[11px] text-gray-500 mt-0.5">
								Go to Review and approve to validate AI-matched transactions, or
								check Dashboard for analysis summary.
							</p>
						</div>
					</div>
				</div>
			</div>

			{error && (
				<div className="bg-red-50/50 backdrop-blur-sm border-l-4 border-red-600 text-gray-900 px-4 py-3.5 shadow-sm text-sm flex items-center justify-between transition-all">
					<div className="flex items-center gap-3">
						<AlertTriangle size={18} className="text-red-600 shrink-0" />
						<span className="font-medium tracking-wide">{error}</span>
					</div>
					<button
						onClick={() => setError("")}
						className="text-gray-400 hover:text-gray-600 px-2 font-mono text-base"
					>
						×
					</button>
				</div>
			)}

			{/* ROW 1: TOP PANEL - INVERTED (DARK MODE) ENGINE CONTROL HUB */}
			<div className="bg-[#1E3A5F] text-white px-5 py-3.5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#172e4c]">
				<div className="flex items-center gap-6">
					<div className="flex items-center gap-2">
						<ShieldCheck size={15} className="text-[#4A90E2]" />
						<span className="text-xs font-black uppercase tracking-wider text-white">
							Engine Hub
						</span>
					</div>
					<div className="flex items-center gap-2 border-l border-[#2E6DA4] pl-6">
						<span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
							State:
						</span>
						<div
							className={`text-xs font-black uppercase flex items-center gap-1.5 ${
								runStatus.status === "completed"
									? "text-emerald-400"
									: runStatus.status === "running"
										? "text-sky-400"
										: runStatus.status === "error"
											? "text-rose-400"
											: "text-gray-300"
							}`}
						>
							{isRunning && (
								<RefreshCw size={12} className="animate-spin text-[#4A90E2]" />
							)}
							{runStatus.status}
						</div>
						{runStatus.status === "error" && (
							<button
								onClick={() => resetRun().then(fetchStatus)}
								className="text-[10px] font-bold text-rose-400 hover:text-rose-300 underline ml-2"
							>
								Reset
							</button>
						)}
					</div>
					{selectedBUs.length > 0 && (
						<div className="hidden md:flex items-center gap-2 border-l border-[#2E6DA4] pl-6">
							<span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
								Scope:
							</span>
							<div className="flex gap-1 max-w-xs truncate">
								{selectedBUs.map((bu) => (
									<span
										key={bu}
										className="text-[9px] bg-[#2E6DA4] text-white font-bold px-1.5 py-0.5 uppercase tracking-wide"
									>
										{bu}
									</span>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="flex items-center gap-5 w-full sm:w-auto justify-end">
					<div className="text-[11px] text-gray-300 font-medium hidden lg:block">
						<span className="font-bold text-[#4A90E2] font-mono bg-[#172e4c] px-1.5 py-0.5 rounded-sm mr-1">
							{selected.size}
						</span>{" "}
						statements vs{" "}
						<span className="font-bold text-white font-mono bg-[#172e4c] px-1.5 py-0.5 rounded-sm">
							{agingStatus.loaded ? agingStatus.row_count.toLocaleString() : 0}
						</span>{" "}
						open records
					</div>
					<button
						onClick={handleStart}
						disabled={
							isRunning || loading || selected.size === 0 || !agingStatus.loaded
						}
						className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#4A90E2] hover:bg-[#357ABD] text-white px-6 py-2.5 font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-md group whitespace-nowrap rounded-sm"
					>
						<Play size={11} className="fill-current" />
						{isRunning ? "Running..." : "Run matching"}
						<ArrowRight
							size={12}
							className="ml-0.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
						/>
					</button>
				</div>
			</div>

			{/* ROW 2: AGING REPORT SECTION */}
			<div className="bg-white border border-gray-200 shadow-sm">
				<div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
					<div className="max-w-2xl">
						<h2 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
							<Layers size={14} className="text-accent" /> Aging Report
						</h2>
						<p className="text-xs text-gray-600 mt-1 leading-relaxed">
							The master list of open invoices from Oracle Fusion. The AI
							matches bank payments against this file. Always use today's latest
							export. Only the most recently loaded report is active — uploading
							a new one replaces the previous.
						</p>
					</div>
					<button
						onClick={handleRefreshAging}
						className="self-start sm:self-auto flex items-center gap-1.5 text-xs text-accent hover:text-primary font-semibold transition-colors bg-white border border-gray-300 px-3 py-1.5 uppercase tracking-wide shadow-sm shrink-0"
					>
						<RefreshCw size={12} className={loading ? "animate-spin" : ""} />{" "}
						Sync Store
					</button>
				</div>

				<div className="p-5 space-y-4">
					{agingStatus.loaded ? (
						<div className="flex items-center justify-between p-3 border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition-colors">
							<div className="flex items-start gap-3 min-w-0">
								<FileSpreadsheet
									size={18}
									className="text-emerald-600 mt-0.5 shrink-0"
								/>
								<div className="min-w-0">
									<p className="text-xs font-bold text-primary truncate font-mono">
										{agingStatus.filename || "oracle_fusion_export_latest.xlsx"}
									</p>
									<p className="text-[11px] text-gray-500 mt-0.5 font-medium">
										<span className="text-primary font-bold">
											{agingStatus.row_count.toLocaleString()}
										</span>{" "}
										invoice records · Loaded via SharePoint Synced Store · Just
										now
									</p>
								</div>
							</div>
							<button
								onClick={handleRefreshAging}
								className="text-[10px] font-bold text-accent hover:text-primary uppercase tracking-wider shrink-0 bg-white border border-gray-200 px-3 py-1 transition-colors"
							>
								Replace
							</button>
						</div>
					) : (
						<div className="p-4 border border-dashed border-red-200 bg-red-50/30 text-xs text-red-800 flex items-center gap-2">
							<XCircle size={16} className="text-red-600" />
							<span>
								No active configuration report detected. Upload or synchronize
								file framework below.
							</span>
						</div>
					)}

					<div className="pt-3 border-t border-gray-100">
						<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2.5">
							Upload a different report (Excel or CSV · max 10 MB)
						</span>
						<div className="flex flex-wrap gap-3">
							<button className="flex items-center gap-2 border border-gray-300 hover:border-primary text-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-white transition-colors">
								<FolderSearch size={14} className="text-accent" /> SharePoint
							</button>
							<button className="flex items-center gap-2 border border-gray-300 hover:border-primary text-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-white transition-colors">
								<UploadCloud size={14} className="text-accent" /> Browse files
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* ROW 3: BANK STATEMENTS SECTION */}
			<div className="bg-white border border-gray-200 shadow-sm">
				<div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-gray-50/50">
					<div className="max-w-2xl">
						<h2 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
							<FileText size={14} className="text-accent" /> Bank statements
						</h2>
						<p className="text-xs text-gray-600 mt-1 leading-relaxed">
							Select the bank statement files you want to include in this
							analysis run. You can run all at once or pick specific banks or
							business units. Files are grouped by business unit.
						</p>
					</div>

					<div className="flex items-center self-end sm:self-auto gap-4 shrink-0 pt-1">
						<button
							onClick={() => setGroupedView(!groupedView)}
							className="text-xs font-bold text-primary hover:text-accent border border-gray-300 bg-white px-3 py-1.5 transition-colors uppercase tracking-wider shadow-sm"
						>
							{groupedView ? "Flat List" : "Group by BU"}
						</button>
						<button
							onClick={fetchFiles}
							className="text-xs font-semibold text-gray-500 hover:text-primary flex items-center gap-1.5"
						>
							<RefreshCw size={12} /> Sync
						</button>
						<div className="h-4 w-px bg-gray-300" />
						<button
							onClick={toggleAll}
							className="text-xs font-bold text-accent hover:text-primary uppercase tracking-wider"
						>
							{selected.size === files.length ? "Clear All" : "Select Global"}
						</button>
					</div>
				</div>

				<div className="p-5">
					{files.length === 0 ? (
						<div className="text-xs text-gray-400 font-medium text-center py-12 border border-dashed border-gray-200 bg-gray-50/50">
							No statement sheets matching schemas located inside backend
							configurations.
						</div>
					) : groupedView ? (
						<div className="space-y-4">
							{Object.entries(buGroups).map(([bu, buFiles]) => {
								const allBuSelected = buFiles.every((f) =>
									selected.has(f.filename),
								);
								return (
									<div key={bu} className="border border-gray-200 bg-white">
										<div className="bg-gray-50/70 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
											<div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
												<Building2 size={13} className="text-gray-400" />
												<span>{bu}</span>
												<span className="text-gray-400 font-medium font-sans">
													· {buFiles.length} file
													{buFiles.length !== 1 ? "s" : ""}
												</span>
											</div>
											<button
												onClick={() => toggleBU(buFiles)}
												className="text-[10px] font-bold text-accent hover:text-primary uppercase tracking-wider bg-white border border-gray-200 px-2.5 py-0.5 transition-colors"
											>
												{allBuSelected ? "Deselect Group" : "Select all"}
											</button>
										</div>

										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
											{buFiles.map((f) => {
												const isChecked = selected.has(f.filename);
												return (
													<label
														key={f.filename}
														className={`group flex items-start gap-3 p-3 border transition-all cursor-pointer ${
															isChecked
																? "border-accent bg-accent/5"
																: "border-gray-200 hover:border-gray-400 bg-white"
														}`}
													>
														<input
															type="checkbox"
															checked={isChecked}
															onChange={() => toggleFile(f.filename)}
															className="mt-1 w-3.5 h-3.5 text-primary focus:ring-primary accent-primary"
														/>
														<div className="min-w-0 flex-1">
															<div className="text-xs font-bold text-primary truncate group-hover:text-accent transition-colors">
																{f.filename}
															</div>
															<div className="flex items-center gap-2 mt-2 flex-wrap">
																<StatusBadge value={f.bank_name} />
																<span className="text-[10px] font-mono text-gray-400">
																	{f.size_mb.toFixed(2)} MB · synced 08:30 AM
																</span>
															</div>
														</div>
													</label>
												);
											})}
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
							{files.map((f) => {
								const isChecked = selected.has(f.filename);
								return (
									<label
										key={f.filename}
										className={`group flex items-start gap-3 p-3 border transition-all cursor-pointer ${
											isChecked
												? "border-accent bg-accent/5"
												: "border-gray-200 hover:border-gray-400 bg-white"
										}`}
									>
										<input
											type="checkbox"
											checked={isChecked}
											onChange={() => toggleFile(f.filename)}
											className="mt-1 w-3.5 h-3.5 text-primary focus:ring-primary accent-primary"
										/>
										<div className="min-w-0 flex-1">
											<div className="text-xs font-bold text-primary truncate group-hover:text-accent transition-colors">
												{f.filename}
											</div>
											<div className="flex items-center gap-2 mt-1.5 flex-wrap">
												<StatusBadge value={f.bank_name} />
												<span className="text-[10px] font-mono text-gray-400">
													{f.size_mb} MB · synced 08:30 AM
												</span>
											</div>
										</div>
									</label>
								);
							})}
						</div>
					)}
				</div>
			</div>

			{/* ANALYTICAL TELEMETRY MODULE */}
			{metrics && (
				<div className="space-y-6 pt-2">
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<MetricCard
							label={
								<span className="flex items-center gap-1.5">
									<Layers size={13} className="text-[#1E3A5F]" />
									<span>Total Records Scanned</span>
								</span>
							}
							value={metrics.total_rows_ingested}
							color="#1E3A5F"
						/>
						<MetricCard
							label={
								<span className="flex items-center gap-1.5">
									<Sparkles size={13} className="text-[#2E6DA4]" />
									<span>Automated Match Rate</span>
								</span>
							}
							value={metrics.found}
							color="#2E6DA4"
						/>
						<MetricCard
							label={
								<span className="flex items-center gap-1.5">
									<AlertTriangle size={13} className="text-rose-600" />
									<span>Unresolved Exceptions</span>
								</span>
							}
							value={metrics.not_found}
							color="#ef4444"
						/>
						<MetricCard
							label={
								<span className="flex items-center gap-1.5">
									<ShieldCheck size={13} className="text-emerald-600" />
									<span>Audit-Ready Clearances</span>
								</span>
							}
							value={metrics.passed_validation}
							color="#16a34a"
						/>
					</div>

					{methodChartData.length > 0 && (
						<div className="bg-white border border-gray-200 p-5 shadow-sm">
							<div className="text-xs font-bold text-primary uppercase tracking-wider mb-6 pb-2 border-b border-gray-100 flex items-center gap-1.5">
								<Sparkles size={14} className="text-accent" /> Extraction Method
								Breakdown Analysis
							</div>
							<div className="w-full overflow-hidden">
								<ResponsiveContainer width="100%" height={200}>
									<BarChart data={methodChartData}>
										<CartesianGrid
											strokeDasharray="3 3"
											vertical={false}
											stroke="#f3f4f6"
										/>
										<XAxis
											dataKey="method"
											tick={{ fontSize: 10, fontWeight: 700, fill: "#1E3A5F" }}
											axisLine={{ stroke: "#e5e7eb" }}
											tickLine={false}
										/>
										<YAxis
											tick={{ fontSize: 11, fill: "#6b7280" }}
											axisLine={false}
											tickLine={false}
										/>
										<Tooltip
											cursor={{ fill: "#f9fafb" }}
											contentStyle={{
												backgroundColor: "#1E3A5F",
												borderColor: "#2E6DA4",
												borderRadius: "0px",
											}}
											itemStyle={{ color: "#ffffff", fontSize: "11px" }}
										/>
										<Bar dataKey="count" fill="#2E6DA4" maxBarSize={40}>
											{methodChartData.map((entry, i) => (
												<Cell
													key={i}
													fill={METHOD_COLORS[entry.method] || "#94a3b8"}
												/>
											))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}