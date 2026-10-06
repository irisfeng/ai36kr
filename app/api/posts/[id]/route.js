import { NextResponse } from 'next/server';
import { getPost } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  const n = Number(id);
  const post = Number.isSafeInteger(n) && n > 0 ? getPost(n) : null;
  if (!post) return NextResponse.json({ error: '文章不存在' }, { status: 404 });
  return NextResponse.json(post);
}
