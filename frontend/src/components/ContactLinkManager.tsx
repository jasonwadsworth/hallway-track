import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { ContactLink, LinkType } from '../types';
import { getMyProfile } from '../graphql/queries';
import { addContactLink, updateContactLink, removeContactLink } from '../graphql/mutations';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import { useLinkTypes } from '../hooks/useLinkTypes';
import './ContactLinkManager.css';

export function ContactLinkManager() {
  const [contactLinks, setContactLinks] = useState<ContactLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedLinkType, setSelectedLinkType] = useState<LinkType | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newLinkVisible, setNewLinkVisible] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Fetch link types using the custom hook
  const { linkTypes, loading: loadingLinkTypes, error: linkTypesError } = useLinkTypes();

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

  // Filter out link types that already exist in user's contact links
  function getAvailableLinkTypes(): LinkType[] {
    const existingLabels = contactLinks.map(link => link.label);
    return linkTypes.filter(type => !existingLabels.includes(type.label));
  }

  // Helper function to get image URL for a link label
  function getLinkImage(label: string): string | null {
    const linkType = linkTypes.find(type => type.label === label);
    return linkType?.imageUrl || null;
  }

  // Validate URL based on link type's urlPattern
  function validateUrl(url: string, linkType: LinkType | null): boolean {
    if (!linkType || !linkType.urlPattern) {
      return true; // No pattern to validate against
    }

    try {
      const regex = new RegExp(linkType.urlPattern);
      return regex.test(url);
    } catch (err) {
      console.error('Invalid URL pattern:', err);
      return true; // If pattern is invalid, don't block submission
    }
  }

  async function handleAddContactLink(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedLinkType) {
      setError('Please select a link type');
      return;
    }

    if (!newUrl.trim()) {
      setError('URL is required');
      return;
    }

    if (contactLinks.length >= 10) {
      setError('Maximum 10 contact links allowed');
      return;
    }

    // Validate URL against link type pattern
    if (!validateUrl(newUrl.trim(), selectedLinkType)) {
      setUrlError(`Please enter a valid ${selectedLinkType.label} URL (e.g., ${selectedLinkType.placeholder})`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setUrlError(null);
      const client = generateClient();
      const response = await client.graphql({
        query: addContactLink,
        variables: {
          label: selectedLinkType.label,
          url: newUrl.trim(),
          visible: newLinkVisible,
        },
      });
      if ('data' in response && response.data) {
        setContactLinks(response.data.addContactLink.contactLinks);
        setSelectedLinkType(null);
        setNewUrl('');
        setNewLinkVisible(true);
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

  const availableLinkTypes = getAvailableLinkTypes();

  if (loading || loadingLinkTypes) {
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
        {!showAddForm && availableLinkTypes.length > 0 && (
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-add"
          >
            + Add Link
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
      {linkTypesError && <div className="error-message">{linkTypesError}</div>}

      {showAddForm && (
        <form onSubmit={handleAddContactLink} className="add-link-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="linkType">Link Type</label>
              <select
                id="linkType"
                value={selectedLinkType?.id || ''}
                onChange={(e) => {
                  const linkType = linkTypes.find(type => type.id === e.target.value);
                  setSelectedLinkType(linkType || null);
                  setUrlError(null);
                }}
                required
                disabled={submitting || loadingLinkTypes}
                className={selectedLinkType ? 'link-type-select has-selection' : 'link-type-select'}
              >
                <option value="">Select a link type...</option>
                {availableLinkTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="url">URL</label>
              <input
                type="text"
                id="url"
                value={newUrl}
                onChange={(e) => {
                  setNewUrl(e.target.value);
                  setUrlError(null);
                }}
                placeholder={selectedLinkType?.placeholder || 'https://...'}
                required
                disabled={submitting}
              />
              {urlError && <span className="field-error">{urlError}</span>}
            </div>
          </div>
          <div className="form-group visibility-group">
            <label className="visibility-checkbox">
              <input
                type="checkbox"
                checked={newLinkVisible}
                onChange={(e) => setNewLinkVisible(e.target.checked)}
                disabled={submitting}
              />
              <span className="checkbox-label">
                {newLinkVisible ? '👁️ Make visible to connections' : '🔒 Keep hidden (only visible to you)'}
              </span>
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setSelectedLinkType(null);
                setNewUrl('');
                setNewLinkVisible(true);
                setError(null);
                setUrlError(null);
              }}
              className="btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || !selectedLinkType}
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
          {contactLinks.map((link) => {
            const imageUrl = getLinkImage(link.label);
            return (
              <div key={link.id} className={`contact-link-item ${link.visible ? 'visible' : 'hidden'}`}>
                <div className="link-info">
                  <div className="link-header">
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt={link.label}
                        className="link-type-image"
                        width="24"
                        height="24"
                        loading="lazy"
                      />
                    )}
                    <span className="link-label">{link.label}</span>
                  </div>
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
            );
          })}
        </div>
      )}

      <div className="manager-footer">
        <p className="info-text">
          {contactLinks.length}/{linkTypes.length} links • Hidden links are only visible to you
          {availableLinkTypes.length === 0 && contactLinks.length > 0 && ' • All link types added'}
        </p>
      </div>
    </div>
  );
}
