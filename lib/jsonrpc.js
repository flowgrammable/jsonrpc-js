var uuid = require('uuid');
var _    = require('underscore');
var bunyan = require('bunyan');
var logutil = require('./logutil');
var buf  = require('./buffer');

var defaultLogConfig = {
  name: 'jsonrpc',
  process: process.stderr,
  level: 'error'
};

function Request(method, params) {
  this.method = method;
  this.params = params;
  this.id     = uuid.v4(); 
}

function Response(result, id, error) {
  this.result = result;
  this.error  = error || null;
  this.id     = id;
}

function Notify(method, params) {
  this.method = method;
  this.params = params;
  this.id     = null;
}

function isRequest(msg) {
  return !_(msg.method).isUndefined() && _(msg.method).isString() &&
         !_(msg.params).isUndefined() && _(msg.params).isArray() &&
         !_(msg.id).isUndefined();
}
exports.isRequest = isRequest;

function isNotification(msg) {
  // assumes its a request
  return (msg.id === null || _(msg.id).isUndefined() );
}
exports.isNotification = isNotification;

function isSuccess(msg) {
  return (!msg.error || msg.error === null) &&
         !_(msg.result).isUndefined();
}

function isError(msg) {
  return (!msg.result || msg.result === null) &&
         !_(msg.error).isUndefined();
}

function isResponse(msg) {
  return (isError(msg) || isSuccess(msg) ) && 
         !_(msg.id).isUndefined();
}
exports.isResponse = isResponse;

// private serialization of json and send
function send(socket, msg) {
  socket.write(JSON.stringify(msg));
}

function Peer(socket, reqCB, notCB, tm_wait, destroy, logCfg) {
  var that = this;
  // peer socket we're managing
  this.socket = socket;
  // socket buffer for msg formation
  this.buffer = new buf.Buffer();
  // who to call for new requests
  this.requestCB = reqCB;
  // who to call for notifications
  this.notifyCB  = notCB;
  // allow a user supplied external destruction callback
  this.destroyCB = destroy || function() {};
  // cache of outstanding requests
  this.requests = {};
  // incoming socket data handler
  this.socket.on('data', function(data) {
    that.recv(data);
  });
  // closed socket handler
  socket.on('end', function() {
    that.dtor();
  });
  // set a timer to check on outstanding requests
  this.time_wait = tm_wait || 10000;
  // set logger
  this.logConfig = logCfg.jsonrpc || defaultLogConfig;
  this.logConfig.serializers = logutil.msgSerializers;
  this.log = new bunyan.createLogger(this.logConfig);
}

Peer.prototype.dtor = function() {
  // Cleanup the socket
  this.socket.destroy();
  // Send timeout errors to any waiting clients
  _(this.requests).each(function(value) {
    value.callback('Request timeout');
  });
  // Initiate the user supplied callback
  this.destroyCB();
};

Peer.prototype.timer = function() {
  // get the current time in milliseconds
  var ct = new Date().getTime();
  // invoke an error and delete any stale requests
  _(this.requests).each(function(value, key) {
    if(ct >= value.timeout) {
      this.logger.info('Request timed out', value);
      value.callback('Request timed out');
      delete this.requests[key];
    }
  }, this);
};

Peer.prototype.recv = function(data) {
  try {
    _(this.buffer.read(data)).each(function(msg) {
      if(isResponse(msg)) {
        this.rxResponse(msg);
      } else if(isRequest(msg)) {
        if(isNotification(msg)) {
          this.rxNotification(msg);
        } else {
          this.rxRequest(msg);
        }
      } else {
        this.log.error('Bad msg: '+msg);
      }
    }, this);
  } catch(e) {
    this.log.error(e);
    this.dtor();
  }
};

Peer.prototype.rxRequest = function(msg) {
  this.log.info({jsonReq: msg},'REQUEST');
  this.requestCB(msg);
};

Peer.prototype.rxNotification = function(msg) {
  this.log.info({jsonNot: msg},'NOTIFICATION');
  this.notifyCB(msg);
};

Peer.prototype.rxResponse = function(msg) {
  if(_(this.requests).has(msg.id)) {
    this.log.info({jsonRes: msg},'RESPONSE');
    this.requests[msg.id].callback(msg.error, msg.result);
    delete this.requests[msg.id];
  } else {
    this.log.error('Unknown response', msg.id);
  }
};

Peer.prototype.request = function(method, params, cb) {
  // Construct the message
  var msg = new Request(method, params);
  // Remember the request transaction
  this.requests[msg.id] = {
    msg: msg,
    callback: cb,
    timeout: (this.time_wait + new Date().getTime())
  };
  // log outgoing message
  this.log.info(msg);
  // Send the msg
  send(this.socket, msg);
  return msg;
};

Peer.prototype.response = function(result, id, error) {
  var msg = new Response(result, id, error);
  send(this.socket, msg);
  return msg;
};

Peer.prototype.notify = function(method, params) {
  var msg = new Notify(method, params);
  send(this.socket, msg);
  return msg;
};

exports.Peer = Peer;

