import {
	AdminAddUserToGroupCommand,
	CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import type { PostConfirmationTriggerHandler } from "aws-lambda";
import { hasAdmin } from "../admins";
import { GROUPS } from "../groups";

const client = new CognitoIdentityProviderClient();

// Bootstrap: the first user to confirm their account becomes ADMIN + PARENT.
export const handler: PostConfirmationTriggerHandler = async (event) => {
	if (
		event.triggerSource === "PostConfirmation_ConfirmSignUp" &&
		!(await hasAdmin(client, event.userPoolId))
	) {
		for (const group of [GROUPS.admin, GROUPS.parent]) {
			await client.send(
				new AdminAddUserToGroupCommand({
					UserPoolId: event.userPoolId,
					Username: event.userName,
					GroupName: group,
				}),
			);
		}
	}
	return event;
};
