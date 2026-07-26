import { NextResponse } from 'next/server';
import { listProducts } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') === 'week' ? 'week' : 'today';
  return NextResponse.json(listProducts(period));
}
