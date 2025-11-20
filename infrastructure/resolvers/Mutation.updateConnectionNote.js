import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const userId = ctx.identity.sub;
  const { connectionId, note } = ctx.args;
  
  // Validate note length
  if (note && note.length > 1000) {
    util.error('Note must be 1000 characters or less');
  }
  
  // Normalize note value
  const noteValue = note === null || note === undefined || note.trim() === '' ? '' : note.trim();
  
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({
      PK: `USER#${userId}`,
      SK: `CONNECTION#${connectionId}`
    }),
    update: {
      expression: 'SET note = :note, updatedAt = :now',
      expressionValues: util.dynamodb.toMapValues({
        ':note': noteValue,
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
