import { createFileRoute } from "@tanstack/react-router";
import Landing from "~/components/landing/Landing";

// The public landing page, also reachable when signed in.
export const Route = createFileRoute("/about")({
	component: Landing,
});
