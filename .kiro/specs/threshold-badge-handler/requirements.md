# Requirements Document

## Introduction

The badge system architecture is designed to be asynchronous, with DynamoDB streams triggering EventBridge events that are processed by badge handlers. Currently, the system has multiple separate badge handlers (VIP, triangle, maker, etc.) that all trigger on the same events, creating inefficiency. Additionally, threshold badges are awarded synchronously only in the connections Lambda, causing them to be missed when connections are created through the connection approval system. This feature implements a unified badge handler that consolidates all badge logic into a single Lambda function for better performance and consistency.

## Glossary

- **Unified Badge Handler**: A single EventBridge-triggered Lambda function that processes all badge types
- **UserConnectionCountUpdated Event**: EventBridge event published when a user's connection count changes
- **ConnectionCreated Event**: EventBridge event published when a new connection is established
- **Badge Types**: All badge categories including threshold, VIP, triangle, maker, early supporter, and event badges
- **Badge Stream Processor**: Existing Lambda that detects changes and publishes EventBridge events
- **Individual Badge Handlers**: Current separate Lambda functions for each badge type that will be consolidated

## Requirements

### Requirement 1

**User Story:** As a user who gets connections through any method (direct creation or approval system), I want to receive all applicable badges automatically, so that I get consistent badge rewards regardless of how connections are created.

#### Acceptance Criteria

1. WHEN a UserConnectionCountUpdated or ConnectionCreated event is published to EventBridge, THE Unified_Badge_Handler SHALL process the event and evaluate all badge types
2. WHEN a user qualifies for any badge for the first time, THE Unified_Badge_Handler SHALL award the appropriate badge
3. WHEN a user already has a badge, THE Unified_Badge_Handler SHALL not award duplicate badges
4. WHEN a user no longer qualifies for a badge, THE Unified_Badge_Handler SHALL remove badges they no longer qualify for
5. WHEN badge changes are made, THE Unified_Badge_Handler SHALL update the user's badge list in the database

### Requirement 2

**User Story:** As a system administrator, I want the badge system to be efficient and reliable, so that all users receive badges fairly while minimizing resource usage.

#### Acceptance Criteria

1. THE Unified_Badge_Handler SHALL process all badge types in a single Lambda invocation per event
2. THE Unified_Badge_Handler SHALL award badges for all types: threshold, VIP, triangle, maker, early supporter, and event badges
3. WHEN processing events, THE Unified_Badge_Handler SHALL handle errors gracefully and log appropriate information
4. THE Unified_Badge_Handler SHALL be idempotent to handle duplicate event processing
5. THE Unified_Badge_Handler SHALL complete processing within EventBridge timeout limits

### Requirement 3

**User Story:** As a developer maintaining the badge system, I want the unified badge handler to consolidate all badge logic, so that the system is more maintainable and efficient.

#### Acceptance Criteria

1. THE Unified_Badge_Handler SHALL listen for multiple event types from hallway-track.users and hallway-track.connections sources
2. THE Unified_Badge_Handler SHALL use the same DynamoDB tables and data structures as existing badge handlers
3. THE Unified_Badge_Handler SHALL consolidate logic from all existing individual badge handlers
4. WHEN the handler is deployed, THE existing individual badge handlers SHALL be removed to eliminate duplication
5. THE Unified_Badge_Handler SHALL be configured with appropriate EventBridge rules and IAM permissions