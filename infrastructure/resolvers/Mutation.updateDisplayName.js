import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({
      PK: `USER#${ctx.identity.sub}`,
      SK: 'PROFILE'
    }),
    update: {
      expression: 'SET displayName = :displayName, updatedAt = :updatedAt',
      expressionValues: util.dynamodb.toMapValues({
        ':displayName': ctx.args.displayName,
        ':updatedAt': util.time.nowISO8601()
      })
    }
  };
}

export function response(ctx) {
  return ctx.result;
}
