import { useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { Connection } from '../types';
import { addTagToConnection, removeTagFromConnection } from '../graphql/mutations';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import './TagManager.css';

const MAX_TAG_LENGTH = 30;
const MAX_TAGS = 10;

interface TagManagerProps {
  connection: Connection;
  onTagsUpdated: (updatedConnection: Connection) => void;
}

export function TagManager({ connection, onTagsUpdated }: TagManagerProps) {
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddTag() {
    if (!newTag.trim()) {
      return;
    }

    if (newTag.length > MAX_TAG_LENGTH) {
      setError(`Tag must be ${MAX_TAG_LENGTH} characters or less`);
      return;
    }

    if (connection.tags.length >= MAX_TAGS) {
      setError(`Maximum ${MAX_TAGS} tags allowed per connection`);
      return;
    }

    const tagToAdd = newTag.trim();

    // Optimistic update
    const optimisticConnection = {
      ...connection,
      tags: [...connection.tags, tagToAdd],
    };
    onTagsUpdated(optimisticConnection);
    setNewTag('');

    try {
      setLoading(true);
      setError(null);

      const client = generateClient();
      const response = await client.graphql({
        query: addTagToConnection,
        variables: {
          connectionId: connection.id,
          tag: tagToAdd,
        },
      });

      if ('data' in response && response.data) {
        const updatedConnection = {
          ...connection,
          tags: response.data.addTagToConnection.tags,
          updatedAt: response.data.addTagToConnection.updatedAt,
        };
        onTagsUpdated(updatedConnection);
      }
    } catch (err) {
      console.error('Error adding tag:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      // Revert optimistic update on error
      onTagsUpdated(connection);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveTag(tag: string) {
    // Optimistic update
    const optimisticConnection = {
      ...connection,
      tags: connection.tags.filter(t => t !== tag),
    };
    onTagsUpdated(optimisticConnection);

    try {
      setLoading(true);
      setError(null);

      const client = generateClient();
      const response = await client.graphql({
        query: removeTagFromConnection,
        variables: {
          connectionId: connection.id,
          tag: tag,
        },
      });

      if ('data' in response && response.data) {
        const updatedConnection = {
          ...connection,
          tags: response.data.removeTagFromConnection.tags,
          updatedAt: response.data.removeTagFromConnection.updatedAt,
        };
        onTagsUpdated(updatedConnection);
      }
    } catch (err) {
      console.error('Error removing tag:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      // Revert optimistic update on error
      onTagsUpdated(connection);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleAddTag();
    }
  }

  return (
    <div className="tag-manager">
      <div className="tag-input-section">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Add a tag (e.g., AWS Summit, Keynote)"
          maxLength={MAX_TAG_LENGTH}
          disabled={loading || connection.tags.length >= MAX_TAGS}
          className="tag-input"
        />
        <button
          onClick={handleAddTag}
          disabled={loading || !newTag.trim() || connection.tags.length >= MAX_TAGS}
          className="btn-add-tag"
        >
          {loading ? 'Adding...' : 'Add Tag'}
        </button>
      </div>

      {error && <div className="tag-error">{error}</div>}

      {connection.tags.length > 0 ? (
        <div className="tags-list">
          {connection.tags.map((tag, index) => (
            <div key={index} className="tag-item">
              <span className="tag-text">{tag}</span>
              <button
                onClick={() => handleRemoveTag(tag)}
                disabled={loading}
                className="btn-remove-tag"
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-tags">No tags yet. Add tags to remember context about this connection.</p>
      )}

      <p className="tag-count">
        {connection.tags.length} / {MAX_TAGS} tags
      </p>
    </div>
  );
}
