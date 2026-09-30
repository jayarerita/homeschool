import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import type { PreSignUpTriggerHandler } from "aws-lambda";
import { hasAdmin } from "../admins";

const client = new CognitoIdentityProviderClient();

// Self sign-up is open only until the first admin exists. After that, new
// accounts are invited by an admin (AdminCreateUser is not blocked here).
export const handler: PreSignUpTriggerHandler = async (event) => {
	if (
		event.triggerSource === "PreSignUp_SignUp" &&
		(await hasAdmin(client, event.userPoolId))
	) {
		throw new Error(
			"Sign-up is invite-only. Ask an admin in this household to invite you.",
		);
	}
	return event;
};
