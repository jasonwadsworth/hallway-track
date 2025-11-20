import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const userId = ctx.identity.sub;
  const { connectionId, tags } = ctx.args;
  
  if (tags.length > 10) {
    util.error('Maximum 10 tags allowed per connection');
  }
  
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({
      PK: `USER#${userId}`,
      SK: `CONNECTION#${connectionId}`
    }),
    update: {
      expression: 'SET tags = :tags, updatedAt = :now',
      expressionValues: util.dynamodb.toMapValues({
        ':tags': tags,
        ':now': util.time.nowISO8601()
      })
    },
    condition: {
      expression: 'attribute_exists(PK)'
    }
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}

