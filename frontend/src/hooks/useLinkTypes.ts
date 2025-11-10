import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { LinkType } from '../types';
import { getLinkTypes } from '../graphql/queries';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';

// In-memory cache for link types
let cachedLinkTypes: LinkType[] | null = null;
let cachePromise: Promise<LinkType[]> | null = null;

export function useLinkTypes() {
  const [linkTypes, setLinkTypes] = useState<LinkType[]>(cachedLinkTypes || []);
  const [loading, setLoading] = useState(!cachedLinkTypes);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If we already have cached data, use it
    if (cachedLinkTypes) {
      setLinkTypes(cachedLinkTypes);
      setLoading(false);
      return;
    }

    // If a fetch is already in progress, wait for it
    if (cachePromise) {
      cachePromise
        .then((types) => {
          setLinkTypes(types);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || 'Failed to load link types');
          setLoading(false);
        });
      return;
    }

    // Start a new fetch
    const fetchLinkTypes = async (): Promise<LinkType[]> => {
      const client = generateClient();
      try {
        setLoading(true);
        setError(null);
        const response = await client.graphql({
          query: getLinkTypes,
        });
        if ('data' in response && response.data) {
          const types = response.data.getLinkTypes;
          // Sort by sortOrder to ensure consistent display
          const sortedTypes = [...types].sort((a, b) => a.sortOrder - b.sortOrder);
          cachedLinkTypes = sortedTypes;
          return sortedTypes;
        }
        throw new Error('No data returned from getLinkTypes');
      } catch (err) {
        console.error('Error loading link types:', err);
        const errorInfo = parseGraphQLError(err);

        if (errorInfo.isAuthError) {
          await handleAuthError();
        }

        throw new Error(errorInfo.message);
      }
    };

    cachePromise = fetchLinkTypes();

    cachePromise
      .then((types) => {
        setLinkTypes(types);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load link types');
        setLoading(false);
      })
      .finally(() => {
        cachePromise = null;
      });
  }, []);

  return { linkTypes, loading, error };
}
