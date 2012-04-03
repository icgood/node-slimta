
var events = require("events"),
    assert = require("assert"),
    util = require("util");

var commands = require("./commands"),
    replies = require("./replies");

function RawClient(stream) {
  events.EventEmitter.call(this);
  this.stream = stream;
  this.instantFlush = false;

  this.commandStack = [new commands.Banner()];
  this.replyStack = [];
  this.sent = 1;
  this.quit = false;
  this.ended = false;

  setupListeners(this);
}
util.inherits(RawClient, events.EventEmitter);

function end(self) {
  if (!self.ended) {
    self.stream.destroy();
    self.emit('end');
    self.ended = true;
  }
}

function setupListeners(self) {
  self.stream.on('connect', function () {
    self.emit('connect');
  });

  var received = '';
  self.stream.on('data', function (buf) {
    buf = buf.toString('ascii');
    received += buf;
    var ret = replies.parseIntoReplies(received);
    received = ret.remainder;

    var i;
    for (i=0; i<ret.replies.length; i++) {
      var reply = ret.replies[i];
      var command = self.commandStack[self.replyStack.length];
      self.replyStack.push(reply);
      self.emit('reply', reply, command);
    }

    if (self.quit && self.replyStack.length === self.commandStack.length) {
      end(self);
    }
    else {
      sendMore(self);
    }
  });

  self.stream.on('error', function (err) {
    self.emit('error', err);
  });

  self.stream.on('end', function () {
    end(self);
  });
}

function buildMore(self, flush) {
  var end, start = self.sent;

  if (start > self.replyStack.length) {
    return;
  }

  for (end=start; end<self.commandStack.length; end++) {
    if (!self.commandStack[end].isPipelined()) {
      self.sent = end+1;
      return commands.buildFromCommands(self.commandStack, start, end+1);
    }
  }

  if (flush) {
    self.sent = end;
    return commands.buildFromCommands(self.commandStack, start, end);
  }
}

function sendMore(self, flush) {
  var data = buildMore(self, flush);
  if (data) {
    process.nextTick(function () {
      self.stream.write(data, 'ascii');
    });
  }
}

RawClient.prototype.setInstantFlush = function (val) {
  if (val !== undefined) {
    this.instantFlush = val;
  }
  else {
    this.instantFlush = true;
  }
};

RawClient.prototype.seeHistory = function (callback) {
  var i;
  for (i=0; i<this.commandStack.length; i++) {
    callback(this.commandStack[i], this.replyStack[i]);
  }
};

RawClient.prototype.sendCommand = function (command, flush) {
  this.commandStack.push(command);
  if (command.is("QUIT")) {
    this.quit = true;
  }
  if (flush !== undefined) {
    sendMore(this, flush);
  }
  else {
    sendMore(this, this.instantFlush);
  }
};

RawClient.prototype.flushCommands = function () {
  sendMore(this, true);
};

exports.RawClient = RawClient;

// vim:et:sw=2:ts=2:sts=2:
