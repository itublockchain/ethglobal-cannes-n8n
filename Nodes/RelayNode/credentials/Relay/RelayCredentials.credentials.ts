import { ICredentialType, NodePropertyTypes } from 'n8n-workflow';

export class RelayCredentials implements ICredentialType {
	name = 'relayCredentials';
	displayName = 'Relay Credentials';

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
