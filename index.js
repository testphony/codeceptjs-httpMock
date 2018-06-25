
const requireg = require('requireg');
const mockttp = require('@kronoslive/mockttp');
const { cropLongData } = require('@kronoslive/codeceptjs-utils');
const path = require('path');

const codeceptjsPath = path.resolve(global.codecept_dir, './node_modules/codeceptjs');
// eslint-disable-next-line import/no-dynamic-require
const { recorder } = require(codeceptjsPath);

let mochawesome;
let utils;

/**
 * Хэлпер для работы с http моком.
 */
class HTTPMock extends Helper {
  /**
   *
   * @param {object} config
   */
  constructor(config) {
    super(config);
    this._validateConfig(config);
  }

  /**
   *
   * @param {object} config
   * @private
   */
  _validateConfig(config) {
    this.options = {
      port: 9037,
      debug: false,
    };
    this.isRunning = false;
    this.requests = {
      get: {},
      post: {},
      put: {},
      delete: {},
      patch: {},
      options: {},
    };

    Object.assign(this.options, config);
  }

  /* eslint-disable consistent-return */
  /**
   *
   * @returns {string[]}
   * @private
   */
  static _checkRequirements() {
    try {
      requireg('@kronoslive/mockttp');
    } catch (e) {
      return ['@kronoslive/mockttp'];
    }
  }

  /* eslint-enable consistent-return */

  /**
   *
   * @returns {boolean}
   * @private
   */
  _beforeSuite() {
    mochawesome = this.helpers.Mochawesome;
    utils = this.helpers.Utils;
    if (!this.isRunning) {
      this.server = mockttp.getLocal();
      this.server.debug = this.options.debug;
      this.server.start(this.options.port);
      this.isRunning = true;
    }
    return true;
  }

  /**
   * Настраивает мок для заданного метода и urlPath. Отвечать будет тем, что будет задано в callback.
   * @param {string} method
   * @param {string} urlPath
   * @param {function} callback
   * @param {object} ctx
   */
  async respondWith(method, urlPath, callback = () => {}, ctx = {}) {
    method = method.toLowerCase();
    urlPath =
    urlPath.charAt(urlPath.length - 1) === '/'
      ? urlPath.substring(0, urlPath.length - 1)
      : urlPath;
    const callbackWithLog = async (req) => {
      const reqWithoutBuff = req;
      delete reqWithoutBuff.body.buffer;
      await mochawesome.addMochawesomeContext({
        title: 'Received HTTP request for mock',
        value: reqWithoutBuff,
      });
      const res = await callback(req);
      return res;
    };
    let endpointMock;
    try {
      switch (method) {
        case 'get':
          endpointMock = await this.server
            .get(urlPath, ctx)
            .thenCallback(callbackWithLog);
          this.requests.get[urlPath] = endpointMock;
          break;
        case 'post':
          endpointMock = await this.server
            .post(urlPath, ctx)
            .thenCallback(callbackWithLog);
          this.requests.post[urlPath] = endpointMock;
          break;
        case 'put':
          endpointMock = await this.server
            .put(urlPath, ctx)
            .thenCallback(callbackWithLog);
          this.requests.put[urlPath] = endpointMock;
          break;
        case 'delete':
          endpointMock = await this.server
            .delete(urlPath, ctx)
            .thenCallback(callbackWithLog);
          this.requests.delete[urlPath] = endpointMock;
          break;
        case 'patch':
          endpointMock = await this.server
            .patch(urlPath, ctx)
            .thenCallback(callbackWithLog);
          this.requests.patch[urlPath] = endpointMock;
          break;
        case 'options':
          endpointMock = await this.server
            .options(urlPath, ctx)
            .thenCallback(callbackWithLog);
          this.requests.options[urlPath] = endpointMock;
          break;
        default:
          throw new Error('unknown type of method');
      }
    } catch (err) {
      recorder.catch(() => {
        throw err;
      });
    }
  }

