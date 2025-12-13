import { HttpTypes } from "@medusajs/types"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

async function getRegionMap(cacheId: string) {
  const { regionMap, regionMapUpdated } = regionMapCache

  if (!BACKEND_URL) {
    throw new Error(
      "Middleware.ts: Error fetching regions. Did you set up regions in your Medusa Admin and define a MEDUSA_BACKEND_URL environment variable? Note that the variable is no longer named NEXT_PUBLIC_MEDUSA_BACKEND_URL."
    )
  }

  if (
    !regionMap.keys().next().value ||
    regionMapUpdated < Date.now() - 3600 * 1000
  ) {
    // Fetch regions from Medusa. We can't use the JS client here because middleware is running on Edge and the client needs a Node environment.
    const { regions } = await fetch(`${BACKEND_URL}/store/regions`, {
      headers: {
        "x-publishable-api-key": PUBLISHABLE_API_KEY!,
      },
      next: {
        revalidate: 3600,
        tags: [`regions-${cacheId}`],
      },
      cache: "force-cache",
    }).then(async (response) => {
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.message)
      }

      return json
    })

    if (!regions?.length) {
      throw new Error(
        "No regions found. Please set up regions in your Medusa Admin."
      )
    }

    // Create a map of country codes to regions.
    regions.forEach((region: HttpTypes.StoreRegion) => {
      region.countries?.forEach((c) => {
        regionMapCache.regionMap.set(c.iso_2 ?? "", region)
      })
    })

    regionMapCache.regionMapUpdated = Date.now()
  }

  return regionMapCache.regionMap
}

/**
 * Fetches regions from Medusa and sets the region cookie.
 * @param request
 * @param response
 */
async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>
) {
  try {
    let countryCode

    const vercelCountryCode = request.headers
      .get("x-vercel-ip-country")
      ?.toLowerCase()

    const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()

    if (urlCountryCode && regionMap.has(urlCountryCode)) {
      countryCode = urlCountryCode
    } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
      countryCode = vercelCountryCode
    } else if (regionMap.has(DEFAULT_REGION)) {
      countryCode = DEFAULT_REGION
    } else if (regionMap.keys().next().value) {
      countryCode = regionMap.keys().next().value
    }

    return countryCode
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Middleware.ts: Error getting the country code. Did you set up regions in your Medusa Admin and define a MEDUSA_BACKEND_URL environment variable? Note that the variable is no longer named NEXT_PUBLIC_MEDUSA_BACKEND_URL."
      )
    }
  }
}

/**
 * Middleware to handle region selection and onboarding status.
 */
export async function middleware(request: NextRequest) {
  let redirectUrl = request.nextUrl.href

  let response = NextResponse.redirect(redirectUrl, 307)

  let cacheIdCookie = request.cookies.get("_medusa_cache_id")

  let cacheId = cacheIdCookie?.value || crypto.randomUUID()

  const regionMap = await getRegionMap(cacheId)

  const countryCode = regionMap && (await getCountryCode(request, regionMap))

  const urlHasCountryCode =
    countryCode && request.nextUrl.pathname.split("/")[1].includes(countryCode)

  // if one of the country codes is in the url and the cache id is set, return next
  if (urlHasCountryCode && cacheIdCookie) {
    return NextResponse.next()
  }

  // if one of the country codes is in the url and the cache id is not set, set the cache id and redirect
  if (urlHasCountryCode && !cacheIdCookie) {
    response.cookies.set("_medusa_cache_id", cacheId, {
      maxAge: 60 * 60 * 24,
    })

    return response
  }

  // check if the url is a static asset
  if (request.nextUrl.pathname.includes(".")) {
    return NextResponse.next()
  }

  const redirectPath =
    request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname

  const queryString = request.nextUrl.search ? request.nextUrl.search : ""

  // If no country code is set, we redirect to the relevant region.
  if (!urlHasCountryCode && countryCode) {
    redirectUrl = `${request.nextUrl.origin}/${countryCode}${redirectPath}${queryString}`
    response = NextResponse.redirect(`${redirectUrl}`, 307)
  } else if (!urlHasCountryCode && !countryCode) {
    // Handle case where no valid country code exists (empty regions)
    return new NextResponse(
      "No valid regions configured. Please set up regions with countries in your Medusa Admin.",
      { status: 500 }
    )
  }

  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}

/**
 * Image proxy route for Next.js App Router.
 * Example: GET /api/images/path/to/key.jpg -> fetches http://minio:9002/medusa-bucket/path/to/key.jpg
 *
 * Notes:
 * - Uses Docker internal DNS: http://minio:9002
 * - Keep your bucket private if desired; this route governs access.
 * - Adjust BUCKET_NAME or BASE_URL if needed.
 */

export const dynamic = "force-static"; // allow caching; change to "force-dynamic" if keys are private & auth-based
export const revalidate = 3600; // ISR-like hint for static fetch caching (in seconds)

const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || "medusa-bucket";
// For internal container-to-container fetches, use the service name 'minio'
const MINIO_BASE_URL =
  process.env.MINIO_INTERNAL_BASE_URL || `http://minio:9002/${BUCKET_NAME}`;

function joinUrl(base: string, segments: string[]): string {
  const s = segments.filter(Boolean).join("/");
  return `${base.replace(/\/+$/, "")}/${s}`;
}

function pickContentType(h: Headers): string {
  // Default to octet-stream if upstream doesn't send one
  return h.get("content-type") ?? "application/octet-stream";
}

export async function GET(
  _req: Request,
  { params }: { params: { path?: string[] } }
) {
  const segments = params.path ?? [];
  if (segments.length === 0) {
    return new Response("Missing key", { status: 400 });
  }

  const upstreamUrl = joinUrl(MINIO_BASE_URL, segments);

  // Stream from MinIO; avoid buffering entire file when possible
  const upstream = await fetch(upstreamUrl, {
    // Forward cache semantics but do not forward client headers by default
    // You can add auth headers here if your bucket is private
    redirect: "follow",
    // Make sure to opt into caching in Next if you want CDN benefits
    // cache: "force-cache", // default for GET in route handlers
  });

  // If not found, passthrough status
  if (!upstream.ok) {
    // Mirror upstream status (404/403/etc)
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "text/plain",
        "cache-control": "no-store",
      },
    });
  }

  // Stream body to client
  const contentType = pickContentType(upstream.headers);
  const contentLength = upstream.headers.get("content-length") || undefined;
  const etag = upstream.headers.get("etag") || undefined;
  const lastModified = upstream.headers.get("last-modified") || undefined;

  // Public caching (1h) + revalidation window
  const cacheControl =
    process.env.IMAGE_PROXY_CACHE_CONTROL ||
    "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      ...(contentLength ? { "content-length": contentLength } : {}),
      ...(etag ? { etag } : {}),
      ...(lastModified ? { "last-modified": lastModified } : {}),
      "cache-control": cacheControl,
    },
  });
}