import { ContactLinkItem } from './ContactLinkItem';
import type { ContactLink } from '../types';
import './ContactLinkList.css';

interface ContactLinkListProps {
  links: ContactLink[];
  className?: string;
  emptyMessage?: string;
}

export function ContactLinkList({
  links,
  className = '',
  emptyMessage = 'No contact links available'
}: ContactLinkListProps) {
  const visibleLinks = links.filter(link => link.visible);

  if (visibleLinks.length === 0) {
    return (
      <div className={`contact-links-empty ${className}`}>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className={`contact-links-list ${className}`}>
      {visibleLinks.map(link => (
        <ContactLinkItem
          key={link.id}
          link={link}
        />
      ))}
    </ul>
  );
}