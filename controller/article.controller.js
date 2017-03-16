/**
 * article controller
 */

const mongoose = require('mongoose')
const { 
  handle: { handleRequest, handleSuccess, handleError },
  validate: { isObjectId }
} = require('../util')
const config = require('../config')
const { ArticleModel, CategoryModel, TagModel } = require('../model')
const authIsVerified = require('../middleware/auth')
const articleCtrl = { list: {}, item: {} }

// 获取文章列表
articleCtrl.list.GET = async (ctx, next) => {
  let { page, page_size, state, keyword, category, tag, start_date, end_date } = ctx.query
  
  // 过滤条件
  const options = {
    sort: { create_at: -1 },
    page: Number(page || 1),
    limit: Number(page_size || config.SERVER.LIMIT),
    populate: ['category', 'tag'],
    select: '-content' // 文章列表不需要content
  }

  // 文章查询条件
  let query = {}

  // 文章状态
  if (['-1', '0', '1', -1, 0, 1].includes(state)) {
    query.state = state
  }

  // 搜索关键词
  if (keyword) {
    const keywordReg = new RegExp(keyword)
    query.$or = [
      { title:  keywordReg },
      { excerpt:  keywordReg }
    ]
  }

  // 分类查询
  if (category) {
    // 如果是id
    if (isObjectId(category)) {
      query.category = category
    } else {
      // 普通字符串，需要先查到id
      await CategoryModel.findOne({ name: category }).exec()
        .then(c => {
          if (c) {
            query.category = c._id
          }
        })
        .catch(err => {
          handleError({ ctx, message: '分类查找失败', err })
        })
    }
  }

  // 标签查询
  if (tag) {
    // 如果是id
    if (isObjectId(tag)) {
      query.tag = tag
    } else {
      // 普通字符串，需要先查到id
      await TagModel.findOne({ name: tag }).exec()
        .then(t => {
          if (t) {
            query.tag = t._id
          }
        })
        .catch(err => {
          handleError({ ctx, message: '标签查找失败', err })
        })
    }
  }

  // 起始日期
  if (start_date) {
    const gte = new Date(start_date)
    if (gte.toString() !== 'Invalid Date') {
      query.create_at = {
        $gte: gte.getTime()
      }
    }
  }

  // 结束日期
  if (end_date) {
    const lte = new Date(end_date)
    if (lte.toString() !== 'Invalid Date') {
      query.create_at = Object.assign({}, query.create_at, {
        $lte: lte.getTime()
      })
    }
  }

  // 如果未通过权限校验，将文章状态重置为1
  if (!await authIsVerified(ctx)) {
    query.state = 1
  }

  await ArticleModel.paginate(query, options)
    .then(articles => {
      handleSuccess({
        ctx,
        message: '文章列表获取成功',
        data: {
          list: articles.docs,
          pagination: {
            total: articles.total,
            current_page: articles.page,
            total_page: articles.pages,
            per_page: articles.limit
          }
        } 
      })
    })
    .catch(err => {
      handleError({ ctx, err, message: '文章列表获取失败' })
    })
}

// 发布新文章
articleCtrl.list.POST = async (ctx, next) => {
  let article = ctx.request.body
  let { title, content } = article
  if (!title) {
    return handleError({ ctx, message: '缺少文章标题' })
  }
  if (!content) {
    return handleError({ ctx, message: '缺少文章内容' })
  }

  await new ArticleModel(article).save()
    .then(data => {
      handleSuccess({ ctx, data, message: '发布文章成功' })
    })
    .catch(err => {
      handleError({ ctx, err, message: '发布文章失败' })
    })
}

// 批量修改文章（移入回收站，移出回收站）
articleCtrl.list.PUT = async (ctx, next) => {
  let { articles, state } = ctx.request.body
  if (!articles || !articles.length) {
    return handleError({ ctx, message: '未选中文章' })
  }
  let update = {}
  if ([-1, 0, 1, '-1', '0', '1'].includes(state)) {
    update.state = Number(state)
  }
  await ArticleModel.update({ _id: { $in: articles }}, { $set: update }, { multi: true })
    .exec()
    .then(data => {
      handleSuccess({ ctx, data, message: '操作成功'})
    })
    .catch(err => {
      handleError({ ctx, err, message: '操作失败' })
    })
}

