import { App } from "@octokit/app";
import { handleWorkflowFailure } from "./handler.js";

export const app = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n"),
  webhooks: {
    secret: process.env.GITHUB_WEBHOOK_SECRET,
  },
});

// Listen for workflow_run completed events
app.webhooks.on("workflow_run.completed", async ({ octokit, payload }) => {
  const { workflow_run, repository } = payload;

  // Only care about failures
  if (workflow_run.conclusion !== "failure") return;

  console.log(`❌ Failure detected: ${workflow_run.name} in ${repository.full_name}`);

  await handleWorkflowFailure({
    octokit,
    owner: repository.owner.login,
    repo: repository.name,
    workflowRun: workflow_run,
  });
});

app.webhooks.onError((error) => {
  console.error("Webhook error:", error.message);
});
