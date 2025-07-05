import { ICredentialType, NodePropertyTypes } from 'n8n-workflow';

export class TheGraphCredentials implements ICredentialType {
	name = 'theGraphCredentials';
	displayName = 'The Graph Credentials';

	properties = [
		{
			displayName: 'Api Key',
			name: 'apiKey',
			type: 'string' as NodePropertyTypes,
			default: '',
			typeOptions: {
				password: true,
			},
			required: true,
		},
		{
			displayName: 'Api Token',
			name: 'apiToken',
			type: 'string' as NodePropertyTypes,
			default: '',
			typeOptions: {
				password: true,
			},
			required: true,
		},
	];
}
