import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Query',
    query: {
      expression: 'PK = :pk AND begins_with(SK, :sk)',
      expressionValues: util.dynamodb.toMapValues({
        ':pk': `USER#${ctx.identity.sub}`,
        ':sk': 'CONNECTION#'
      })
    },
    scanIndexForward: false
  };
}

export function response(ctx) {
  return ctx.result.items;
}
