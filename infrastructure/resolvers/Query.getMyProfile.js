import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({
      PK: `USER#${ctx.identity.sub}`,
      SK: 'PROFILE'
    })
  };
}

export function response(ctx) {
  return ctx.result;
}
