import { NextResponse } from 'next/server';
import { getPulse } from '@/lib/pulse';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getPulse());
}
