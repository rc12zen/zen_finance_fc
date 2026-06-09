"use client";
import "./globals.css";
import {
	AlertCircle,
	BarChart2,
	CheckSquare,
	Home,
	LogOut,
	Menu,
	Settings,
	User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
	const [isSidebarOpen, setIsSidebarOpen] = useState(true);

	const [userEmail, setUserEmail] = useState("admin@zensar.com");
	const [userIdentifier, setUserIdentifier] = useState("Admin User");

	const isLoginPage = pathname === "/";

	useEffect(() => {
		if (isLoginPage) return;

		const getCookie = (name: string) => {
			const matches = document.cookie.match(
				new RegExp(
					`(?:^|; )${name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1")}=([^;]*)`,
				),
			);
			return matches ? decodeURIComponent(matches[1]) : null;
		};

		const activeEmail = getCookie("login_user_email_stub");
		if (activeEmail) {
			setUserEmail(activeEmail);
			const identifier = activeEmail.split("@")[0];
			setUserIdentifier(identifier);
		}
	}, [isLoginPage, pathname]);

	const getPageTitle = () => {
		const currentItem = navItems.find((item) => item.href === pathname);
		return currentItem ? currentItem.label : "Console";
	};

	const handleSignOut = () => {
		document.cookie =
			"login_user_email_stub=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
	};

	return (
		<html lang="en" className="h-full">
			<body className="antialiased text-gray-800 bg-gray-50 h-full overflow-hidden">
				{isLoginPage ? (
					// On the login page, render children directly without header or sidebar
					children
				) : (
					// On authenticated dashboard views, mount global frame architecture
					<div className="flex flex-col h-screen w-screen overflow-hidden">
						{/* GLOBAL FIXED TOP BAR */}
						<header className="h-16 bg-[#1E3A5F] text-white px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs border-b border-[#172e4c] shrink-0">
							<div className="flex items-center gap-4">
								<button
									onClick={() => setIsSidebarOpen(!isSidebarOpen)}
									className="p-1.5 rounded-sm hover:bg-[#2E6DA4]/30 transition-colors focus:outline-none cursor-pointer"
									aria-label="Toggle Sidebar"
								>
									<Menu size={18} />
								</button>
								<div className="flex items-center gap-3">
									<div className="leading-tight border-r border-[#2E6DA4]/40 pr-4">
										<div className="text-[9px] text-[#4A90E2] font-black uppercase tracking-widest">
											Zensar
										</div>
										<div className="text-xs font-black uppercase tracking-tight whitespace-nowrap">
											BR Processing
										</div>
									</div>
									<h1 className="text-xs font-black uppercase tracking-wider text-white pl-1 hidden sm:block">
										{getPageTitle()}
									</h1>
								</div>
							</div>

							<div className="flex items-center gap-4">
								<div className="text-right hidden sm:block">
									<p className="text-xs font-bold text-white capitalize">
										{userIdentifier}
									</p>
									<p className="text-[10px] text-gray-400 font-mono">
										{userEmail}
									</p>
								</div>
								<div className="h-8 w-8 rounded-full bg-[#2E6DA4]/20 text-white flex items-center justify-center border border-[#4A90E2]/20">
									<User size={14} />
								</div>
								<hr className="w-px h-6 bg-[#2E6DA4]/30" />
								<Link
									href="/"
									onClick={handleSignOut}
									className="text-gray-400 hover:text-[#e11d48] transition-colors p-1.5 rounded-sm hover:bg-[#e11d48]/5"
									title="Sign Out"
								>
									<LogOut size={16} />
								</Link>
							</div>
						</header>

						<div className="flex flex-1 h-[calc(100vh-64px)] relative overflow-hidden">
							{/* FIXED NAVIGATION PANEL */}
							<aside
								className={`bg-white border-r border-gray-200 flex flex-col fixed left-0 bottom-0 top-16 z-20 transition-all duration-300 ease-in-out shrink-0 ${
									isSidebarOpen ? "w-60" : "w-16"
								}`}
							>
								<nav className="flex-1 py-4 space-y-1">
									{navItems.map(({ href, label, icon: Icon }) => {
										const active = pathname === href;
										return (
											<Link
												key={href}
												href={href}
												title={!isSidebarOpen ? label : undefined}
												className={`flex items-center gap-3 mx-3 px-3 py-2.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
													active
														? "bg-[#1E3A5F] text-white shadow-xs"
														: "text-gray-500 hover:bg-gray-100 hover:text-primary"
												}`}
											>
												<div className="flex-shrink-0">
													<Icon
														size={16}
														className={active ? "text-[#4A90E2]" : ""}
													/>
												</div>
												<span
													className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none hidden"}`}
												>
													{label}
												</span>
											</Link>
										);
									})}
								</nav>
								<div
									className={`p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-t border-gray-100 whitespace-nowrap overflow-hidden transition-all duration-200 ${isSidebarOpen ? "opacity-100" : "opacity-0 w-0 h-0 p-0 pointer-events-none"}`}
								>
									Internal Use Only
								</div>
							</aside>

							{/* ISOLATED COMPOSITE VIEWPORT FOR INLINE PAGE COMPONENT LAYER SCROLLING */}
							<main
								className={`flex-1 p-8 h-full overflow-y-auto transition-all duration-300 ease-in-out ${
									isSidebarOpen ? "ml-60" : "ml-16"
								}`}
							>
								{children}
							</main>
						</div>
					</div>
				)}
			</body>
		</html>
	);
}