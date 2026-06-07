const BROWSER_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];

function alternateTextureUrls(url: string): string[] {
  const urls = [url];
  const extensionMatch = url.match(/\.(tif|tiff)$/i);
  if (!extensionMatch) {
    return urls;
  }

  const base = url.slice(0, -extensionMatch[0].length);
  for (const extension of BROWSER_IMAGE_EXTENSIONS) {
    urls.push(`${base}${extension}`);
  }
  return urls;
}

async function decodeImageBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load texture (${response.status}): ${url}`);
  }

  return createImageBitmap(await response.blob());
}

export async function loadTextureFromUrl(
  device: GPUDevice,
  url: string,
): Promise<GPUTexture> {
  let lastError: unknown;

  for (const candidate of alternateTextureUrls(url)) {
    try {
      const imageBitmap = await decodeImageBitmap(candidate);
      const texture = device.createTexture({
        size: [imageBitmap.width, imageBitmap.height, 1],
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });

      device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture },
        [imageBitmap.width, imageBitmap.height],
      );

      if (candidate !== url) {
        console.info(`Loaded texture fallback: ${candidate}`);
      }

      return texture;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to decode texture: ${url}`);
}

export function createWhiteTexture(device: GPUDevice): GPUTexture {
  const texture = device.createTexture({
    size: [1, 1, 1],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.writeTexture(
    { texture },
    new Uint8Array([255, 255, 255, 255]),
    { bytesPerRow: 4 },
    [1, 1, 1],
  );

  return texture;
}
