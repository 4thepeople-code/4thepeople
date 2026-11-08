/**
 * Formats a Cloudinary image URL by inserting transformation parameters right after /upload/.
 *
 * @param url - The Cloudinary image URL or any image URL string
 * @param transformString - Cloudinary transformation parameters (e.g., "w_1600,h_600,c_fill,g_auto,q_auto,f_auto")
 * @returns Transformed Cloudinary URL, original URL if non-Cloudinary, or null if empty/invalid URL
 */
export function getCloudinaryUrl(
  url: string | null | undefined,
  transformString?: string
): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;
  if (!transformString) return trimmedUrl;

  // Insert transformations immediately after /upload/ for Cloudinary URLs
  if (trimmedUrl.includes('/upload/')) {
    if (trimmedUrl.includes(`/upload/${transformString}/`)) {
      return trimmedUrl;
    }
    return trimmedUrl.replace('/upload/', `/upload/${transformString}/`);
  }

  return trimmedUrl;
}

export const CLOUDINARY_TRANSFORMS = {
  COVER: 'w_1600,h_600,c_fill,g_auto,q_auto,f_auto',
  LOGO: 'w_400,h_400,c_fill,g_auto,q_auto,f_auto',
  SQUARE: 'w_400,h_400,c_fill,g_auto,q_auto,f_auto',
} as const;

export default getCloudinaryUrl;

