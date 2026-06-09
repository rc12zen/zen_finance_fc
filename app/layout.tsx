"use client";
import "./globals.css";
import {
	AlertCircle,
	BarChart2,
	CheckSquare,
	Home,
	Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
	{ href: "/dashboard", label: "Dashboard", icon: Home },
	{ href: "/results", label: "Matched Results", icon: BarChart2 },
	{ href: "/not-found-bucket", label: "Not Found", icon: AlertCircle },
	{ href: "/hitl", label: "HITL Approval", icon: CheckSquare },
	{ href: "/config", label: "Config", icon: Settings },
];

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();

	// Check if current route is the login page
	const isLoginPage = pathname === "/";

	return (
		<html lang="en">
			<body>
				{isLoginPage ? (
					// Render plain view without sidebar for the login page
					<main className="min-h-screen w-full">{children}</main>
				) : (
					// Render full authenticated app view with sidebar
					<div className="flex min-h-screen">
						{/* Sidebar */}
						<aside className="w-60 bg-primary text-white flex flex-col fixed h-full z-10">
							<div className="px-6 py-5 border-b border-accent">
								<div className="text-xs text-blue-300 font-medium uppercase tracking-wider mb-1">
									Zensar Technologies
								</div>
								<div className="text-sm font-bold leading-tight">
									Bank Statement
									<br />
									Receipt Processing
								</div>
								<div className="text-xs text-blue-400 mt-1">POC v1.0</div>
							</div>
							<nav className="flex-1 py-4">
								{navItems.map(({ href, label, icon: Icon }) => {
									const active = pathname === href;
									return (
										<Link
											key={href}
											href={href}
											className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
												active
													? "bg-accent text-white font-semibold"
													: "text-blue-200 hover:bg-accent/50"
											}`}
										>
											<Icon size={16} />
											{label}
										</Link>
									);
								})}
							</nav>
							<div className="px-6 py-4 text-xs text-blue-400 border-t border-accent">
								Internal Use Only
							</div>
						</aside>

						{/* Main content */}
						<main className="ml-60 flex-1 p-8 min-h-screen bg-gray-50">
							{children}
						</main>
					</div>
				)}
			</body>
		</html>
	);
}