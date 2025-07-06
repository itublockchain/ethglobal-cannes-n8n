#!/usr/bin/env node

import {
  intro,
  outro,
  confirm,
  spinner,
  multiselect,
  isCancel,
  cancel,
} from "@clack/prompts";
import color from "picocolors";

import { installNode, n8nNodesOptions } from "./utils";

async function main() {
  console.clear();
  intro(color.blueBright(color.inverse(color.bold(" n3XUS CLI "))));

  const n8nNodes = await multiselect({
    message: color.greenBright(color.bold("Select n8n nodes to install")),
    options: n8nNodesOptions,
  });

  if (isCancel(n8nNodes)) {
    cancel("Operation cancelled");
    return process.exit(0);
  }

  const shouldContinue = await confirm({
    message: "Do you want to continue?",
  });

  if (isCancel(shouldContinue)) {
    cancel("Operation cancelled");
    return process.exit(0);
  }

  // Install nodes
  const start = performance.now();

  const s = spinner();
  s.start(color.inverse(`Installing nodes...`));

  let installedNodes = 0;
  let currentNode = "";

  // Progress tracking için interval kullan
  const progressInterval = setInterval(() => {
    s.message(
      color.gray(
        `${installedNodes}/${n8nNodes.length} - ${currentNode} - Installing node`
      )
    );
  }, 100);

  await Promise.all(
    n8nNodes.map(async (node) => {
      currentNode = node;
      await installNode(node);
      installedNodes++;
    })
  );

  clearInterval(progressInterval);

  const end = performance.now();

  s.stop();

  outro(
    color.green(
      `(${installedNodes}/${
        n8nNodes.length
      }) Installation completed! ${color.cyan(
        `(${Math.round(end - start)}ms)`
      )}`
    )
  );
}

await main();
