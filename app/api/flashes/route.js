import { NextResponse } from 'next/server';
import { listFlashes } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(listFlashes());
}
