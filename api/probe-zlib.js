/**
 * POST /api/probe-zlib
 * 顺序探测 Z-Library 镜像可用性，返回首个可用镜像的搜索链接
 *
 * body: { isbn, title, mirrors: [{name, homeUrl, searchBase}] }
 * 返回: { url, mirror, alive }
 */
const { probeZLibraryMirrors } = require('../lib/mirror-probe');

module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var body = req.body || {};
  var isbn = (body.isbn || '').trim();
  var title = (body.title || '').trim();
  var mirrors = body.mirrors;

  if (!Array.isArray(mirrors) || mirrors.length === 0) {
    return res.status(400).json({ error: '镜像列表为空' });
  }

  try {
    var result = await probeZLibraryMirrors(mirrors, isbn, title);
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
