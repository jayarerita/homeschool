import {
	AdminAddUserToGroupCommand,
	AdminCreateUserCommand,
	AdminDeleteUserCommand,
	AdminListGroupsForUserCommand,
	AdminRemoveUserFromGroupCommand,
	CognitoIdentityProviderClient,
	ListUsersCommand,
	type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import type {
	AppSyncIdentityCognito,
	AppSyncResolverHandler,
} from "aws-lambda";
import type { Schema } from "../../data/resource";
import { GROUPS, type Group, normalizeGroups } from "../groups";

type Member = Schema["Member"]["type"];

type Args = {
	email?: string;
	username?: string;
	groups?: string[];
};

const client = new CognitoIdentityProviderClient();
// Injected by Amplify because this function has access to the auth resource.
const UserPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;

async function groupsFor(username: string): Promise<Group[]> {
	const { Groups } = await client.send(
		new AdminListGroupsForUserCommand({ UserPoolId, Username: username }),
	);
	return (Groups ?? []).map((g) => g.GroupName as Group);
}

function toMember(user: UserType, groups: Group[]): Member {
	return {
		username: user.Username ?? "",
		email: user.Attributes?.find((a) => a.Name === "email")?.Value ?? null,
		status: user.UserStatus ?? null,
		enabled: user.Enabled ?? null,
		groups,
		createdAt: user.UserCreateDate?.toISOString() ?? null,
	};
}

async function listMembers(): Promise<Member[]> {
	const users: UserType[] = [];
	let PaginationToken: string | undefined;
	do {
		const page = await client.send(
			new ListUsersCommand({ UserPoolId, PaginationToken }),
		);
		users.push(...(page.Users ?? []));
		PaginationToken = page.PaginationToken;
	} while (PaginationToken);

	return Promise.all(
		users.map(async (u) => toMember(u, await groupsFor(u.Username ?? ""))),
	);
}

async function setGroups(username: string, wanted: Group[]): Promise<void> {
	const current = await groupsFor(username);
	for (const g of wanted.filter((g) => !current.includes(g))) {
		await client.send(
			new AdminAddUserToGroupCommand({
				UserPoolId,
				Username: username,
				GroupName: g,
			}),
		);
	}
	for (const g of current.filter((g) => !wanted.includes(g))) {
		await client.send(
			new AdminRemoveUserFromGroupCommand({
				UserPoolId,
				Username: username,
				GroupName: g,
			}),
		);
	}
}

async function findMember(username: string): Promise<Member> {
	const member = (await listMembers()).find((m) => m.username === username);
	if (!member) throw new Error("Member not found.");
	return member;
}

export const handler: AppSyncResolverHandler<Args, unknown> = async (event) => {
	// AppSync already restricts these operations to the ADMIN group.
	const caller = (event.identity as AppSyncIdentityCognito).username;
	const args = event.arguments;

	switch (event.info.fieldName) {
		case "listMembers":
			return listMembers();

		case "inviteMember": {
			const groups = normalizeGroups(args.groups ?? []);
			const { User } = await client.send(
				new AdminCreateUserCommand({
					UserPoolId,
					Username: args.email,
					UserAttributes: [
						{ Name: "email", Value: args.email },
						{ Name: "email_verified", Value: "true" },
					],
					DesiredDeliveryMediums: ["EMAIL"],
				}),
			);
			if (!User?.Username) throw new Error("Could not create the user.");
			await setGroups(User.Username, groups);
			return toMember(User, groups);
		}

		case "setMemberGroups": {
			const username = args.username ?? "";
			const groups = normalizeGroups(args.groups ?? []);
			// Keeps at least one admin: nobody can demote themselves.
			if (username === caller && !groups.includes(GROUPS.admin)) {
				throw new Error("You can't remove your own admin role.");
			}
			await setGroups(username, groups);
			return findMember(username);
		}

		case "removeMember": {
			if (args.username === caller) {
				throw new Error("You can't remove yourself.");
			}
			await client.send(
				new AdminDeleteUserCommand({ UserPoolId, Username: args.username }),
			);
			return true;
		}

		default:
			throw new Error(`Unknown operation: ${event.info.fieldName}`);
	}
};
