/**
 * 博客信息 controller
 * 包括：文章，分类，标签总数，可扩展其他类型
 */

const { handle: { handleRequest, handleSuccess, handleError } } = require('../util')
const {
  ArticleModel, TagModel, CategoryModel
} = require('../model')
const authIsVerified = require('../middleware/auth')
const statisticsCtrl = {}

statisticsCtrl.GET = async (ctx, next) => {
  let query = {}
  // 如果未通过权限校验，将文章状态重置为1
  if (!await authIsVerified(ctx)) {
    query.state = 1
  }
  let articleCount = await ArticleModel.where(query).count()
    .exec()
  let categoryCount = await CategoryModel.where().count()
    .exec()
  let tagCount = await TagModel.where().count()
    .exec()
  handleSuccess({ ctx, message: '博客文章统计信息获取成功', data: {
    count: {
      article: articleCount,
      category: categoryCount,
      tag: tagCount
    }
  }})
}

module.exports = async (ctx, next) => await handleRequest({ ctx, next, type: statisticsCtrl })