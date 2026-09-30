import {
	type CognitoIdentityProviderClient,
	ListUsersInGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { GROUPS } from "./groups";

export async function hasParent(
	client: CognitoIdentityProviderClient,
	userPoolId: string,
): Promise<boolean> {
	const { Users } = await client.send(
		new ListUsersInGroupCommand({
			UserPoolId: userPoolId,
			GroupName: GROUPS.parent,
			Limit: 1,
		}),
	);
	return (Users?.length ?? 0) > 0;
}
