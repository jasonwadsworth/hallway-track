import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const requestingUserId = ctx.identity.sub;
  const profileUserId = ctx.args.userId;
  
  // Allow viewing own profile
  if (requestingUserId === profileUserId) {
    return {
      operation: 'GetItem',
      key: util.dynamodb.toMapValues({
        PK: `USER#${profileUserId}`,
        SK: 'PROFILE'
      })
    };
  }
  
  // Check if connection exists
  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({
      PK: `USER#${requestingUserId}`,
      SK: `CONNECTION#${profileUserId}`
    })
  };
}

export function response(ctx) {
  const requestingUserId = ctx.identity.sub;
  const profileUserId = ctx.args.userId;
  
  // If viewing own profile, return the user data
  if (requestingUserId === profileUserId && ctx.result) {
    const user = ctx.result;
    const visibleContactLinks = (user.contactLinks || []).filter(link => link.visible);
    
    return {
      id: user.id,
      displayName: user.displayName,
      gravatarHash: user.gravatarHash,
      contactLinks: visibleContactLinks,
      badges: user.badges || []
    };
  }
  
  // If not connected, throw error
  if (!ctx.result) {
    util.error('Not authorized to view this user\'s connected profile', 'Unauthorized');
  }
  
  // Connection exists, pass to next function
  return { connectionExists: true, profileUserId };
}
