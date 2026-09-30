import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

export const client = generateClient<Schema>();

export type { Schema };

type Result<T> = {
	data: T;
	errors?: readonly { message: string }[] | null;
};

// Amplify Data returns GraphQL errors instead of throwing; React Query needs a
// rejected promise to show an error state.
export function unwrap<T>({ data, errors }: Result<T>): T {
	if (errors?.length) {
		throw new Error(errors.map((e) => e.message).join("; "));
	}
	return data;
}
