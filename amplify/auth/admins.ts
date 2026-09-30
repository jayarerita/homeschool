import {
	type CognitoIdentityProviderClient,
	ListUsersInGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { GROUPS } from "./groups";

export async function hasAdmin(
	client: CognitoIdentityProviderClient,
	userPoolId: string,
): Promise<boolean> {
	const { Users } = await client.send(
		new ListUsersInGroupCommand({
			UserPoolId: userPoolId,
			GroupName: GROUPS.admin,
			Limit: 1,
		}),
	);
	return (Users?.length ?? 0) > 0;
}
