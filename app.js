const createTchannel = require('./lib/tchannel');

module.exports = app => {
  createTchannel(app);
}
