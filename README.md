# egg-tchannel
[tchannel](https://github.com/uber/tchannel-node) plugin for egg.       
## Install

```sh
$ npm i tchannel  
$ npm i egg-tchannel  
```

## Configuration

`egg-tchannel` with default configurations below:

- cacheThriftTime: `0` thriftIDL cache millisecond, 0 => permanent   
- thriftIDLPath: `path.join(appInfo.baseDir, "thrift_idl")`    
- timeout: `2500`  

```js
// {app_root}/config/config.default.js
exports.tchannel = {
  // timeout: 2500,
};
```

## Usage

```js
// {app_root}/app.js

class AppBootHook {
  constructor (app) {
    this.app = app;
  }

  async didLoad () {
    // registry should return a promise, like:
    function registry(serviceName, tag) {
      return Promise.resolve([
        {
          peer: '192.x.x.10:6666'
        },
        {
          peer: '192.x.x.11:6666'
        }
      ]);
    }
    this.app.tchannel.configure({
      registry: registry
    });
  }
}

module.exports = AppBootHook;
```

In controller, you can use `app.tchannel.request`.

```js
// app/controller/home.js

module.exports = app => {
  return class HomeController extends app.Controller {
    async index() {
      const { ctx, app } = this;
      const res = await app.tchannel.request({
        serviceName: 'serviceName',
        method: 'method',
        headers: {},
        body: {
         'some key': 'some data',
        },
        tag: 'group1',
        options: {}
      });
      ctx.body = res;
    }
  };
};
```

## Questions & Suggestions

Please open an issue [here](https://github.com/hm496/egg-tchannel/issues).

## License

[MIT](https://github.com/hm496/egg-tchannel/blob/master/LICENSE)
