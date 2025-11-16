import { useState } from 'react';
import { Modal } from './Modal';
import type { PublicProfile } from '../types';
import './ConnectionRequestModal.css';

const MAX_NOTE_LENGTH = 1000;
const MAX_TAG_LENGTH = 50;
const MAX_TAGS = 10;

interface ConnectionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: PublicProfile;
  onSubmit: (note: string, tags: string[]) => Promise<void>;
  initialNote?: string;
  initialTags?: string[];
  isEditing?: boolean;
}

export function ConnectionRequestModal({
  isOpen,
  onClose,
  recipient,
  onSubmit,
  initialNote = '',
  initialTags = [],
  isEditing = false,
}: ConnectionRequestModalProps) {
  const [note, setNote] = useState(initialNote);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddTag = () => {
    if (!newTag.trim()) {
      return;
    }

    if (newTag.length > MAX_TAG_LENGTH) {
      setError(`Tag must be ${MAX_TAG_LENGTH} characters or less`);
      return;
    }

    if (tags.length >= MAX_TAGS) {
      setError(`Maximum ${MAX_TAGS} tags allowed`);
      return;
    }

    const tagToAdd = newTag.trim();
    if (tags.includes(tagToAdd)) {
      setError('Tag already added');
      return;
    }

    setTags([...tags, tagToAdd]);
    setNewTag('');
    setError(null);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async () => {
    if (note.length > MAX_NOTE_LENGTH) {
      setError(`Note must be ${MAX_NOTE_LENGTH} characters or less`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit(note, tags);
      onClose();
    } catch (err) {
      console.error('Error submitting connection request:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setNote(initialNote);
      setTags(initialTags);
      setNewTag('');
      setError(null);
      onClose();
    }
  };

  const noteCharCount = note.length;
  const isNoteValid = noteCharCount <= MAX_NOTE_LENGTH;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit Connection Request' : 'Send Connection Request'}
    >
      <div className="connection-request-modal">
        {/* Recipient Info */}
        <div className="recipient-info">
          <img
            src={`https://www.gravatar.com/avatar/${recipient.gravatarHash}?s=48&d=identicon`}
            alt={recipient.displayName}
            className="recipient-avatar"
          />
          <span className="recipient-name">{recipient.displayName}</span>
        </div>

        {/* Notes Section */}
        <div className="form-section">
          <label htmlFor="note-input" className="form-label">
            Add a note (optional)
          </label>
          <textarea
            id="note-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Met at AWS Summit, discussed serverless architecture..."
            maxLength={MAX_NOTE_LENGTH}
            rows={4}
            className={`note-textarea ${!isNoteValid ? 'invalid' : ''}`}
            disabled={loading}
          />
          <div className={`character-counter ${!isNoteValid ? 'invalid' : ''}`}>
            {noteCharCount} / {MAX_NOTE_LENGTH} characters
          </div>
        </div>

        {/* Tags Section */}
        <div className="form-section">
          <label htmlFor="tag-input" className="form-label">
            Add tags (optional)
          </label>
          <div className="tag-input-section">
            <input
              id="tag-input"
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={handleTagKeyPress}
              placeholder="e.g., AWS Summit, Serverless"
              maxLength={MAX_TAG_LENGTH}
              disabled={loading || tags.length >= MAX_TAGS}
              className="tag-input"
            />
            <button
              onClick={handleAddTag}
              disabled={loading || !newTag.trim() || tags.length >= MAX_TAGS}
              className="btn-add-tag"
              type="button"
            >
              Add
            </button>
          </div>

          {tags.length > 0 && (
            <div className="tags-list">
              {tags.map((tag, index) => (
                <div key={index} className="tag-item">
                  <span className="tag-text">{tag}</span>
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    disabled={loading}
                    className="btn-remove-tag"
                    aria-label={`Remove tag ${tag}`}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="tag-count">
            {tags.length} / {MAX_TAGS} tags
          </p>
        </div>

        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}

        {/* Actions */}
        <div className="modal-actions">
          <button
            onClick={handleClose}
            disabled={loading}
            className="btn-cancel"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !isNoteValid}
            className="btn-submit"
            type="button"
          >
            {loading ? 'Sending...' : isEditing ? 'Save Changes' : 'Send Request'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
