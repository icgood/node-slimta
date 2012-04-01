
var util = require("util"),
    events = require("events"),
    assert = require("assert");

function MockSmtpServer(expects, replies) {
    events.EventEmitter.call(this);
    this.expects = expects;
    this.replies = replies;
}
util.inherits(MockSmtpServer, events.EventEmitter);

function flushReplies(self) {
    while (self.replies.length > self.expects.length) {
        var reply = self.replies.shift();
        self.emit("data", reply);
    }
    if (self.replies.length === 0) {
        self.emit("end");
    }
}

MockSmtpServer.prototype.start = function () {
    flushReplies(this);
};

MockSmtpServer.prototype.write = function (str) {
    var expected = this.expects.shift();
    assert.equal(str, expected);
    flushReplies(this);
};

MockSmtpServer.prototype.destroy = function () {

};

exports.MockSmtpServer = MockSmtpServer;

// vim:et:sw=4:ts=4:sts=4:
