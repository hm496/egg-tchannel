'use strict';
const path = require('path');

module.exports = appInfo => {
  const exports = {};

  exports.tchannel = {
    cacheThriftTime: 300000, // 5 minutes
    thriftIDLPath: path.join(appInfo.baseDir, "thrift_idl"),
    timeout: 2500,
  };

  return exports;
};
