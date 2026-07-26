import { NextResponse } from 'next/server';
import { listFlashes } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const before = (searchParams.get('before') || '').slice(0, 40);
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);
  return NextResponse.json(listFlashes({ before, limit }));
}
