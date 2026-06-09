"use client";
import { useRouter } from "next/navigation"; // Corrected import path for Next.js 14
import type React from "react";
import { useState } from "react";

export default function LoginScreen() {
	const router = useRouter();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			setError("Please enter a valid email address.");
			return;
		}

		setIsLoading(true);

		try {
			await new Promise((resolve) => setTimeout(resolve, 700));
			document.cookie = `login_user_email_stub=${encodeURIComponent(email)}; path=/; max-age=86400; SameSite=Lax`;
			router.refresh();
			router.push("/dashboard");
		} catch (err) {
			setError("Invalid credentials. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen w-full bg-gray-50">
			{/* Left Side: Banner Image & Branding */}
			<div className="relative hidden w-1/2 bg-primary lg:block">
				<div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1964&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-40" />
				<div className="relative flex h-full flex-col justify-between p-12 text-white">
					<div className="flex items-center gap-2 font-semibold tracking-wide text-xl">
						<div className="h-6 w-6 rounded-md bg-accent" />
						<span>Zensar</span>
					</div>
					<div className="space-y-4">
						<h1 className="text-4xl font-bold leading-tight xl:text-5xl">
							Leveraging financial management <br />
							with AI.
						</h1>
						<p className="text-gray-300 max-w-md">
							Welcome to a new experience of handling financial documents. Easy,
							blazing fast, automated.
						</p>
					</div>
					<p className="text-sm text-gray-400">Internal Use Only</p>
				</div>
			</div>

			{/* Right Side: Login Form */}
			<div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16 xl:px-24 bg-white">
				<div className="mx-auto w-full max-w-md space-y-8">
					<div className="space-y-2">
						<h2 className="text-3xl font-bold tracking-tight text-primary">
							Welcome back
						</h2>
						<p className="text-sm text-gray-500">
							Please enter your details to sign in to your account.
						</p>
					</div>

					<form onSubmit={handleSubmit} className="space-y-6" noValidate>
						{error && (
							<div className="rounded-md bg-red-50 p-4 text-sm text-red-600 border border-red-200">
								{error}
							</div>
						)}

						<div className="space-y-4">
							<div>
								<label
									htmlFor="email"
									className="block text-sm font-medium text-gray-700 mb-1.5"
								>
									Email Address
								</label>
								<input
									id="email"
									type="email"
									autoComplete="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:text-sm"
									placeholder="you@example.com"
									required
								/>
							</div>

							<div>
								<label
									htmlFor="password"
									className="block text-sm font-medium text-gray-700 mb-1.5"
								>
									Password
								</label>
								<input
									id="password"
									type="password"
									autoComplete="current-password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:text-sm"
									placeholder="••••••••"
									required
								/>
							</div>
						</div>

						<button
							type="submit"
							disabled={isLoading}
							className="flex w-full justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 transition-colors"
						>
							{isLoading ? "Signing in..." : "Sign in"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}