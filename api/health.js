/**
 * GET /api/health — 健康检查
 */
module.exports = function (req, res) {
  res.status(200).json({
    ok: true,
    service: 'douban-ebook-plus-web',
    time: new Date().toISOString()
  });
};
