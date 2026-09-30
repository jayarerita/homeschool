import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/planning/")({
	beforeLoad: () => {
		throw redirect({ to: "/planning/routines" });
	},
});
