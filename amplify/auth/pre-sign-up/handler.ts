import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import type { PreSignUpTriggerHandler } from "aws-lambda";
import { hasParent } from "../parents";

const client = new CognitoIdentityProviderClient();

// Self sign-up is open only until the first parent exists. After that, new
// accounts must be created by a parent (AdminCreateUser is not blocked here).
export const handler: PreSignUpTriggerHandler = async (event) => {
	if (
		event.triggerSource === "PreSignUp_SignUp" &&
		(await hasParent(client, event.userPoolId))
	) {
		throw new Error(
			"Sign-up is invite-only. Ask a parent in this household to add you.",
		);
	}
	return event;
};
