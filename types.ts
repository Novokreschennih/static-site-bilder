
export interface SiteFile {
  id: string;
  path: string;
  name: string;
  content: string | ArrayBuffer;
  type: string;
  objectUrl?: string;
}

export interface HtmlFile extends SiteFile {
  content: string; // Override content to be string for HTML files
  isMain: boolean;
  newFileName: string;
  placeholders: string[]; // For text placeholders
  placeholderValues: Record<string, string>;
  linkPlaceholders: Record<string, string>; // For link placeholders: maps key to target file ID
}
