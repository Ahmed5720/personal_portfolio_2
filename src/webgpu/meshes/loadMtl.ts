import { publicAssetUrl } from '../../publicAssetUrl';

export interface MtlMaterial {
  name: string;
  diffuseMap: string | null;
  diffuseColor: [number, number, number];
  alpha: number;
}

export async function loadMtl(url: string): Promise<Map<string, MtlMaterial>> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load MTL (${response.status}): ${url}`);
  }
  return parseMtl(await response.text());
}

export function parseMtl(source: string): Map<string, MtlMaterial> {
  const materials = new Map<string, MtlMaterial>();
  let current: MtlMaterial | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    const keyword = parts[0];

    if (keyword === 'newmtl') {
      const name = parts.slice(1).join(' ');
      current = {
        name,
        diffuseMap: null,
        diffuseColor: [1, 1, 1],
        alpha: 1,
      };
      materials.set(name, current);
      continue;
    }

    if (!current) continue;

    if (keyword === 'Kd') {
      current.diffuseColor = [
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3]),
      ];
      continue;
    }

    if (keyword === 'd' || keyword === 'Tr') {
      const value = Number(parts[1]);
      current.alpha = keyword === 'Tr' ? 1 - value : value;
      continue;
    }

    if (keyword === 'map_Kd') {
      current.diffuseMap = parseMapKd(parts.slice(1));
    }
  }

  return materials;
}

/** Extract the texture path from a map_Kd argument list. */
function parseMapKd(tokens: string[]): string {
  if (tokens.length === 0) return '';

  const joined = tokens.join(' ').trim();
  const quoted = joined.match(/^"(.+)"$/) ?? joined.match(/^'(.+)'$/);
  if (quoted) {
    return quoted[1];
  }

  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i].replace(/^["']|["']$/g, '');
    if (/\.(png|jpe?g|bmp|tga|webp|tif)$/i.test(token)) {
      return token;
    }
  }

  return tokens[tokens.length - 1].replace(/^["']|["']$/g, '');
}

/** Resolve map_Kd paths to textures served from public/assets/img. */
export function resolveDiffuseTextureUrl(mapKd: string): string {
  const normalized = mapKd.trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/');
  const filename = (normalized.split('/').pop() ?? normalized).replace(/["']/g, '');
  return publicAssetUrl(`assets/img/${filename}`);
}
