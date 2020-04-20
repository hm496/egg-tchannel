'use strict';
const path = require('path');

module.exports = appInfo => {
  const exports = {};

  exports.tchannel = {
    cacheThriftTime: 0, // thriftIDL cache millisecond, 0 => permanent
    thriftIDLPath: path.join(appInfo.baseDir, "thrift_idl"),
    timeout: 2500,
  };

  return exports;
};
