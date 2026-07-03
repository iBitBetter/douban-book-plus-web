/**
 * POST /api/parse-douban
 * 解析豆瓣书籍页面，提取书名 / ISBN / 作者
 *
 * body: { url }
 * 返回: { title, isbn, author }
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var url = ((req.body && req.body.url) || '').trim();
  if (!url || url.indexOf('book.douban.com/subject/') === -1) {
    return res.status(400).json({ error: '请输入有效的豆瓣书籍链接（含 book.douban.com/subject/）' });
  }

  try {
    var resp = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' }
    });
    if (!resp.ok) {
      return res.status(502).json({ error: '豆瓣页面请求失败：HTTP ' + resp.status });
    }
    var html = await resp.text();

    // 提取书名 — 优先 v:itemreviewed
    var title = '';
    var titleMatch = html.match(/<span[^>]*property="v:itemreviewed"[^>]*>([^<]+)<\/span>/i);
    if (titleMatch) title = titleMatch[1].trim();
    if (!title) {
      var ogMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
      if (ogMatch) title = ogMatch[1].trim();
    }

    // 提取 ISBN
    var isbn = '';
    var isbnMatch = html.match(/ISBN[:\s]*(\d[\d\-Xx]{9,17})/i);
    if (isbnMatch) isbn = isbnMatch[1].replace(/[-\s]/g, '').trim();

    // 提取作者（首个 /author/ 链接）
    var author = '';
    var authorMatch = html.match(/<a[^>]*href="[^"]*\/author\/[^"]*"[^>]*>([^<]+)<\/a>/i);
    if (authorMatch) author = authorMatch[1].trim();

    res.status(200).json({ title: title, isbn: isbn, author: author });
  } catch (e) {
    res.status(500).json({ error: '解析失败：' + e.message });
  }
};
