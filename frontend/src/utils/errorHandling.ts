import { signOut } from 'aws-amplify/auth';

export interface ErrorInfo {
  message: string;
  isAuthError: boolean;
  shouldRetry: boolean;
}

export function parseGraphQLError(error: unknown): ErrorInfo {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Check for authentication errors
  if (
    errorMessage.includes('Unauthorized') ||
    errorMessage.includes('Not Authorized') ||
    errorMessage.includes('401') ||
    errorMessage.includes('authentication')
  ) {
    return {
      message: 'Your session has expired. Please sign in again.',
      isAuthError: true,
      shouldRetry: false,
    };
  }

  // Check for network errors
  if (
    errorMessage.includes('Network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('timeout')
  ) {
    return {
      message: 'Network error. Please check your connection and try again.',
      isAuthError: false,
      shouldRetry: true,
    };
  }

  // Check for duplicate connection errors
  if (
    errorMessage.includes('duplicate') ||
    errorMessage.includes('already connected')
  ) {
    return {
      message: 'You are already connected with this user.',
      isAuthError: false,
      shouldRetry: false,
    };
  }

  // Check for not found errors
  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    return {
      message: 'The requested resource was not found.',
      isAuthError: false,
      shouldRetry: false,
    };
  }

  // Check for validation errors
  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return {
      message: 'Invalid input. Please check your data and try again.',
      isAuthError: false,
      shouldRetry: false,
    };
  }

  // Generic error
  return {
    message: 'Something went wrong. Please try again.',
    isAuthError: false,
    shouldRetry: true,
  };
}

export async function handleAuthError(): Promise<void> {
  try {
    await signOut();
    window.location.href = '/';
  } catch (error) {
    console.error('Error signing out:', error);
    window.location.href = '/';
  }
}
