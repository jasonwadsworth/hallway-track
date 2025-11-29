import { util } from '@aws-appsync/utils';

export function request(ctx) {
    const connectedUserId = ctx.source.connectedUserId;

    return {
        operation: 'GetItem',
        key: util.dynamodb.toMapValues({
            PK: `USER#${connectedUserId}`,
            SK: 'PROFILE',
        }),
    };
}

export function response(ctx) {
    if (!ctx.result) {
        return null;
    }

    const user = ctx.result;
    const visibleContactLinks = (user.contactLinks || []).filter((link) => link.visible);

    return {
        id: user.id,
        displayName: user.displayName,
        gravatarHash: user.gravatarHash,
        profilePictureUrl: user.profilePictureUrl,
        uploadedProfilePictureUrl: user.uploadedProfilePictureUrl,
        contactLinks: visibleContactLinks,
        badges: user.badges || [],
    };
}
