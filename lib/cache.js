/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

/* {{{ exports getkey() */
/**
 * 构造key
 */
var cacheindex  = function(key) {

  key = (key instanceof Buffer) ? key : new Buffer(key);

  var hash1 = 5381;
  var hash2 = 0;
  for (var i = 0, len = key.length; i < len; i++) {
    hash1 = (hash1 << 5 + hash1) + key[i];
    hash2 = (hash2 << 4) ^ (hash2 >> 28) ^ key[i];
  }

  return ([hash1, hash2, key.length]).join(':');
};
exports.getkey  = cacheindex;
/* }}} */

/* {{{ function MemoryStore() */
/**
 * 数据存储在内存中
 */
var MemoryStore = function(size) {

  var _pool = require(__dirname + '/mstack.js').create(size || 2000);

  var _me = {};

  _me.set = function(key, value, callback) {
    _pool.set(key, value);
    callback(null);
  };

  _me.get = function(key, callback) {
    callback(null, _pool.get(key));
  };

  _me.delete = function(key, callback) {
    _pool.clean();
    callback(null);
  };

  return _me;
};
/* }}} */

var __instances = {};
exports.create  = function(name, store, keeper, options) {

  name  = name.trim().toLowerCase();
  if (undefined !== __instances[name]) {
    return __instances[name];
  }

  /* {{{ private variable _conf */
  var _conf = {
    'tag_flush_interval'    : 5000,
    'tag_max_expire_time'   : 7 * 86400000,
  };
  for (var key in options) {
    _conf[key]  = options[key];
  }
  /* }}} */

  /* {{{ private variable _res */
  /**
   * @缓存存储引擎
   */
  var _res  = store;

  if (!_res || !_res.set || !_res.get || !_res.delete) {
    _res    = MemoryStore();
    var serialize   = function(value) {
      return value;
    };
    var unserialize = function(value) {
      return value;
    };
  } else {
    var serialize   = function(value) {
      return JSON.stringify((value instanceof Buffer) ? value.toString() : value);
    };
    var unserialize = function(value) {
      try {
        return JSON.parse(value.toString());
      } catch (e) {
        return null;
      }
    };
  }
  /* }}} */

  /* {{{ private variable _sync */
  /**
   * @Tag同步引擎
   */
  var _sync = keeper;

  /**
   * @Tag数据更新时间
   */
  var _tags = {};

  /**
   * @有更新的tag
   */
  var _upds = {};

  /**
   * @数据同步时间
   */
  var _time = Date.now() - _conf.tag_max_expire_time;

  var sync_tag_time = function() {
    for (var key in _upds) {
      (function() {
        var t = _upds[key];
        _sync.write(key, t, function(error) {
          if (error && (!_upds[key] || t > _upds[key])) {
            _upds[key]  = t;
          }
        });
      })();
      delete _upds[key];
    }

    _sync.load(function(error, _data) {
      if (error) {
        return;
      }

      for (var idx in _data) {
        _tags[idx]  = _tags[idx] ? Math.max(_data[idx], _tags[idx]) : _data[idx];
        _time   = Math.max(_time, _tags[idx]);
      }
    }, _time);
  };
  /* }}} */

  /* {{{ private variable timer */
  /**
   * @tag数据同步定时器
   */
  var timer = null;
  if (_sync) {
    timer   = setInterval(sync_tag_time, _conf.tag_flush_interval);
  }
  /* }}} */

  var _me   = __instances[name] = {};

  /* {{{ public function set() */
  /**
   * Set cache value
   *
   * @param {String} key
   * @param {Object} value
   * @param {Function} callback
   * @param {Integer} expire
   * @param {Array} tags
   */
  _me.set   = function(key, value, callback, expire, tags) {
    var now = Date.now();
    expire = expire || 86400000;
    _res.set(cacheindex(name + '#' + key), serialize({
      'i'   : now,                                  /**<    数据写入时间    */
      'e'   : now + expire,                         /**<    数据过期时间    */
      'k'   : key,                                  /**<    数据key         */
      'v'   : value,                                /**<    数据值          */
      't'   : tags ? (Array.isArray(tags) ? tags : [tags]) : [],
    }), callback, Math.floor(expire / 1000));
  };
  /* }}} */

  /* {{{ public function get() */
  _me.get   = function(key, callback) {
    var now = Date.now();
    _res.get(cacheindex(name + '#' + key), function(error, value) {
      if (error || !value) {
        callback(error, null);
        return;
      }

      value = unserialize(value);
      if (!value.i || !value.e || !value.k || undefined === value.v) {
        callback(new Error('UnExpectCacheValue'));
        return;
      }

      /**
       * @time expire or key does not match
       */
      if (value.e < now || value.k != key) {
        callback(null, null);
        return;
      };

      /**
       * @tag expire
       */
      var _list = Array.isArray(value.t) ? value.t : [];
      var _len  = _list.unshift('__global__');
      for (var i = 0; i < _len; i++) {
        var idx = _list[i];
        if (_tags[idx] && value.i <= _tags[idx]) {
          callback(null, null);
          return;
        }
      }

      callback(null, value.v, value.e - now);
    });
  };
  /* }}} */

  /* {{{ public function unset() */
  _me.unset = function(key, callback) {
    _res.delete(cacheindex(name + '#' + key), callback);
  };
  /* }}} */

  /* {{{ public function tagrm() */
  /**
   * 根据tag删除缓存
   *
   * @param {String}  tag
   * @param {Integer} delay time (ms)
   */
  _me.tagrm = function(tag, delay, flush) {
    var tag = tag ? tag.trim() : '__global__';
    var now = Date.now();
    if (delay) {
      delay = parseInt(delay, 10);
      now   += delay ? delay : 0;
    }

    _upds[tag]  = now;
    _tags[tag]  = now;
    if (flush && _sync) {
      _sync.write(tag, now, function(error){});
    }
  };
  /* }}} */

  return _me;
}
