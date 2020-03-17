const TChannelAsThrift = require("tchannel/as/thrift");
const TChannel = require("tchannel");
const path = require("path");
const assert = require("assert");
const LRU = require("lru-cache");
const fs = require("mz/fs");
const { EventEmitter } = require('events');

const cacheThriftClient = {};

const clientChanNeedUpdatePeers = {};

const lastEntryPoint = {};

class _TChannel extends EventEmitter {
  constructor (app) {
    super();
    this.app = app;
    this.opts = app.config.tchannel;
    this.configuration = {};

    this._logger = this.opts.logger || this.app.logger;
    this._isInit = false;
  }

  _init () {
    if (!this.registry) {
      this._logger.error('[egg-tchannel] [registry] => undefined')
      return;
    }
    if (this._isInit) {
      return;
    }

    this._client = new TChannel({
      logger: this._logger
    });

    this._isInit = true;
  }

  configure (configuration) {
    this.configuration = Object.assign({}, this.configuration, configuration);
    this.registry = this.configuration.registry;
  }

  serviceChange ({ serviceName, tag, nodes } = {}) {
    const logger = this._logger;
    const serviceName_tag = this._getServiceNameTagKey(serviceName, tag);
    clientChanNeedUpdatePeers[serviceName_tag] = true;

    if (nodes && nodes.length > 0) {
      this.updateClientChanPeers(serviceName, tag);
    }
  }

  _getServiceNameTagKey (serviceName, tag) {
    return `[service:${serviceName},tag:${tag}]`;
  }

  async updateClientChanPeers (serviceName, tag = "") {
    assert(typeof serviceName === 'string' && serviceName.length > 0, '[updateClientChanPeers] serviceName is required');

    const serviceName_tag = this._getServiceNameTagKey(serviceName, tag);
    let channel = this._client.subChannels[serviceName_tag];
    if (channel) {
      const nodes = await this.registry(serviceName, tag);
      if (nodes.length > 0) {
        const peers = nodes.map(item => item.peer).sort();
        this._logger.info(`[egg-tchannel] [updateClientChanPeers] serviceName_tag => [${serviceName_tag}] peers => [${peers}]`);
        channel.updatePeers(peers);
        clientChanNeedUpdatePeers[serviceName_tag] = false;
      }
    }
  }

  async _getServiceClientChan (serviceName, tag = "") {
    if (!this._isInit) {
      return;
    }
    const serviceName_tag = this._getServiceNameTagKey(serviceName, tag);
    let channel = this._client.subChannels[serviceName_tag];
    if (channel) {
      if (clientChanNeedUpdatePeers[serviceName_tag]) {
        await this.updateClientChanPeers(serviceName, tag);
      }
      return channel;
    }

    const nodes = await this.registry(serviceName, tag);

    channel = this._client.subChannels[serviceName_tag];
    if (channel) {
      if (clientChanNeedUpdatePeers[serviceName_tag]) {
        await this.updateClientChanPeers(serviceName, tag);
      }
      return channel;
    }
    const peers = nodes.map(item => item.peer).sort();
    if (peers.length > 0) {
      channel = this._client.makeSubChannel({
        serviceName: serviceName_tag,
        peers,
        requestDefaults: {
          timeout: this.opts.timeout,
          hasNoParent: true,
          headers: {
            as: "thrift",
            cn: this.opts.myServiceName || this.app.name
          },
        }
      });
      this._client.subChannels[serviceName_tag] = channel;
      return channel;
    } else {
      return null;
    }
  }

  async _getThriftClient (serviceName, tag = "") {
    const clientChan = await this._getServiceClientChan(serviceName, tag);
    const serviceName_tag = this._getServiceNameTagKey(serviceName, tag);
    if (clientChan) {
      lastEntryPoint[serviceName_tag] = lastEntryPoint[serviceName_tag] || {};

      const isCached = !!cacheThriftClient[serviceName_tag];
      const isTimeOut = Date.now() - new Date(lastEntryPoint[serviceName_tag].lastReadTime || 0).getTime() > this.opts.cacheThriftTime;
      if (!isCached || isTimeOut) {
        const thriftPath = path.join(this.opts.thriftIDLPath, `${serviceName}.thrift`);
        this._logger.info(`[egg-tchannel] [thriftPath] ${serviceName} => `, thriftPath);
        const stat = await fs.stat(thriftPath);
        if (stat && stat.mtimeMs) {
          if (Math.floor(stat.mtimeMs) !== lastEntryPoint[serviceName_tag].fileMtimeMs) {
            lastEntryPoint[serviceName_tag].fileMtimeMs = Math.floor(stat.mtimeMs);
            const thriftSource = await fs.readFile(thriftPath, 'utf8');
            lastEntryPoint[serviceName_tag].lastReadTime = Date.now();
            cacheThriftClient[serviceName_tag] = TChannelAsThrift({
              channel: clientChan,
              source: thriftSource
            });
          }
        }
      }

      return cacheThriftClient[serviceName_tag];
    }
  }

  async request ({ serviceName, method, headers, body = {}, tag, options } = {}) {
    if (!this._isInit) {
      this._init();
    }
    const thriftClient = await this._getThriftClient(serviceName, tag);
    if (thriftClient) {
      return new Promise((resolve, reject) => {
        thriftClient.request(Object.assign({
          serviceName,
        }, options)).send(`${serviceName}::${method}`, headers, body, (err, res) => {
          if (err) {
            if (err.code === "ECONNREFUSED") {
              const serviceName_tag = this._getServiceNameTagKey(serviceName, tag);
              clientChanNeedUpdatePeers[serviceName_tag] = true;
            }
            reject(err);
          } else {
            resolve(res);
          }
        });
      })
    }
  }
}

function createTchannel (app) {
  app.tchannel = new _TChannel(app);
}

module.exports = createTchannel;
