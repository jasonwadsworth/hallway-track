import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { ContactLink } from '../types';
import { getMyProfile } from '../graphql/queries';
import { addContactLink, updateContactLink, removeContactLink } from '../graphql/mutations';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import './ContactLinkManager.css';

export function ContactLinkManager() {
  const [contactLinks, setContactLinks] = useState<ContactLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadContactLinks();
  }, []);

  async function loadContactLinks() {
    const client = generateClient();
    try {
      setLoading(true);
      setError(null);
      const response = await client.graphql({
        query: getMyProfile,
      });
      if ('data' in response && response.data) {
        setContactLinks(response.data.getMyProfile.contactLinks);
      }
    } catch (err) {
      console.error('Error loading contact links:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAddContactLink(e: React.FormEvent) {
    e.preventDefault();

    if (!newLabel.trim() || !newUrl.trim()) {
      setError('Label and URL are required');
      return;
    }

    if (contactLinks.length >= 10) {
      setError('Maximum 10 contact links allowed');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const client = generateClient();
      const response = await client.graphql({
        query: addContactLink,
        variables: {
          label: newLabel.trim(),
          url: newUrl.trim(),
        },
      });
      if ('data' in response && response.data) {
        setContactLinks(response.data.addContactLink.contactLinks);
        setNewLabel('');
        setNewUrl('');
        setShowAddForm(false);
      }
    } catch (err) {
      console.error('Error adding contact link:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleVisibility(link: ContactLink) {
    const client = generateClient();
    try {
      setError(null);
      const response = await client.graphql({
        query: updateContactLink,
        variables: {
          contactLinkId: link.id,
          visible: !link.visible,
        },
      });
      if ('data' in response && response.data) {
        setContactLinks(response.data.updateContactLink.contactLinks);
      }
    } catch (err) {
      console.error('Error updating contact link:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    }
  }

  async function handleRemoveContactLink(linkId: string) {
    if (!confirm('Are you sure you want to remove this contact link?')) {
      return;
    }

    try {
      setError(null);
      const client = generateClient();
      const response = await client.graphql({
        query: removeContactLink,
        variables: {
          contactLinkId: linkId,
        },
      });
      if ('data' in response && response.data) {
        setContactLinks(response.data.removeContactLink.contactLinks);
      }
    } catch (err) {
      console.error('Error removing contact link:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    }
  }

  if (loading) {
    return (
      <div className="contact-link-manager">
        <LoadingSpinner message="Loading contact links..." />
      </div>
    );
  }

  return (
    <div className="contact-link-manager">
      <div className="manager-header">
        <h3>Contact Links</h3>
        {!showAddForm && contactLinks.length < 10 && (
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-add"
          >
            + Add Link
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {showAddForm && (
        <form onSubmit={handleAddContactLink} className="add-link-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="label">Label</label>
              <input
                type="text"
                id="label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g., LinkedIn, Email, GitHub"
                required
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="url">URL</label>
              <input
                type="url"
                id="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://..."
                required
                disabled={submitting}
              />
            </div>
          </div>
          <div className="form-actions">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewLabel('');
                setNewUrl('');
                setError(null);
              }}
              className="btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Link'}
            </button>
          </div>
        </form>
      )}

      {contactLinks.length === 0 ? (
        <div className="empty-state">
          <p>No contact links yet. Add your first link to share with connections!</p>
        </div>
      ) : (
        <div className="contact-links-list">
          {contactLinks.map((link) => (
            <div key={link.id} className={`contact-link-item ${link.visible ? 'visible' : 'hidden'}`}>
              <div className="link-info">
                <span className="link-label">{link.label}</span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-url"
                >
                  {link.url}
                </a>
              </div>
              <div className="link-actions">
                <label className="visibility-toggle">
                  <input
                    type="checkbox"
                    checked={link.visible}
                    onChange={() => handleToggleVisibility(link)}
                  />
                  <span className="toggle-label">
                    {link.visible ? '👁️ Visible' : '🔒 Hidden'}
                  </span>
                </label>
                <button
                  onClick={() => handleRemoveContactLink(link.id)}
                  className="btn-delete"
                  title="Remove link"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="manager-footer">
        <p className="info-text">
          {contactLinks.length}/10 links • Hidden links are only visible to you
        </p>
      </div>
    </div>
  );
}
