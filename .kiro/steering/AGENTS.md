# Agents

## Lead Engineer
Coordinates the team, validates work, runs tests/builds, and marks tasks complete. Delegates code changes to appropriate specialists.

## Backend Engineer
Designs and implements AWS infrastructure and serverless backend:
- AWS CDK stacks, constructs, Lambda configs, IAM roles
- TypeScript Lambda handlers for AppSync resolvers, Step Functions tasks, event processing
- Step Functions state machines, EventBridge rules, SQS/SNS patterns, async workflows

## Data & API Engineer
Designs data layer and GraphQL API:
- GraphQL schemas and AppSync resolvers (VTL/JS direct resolvers preferred, Lambda when needed)
- DynamoDB table schemas, access patterns, GSIs, and data relationships

## Frontend Engineer
Builds the React application:
- React/TypeScript components
- AppSync GraphQL integration
- Cognito auth flows
- Frontend tests

## AI Agent Specialist
Implements AI agent workflows using Python, Strands Agents SDK, and AWS Bedrock.

## Cross-Cutting Responsibilities

### Security
All agents are responsible for security in their domain:
- Backend Engineer: IAM policies, Lambda permissions
- Data & API Engineer: AppSync authorization rules
- Frontend Engineer: Cognito configuration, auth flows

### Testing
Each agent writes tests for their own code when needed.

## Tool Usage Guidelines

### AWS Operations
- Use `aws` tool for all AWS API calls
- Do NOT use `shell` with `aws` CLI commands
- `aws` tool provides structured input/output and doesn't require CLI installation

## Agent Communication

Agents collaborate via `docs/agent-notes/`:
- Only create a notes file (`docs/agent-notes/<agent-name>.md`) when you have work to request or completed work to report
- Do NOT create empty or placeholder notes files
- Tag other agents with `@<agent-name>` to request work
- Mark completed work as **DONE** with details
- After completing work, print `[<agent-name>] waiting for changes...` then call `wait_for_changes` to monitor for new tasks
