import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q   = url.searchParams.get('q')?.trim() ?? '';
  const plz = url.searchParams.get('plz')?.trim() ?? '';

  // PLZ → city lookup via Zippopotamus
  if (plz && /^\d{5}$/.test(plz)) {
    try {
      const res  = await fetch(`https://api.zippopotam.us/de/${plz}`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json() as { places?: Array<{ 'place name': string }> };
        const city = data.places?.[0]?.['place name'] ?? null;
        return Response.json({ city });
      }
    } catch { /* fall through */ }
    return Response.json({ city: null });
  }

  // Street autocomplete via Photon (OSM)
  if (!q || q.length < 3) return Response.json({ features: [] });

  try {
    const params = new URLSearchParams({
      q,
      lang: 'de',
      limit: '6',
      countrycodes: 'de',
    });
    const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
      headers: { 'User-Agent': 'dumbdecision.de/address-lookup' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return Response.json({ features: [] });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ features: [] });
  }
};
