import { Modal } from './Modal'
import { ContactLinkManager } from './ContactLinkManager'

interface ContactLinkModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ContactLinkModal({ isOpen, onClose }: ContactLinkModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Contact Links">
      <ContactLinkManager />
    </Modal>
  )
}