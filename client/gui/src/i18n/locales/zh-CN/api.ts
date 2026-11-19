import type apiDict from "../en/api";
import type { Localized } from "../localized";

/** 客户端 API 层消息（HTTP 状态、传输错误）。 */
const api: Localized<typeof apiDict> = {
  requestFailed: "请求失败",
  unreachableHost: "主机不可达",
  invalidServer: "服务器无效",
  notAuthenticated: "未认证",
  keyEmpty: "密钥为空",
  badKey: "认证密钥无效",
  connectionTimedOut: "连接超时",
  serverNotFound: "未找到服务器",
  noServersConfigured: "未配置任何服务器",
  failure: "失败",
  http: {
    badRequest: "错误请求",
    unauthorized: "未授权",
    forbidden: "禁止访问",
    notFound: "未找到",
    methodNotAllowed: "方法不被允许",
    requestTimeout: "请求超时",
    conflict: "冲突",
    payloadTooLarge: "负载过大",
    unsupportedMediaType: "不支持的媒体类型",
    unprocessableEntity: "无法处理的实体",
    tooManyRequests: "请求过多",
    internalError: "内部错误",
    notImplemented: "未实现",
    badGateway: "网关错误",
    serviceUnavailable: "服务不可用",
    gatewayTimeout: "网关超时",
  },
};

export default api;
