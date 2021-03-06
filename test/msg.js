var expect = require('expect.js');
var msg = require('../lib/jsonrpc.js');
var testMsgs = require('./msgs/addbr');

var resPass1 = {id: 1, result: [], error: null};
var resPass2 = {id: '1', result: ['test'], error: null};
var resPass3 = {id: 'aa', error: 'bad method'};
var resPass4 = {id: 1, result: {test:['pass']}, error: null};
var resPass5 = {id: 1, result: null, error: 'a new error'};

describe('isResponse', function(){
  it('pass', function(){
    expect(msg.isResponse(resPass1)).to.be(true);
    expect(msg.isResponse(resPass2)).to.be(true);
    expect(msg.isResponse(resPass4)).to.be(true);
  });

  it('Response error pass', function(){
    expect(msg.isResponse(resPass3)).to.be(true);
    expect(msg.isResponse(resPass5)).to.be(true);
  });

  it('ovsdb trace response pass', function(){
    expect(msg.isResponse(testMsgs.Responses[0])).to.be(true);
    expect(msg.isResponse(testMsgs.Responses[1])).to.be(true);
  });
});

describe('isRequest pass', function(){
  describe('ovsdb trace', function(){
    it('should pass', function(){
      expect(msg.isRequest(testMsgs.Requests[0])).to.be(true);
      expect(msg.isRequest(testMsgs.Requests[1])).to.be(true);
    });
  });
  describe('method', function(){
    it('should be a string', function(){
      expect(msg.isRequest({method: "astring", params:[], id: 1})).to.be(true);
    });
  });
  describe('params', function(){
    it('should be an array', function(){
      expect(msg.isRequest({method: "t", params:[], id:1})).to.be(true);
    });
  });
  describe('id', function(){
    it('should be any type', function(){
      expect(msg.isRequest({method: "t", params:[], id: 1})).to.be(true);
      expect(msg.isRequest({method: "t", params:[], id: "one"})).to.be(true);
    });
  });
});

describe('isRequest fail', function(){
  describe('method', function(){
    it('should be a string', function(){
      expect(msg.isRequest({method: [], params:[], id: 1})).to.be(false);
      expect(msg.isRequest({method: {}, params:[], id: 1})).to.be(false);
    });
  });
  describe('params', function(){
    it('should be an array', function(){
      expect(msg.isRequest({method: "t", params:{}, id:1})).to.be(false);
      expect(msg.isRequest({method: "t", params:"n", id:1})).to.be(false);
    });
  });
});

describe('isNotification pass', function(){
  describe('ovsdb trace msgs', function(){
    it('should pass', function(){
      expect(msg.isNotification(testMsgs.Notifications[0])).to.be(true);
      expect(msg.isNotification(testMsgs.Notifications[1])).to.be(true);
    });
  });
  describe('id', function(){
    it('should be null', function(){
      expect(msg.isNotification({method: "astring", params:[], id: null})).to.be(true);
    });
  });
});
