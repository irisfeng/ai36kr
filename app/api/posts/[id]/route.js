import { NextResponse } from 'next/server';
import { getPost } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = (searchParams.get('token') || '').trim();
  const post = getPost(
    Number(id),
    token.length >= 8 && token.length <= 64 ? token : ''
  );
  if (!post) return NextResponse.json({ error: '文章不存在' }, { status: 404 });
  return NextResponse.json(post);
}
