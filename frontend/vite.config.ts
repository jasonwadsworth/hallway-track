import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'fs'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }: { mode: string }) => {
  // Determine output directory based on mode
  const outputDir = mode && mode !== 'development' && mode !== 'production'
    ? `dist/${mode}`
    : 'dist'

  // Validate environment file exists for account-specific modes
  if (mode && mode !== 'development' && mode !== 'production') {
    // Validate account ID format (12-digit number)
    if (!/^\d{12}$/.test(mode)) {
      throw new Error(
        `Invalid account ID format: ${mode}. ` +
        `Account ID must be a 12-digit number (e.g., 123456789012).`
      )
    }

    const envFile = resolve(process.cwd(), `.env.${mode}`)
    if (!existsSync(envFile)) {
      throw new Error(
        `Environment file .env.${mode} not found. ` +
        `Please create this file with the required configuration for account ${mode}.`
      )
    }
    console.log(`✓ Building for account: ${mode}`)
    console.log(`✓ Using environment file: .env.${mode}`)
  } else {
    console.log(`✓ Building with default configuration`)
  }

  console.log(`✓ Output directory: ${outputDir}`)

  return {
    plugins: [react()],
    build: {
      outDir: outputDir,
      emptyOutDir: true
    }
  }
})
