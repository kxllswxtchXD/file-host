import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname === '/' ||
    pathname.endsWith('.tsx')
  ) {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL(`/api${pathname}`, req.url));
}

export const config = {
  matcher: '/:path*',
};
