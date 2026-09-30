import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import Section, {
	ErrorText,
	inputClass,
	labelClass,
	primaryButtonClass,
} from "~/components/Section";
import { useAuthContext } from "~/hooks/useAuth";
import { client, type Schema, unwrap } from "~/lib/data-client";
import {
	BASE_ROLES,
	type BaseRole,
	GROUPS,
	rolesToGroups,
} from "../../../amplify/auth/groups";

type Member = Schema["Member"]["type"];

const ROLE_LABELS: Record<BaseRole, string> = {
	PARENT: "Parent",
	CHILD: "Kid",
	DEVICE: "Device",
};

const STATUS_LABELS: Record<string, string> = {
	FORCE_CHANGE_PASSWORD: "Invited",
	CONFIRMED: "Active",
	UNCONFIRMED: "Unconfirmed",
	RESET_REQUIRED: "Password reset",
};

function baseRole(member: Member): BaseRole | undefined {
	return BASE_ROLES.find((r) => member.groups.includes(r));
}

async function listMembers(): Promise<Member[]> {
	const members = unwrap(await client.queries.listMembers()) ?? [];
	return members
		.filter((m): m is Member => !!m)
		.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}

function InviteForm() {
	const queryClient = useQueryClient();
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<BaseRole>(GROUPS.parent);
	const [admin, setAdmin] = useState(false);

	const invite = useMutation({
		mutationFn: async () =>
			unwrap(
				await client.mutations.inviteMember({
					email: email.trim(),
					groups: rolesToGroups(role, admin),
				}),
			),
		onSuccess: () => {
			setEmail("");
			setAdmin(false);
			queryClient.invalidateQueries({ queryKey: ["members"] });
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				invite.mutate();
			}}
			className="mt-5 rounded-2xl bg-slate-50 p-4"
		>
			<p className={labelClass}>Invite someone</p>
			<div className="flex flex-col gap-2 sm:flex-row">
				<input
					type="email"
					required
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="email@example.com"
					aria-label="Email"
					className={`${inputClass} flex-1`}
				/>
				<select
					value={role}
					onChange={(e) => setRole(e.target.value as BaseRole)}
					aria-label="Role"
					className={`${inputClass} sm:w-32`}
				>
					{BASE_ROLES.map((r) => (
						<option key={r} value={r}>
							{ROLE_LABELS[r]}
						</option>
					))}
				</select>
				<button
					type="submit"
					disabled={invite.isPending}
					className={primaryButtonClass}
				>
					{invite.isPending ? "Sending…" : "Send invite"}
				</button>
			</div>
			{role === GROUPS.parent && (
				<label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
					<input
						type="checkbox"
						checked={admin}
						onChange={(e) => setAdmin(e.target.checked)}
					/>
					Admin — can also invite and manage household members
				</label>
			)}
			<p className="mt-2 text-xs text-slate-400">
				They'll get an email with a temporary password and set their own on
				first sign-in.
			</p>
			<ErrorText error={invite.error} />
			{invite.isSuccess && (
				<p className="mt-2 text-sm text-emerald-600">Invite sent.</p>
			)}
		</form>
	);
}

export default function MembersSettings() {
	const queryClient = useQueryClient();
	const { user } = useAuthContext();

	const {
		data: members = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["members"],
		queryFn: listMembers,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["members"] });

	const setGroups = useMutation({
		mutationFn: async (vars: { username: string; groups: string[] }) =>
			unwrap(await client.mutations.setMemberGroups(vars)),
		onSuccess: invalidate,
	});

	const remove = useMutation({
		mutationFn: async (username: string) =>
			unwrap(await client.mutations.removeMember({ username })),
		onSuccess: invalidate,
	});

	return (
		<Section
			title="Household members"
			description="Who can sign in, and what they can do. Only admins see this."
		>
			{isLoading && <p className="text-sm text-slate-400">Loading…</p>}
			<ErrorText error={error ?? setGroups.error ?? remove.error} />

			<div className="divide-y divide-slate-100">
				{members.map((member) => {
					const isSelf = member.username === user?.username;
					const role = baseRole(member);
					const isAdmin = member.groups.includes(GROUPS.admin);
					const busy = setGroups.isPending || remove.isPending;
					return (
						<div
							key={member.username}
							className="flex flex-wrap items-center gap-3 py-3"
						>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-semibold text-slate-700">
									{member.email ?? member.username}
									{isSelf && (
										<span className="ml-1.5 font-normal text-slate-400">
											(you)
										</span>
									)}
								</p>
								<p className="text-xs text-slate-400">
									{STATUS_LABELS[member.status ?? ""] ?? member.status}
									{!role && " · no role assigned"}
								</p>
							</div>
							<select
								value={role ?? ""}
								disabled={isSelf || busy}
								onChange={(e) =>
									setGroups.mutate({
										username: member.username,
										groups: rolesToGroups(e.target.value as BaseRole, isAdmin),
									})
								}
								aria-label={`Role for ${member.email}`}
								className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-400"
							>
								{!role && <option value="">No role</option>}
								{BASE_ROLES.map((r) => (
									<option key={r} value={r}>
										{ROLE_LABELS[r]}
									</option>
								))}
							</select>
							<label
								className={`flex items-center gap-1.5 text-sm ${
									role === GROUPS.parent ? "text-slate-600" : "invisible"
								}`}
								title={isSelf ? "You can't remove your own admin role" : ""}
							>
								<input
									type="checkbox"
									checked={isAdmin}
									disabled={isSelf || busy || role !== GROUPS.parent}
									onChange={(e) =>
										setGroups.mutate({
											username: member.username,
											groups: rolesToGroups(GROUPS.parent, e.target.checked),
										})
									}
								/>
								Admin
							</label>
							<button
								type="button"
								disabled={isSelf || busy}
								onClick={() => {
									if (
										window.confirm(
											`Remove ${member.email ?? "this member"}? They will no longer be able to sign in.`,
										)
									) {
										remove.mutate(member.username);
									}
								}}
								aria-label={`Remove ${member.email}`}
								className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:invisible"
							>
								<Trash2 className="h-4 w-4" />
							</button>
						</div>
					);
				})}
			</div>

			<InviteForm />
		</Section>
	);
}
