# Agents

## Lead Engineer
Coordinates the team, validates work, runs tests/builds, and marks tasks complete. Delegates code changes to appropriate specialists.

## CDK Expert
Designs and implements AWS CDK infrastructure - stacks, constructs, Lambda configs, IAM roles, and cross-stack wiring.

## AppSync Architect
Designs GraphQL schemas and implements AppSync resolvers (VTL/JS direct resolvers preferred, Lambda when needed).

## Lambda Implementer
Implements TypeScript Lambda handlers for AppSync resolvers, Step Functions tasks, and event processing.

## AI Agent Specialist
Implements AI agent workflows using Python, Strands Agents SDK, and AWS Bedrock.

## Workflow Orchestrator
Designs Step Functions state machines, EventBridge rules, SQS/SNS patterns, and async workflows.

## Data Modeling
Designs DynamoDB table schemas, access patterns, GSIs, and data relationships.

## Frontend Specialist
Builds React/TypeScript components, integrates with AppSync GraphQL, and handles Cognito auth flows.

## Security Reviewer
Reviews IAM policies, authorization rules, Cognito configuration, and AI guardrails.

## Testing Specialist
Writes unit tests (Vitest/Jest) and integration tests against deployed AWS resources.

## Agent Communication

Agents collaborate via `docs/agent-notes/`:
- Each agent has a notes file: `docs/agent-notes/<agent-name>.md`
- Tag other agents with `@<agent-name>` to request work
- Mark completed work as **DONE** with details
- After completing work, call `wait_for_changes` to monitor for new tasks
