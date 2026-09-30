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
		Amplify.configure(resourceConfig, libraryOptions);
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