  /**
 * Метод проверяет, что для указанного метода и urlpath был совершен запрос, подходящий под предикат за указанный
 * таймаут.
 * @param {string} method
 * @param {string} urlPath
 * @param {function} predicate
 * @param {number} timeout
 */
  async expectRequestUntil(method, urlPath, predicate = msg => msg, timeout) {
    method = method.toLowerCase();
    urlPath =
    urlPath.charAt(urlPath.length - 1) === '/'
      ? urlPath.substring(0, urlPath.length - 1)
      : urlPath;
    if (this.requests[method][urlPath] === undefined) {
      throw new Error(`We should create mock for method ${method} and url ${urlPath} before expecting something!`);
    }

    const seen = {};
    let predicateErr;

    try {
      await utils.waitUntil(
        async () => Promise.resolve((
          (await this.requests[method][urlPath].getSeenRequests()) || []
        ).find((msg, i) => {
          try {
            if (!seen[i]) {
              seen[i] = true;
              return predicate(msg);
            }
            return false;
          } catch (err) {
            predicateErr = err;
            return true;
          }
        })),
        timeout,
        'timeout',
        100,
      );
      if (predicateErr) {
        throw new Error(`predicate return err (${
          predicateErr.code
        }), but it should return boolean value`);
      }
      const messages = await this.requests[method][urlPath].getSeenRequests();
      mochawesome.addMochawesomeContext({
        title: `Wait request with predicate for method ${method} and url ${urlPath}`,
        value: predicate.toString(),
      });
      const reqWithoutBuff = messages[messages.length - 1];
      delete reqWithoutBuff.body.buffer;
      mochawesome.addMochawesomeContext({
        title: 'Latest request',
        value: cropLongData(reqWithoutBuff),
      });
    } catch (err) {
      const messages = await this.requests[method][urlPath].getSeenRequests();
      mochawesome.addMochawesomeContext({
        title: `Wait request with predicate for method ${method} and url ${urlPath}`,
        value: predicate.toString(),
      });
      const reqWithoutBuff = messages[messages.length - 1];
      delete reqWithoutBuff.body.buffer;
      mochawesome.addMochawesomeContext({
        title: 'Latest request',
        value: cropLongData(reqWithoutBuff),
      });
      if (err.message === 'timeout') {
        throw new Error(`http mock timeout while expecting request with method ${method} and url ${urlPath} with ${predicate}`);
      } else throw err;
    }
  }

  /**
 * Метод проверяет, что за указанный таймаут не было ни одного сообщения по методу и urlpath подпадающий под
 * предикат.
 * @param {string} method
 * @param {string} urlPath
 * @param {function} predicate
 * @param {number} timeout
 * @returns {Promise<void>}
 */
  dontExpectRequestUntil(method, urlPath, predicate, timeout) {
    method = method.toLowerCase();
    urlPath =
    urlPath.charAt(urlPath.length - 1) === '/'
      ? urlPath.substring(0, urlPath.length - 1)
      : urlPath;
    if (this.requests[method][urlPath] === undefined) {
      throw new Error(`We should create mock for method ${method} and url ${urlPath} before expecting something!`);
    }

    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        const found = (
          (await this.requests[method][urlPath].getSeenRequests()) || []
        ).find(x => predicate(x));

        if (found === undefined) {
          resolve();
        } else {
          reject(new Error(`Found some not expected: ${JSON.stringify(found)}`));
        }
      }, timeout);
    });
  }

  /**
 * Получить все запросы по методу и urlPath, которые были отправлены в моксервер.
 * @param {string} method
 * @param {string} urlPath
 * @returns {Promise<void>}
 */
  grabServerRequests(method, urlPath) {
    method = method.toLowerCase();
    urlPath =
    urlPath.charAt(urlPath.length - 1) === '/'
      ? urlPath.substring(0, urlPath.length - 1)
      : urlPath;
    return this.requests[method][urlPath].getSeenRequests();
  }

  /**
 *
 * @private
 * @returns {Promise<void>}
 */
  _after() {
    this.requests = {
      get: {},
      post: {},
      put: {},
      delete: {},
      patch: {},
      options: {},
    };
    return this.server.reset();
  }

  /**
 *
 * @returns {Promise<void>}
 * @private
 */
  _finishTest() {
    return this.server.stop();
  }
}

module.exports = HTTPMock;
