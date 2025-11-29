import { util } from '@aws-appsync/utils';

export function request(ctx) {
    const prev = ctx.prev.result;

    // If already returned (own profile case), skip
    if (prev.id) {
        return {};
    }

    return {
        operation: 'GetItem',
        key: util.dynamodb.toMapValues({
            PK: `USER#${prev.profileUserId}`,
            SK: 'PROFILE',
        }),
    };
}

export function response(ctx) {
    const prev = ctx.prev.result;

    // If already returned (own profile case), return it
    if (prev.id) {
        return prev;
    }

    if (!ctx.result) {
        util.error('User not found');
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