// 批量删除文章
articleCtrl.list.DELETE = async (ctx, next) => {
  let { articles } = ctx.request.body
  if (!articles || !articles.length) {
    return handleError({ ctx, message: '未选中文章' })
  }
  await ArticleModel.remove({ _id: { $in: articles } }).exec()
    .then(data => {
      handleSuccess({ ctx, data, message: '文章批量删除成功' })
    })
    .catch(err => {
      handleError({ ctx, err, message: '文章批量删除失败' })
    })
}

// 获取单篇文章详情
articleCtrl.item.GET = async (ctx, next) => {
  let { id } = ctx.params
  if (!isObjectId(id)) {
    return handleError({ ctx, message: '缺少文章id' })
  }
  // 获取相关文章
  const getRelatedArticles = async (data) => {
    if (data && data.tag && data.tag.length) {
      data.related = []
      await ArticleModel.find({ _id: { $nin: [ data._id ] }, state: 1, tag: { $in: data.tag.map(t => t._id) }})
        .select('id title excerpt thumb create_at')
        .exec()
        .then(articles => {
          data.related = articles
        })
        .catch(err => {
          console.error(err)
          logger.error(`相关文章获取失败,id:${data._id}`)
        })
    }
  }

  const getSiblingArticles = async (data) => {
    if (data && data._id) {
      let query = {}
      // 如果未通过权限校验，将文章状态重置为1
      if (!await authIsVerified(ctx)) {
        query.state = 1
      }
      let prev = await ArticleModel.findOne(query)
        .select('title')
        .sort('-create_at')
        .lt('create_at', data.create_at)
        .exec()
      let next = await ArticleModel.findOne(query)
        .select('title create_at')
        .sort('create_at')
        .gt('create_at', data.create_at)
        .exec()
      prev = prev && prev.toObject()
      next = next && next.toObject()
      data.sibling = { prev, next }
    }
  }

  let data = await ArticleModel.findByIdAndUpdate(id, { $inc: { 'meta.visit': 1 } }, { new: true })
    .populate('category tag')
    .exec()
    .catch(err => {
      handhandleError({ ctx, err, message: '文章详情获取失败' })
    })
  if (data) {
    data = data.toObject()
  }
  await getRelatedArticles(data)
  await getSiblingArticles(data)
  handleSuccess({ ctx, data, message: '文章详情获取成功' })    
  
}

// 修改单篇文章
articleCtrl.item.PUT = async (ctx, next) => {
  let { id } = ctx.params
  let { article, article: { title, content } } = ctx.request.body
  if (!isObjectId(id)) {
    return handleError({ ctx, message: '缺少文章id' })
  }
  if (!title) {
    return handleError({ ctx, message: '缺少文章标题' })
  }
  if (!content) {
    return handleError({ ctx, message: '缺少文章内容' })
  }
  await ArticleModel.findByIdAndUpdate(id, article, { new: true })
    .exec()
    .then(data => {
      handleSuccess({ ctx, data, message: '修改文章成功' })
    })
    .catch(err => {
      handleError({ ctx, err, message: '修改文章失败' })
    })
}

// 删除单篇文章
articleCtrl.item.DELETE = async (ctx, next) => {
  let { id } = ctx.params
  if (!isObjectId(id)) {
    return handleError({ ctx, message: '缺少文章id' })
  }
  await ArticleModel.findByIdAndRemove(id).exec()
    .then(data => {
      handleSuccess({ ctx, data, message: '删除文章成功' })
    })
    .catch(err => {
      handleError({ ctx, err, message: '删除文章失败' })
    })
}

module.exports = {
  list: async (ctx, next) => await handleRequest({ ctx, next, type: articleCtrl.list }),
  item: async (ctx, next) => await handleRequest({ ctx, next, type: articleCtrl.item })
}