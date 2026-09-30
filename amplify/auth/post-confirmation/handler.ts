import {
	AdminAddUserToGroupCommand,
	CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import type { PostConfirmationTriggerHandler } from "aws-lambda";
import { GROUPS } from "../groups";
import { hasParent } from "../parents";

const client = new CognitoIdentityProviderClient();

// Bootstrap: the first user to confirm their account becomes a PARENT.
export const handler: PostConfirmationTriggerHandler = async (event) => {
	if (
		event.triggerSource === "PostConfirmation_ConfirmSignUp" &&
		!(await hasParent(client, event.userPoolId))
	) {
		await client.send(
			new AdminAddUserToGroupCommand({
				UserPoolId: event.userPoolId,
				Username: event.userName,
				GroupName: GROUPS.parent,
			}),
		);
	}
	return event;
};
