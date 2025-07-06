import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class EulerCredentials implements ICredentialType {
	name = 'eulerCredentials';
	displayName = 'Euler Finance Credentials';
	documentationUrl = 'https://docs.euler.finance/';
	properties: INodeProperties[] = [
		{
			displayName: 'Private Key',
			name: 'privateKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'Private key of the wallet to use for transactions (must start with 0x)',
			placeholder: '0x1234567890abcdef...',
		},
		{
			displayName: 'RPC URL',
			name: 'rpcUrl',
			type: 'string',
			default: '',
			description: 'Custom RPC URL (optional - will use chain default if not provided)',
			placeholder: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
		},
	];
}
