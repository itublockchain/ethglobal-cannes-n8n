import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function installNode(node: string) {
  try {
    const nodesDir = path.resolve(__dirname, "../../../Nodes");
    const sourceDir = path.join(nodesDir, node);
    const homeDir = process.env.HOME || process.env.USERPROFILE || "~";
    const n8nCustomDir = path.join(homeDir, ".n8n", "nodes");

    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Node ${node} not found in ${sourceDir}`);
    }

    const packageJsonPath = path.join(sourceDir, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`package.json not found in ${sourceDir}`);
    }

    await execAsync(`mkdir -p ${n8nCustomDir}`);

    await execAsync(`cd ${sourceDir} && npm install`);

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const packageName = packageJson.name;

    if (!fs.existsSync(path.join(n8nCustomDir, "node_modules"))) {
      await execAsync(`mkdir -p ${path.join(n8nCustomDir, "node_modules")}`);
    }

    const targetPath = path.join(n8nCustomDir, "node_modules", packageName);
    if (fs.existsSync(targetPath)) {
      await execAsync(`rm -rf ${targetPath}`);
    }

    await execAsync(`cp -r ${sourceDir} ${targetPath}`);
    await execAsync(`cd ${targetPath} && npm install`);

    const finalPath = path.join(n8nCustomDir, "node_modules", packageName);
    if (fs.existsSync(finalPath)) {
      try {
        await execAsync(`cd ${finalPath} && npm run build`);
      } catch (buildError) {
        console.warn(`Build failed for ${node}, but package is installed`);
      }
    }
  } catch (error) {
    console.error(`Error installing node ${node}:`, error);
    throw error;
  }
}
