import { ICredentialType, NodePropertyTypes } from 'n8n-workflow';

export class ViemCredentials implements ICredentialType {
	name = 'viemCredentials';
	displayName = 'Viem Credentials';

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
