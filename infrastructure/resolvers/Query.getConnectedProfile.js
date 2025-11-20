import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const requestingUserId = ctx.identity.sub;
  const profileUserId = ctx.args.userId;
  
  // If viewing own profile, just get the user
  if (requestingUserId === profileUserId) {
    return {
      operation: 'GetItem',
      key: util.dynamodb.toMapValues({
        PK: `USER#${profileUserId}`,
        SK: 'PROFILE'
      })
    };
  }
  
  // BatchGetItem to fetch both connection and user
  return {
    operation: 'BatchGetItem',
    tables: {
      'hallway-track-connections': {
        keys: [
          util.dynamodb.toMapValues({
            PK: `USER#${requestingUserId}`,
            SK: `CONNECTION#${profileUserId}`
          })
        ],
        consistentRead: false
      },
      'hallway-track-users': {
        keys: [
          util.dynamodb.toMapValues({
            PK: `USER#${profileUserId}`,
            SK: 'PROFILE'
          })
        ],
        consistentRead: false
      }
    }
  };
}

export function response(ctx) {
  const requestingUserId = ctx.identity.sub;
  const profileUserId = ctx.args.userId;
  
  // If viewing own profile
  if (requestingUserId === profileUserId) {
    if (!ctx.result) {
      util.error('User not found');
    }
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
  
  // Check if connection exists
  const connections = ctx.result.data['hallway-track-connections'] || [];
  if (connections.length === 0) {
    util.error('Not authorized to view this user\'s connected profile', 'Unauthorized');
  }
  
  // Get user data
  const users = ctx.result.data['hallway-track-users'] || [];
  if (users.length === 0) {
    util.error('User not found');
  }
  
  const user = users[0];
  const visibleContactLinks = (user.contactLinks || []).filter(link => link.visible);
  
  return {
    id: user.id,
    displayName: user.displayName,
    gravatarHash: user.gravatarHash,
    contactLinks: visibleContactLinks,
    badges: user.badges || []
  };
}
