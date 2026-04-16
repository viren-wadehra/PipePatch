import { fetchFailedLogs } from "./logs.js";
import { explainFailure } from "./gemini.js";

export async function handleWorkflowFailure({ octokit, owner, repo, workflowRun }) {
  try {
    // 1. Fetch and extract the failure logs
    console.log(`📥 Fetching logs for run #${workflowRun.id}...`);
    const { logs, failedJobName, failedStepName } = await fetchFailedLogs({
      octokit,
      owner,
      repo,
      runId: workflowRun.id,
    });

    if (!logs) {
      console.log("⚠️  No logs found, skipping.");
      return;
    }

    // 2. Send to Gemini for explanation
    console.log(`🤖 Sending to Gemini...`);
    const explanation = await explainFailure({
      logs,
      workflowName: workflowRun.name,
      failedJobName,
      failedStepName,
      repoName: `${owner}/${repo}`,
    });

    // 3. Post the explanation as a check run annotation / commit comment
    console.log(`💬 Posting comment...`);
    await postComment({ octokit, owner, repo, workflowRun, explanation, failedJobName });

    console.log(`✅ Done for run #${workflowRun.id}`);
  } catch (err) {
    console.error(`Failed to handle workflow run #${workflowRun.id}:`, err.message);
  }
}

async function postComment({ octokit, owner, repo, workflowRun, explanation, failedJobName }) {
  const body = formatComment({ explanation, workflowRun, failedJobName });

  // Post as a commit comment on the head commit of the failed run
  await octokit.rest.repos.createCommitComment({
    owner,
    repo,
    commit_sha: workflowRun.head_sha,
    body,
  });
}

function formatComment({ explanation, workflowRun, failedJobName }) {
  const runUrl = workflowRun.html_url;
  const timestamp = new Date().toUTCString();

  return `## 🔍 CI/CD Failure Analysis

**Workflow:** \`${workflowRun.name}\`  
**Failed Job:** \`${failedJobName || "Unknown"}\`  
**Run:** [View full logs](${runUrl})

---

${explanation}

---
<sub>🤖 Analysed by CI/CD Explainer • ${timestamp}</sub>`;
}
