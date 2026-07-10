
    export type RemoteKeys = 'REMOTE_ALIAS_IDENTIFIER/ActionTelegram';
    type PackageType<T> = T extends 'REMOTE_ALIAS_IDENTIFIER/ActionTelegram' ? typeof import('REMOTE_ALIAS_IDENTIFIER/ActionTelegram') :any;