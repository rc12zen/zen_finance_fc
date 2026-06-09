"use client";
import { Cpu, Mail, Save, ShieldAlert } from "lucide-react";
import { useState } from "react";

export default function ConfigPage() {
	// --- WORKSPACE CONFIGURATION PARAMETER STATES ---
	const [confidenceScore, setConfidenceScore] = useState(85);
	const [bankChargesTolerance, setBankChargesTolerance] = useState(25.0);
	const [fusionEndpoint, setFusionEndpoint] = useState(
		"https://fa-ext.oraclecloud.com/fscmRestApi/resources/11.13.18.05",
	);
	const [environment, setEnvironment] = useState("test");
	const [saved, setSaved] = useState(false);

	// Notification flags
	const [notifyOnComplete, setNotifyOnComplete] = useState(true);
	const [notifyOnPostFailure, setNotifyOnPostFailure] = useState(true);
	const [notifySummaryToManager, setNotifySummaryToManager] = useState(false);

	const handleGlobalConfigSave = () => {
		setSaved(true);
		setTimeout(() => setSaved(false), 3000);
	};

	return (
		<div className="space-y-6 max-w-5xl mx-auto">
			{/* HEADER PLATFORM ANCHOR */}
			<div className="pb-2 border-b border-gray-200">
				<h1 className="text-xl font-black text-primary uppercase tracking-wider">
					Config
				</h1>
				<p className="text-xs text-gray-500 mt-0.5 font-medium">
					Manage ingestion rules, automation matching tolerances, integration
					environments, and message routing maps
				</p>
			</div>

			{saved && (
				<div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-sm text-xs font-bold tracking-wide shadow-2xs">
					✓ Parameters and rules synchronized successfully over active pipeline
					instances.
				</div>
			)}

			{/* SECTION: MATCHING THRESHOLDS */}
			<div className="bg-white border border-gray-200 rounded-sm shadow-xs overflow-hidden">
				<div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center gap-2">
					<ShieldAlert size={13} className="text-[#1E3A5F]" />
					<h2 className="text-xs font-black text-primary uppercase tracking-wider">
						Matching Thresholds
					</h2>
				</div>

				<div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* Left Column: Confidence Score */}
					<div className="space-y-1.5">
						<label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">
							Minimum confidence score to auto-suggest
						</label>
						<div className="relative max-w-xs">
							<input
								type="number"
								min={0}
								max={100}
								value={confidenceScore}
								onChange={(e) => setConfidenceScore(Number(e.target.value))}
								className="w-full bg-white border border-gray-300 rounded-sm text-xs font-bold text-primary pl-3 pr-8 py-2 outline-none focus:border-[#4A90E2]"
							/>
							<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400 pointer-events-none">
								%
							</span>
						</div>
					</div>

					{/* Right Column: Bank Charges Variance Tolerance */}
					<div className="space-y-1.5">
						<label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">
							Amount tolerance for bank charges (any currency)
						</label>
						<div className="relative max-w-xs">
							<input
								type="number"
								step="0.01"
								value={bankChargesTolerance}
								onChange={(e) =>
									setBankChargesTolerance(Number(e.target.value))
								}
								className="w-full bg-white border border-gray-300 rounded-sm text-xs font-mono font-bold text-primary px-3 py-2 outline-none focus:border-[#4A90E2]"
							/>
						</div>
					</div>
				</div>
			</div>

			{/* SECTION: ORACLE FUSION INTEGRATION ENGINE */}
			<div className="bg-white border border-gray-200 rounded-sm shadow-xs overflow-hidden">
				<div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center gap-2">
					<Cpu size={13} className="text-[#1E3A5F]" />
					<h2 className="text-xs font-black text-primary uppercase tracking-wider">
						Oracle Fusion
					</h2>
				</div>

				<div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-6">
					{/* Left Column: API Endpoint Base Route */}
					<div className="md:col-span-8 space-y-1.5">
						<label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">
							Oracle Fusion API endpoint
						</label>
						<input
							type="text"
							value={fusionEndpoint}
							onChange={(e) => setFusionEndpoint(e.target.value)}
							className="w-full bg-white border border-gray-300 rounded-sm text-xs font-mono font-semibold text-primary px-3 py-2 outline-none focus:border-[#4A90E2]"
						/>
					</div>

					{/* Right Column: Environment Type Dropdown */}
					<div className="md:col-span-4 space-y-1.5">
						<label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">
							Environment
						</label>
						<div className="relative">
							<select
								value={environment}
								onChange={(e) => setEnvironment(e.target.value)}
								className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-3 pr-8 py-2 rounded-sm appearance-none focus:outline-none focus:border-[#4A90E2] cursor-pointer"
							>
								<option value="production">production</option>
								<option value="test">test</option>
							</select>
							<span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[10px]">
								▼
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* SECTION: AUTOMATED EVENT NOTIFICATIONS */}
			<div className="bg-white border border-gray-200 rounded-sm shadow-xs overflow-hidden">
				<div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center gap-2">
					<Mail size={13} className="text-[#1E3A5F]" />
					<h2 className="text-xs font-black text-primary uppercase tracking-wider">
						Notifications
					</h2>
				</div>

				<div className="p-4 space-y-3">
					{/* Checkbox Option 1 */}
					<label className="flex items-start gap-3 select-none group cursor-pointer">
						<input
							type="checkbox"
							checked={notifyOnComplete}
							onChange={(e) => setNotifyOnComplete(e.target.checked)}
							className="mt-0.5 rounded-xs text-[#4A90E2] focus:ring-0 cursor-pointer h-3.5 w-3.5 border-gray-300"
						/>
						<span className="text-xs font-semibold text-gray-700 group-hover:text-primary transition-colors">
							Send a mail when analysis run completes
						</span>
					</label>

					{/* Checkbox Option 2 */}
					<label className="flex items-start gap-3 select-none group cursor-pointer">
						<input
							type="checkbox"
							checked={notifyOnPostFailure}
							onChange={(e) => setNotifyOnPostFailure(e.target.checked)}
							className="mt-0.5 rounded-xs text-[#4A90E2] focus:ring-0 cursor-pointer h-3.5 w-3.5 border-gray-300"
						/>
						<span className="text-xs font-semibold text-gray-700 group-hover:text-primary transition-colors">
							Alert me when Oracle posting fails
						</span>
					</label>

					{/* Checkbox Option 3 */}
					<label className="flex items-start gap-3 select-none group cursor-pointer">
						<input
							type="checkbox"
							checked={notifySummaryToManager}
							onChange={(e) => setNotifySummaryToManager(e.target.checked)}
							className="mt-0.5 rounded-xs text-[#4A90E2] focus:ring-0 cursor-pointer h-3.5 w-3.5 border-gray-300"
						/>
						<span className="text-xs font-semibold text-gray-700 group-hover:text-primary transition-colors">
							Periodically send a summary mail to Finance manager(s)
						</span>
					</label>
				</div>
			</div>

			{/* SAVE EXECUTION BUTTON BAR */}
			<div className="pt-2 flex justify-end">
				<button
					onClick={handleGlobalConfigSave}
					className="flex items-center gap-2 text-xs font-black uppercase tracking-wider bg-[#1E3A5F] hover:bg-[#2E6DA4] text-white px-6 py-2.5 rounded-sm shadow-xs transition-colors cursor-pointer"
				>
					<Save size={13} /> Save Config
				</button>
			</div>
		</div>
	);
}