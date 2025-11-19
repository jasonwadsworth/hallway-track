import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const userId = ctx.identity.sub;
  const contactLinkId = util.autoId();
  const visible = ctx.args.visible ?? true;
  
  const newContactLink = {
    id: contactLinkId,
    label: ctx.args.label,
    url: ctx.args.url,
    visible
  };
  
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({
      PK: `USER#${userId}`,
      SK: 'PROFILE'
    }),
    update: {
      expression: 'SET contactLinks = list_append(if_not_exists(contactLinks, :emptyList), :newLink), updatedAt = :updatedAt',
      expressionValues: util.dynamodb.toMapValues({
        ':newLink': [newContactLink],
        ':emptyList': [],
        ':updatedAt': util.time.nowISO8601()
      })
    },
    condition: {
      expression: '(attribute_not_exists(contactLinks) OR size(contactLinks) < :maxLinks)',
      expressionValues: util.dynamodb.toMapValues({
        ':maxLinks': 10
      })
    }
  };
}

export function response(ctx) {
  return ctx.result;
}
