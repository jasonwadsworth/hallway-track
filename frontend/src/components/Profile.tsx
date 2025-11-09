import { useState } from 'react';
import { ProfileView } from './ProfileView';
import { ProfileEdit } from './ProfileEdit';
import { ContactLinkManager } from './ContactLinkManager';
import { QRCodeDisplay } from './QRCodeDisplay';
import './Profile.css';

type ProfileTab = 'view' | 'edit' | 'links' | 'qr';

export function Profile() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('view');

  return (
    <div className="profile-container">
      <div className="profile-tabs">
        <button
          className={`tab ${activeTab === 'view' ? 'active' : ''}`}
          onClick={() => setActiveTab('view')}
        >
          Profile
        </button>
        <button
          className={`tab ${activeTab === 'edit' ? 'active' : ''}`}
          onClick={() => setActiveTab('edit')}
        >
          Edit Profile
        </button>
        <button
          className={`tab ${activeTab === 'links' ? 'active' : ''}`}
          onClick={() => setActiveTab('links')}
        >
          Contact Links
        </button>
        <button
          className={`tab ${activeTab === 'qr' ? 'active' : ''}`}
          onClick={() => setActiveTab('qr')}
        >
          My QR Code
        </button>
      </div>

      <div className="profile-content">
        {activeTab === 'view' && (
          <ProfileView onEdit={() => setActiveTab('edit')} />
        )}
        {activeTab === 'edit' && (
          <ProfileEdit
            onCancel={() => setActiveTab('view')}
            onSave={() => setActiveTab('view')}
          />
        )}
        {activeTab === 'links' && <ContactLinkManager />}
        {activeTab === 'qr' && <QRCodeDisplay />}
      </div>
    </div>
  );
}
