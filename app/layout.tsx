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
		<html lang="en">
			<body className="antialiased text-gray-800 bg-gray-50">
				{isLoginPage ? (
					// On the login page, render children directly without header or sidebar
					children
				) : (
					// On authenticated dashboard views, mount global frame architecture
					<div className="flex flex-col min-h-screen">
						<header className="h-16 bg-primary text-white px-6 flex items-center justify-between sticky top-0 z-30 shadow-md border-b border-accent">
							<div className="flex items-center gap-4">
								<button
									onClick={() => setIsSidebarOpen(!isSidebarOpen)}
									className="p-1.5 rounded-md hover:bg-accent transition-colors focus:outline-none"
									aria-label="Toggle Sidebar"
								>
									<Menu size={20} />
								</button>
								<div className="flex items-center gap-3">
									<div className="leading-tight border-r border-accent/40 pr-4">
										<div className="text-[10px] text-blue-300 font-medium uppercase tracking-wider">
											Zensar
										</div>
										<div className="text-xs font-bold whitespace-nowrap">
											BR Processing
										</div>
									</div>
									<h1 className="text-base font-semibold text-white tracking-wide pl-1">
										{getPageTitle()}
									</h1>
								</div>
							</div>

							<div className="flex items-center gap-4">
								<div className="text-right hidden sm:block">
									<p className="text-xs font-semibold text-white capitalize">
										{userIdentifier}
									</p>
									<p className="text-[10px] text-blue-300">{userEmail}</p>
								</div>
								<div className="h-8 w-8 rounded-full bg-accent text-white flex items-center justify-center border border-blue-400/30">
									<User size={15} />
								</div>
								<hr className="w-px h-6 bg-accent/40" />
								<Link
									href="/"
									onClick={handleSignOut}
									className="text-blue-300 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-accent/40"
									title="Sign Out"
								>
									<LogOut size={18} />
								</Link>
							</div>
						</header>

						<div className="flex flex-1 relative">
							<aside
								className={`bg-white border-r border-gray-200 flex flex-col fixed left-0 bottom-0 top-16 z-20 transition-all duration-300 ease-in-out ${
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
												className={`flex items-center gap-3 mx-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
													active
														? "bg-accent text-white font-medium shadow-sm"
														: "text-gray-600 hover:bg-gray-100 hover:text-primary"
												}`}
											>
												<div className="flex-shrink-0">
													<Icon size={18} />
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
									className={`p-4 text-[11px] text-gray-400 border-t border-gray-100 whitespace-nowrap overflow-hidden transition-all duration-200 ${isSidebarOpen ? "opacity-100" : "opacity-0 w-0 h-0 p-0 pointer-events-none"}`}
								>
									Internal Use Only
								</div>
							</aside>

							{/* Standard structural parent container for child routes */}
							<main
								className={`flex-1 p-8 min-h-screen transition-all duration-300 ease-in-out ${isSidebarOpen ? "ml-60" : "ml-16"}`}
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