
var util = require("util"),
  events = require("events"),
  assert = require("assert");

function MockSmtpServer(expects, replies, debug) {
  events.EventEmitter.call(this);
  this.expects = expects;
  this.replies = replies;
  this.debug = debug;
}
util.inherits(MockSmtpServer, events.EventEmitter);

function flushReplies(self) {
  while (self.replies.length > self.expects.length) {
    var reply = self.replies.shift();
    if (self.debug) {
      console.log("S: [["+reply+"]]");
    }
    self.emit("data", reply);
  }
  if (self.replies.length === 0) {
    if (self.debug) {
      console.log("S: end");
    }
    self.emit("end");
  }
}

MockSmtpServer.prototype.start = function () {
  var self = this;
  process.nextTick(function () {
    flushReplies(self);
  });
};

MockSmtpServer.prototype.write = function (str) {
  if (this.debug) {
    console.log("C: [["+str+"]]");
  }
  var expected = this.expects.shift();
  assert.equal(str, expected);
  flushReplies(this);
};

MockSmtpServer.prototype.destroy = function () {

};

exports.MockSmtpServer = MockSmtpServer;

// vim:et:sw=2:ts=2:sts=2:
