import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { execSync } from 'child_process';

export class HardhatCompile implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Hardhat: Compile',
		name: 'hardhatCompile',
		group: ['transform'],
		version: 1,
		description: "This node allows you to compile a contract from it's code.",
		defaults: {
			name: 'Hardhat: Compile',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		codex: {
			categories: ['Hardhat', 'Blockchain', 'Transaction', 'Wallet'],
			alias: ['hardhat', 'blockchain', 'transaction', 'wallet'],
			subcategories: {
				hardhat: ['Hardhat', 'Blockchain', 'Transaction', 'Wallet'],
			},
		},
		properties: [
			{
				displayName: 'Contract Code',
				name: 'contractCode',
				type: 'string',
				default: '',
				required: true,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const contractCode = this.getNodeParameter('contractCode', i) as string;

			async function copyDirectory(src: string, dest: string) {
				await fs.promises.mkdir(dest, { recursive: true });
				const entries = await fs.promises.readdir(src, { withFileTypes: true });

				for (const entry of entries) {
					const srcPath = path.join(src, entry.name);
					const destPath = path.join(dest, entry.name);

					if (entry.isDirectory()) {
						await copyDirectory(srcPath, destPath);
					} else {
						await fs.promises.copyFile(srcPath, destPath);
					}
				}
			}

			const contractHash = crypto.createHash('sha256').update(contractCode).digest('hex');

			const root_path = __dirname;
			const executeDir = path.join(root_path, 'execute');
			const projectDir = path.join(executeDir, contractHash);
			const templateDir = path.join(root_path, 'template');
			const contractsDir = path.join(projectDir, 'contracts');
			const contractFile = path.join(contractsDir, `${contractHash}.sol`);

			// Proje dizinini oluştur ve template'i kopyala
			if (!fs.existsSync(projectDir)) {
				await fs.promises.mkdir(executeDir, { recursive: true });
				await copyDirectory(templateDir, projectDir);
			}

			// npm install sadece package.json değiştiyse çalıştır
			const nodeModulesPath = path.join(projectDir, 'node_modules');
			if (!fs.existsSync(nodeModulesPath)) {
				execSync('npm install', { cwd: projectDir, stdio: 'inherit' });
			}

			// Contract dosyasını yaz
			await fs.promises.writeFile(contractFile, contractCode);

			// Compile işlemi
			execSync('npx hardhat compile', { cwd: projectDir, stdio: 'inherit' });

			const artifactsPath = path.join(projectDir, 'artifacts', 'contracts', `${contractHash}.sol`);
			const artifactsFiles = fs.readdirSync(artifactsPath);
			const jsonFiles = artifactsFiles.filter(
				(file: string) => file.endsWith('.json') && !file.endsWith('.dbg.json'),
			);

			if (jsonFiles.length === 0) {
				throw new Error('Compiled contract artifacts not found');
			}

			const allContracts: {
				[contractName: string]: { abi: any[]; bytecode: string };
			} = {};

			for (const jsonFile of jsonFiles) {
				const contractArtifacts = fs.readFileSync(path.join(artifactsPath, jsonFile), 'utf8');

				const contractArtifactsJson = JSON.parse(contractArtifacts);
				const contractName = contractArtifactsJson.contractName;

				if (contractName && contractArtifactsJson.abi && contractArtifactsJson.bytecode) {
					allContracts[contractName] = {
						abi: contractArtifactsJson.abi,
						bytecode: contractArtifactsJson.bytecode,
					};
				}
			}

			await execSync(`rm -rf execute/${contractHash}`);

			returnData.push({
				json: {
					allContracts,
				},
			});
		}

		return [returnData];
	}
}
