import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../data/resource";

export type DataClient = ReturnType<typeof generateClient<Schema>>;

let clientPromise: Promise<DataClient> | undefined;

// Configured once per Lambda container. Amplify injects the GraphQL endpoint
// and IAM credentials into the function's environment.
export function dataClient(): Promise<DataClient> {
	clientPromise ??= (async () => {
		const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
			process.env as Parameters<typeof getAmplifyDataClientConfig>[0],
		);
		// Workaround for @aws-amplify/core 6.19.x: createAmplifyContext only
		// passes libraryOptions.Auth (the credentials provider that signs IAM
		// requests with this Lambda's role) to Auth when the resource config has
		// an Auth section. Without one every data call fails with "No
		// credentials". The Cognito values are never used: there is no token
		// provider, so the credentials provider is always asked directly.
		Amplify.configure(
			{
				...resourceConfig,
				Auth: { Cognito: { userPoolId: "unused", userPoolClientId: "unused" } },
			},
			libraryOptions,
		);
		return generateClient<Schema>();
	})();
	return clientPromise;
}

type Result<T> = {
	data: T;
	errors?: readonly { message: string }[] | null;
};

export function unwrap<T>({ data, errors }: Result<T>): T {
	if (errors?.length) {
		throw new Error(errors.map((e) => e.message).join("; "));
	}
	return data;
}
