import { ICredentialType, NodePropertyTypes } from 'n8n-workflow';

export class HardhatCredentials implements ICredentialType {
	name = 'hardhatCredentials';
	displayName = 'Hardhat Credentials';

	properties = [
		{
			displayName: 'Private Key',
			name: 'privateKey',
			type: 'string' as NodePropertyTypes,
			default: '',
			typeOptions: {
				password: true,
			},
			required: true,
		},
	];
}
