import AdmZip from "adm-zip";

const MAX_LOG_LINES = 150;
const ERROR_PATTERNS = /error|failed|failure|exception|fatal|exit code|cannot|unable|not found|denied|timeout/i;

export async function fetchFailedLogs({ octokit, owner, repo, runId }) {
  // Step 1: Get all jobs for this run to find which one failed
  const { data: jobsData } = await octokit.rest.actions.listJobsForWorkflowRun({
    owner,
    repo,
    run_id: runId,
  });

  const failedJob = jobsData.jobs.find((j) => j.conclusion === "failure");
  if (!failedJob) return { logs: null };

  const failedStep = failedJob.steps?.find((s) => s.conclusion === "failure");

  // Step 2: Download the full log zip
  // GitHub returns a redirect, so we need to follow it
  let zipBuffer;
  try {
    const response = await octokit.rest.actions.downloadWorkflowRunLogs({
      owner,
      repo,
      run_id: runId,
    });

    // The response URL is a redirect — fetch it directly
    const logResponse = await fetch(response.url);
    const arrayBuffer = await logResponse.arrayBuffer();
    zipBuffer = Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("Failed to download logs:", err.message);
    return { logs: null };
  }

  // Step 3: Extract the failed job's log from the zip
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  // Log files are named like: "JobName/1_StepName.txt"
  // Find the file matching the failed job
  const jobLogEntry = entries.find((e) => {
    const name = e.entryName.toLowerCase();
    return name.includes(failedJob.name.toLowerCase().replace(/\s+/g, "_")) ||
           name.startsWith(`${failedJob.name}/`) ||
           entries.length === 1; // Only one log file
  }) || entries[entries.length - 1]; // Fallback to last file

  if (!jobLogEntry) return { logs: null };

  const rawLog = jobLogEntry.getData().toString("utf-8");
  const trimmedLogs = extractSignal(rawLog);

  return {
    logs: trimmedLogs,
    failedJobName: failedJob.name,
    failedStepName: failedStep?.name || null,
  };
}

function extractSignal(rawLog) {
  const lines = rawLog.split("\n");

  // Strip GitHub's timestamp prefix from each line: "2024-01-01T00:00:00.000Z "
  const cleanLines = lines.map((l) => l.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s/, "").trimEnd());

  // Collect error-adjacent lines (error line + 3 lines of context around it)
  const errorLineIndices = new Set();
  cleanLines.forEach((line, i) => {
    if (ERROR_PATTERNS.test(line)) {
      for (let j = Math.max(0, i - 2); j <= Math.min(cleanLines.length - 1, i + 3); j++) {
        errorLineIndices.add(j);
      }
    }
  });

  // Always include the last MAX_LOG_LINES lines (most failures are at the end)
  const lastLines = new Set(
    Array.from({ length: MAX_LOG_LINES }, (_, i) => cleanLines.length - MAX_LOG_LINES + i).filter(
      (i) => i >= 0
    )
  );

  const relevantIndices = new Set([...errorLineIndices, ...lastLines]);
  const relevantLines = [...relevantIndices]
    .sort((a, b) => a - b)
    .map((i) => cleanLines[i])
    .filter((l) => l.trim()); // Remove blank lines

  return relevantLines.join("\n");
}
