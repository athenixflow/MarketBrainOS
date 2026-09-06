export interface ImageSource {
  type: 'image/avif' | 'image/webp';
  srcSet: string;
}

export interface ImageAsset {
  alt: string;
  width: number;
  height: number;
  sources: ImageSource[];
  fallback: string;
}

export interface VideoAsset {
  alt: string;
  width: number;
  height: number;
  mp4: string;
  mp4Mobile?: string;
  poster?: string;
  posterWebp?: string;
}
