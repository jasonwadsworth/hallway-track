import { getLinkTypeIcon } from '../utils/linkTypeIcons';
import type { ContactLink } from '../types';
import './ContactLinkItem.css';

interface ContactLinkItemProps {
  link: ContactLink;
  className?: string;
}

export function ContactLinkItem({ link, className = '' }: ContactLinkItemProps) {
  // Use the label as the type for icon mapping
  const iconSrc = getLinkTypeIcon(link.label);

  return (
    <li className={`contact-link-item ${className}`}>
      <img
        src={iconSrc}
        alt={`${link.label} icon`}
        className="contact-link-icon"
        width="20"
        height="20"
        loading="lazy"
        onError={(e) => {
          // Fallback to website icon if the specific icon fails to load
          const target = e.target as HTMLImageElement;
          if (target.src !== '/link-type-images/website.svg') {
            target.src = '/link-type-images/website.svg';
          }
        }}
      />
      <div className="contact-link-content">
        <span className="contact-link-label">{link.label}:</span>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="contact-link-url"
        >
          {link.url}
        </a>
      </div>
    </li>
  );
}