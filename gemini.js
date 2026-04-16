import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    temperature: 0.1, // Low temp for deterministic, factual debugging
    maxOutputTokens: 1024,
  },
});

export async function explainFailure({ logs, workflowName, failedJobName, failedStepName, repoName }) {
  const prompt = buildPrompt({ logs, workflowName, failedJobName, failedStepName, repoName });

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error("Gemini API error:", err.message);
    return "⚠️ Could not generate explanation — Gemini API error. Check the full logs linked above.";
  }
}

function buildPrompt({ logs, workflowName, failedJobName, failedStepName, repoName }) {
  return `You are an expert DevOps engineer analysing a failed GitHub Actions workflow. Be concise, specific, and actionable. Do not use vague language.

**Context**
- Repository: ${repoName}
- Workflow: ${workflowName}
- Failed Job: ${failedJobName || "Unknown"}
- Failed Step: ${failedStepName || "Unknown"}

**Failure Logs**
\`\`\`
${logs}
\`\`\`

Respond using this exact markdown format:

**🔴 Root Cause**
One clear sentence stating what went wrong.

**📖 Explanation**
2-3 sentences explaining why this happened in plain English. No jargon.

**🛠 Fix**
Numbered list of concrete steps to fix it. Include exact commands or code snippets where relevant.

**⚠️ Watch Out For**
One sentence about a related issue to check that developers often miss.

**Confidence:** [High / Medium / Low] — one sentence on why.`;
}
