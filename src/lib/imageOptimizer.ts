/**
 * Ultra-fast client-side image compression using HTML5 Canvas.
 * Reduces 5MB-15MB phone camera photos down to crisp ~60KB-120KB WebP/JPEG base64 strings.
 * Prevents UI freezes, memory spikes, and Firestore payload limits.
 */
export async function compressImage(
  fileOrBase64: File | string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If it's a File object
    if (typeof fileOrBase64 !== 'string') {
      if (!fileOrBase64.type.startsWith('image/')) {
        reject(new Error('Ficheiro inválido. Por favor selecione uma imagem legítima (JPG, PNG, WebP).'));
        return;
      }
      if (fileOrBase64.size > 25 * 1024 * 1024) {
        reject(new Error('A imagem é demasiado grande (máximo 25MB).'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Falha ao ler imagem'));
      reader.onload = (e) => {
        const src = e.target?.result as string;
        compressSrc(src, maxWidth, maxHeight, quality, resolve, reject);
      };
      reader.readAsDataURL(fileOrBase64);
    } else {
      compressSrc(fileOrBase64, maxWidth, maxHeight, quality, resolve, reject);
    }
  });
}

function compressSrc(
  src: string,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  resolve: (res: string) => void,
  reject: (err: any) => void
) {
  // Guard against non-image data URIs or malicious script injections
  if (typeof src !== 'string' || (!src.startsWith('data:image/') && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('blob:'))) {
    reject(new Error('Origem de imagem inválida ou insegura.'));
    return;
  }

  // If already a tiny SVG without scripts or small data URL (< 50KB), keep as is
  if (src.startsWith('data:image/svg') && !src.toLowerCase().includes('script') || (src.startsWith('data:image/') && src.length < 50000)) {
    resolve(src);
    return;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onerror = () => {
    // Fallback: return original if image loading fails
    resolve(src);
  };
  img.onload = () => {
    try {
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        resolve(src);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(img, 0, 0, width, height);

      // Try image/webp first if supported, fallback to image/jpeg
      let compressed = '';
      try {
        compressed = canvas.toDataURL('image/webp', quality);
        if (!compressed.startsWith('data:image/webp')) {
          compressed = canvas.toDataURL('image/jpeg', quality);
        }
      } catch {
        compressed = canvas.toDataURL('image/jpeg', quality);
      }

      resolve(compressed);
    } catch (err) {
      console.warn('Image compression fallback:', err);
      resolve(src);
    }
  };
  img.src = src;
}
