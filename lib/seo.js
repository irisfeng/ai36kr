// 页面级 alternates 会整体覆盖根布局的同名字段：规范地址和 RSS 声明放一起给
export function alternates(path) {
  return { canonical: path, types: { 'application/rss+xml': '/rss.xml' } };
}
