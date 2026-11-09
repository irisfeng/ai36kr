import Link from 'next/link';
import { breadcrumbJsonLd, jsonLdScript } from '@/lib/seo';

// 可见面包屑和 BreadcrumbList 用同一份 items，避免结构化数据多写出页面上没有的层级
export default function Breadcrumb({ items }) {
  return (
    <nav className="crumb" aria-label="面包屑">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(items)) }}
      />
      <ol>
        {items.map((item, index) => (
          <li key={`${item.href || 'here'}-${index}`}>
            {item.href && !item.current
              ? <Link href={item.href}>{item.name}</Link>
              : <span aria-current={item.current ? 'page' : undefined}>{item.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
