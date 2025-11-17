import { useState } from 'react';
import { ProfileView } from './ProfileView';
import { ProfileEditModal } from './ProfileEditModal';
import { ContactLinkModal } from './ContactLinkModal';
import { PullToRefresh } from './PullToRefresh';
import './Profile.css';

export function Profile() {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  const handleEditProfile = () => {
    setShowEditModal(true);
  };

  const handleManageLinks = () => {
    setShowContactModal(true);
  };

  const handleProfileSaved = () => {
    // Trigger profile data refresh
    window.dispatchEvent(new Event('profileDataChanged'));
  };

  const handleRefresh = async () => {
    window.dispatchEvent(new Event('profileDataChanged'));
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="profile-container">
        <div className="profile-header-actions">
          <h1>My Profile</h1>
          <div className="profile-action-buttons">
            <button onClick={handleEditProfile} className="btn-primary">
              Edit Profile
            </button>
            <button onClick={handleManageLinks} className="btn-secondary">
              Manage Contact Links
            </button>
          </div>
        </div>

        <div className="profile-content">
          <ProfileView />
        </div>

        <ProfileEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={handleProfileSaved}
        />

        <ContactLinkModal
          isOpen={showContactModal}
          onClose={() => setShowContactModal(false)}
        />
      </div>
    </PullToRefresh>
  );
}
