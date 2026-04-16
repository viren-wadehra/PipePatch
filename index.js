import "dotenv/config";
import express from "express";
import { createNodeMiddleware } from "@octokit/app";
import { app as githubApp } from "./github.js";
import { handleWorkflowFailure } from "./handler.js";

const server = express();
server.use(express.json());

// GitHub App webhook middleware (handles signature verification automatically)
server.use(createNodeMiddleware(githubApp));

// Health check
server.get("/", (req, res) => res.json({ status: "ok", app: "CI/CD Failure Explainer" }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Listening for GitHub webhooks...`);
});
