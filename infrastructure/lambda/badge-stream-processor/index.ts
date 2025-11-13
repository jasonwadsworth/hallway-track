import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const eventBridge = new EventBridgeClient({});
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

interface EventEntry {
  Source: string;
  DetailType: string;
  Detail: string;
  EventBusName: string;
}

export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  const events: EventEntry[] = [];

  try {
    for (const record of event.Records) {
      const processedEvents = processRecord(record);
      events.push(...processedEvents);
    }

    // Publish events to EventBridge in batches
    if (events.length > 0) {
      console.log(`Publishing ${events.length} events to EventBridge`);
      await eventBridge.send(new PutEventsCommand({ Entries: events }));
      console.log('Events published successfully');
    }
  } catch (error) {
    console.error('Error processing stream records:', error);
    throw error;
  }
}

function processRecord(record: DynamoDBRecord): EventEntry[] {
  const events: EventEntry[] = [];

  if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
    const newImage = record.dynamodb?.NewImage;
    const oldImage = record.dynamodb?.OldImage;

    if (!newImage) {
      return events;
    }

    // Check if this is a connection creation
    if (newImage.PK?.S?.startsWith('USER#') && newImage.SK?.S?.startsWith('CONNECTION#')) {
      console.log('Processing connection creation event');

      events.push({
        Source: 'hallway-track.connections',
        DetailType: 'ConnectionCreated',
        Detail: JSON.stringify({
          connectionId: newImage.id?.S || '',
          userId: newImage.userId?.S || '',
          connectedUserId: newImage.connectedUserId?.S || '',
          timestamp: newImage.createdAt?.S || new Date().toISOString()
        }),
        EventBusName: EVENT_BUS_NAME
      });
    }

    // Check if this is a user connection count update
    if (newImage.PK?.S?.startsWith('USER#') && newImage.SK?.S === 'PROFILE') {
      const newCount = parseInt(newImage.connectionCount?.N || '0');
      const oldCount = parseInt(oldImage?.connectionCount?.N || '0');

      if (newCount !== oldCount) {
        console.log(`Processing connection count update: ${oldCount} -> ${newCount}`);

        events.push({
          Source: 'hallway-track.users',
          DetailType: 'UserConnectionCountUpdated',
          Detail: JSON.stringify({
            userId: newImage.id?.S || '',
            connectionCount: newCount,
            previousCount: oldCount,
            timestamp: newImage.updatedAt?.S || new Date().toISOString()
          }),
          EventBusName: EVENT_BUS_NAME
        });
      }
    }
  }

  return events;
}
