import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const initiatorUserId = ctx.source.initiatorUserId;
  
  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({
      PK: `USER#${initiatorUserId}`,
      SK: 'PROFILE'
    })
  };
}

export function response(ctx) {
  if (!ctx.result) {
    return null;
  }
  
  const user = ctx.result;
  
  return {
    id: user.id,
    displayName: user.displayName,
    gravatarHash: user.gravatarHash
  };
}
