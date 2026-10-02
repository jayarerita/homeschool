/// <reference types="vite/client" />
import { QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary.js";
import { NotFound } from "~/components/NotFound.js";
import { queryClient } from "~/lib/query-client.js";
import appCss from "~/styles/app.css?url";
import { seo } from "~/utils/seo.js";
import "~/lib/amplify.js";

// Lazy load React Query DevTools to avoid SSR issues
const ReactQueryDevtools = React.lazy(() =>
	import("@tanstack/react-query-devtools").then((d) => ({
		default: d.ReactQueryDevtools,
	})),
);

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			...seo({
				title: "Homeschool",
				description:
					"Open-source homeschool planner with an AI tutor, kid-friendly spoken lessons and a speaker device. Host it in your own AWS account.",
			}),
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "32x32",
				href: "/favicon-32x32.png",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "16x16",
				href: "/favicon-16x16.png",
			},
			{ rel: "manifest", href: "/site.webmanifest" },
			{ rel: "icon", href: "/favicon.ico" },
		],
	}),
	errorComponent: (props) => (
		<RootDocument>
			<DefaultCatchBoundary {...props} />
		</RootDocument>
	),
	notFoundComponent: () => <NotFound />,
	component: RootComponent,
});

function RootComponent() {
	return (
		<QueryClientProvider client={queryClient}>
			<RootDocument>
				<Outlet />
			</RootDocument>
			{import.meta.env.DEV && (
				<React.Suspense fallback={null}>
					<ReactQueryDevtools initialIsOpen={false} />
				</React.Suspense>
			)}
		</QueryClientProvider>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<div className="flex h-dvh flex-col">
					<div className="min-h-0 flex-1">{children}</div>
				</div>
				{import.meta.env.DEV && (
					<TanStackRouterDevtools position="bottom-left" />
				)}
				<Scripts />
			</body>
		</html>
	);
}
