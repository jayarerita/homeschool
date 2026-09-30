import { defineBackend } from "@aws-amplify/backend";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { tutorTurn } from "./functions/tutor-turn/resource";
import { storage } from "./storage/resource";

export const backend = defineBackend({
	auth,
	data,
	storage,
	tutorTurn,
});

// The tutor reads household uploads and keeps verbatim conversation
// transcripts under tutor/. Granted here rather than in defineStorage's access
// rules, which would make storage depend on the data stack (a cycle).
const tutorLambda = backend.tutorTurn.resources.lambda;
const bucket = backend.storage.resources.bucket;
bucket.grantRead(tutorLambda, "uploads/*");
bucket.grantReadWrite(tutorLambda, "tutor/*");
backend.tutorTurn.addEnvironment("HOUSEHOLD_BUCKET", bucket.bucketName);

// Claude in Amazon Bedrock (the default provider; see
// amplify/functions/tutor-turn/resource.ts).
tutorLambda.addToRolePolicy(
	new PolicyStatement({
		actions: ["bedrock-mantle:CreateInference"],
		resources: ["*"],
	}),
);
