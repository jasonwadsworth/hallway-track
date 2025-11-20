import { util } from '@aws-appsync/utils';

export function request(ctx) {
    return {
        operation: 'GetItem',
        key: util.dynamodb.toMapValues({
            PK: `USER#${ctx.args.userId}`,
            SK: 'PROFILE',
        }),
    };
}

export function response(ctx) {
    if (!ctx.result) {
        util.error('User not found');
    }

    return {
        id: ctx.result.id,
        displayName: ctx.result.displayName,
        gravatarHash: ctx.result.gravatarHash,
        profilePictureUrl: ctx.result.profilePictureUrl,
    };
}
