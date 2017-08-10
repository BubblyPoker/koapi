/**
 * 处理请求响应
 * @author Jooger
 */

import config from '../config'
const { METHOD_NOT_ALLOWED, FAILED } = config.SERVER.CODE

export async function handleRequest ({ ctx, type, next }) {
  const method = ctx.request.method
  const support = !!type[method]
  if (support) {
    await type[method](ctx, next)
  } else {
    handleError({ ctx, message: `${ctx.request.url}不支持${method}请求类型` })
  }
}

export function handleSuccess ({ ctx, message = '请求成功', data = {} }) {
  logger.info(message)
  ctx.success({
    message,
    data: data || {}
  })
}

export function handleError ({ ctx, message = '请求失败', err = {} }) {
  logger.error(message)
  Object.keys(err).length && console.error(err)
  ctx.failed({
    message,
    error: err || {}
  })
}