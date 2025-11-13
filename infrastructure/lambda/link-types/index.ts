import { LINK_TYPES } from './linkTypeConfig';

interface LinkTypeResponse {
  id: string;
  label: string;
  imageUrl: string;
  placeholder: string;
  urlPattern?: string;
  sortOrder: number;
}

export const handler = async (): Promise<LinkTypeResponse[]> => {
  // Return link types with relative image URLs (served from frontend)
  return LINK_TYPES;
};
