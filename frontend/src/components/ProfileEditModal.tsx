import { Modal } from './Modal'
import { ProfileEdit } from './ProfileEdit'

interface ProfileEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export function ProfileEditModal({ isOpen, onClose, onSave }: ProfileEditModalProps) {
  const handleSave = () => {
    onSave()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile">
      <ProfileEdit onCancel={onClose} onSave={handleSave} />
    </Modal>
  )
}