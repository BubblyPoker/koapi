const Koa = require('koa')
const app = new Koa()
const router = require('koa-router')()
const bodyparser = require('koa-bodyparser')
const httpLogger = require('koa-logger')
const respond = require('koa-respond')
const logger = require('simple-node-logger').createSimpleLogger()
const minimist = require('minimist')

const config = require('./config')
const db = require('./mongoose')
const routes = require('./routes')

// 全局logger
global.logger = logger

// 数据库连接
db.init()

// middlewares
app.use(bodyparser())
app.use(httpLogger())
app.use(respond({
  methods: {
    success: (ctx, body) => {
      body = Object.assign({}, {
        code: config.SERVER.CODE.SUCCESS
      }, body)
      ctx.send(200, body)
    },
    failed: (ctx, body) => {
      body = Object.assign({}, {
        code: config.SERVER.CODE.FAILED
      }, body)
      ctx.send(200, body)
    }
  }
}))

// routes 绑定
routes(router)
app.use(router.routes(), router.allowedMethods())

// error response listen
app.on('error', function(err, ctx){
  logger.error('server error', err)
})

// 设置 Cookie 签名密钥
// 签名密钥只在配置项 signed 参数为真是才会生效
app.keys = [config.AUTH.SECRET_KEY]

module.exports = app