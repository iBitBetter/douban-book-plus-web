/**
 * 智能书名匹配工具
 * 从原 background.js 提取，用于在搜索结果中找到与豆瓣书名最匹配的条目
 */

/**
 * 计算两个字符串的相似度，返回 0~1 的分数
 * 策略：先尝试包含关系（高分），再算编辑距离相似度（2-gram Jaccard）
 */
function titleSimilarity(a, b) {
  if (!a || !b) return 0;
  a = a.trim().toLowerCase();
  b = b.trim().toLowerCase();
  if (a === b) return 1.0;
  // 移除常见标点/空格后比较
  var clean = function (s) { return s.replace(/[\s()（）《》「」『』\-,，。、：:；;！!？?""''\.]/g, ''); };
  var ca = clean(a);
  var cb = clean(b);
  if (ca === cb) return 0.95;
  // 包含关系
  if (ca.length > 1 && cb.length > 1) {
    if (ca.indexOf(cb) !== -1) return 0.90;
    if (cb.indexOf(ca) !== -1) return 0.85;
  }
  // 简化的 Jaccard: 2-gram 重叠度
  function bigrams(s) {
    var result = {};
    for (var i = 0; i < s.length - 1; i++) {
      var bg = s.substring(i, i + 2);
      result[bg] = (result[bg] || 0) + 1;
    }
    return result;
  }
  var ba = bigrams(ca);
  var bb = bigrams(cb);
  var intersection = 0;
  var union = 0;
  var keys = {};
  for (var k in ba) { keys[k] = true; }
  for (var k in bb) { keys[k] = true; }
  for (var k in keys) {
    var va = ba[k] || 0;
    var vb = bb[k] || 0;
    intersection += Math.min(va, vb);
    union += Math.max(va, vb);
  }
  if (union === 0) return 0;
  return intersection / union;
}

/**
 * 对搜索结果做书名 + 作者交叉匹配，返回最佳匹配项
 * @param {string} doubanTitle - 豆瓣书名
 * @param {string} doubanAuthor - 豆瓣作者
 * @param {Array} results - 搜索结果数组
 * @param {Function} getTitle - 从 result 取书名的函数
 * @param {Function} getAuthor - 从 result 取作者的函数（可选）
 * @param {number} minTitleScore - 书名最低相似度阈值（默认 0.60）
 * @returns {{index: number, score: number, matched: boolean}}
 */
function bookMatch(doubanTitle, doubanAuthor, results, getTitle, getAuthor, minTitleScore) {
  minTitleScore = minTitleScore || 0.60;
  var best = { index: -1, score: 0, matched: false, authorMismatch: false };

  for (var i = 0; i < results.length; i++) {
    var resultTitle = getTitle(results[i]);
    var resultAuthor = getAuthor ? getAuthor(results[i]) : '';
    var titleScore = titleSimilarity(doubanTitle, resultTitle);
    var authorScore = 0;
    var bothAuthorsExist = false;

    // 作者匹配：双向包含
    if (doubanAuthor && resultAuthor) {
      bothAuthorsExist = true;
      var da = doubanAuthor.trim().toLowerCase();
      var ra = resultAuthor.trim().toLowerCase();
      if (da && ra) {
        if (da === ra) {
          authorScore = 1.0;
        } else if (da.indexOf(ra) !== -1 || ra.indexOf(da) !== -1) {
          authorScore = 0.80;
        }
      }
    }

    // 综合得分：书名权重 0.7，作者权重 0.3（有作者时）
    var composite = titleScore;
    if (authorScore > 0) {
      composite = titleScore * 0.7 + authorScore * 0.3;
    }

    if (composite > best.score) {
      best = {
        index: i,
        score: composite,
        matched: false,
        authorMismatch: bothAuthorsExist && authorScore === 0
      };
    }
  }

  // 判定匹配：书名相似度 >= 阈值，且不能是作者明确冲突的同名异书
  if (best.index >= 0 && best.score >= minTitleScore && !best.authorMismatch) {
    best.matched = true;
  }

  return best;
}

module.exports = { titleSimilarity: titleSimilarity, bookMatch: bookMatch };
