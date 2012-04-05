
var events = require('events'),
    util = require('util');

var commands = require('./commands'),
    replies = require('./replies');

function RawClient(stream, debug) {
  events.EventEmitter.call(this);
  this.stream = stream;
  this.pipeline = false;
  this.debug = debug;

  this.commandsToSend = [];
  this.commandsWaiting = [new commands.Banner()];

  setupListeners.call(this);
}
util.inherits(RawClient, events.EventEmitter);

function setupListeners() {
  var self = this;

  self.stream.on('connect', function onConnect() {
    self.emit('connect');
  });

  var received = '';
  self.stream.on('data', function onData(buf) {
    received = handleData.call(self, buf.toString('ascii'), received);
  });

  self.stream.on('error', function onError(err) {
    self.emit('error', err);
  });

  self.stream.on('end', function onEnd() {
    self.emit('end');
  });
}

function handleData(data, received) {
  if (this.debug) {
    console.log('S: [['+data+']]');
  }

  received += data;
  var ret = replies.parseIntoReplies(received);
  
  var i, quit = false;
  for (i=0; i<ret.replies.length; i++) {
    var reply = ret.replies[i];
    var command = this.commandsWaiting.shift();
    quit = command && command.is('QUIT');
    this.emit('reply', reply, command);
  }

  if (quit) {
    this.stream.destroy();
  }
  else if (this.commandsWaiting.length === 0) {
    this.emit('drain');
  }

  sendMore.call(this);
  return ret.remainder;
}

function buildSendableCommands() {
  if (this.commandsWaiting.length > 0) {
    return;
  }

  var i;
  for (i=0; i<this.commandsToSend.length; i++) {
    if (!this.pipeline || !this.commandsToSend[i].isPipelined()) {
      break;
    }
  }
  var ret = commands.buildFromCommands(this.commandsToSend, 0, i+1);
  this.commandsWaiting = this.commandsToSend.slice(0, i+1);
  this.commandsToSend = this.commandsToSend.slice(i+1);
  return ret;
}

function sendMore() {
  var self = this;
  var data = buildSendableCommands.call(this);
  if (data) {
    process.nextTick(function () {
      self.stream.write(data, 'ascii');
    });
    return true;
  }
  return false;
}

RawClient.prototype.allowPipelining = function (val) {
  if (val !== undefined) {
    this.pipeline = val;
  }
  else {
    this.pipeline = true;
  }
};

RawClient.prototype.sendCommand = function (command) {
  this.commandsToSend.push(command);
  return sendMore.call(this);
};

exports.RawClient = RawClient;

// vim:et:sw=2:ts=2:sts=2:
