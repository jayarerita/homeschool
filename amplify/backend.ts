import { defineBackend } from "@aws-amplify/backend";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { householdJobs } from "./functions/household-jobs/resource";
import { tutorTurn } from "./functions/tutor-turn/resource";
import { storage } from "./storage/resource";

export const backend = defineBackend({
	auth,
	data,
	storage,
	tutorTurn,
	householdJobs,
});

// The tutor reads household uploads and keeps verbatim conversation
// transcripts under tutor/. Granted here rather than in defineStorage's access
// rules, which would make storage depend on the data stack (a cycle).
const tutorLambda = backend.tutorTurn.resources.lambda;
const bucket = backend.storage.resources.bucket;
bucket.grantRead(tutorLambda, "uploads/*");
bucket.grantReadWrite(tutorLambda, "tutor/*");
// Worksheets the tutor writes (create_worksheet), readable by parents through
// the uploads/* storage rule.
bucket.grantPut(tutorLambda, "uploads/worksheets/*");
// The admin's AI provider choice (and Claude API key), written by
// household-jobs from Settings.
bucket.grantRead(tutorLambda, "system/ai-provider.json");
backend.tutorTurn.addEnvironment("HOUSEHOLD_BUCKET", bucket.bucketName);

// The household jobs (planner, reminders) read uploads through the tutor's
// tools, and keep the generated Web Push keys under system/.
const jobsLambda = backend.householdJobs.resources.lambda;
bucket.grantRead(jobsLambda, "uploads/*");
bucket.grantReadWrite(jobsLambda, "system/*");
bucket.grantPut(jobsLambda, "uploads/worksheets/*");
backend.householdJobs.addEnvironment("HOUSEHOLD_BUCKET", bucket.bucketName);

// Claude in Amazon Bedrock (the default provider; see
// amplify/functions/tutor-core/environment.ts).
for (const lambda of [tutorLambda, jobsLambda]) {
	lambda.addToRolePolicy(
		new PolicyStatement({
			actions: ["bedrock-mantle:CreateInference"],
			resources: ["*"],
		}),
	);
}

// Spoken replies for the speaker device and lessons (the speak query).
jobsLambda.addToRolePolicy(
	new PolicyStatement({
		actions: ["polly:SynthesizeSpeech"],
		resources: ["*"],
	}),
);

// Optional email notifications through Amazon SES (off until a sender address
// is set in household settings).
jobsLambda.addToRolePolicy(
	new PolicyStatement({
		actions: ["ses:SendEmail"],
		resources: ["*"],
	}),
);
