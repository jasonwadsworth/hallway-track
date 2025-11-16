# Frontend Account Environments Design

## Overview

This design implements account-specific environment configuration for the frontend build system using Vite's built-in mode functionality. The solution allows different AWS accounts to have their own environment files and generates builds in separate directories, enabling clean multi-account deployments without manual configuration changes.

## Architecture

The solution leverages Vite's native environment file loading and extends the build configuration to support:

- **Account-Specific Environment Files**: Using Vite's `.env.[mode]` pattern
- **Dynamic Output Directories**: Configuring build output based on the selected mode
- **Build Script Integration**: Extending package.json scripts to support account modes
- **Clean Separation**: Each account gets its own build artifacts in separate directories

## Components and Interfaces

### Environment File Structure

The frontend will support multiple environment files organized by account:

```
frontend/
├── .env.example                 # Example configuration template (committed)
├── .env.123456789012           # Production account config
├── .env.987654321098           # Staging account config
├── .env.development.local      # Local development (gitignored)
└── .gitignore                  # Excludes .env to prevent conflicts
```

**Important**: The base `.env` file will be removed/gitignored to prevent conflicts. Each account must have its complete configuration in its own `.env.[account-id]` file.

### Vite Configuration Updates

**Location**: `frontend/vite.config.ts`

The Vite configuration will be enhanced to:
- Detect the current mode (account ID)
- Set the build output directory based on the mode
- Provide clear feedback about which configuration is being used

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Determine output directory based on mode
  const outputDir = mode && mode !== 'development' && mode !== 'production'
    ? `dist/${mode}`
    : 'dist'

  console.log(`Building for mode: ${mode || 'default'}`)
  console.log(`Output directory: ${outputDir}`)

  return {
    plugins: [react()],
    build: {
      outDir: outputDir,
      emptyOutDir: true
    }
  }
})
```

### Package.json Script Updates

**Location**: `frontend/package.json`

New build scripts will be added to support account-specific builds:

```json
{
  "scripts": {
    "build": "vite build",
    "build:account": "vite build --mode",
    "build:clean": "rm -rf dist/*"
  }
}
```

Usage examples:
- `npm run build` - Default build to `dist/`
- `npm run build:account 123456789012` - Build for account to `dist/123456789012/`
- `npm run build:clean` - Clean all build directories

## Data Models

### Environment File Content Structure

Each account-specific environment file will contain:

```properties
# Account: [Account Name/Description]
# Environment: [Production/Staging/etc]

VITE_USER_POOL_ID=us-west-2_xxxxxxxxx
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_GRAPHQL_ENDPOINT=https://xxxxxxxxxx.appsync-api.us-west-2.amazonaws.com/graphql
VITE_AWS_REGION=us-west-2

# Optional: Account-specific feature flags
VITE_CUSTOM_DOMAIN=example.com
VITE_ENVIRONMENT_NAME=production
```

### Build Output Structure

The build system will generate the following directory structure:

```
frontend/dist/
├── 123456789012/          # Production account build
│   ├── index.html
│   ├── assets/
│   └── ...
├── 987654321098/          # Staging account build
│   ├── index.html
│   ├── assets/
│   └── ...
└── index.html             # Default build (if no mode specified)
```

## Error Handling

### Missing Environment File
- **Trigger**: Build command specifies a mode but `.env.[mode]` doesn't exist
- **Response**: Build should fail with clear error message since no fallback `.env` exists
- **Enhancement**: Add custom validation in Vite config to check for required environment file

### Invalid Mode Parameter
- **Trigger**: Mode parameter contains invalid characters or is malformed
- **Response**: Sanitize mode parameter and validate against expected account ID format
- **Fallback**: Use default build configuration

### Build Directory Conflicts
- **Trigger**: Multiple builds targeting the same output directory
- **Response**: `emptyOutDir: true` ensures clean builds
- **Safety**: Preserve other account directories during build

## Testing Strategy

### Build Validation Tests
- Test default build (no mode) outputs to `dist/`
- Test account-specific builds output to correct directories
- Verify environment variables are correctly loaded for each mode
- Test build script error handling

### Environment File Tests
- Validate each account environment file loads correctly
- Test fallback behavior when account file is missing
- Verify development.local is ignored during account builds

### Integration Tests
- Test full deployment pipeline with account-specific builds
- Verify CDK can consume builds from correct directories
- Test cleanup and rebuild scenarios

## Implementation Approach

### Phase 1: Vite Configuration
1. Update `vite.config.ts` to support dynamic output directories
2. Add mode detection and logging
3. Configure build options for account-specific outputs

### Phase 2: Environment Files
1. Create example account environment files
2. Update `.gitignore` to handle new environment files appropriately
3. Create documentation for environment file management

### Phase 3: Build Scripts
1. Update `package.json` with new build commands
2. Add build validation and error handling
3. Create helper scripts for common build operations

### Phase 4: Integration
1. Update deployment documentation
2. Integrate with existing CDK deployment process
3. Test end-to-end deployment workflow

## CDK Integration

The CDK deployment process will need to be updated to consume builds from the correct directory:

```typescript
// In CDK stack
const buildPath = accountId ? `frontend/dist/${accountId}` : 'frontend/dist'
```

This ensures the CDK deployment picks up the correct build artifacts for the target account.

## Security Considerations

### Environment File Management
- Account-specific `.env` files should be committed to version control (they contain non-sensitive config)
- `.env.development.local` should be gitignored to prevent accidental commits
- Sensitive values should still use AWS Secrets Manager, not environment files

### Build Artifact Security
- Each account's build artifacts are isolated in separate directories
- No cross-contamination between account configurations
- Build process validates environment file integrity

## Migration Strategy

### Existing Deployment Update
1. Create account-specific environment files from current `.env`
2. Move current `.env` to `.env.example` as template
3. Add `.env` to `.gitignore` to prevent future conflicts
4. Update deployment scripts to use account-specific build commands
5. Test new build process with each account configuration

### Breaking Changes
- **No Default Build**: Builds without a mode will fail since no base `.env` exists
- **Required Mode**: All production builds must specify an account mode
- **Complete Configuration**: Each account file must contain all required variables

## Documentation Updates

### Developer Documentation
- Environment file naming conventions
- Build command usage examples
- Troubleshooting guide for common issues

### Deployment Documentation
- Account-specific build process
- Integration with CDK deployment
- Environment file management best practices