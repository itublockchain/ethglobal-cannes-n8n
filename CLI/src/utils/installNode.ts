import { exec } from "node:child_process";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function installNode(node: string) {
  await exec(`echo "Installing ${node} node..."`);

  await sleep(1500 + 1000 * Math.random() * 3);

  // TODO: implement the node installation
}
