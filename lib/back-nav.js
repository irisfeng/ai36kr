// 只有确实从本站某一页过来，才 history.back()，这样能回到原来的滚动位置。
// 分享链接、新开的文章页没有站内上一页，退回精选，避免把读者送出站点。
export function shouldGoBack({ fromSite, historyLength }) {
  return Boolean(fromSite) && historyLength > 1;
}
