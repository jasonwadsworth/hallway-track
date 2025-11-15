# Account-Based Configuration Design

## Overview

This design implements account-based configuration loading for the CDK application, allowing different AWS accounts to have their own specific configurations while maintaining a clean separation between configuration management and stack implementation.

## Architecture

The solution introduces a configuration manager that loads account-specific settings and passes them to the stack through props. The architecture follows these principles:

- **Single Source of Truth**: Configuration manager is the only component that reads configuration files
- **Fail Fast**: Application terminates immediately if configuration is missing or invalid
- **Clean Separation**: Stack receives configuration through props, never directly accessing config files
- **Account-Based**: Configuration is organized by AWS account ID for multi-environment support

## Components and Interfaces

### Configuration Manager

**Location**: `infrastructure/config.ts`

The configuration manager will be refactored to:
- Load configurations organized by AWS account ID
- Validate that the current account has a configuration
- Return account-specific configuration or throw descriptive errors
- Export a function that takes an account ID and returns the configuration

```typescript
interface AccountConfiguration {
  [accountId: string]: HallwayTrackConfig;
}

interface ConfigurationManager {
  getConfigForAccount(accountId: string): HallwayTrackConfig;
}
```

### Updated App Structure

**Location**: `infrastructure/app.ts`

The app will:
- Read `CDK_DEFAULT_ACCOUNT` environment variable
- Call the configuration manager to get account-specific config
- Handle configuration errors with descriptive messages
- Pass configuration to stack through props

### Stack Props Interface

**Location**: `infrastructure/stacks/hallway-track-stack.ts`

The existing `HallwayTrackStackProps` interface already accepts configuration through props, so no changes needed to the interface itself.

## Data Models

### Account Configuration Structure

The configuration file will be restructured to support multiple accounts:

```typescript
// Before (current structure)
export const config: HallwayTrackConfig = {
  badges: { ... }
};

// After (new structure)
const accountConfigurations: AccountConfiguration = {
  "123456789012": {
    badges: {
      makerUserId: "user-123",
      reinventDates: [...]
    }
  },
  "987654321098": {
    badges: {
      makerUserId: "user-456",
      reinventDates: [...]
    }
  }
};
```

### Configuration Loading Function

```typescript
export function getConfigForAccount(accountId: string): HallwayTrackConfig {
  if (!accountId) {
    throw new Error('CDK_DEFAULT_ACCOUNT environment variable is required');
  }

  const config = accountConfigurations[accountId];
  if (!config) {
    throw new Error(`No configuration found for account ${accountId}. Please add configuration for this account in infrastructure/config.ts`);
  }

  return config;
}
```

## Error Handling

### Missing Account ID
- **Trigger**: `CDK_DEFAULT_ACCOUNT` environment variable is undefined or empty
- **Response**: Throw error with message explaining the required environment variable
- **Exit**: Application terminates before attempting deployment

### Missing Account Configuration
- **Trigger**: No configuration exists for the current account ID
- **Response**: Throw error with account ID and instructions for adding configuration
- **Exit**: Application terminates before attempting deployment

### Invalid Configuration
- **Trigger**: Configuration exists but is malformed or incomplete
- **Response**: Throw error with specific validation failure details
- **Exit**: Application terminates before attempting deployment

## Testing Strategy

### Unit Tests
- Test configuration loading for valid account IDs
- Test error handling for missing account IDs
- Test error handling for missing account configurations
- Test configuration validation logic

### Integration Tests
- Test full app initialization with valid configurations
- Test app failure scenarios with invalid configurations
- Verify stack receives correct configuration values

### Manual Testing
- Deploy with different account configurations
- Verify error messages are clear and actionable
- Test with missing CDK_DEFAULT_ACCOUNT environment variable

## Implementation Approach

### Phase 1: Configuration Manager
1. Refactor `config.ts` to support account-based structure
2. Implement `getConfigForAccount` function with error handling
3. Add configuration validation logic

### Phase 2: App Integration
1. Update `app.ts` to use configuration manager
2. Add environment variable validation
3. Implement error handling and messaging

### Phase 3: Testing & Validation
1. Test with multiple account configurations
2. Verify error scenarios work correctly
3. Validate stack receives proper configuration

## Migration Notes

Since backward compatibility is not required, the existing single configuration structure will be completely replaced with the account-based structure. Existing deployments will need to:

1. Update their configuration file to use the new account-based format
2. Ensure their account ID is included in the configuration
3. Redeploy using the updated CDK app

## Security Considerations

- Configuration files should not contain sensitive data (use AWS Secrets Manager for secrets)
- Account IDs are not sensitive and can be stored in configuration files
- Environment variables should be validated before use
- Configuration validation should prevent injection attacks through malformed config