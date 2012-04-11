
var net = require("net"),
    tls = require("tls"),
    events = require("events"),
    os = require("os"),
    util = require("util"),
    assert = require("assert");

var RawClient = require("./rawclient").RawClient,
    commands = require("./commands"),
    replies = require("./replies"),
    extensions = require("./extensions");

function getStream(options) {
  if (options.stream) {
    return options.stream;
  }

  var socket;
  if (options.host || options.port) {
    if (options.ssl) {
      return tls.connect(options.port || 25, options.host, options);
    }
    socket = net.createConnection(options.port || 25, options.host);
    return socket;
  }

  if (options.path) {
    socket = net.createConnection(options.path);
    return socket;
  }

  if (options.ssl) {
    return tls.connect(25, "localhost", options);
  }
  socket = net.createConnection(25, "localhost");
  return socket;
}

function request(options, callback) {
  var stream = getStream(options);
  var rawClient = new RawClient(stream);
  var req = new ClientRequest(rawClient, options);
  if (callback) {
    req.on('response', callback);
  }
  return req;
}

function ClientRequest(rawClient, options) {
  events.EventEmitter.call(this);
  this.rawClient = rawClient;
  this.options = options;
  fillDefaultOptions(this.options);

  this.bannerReply = null;
  this.ehloReply = null;
  this.extensions = new extensions.EsmtpExtensions();
  this.messages = [];

  this.currentMessage = null;
  this.currentMessageData = null;

  this.readable = true;
  this.writable = true;

  setupListeners.call(this);
}
util.inherits(ClientRequest, events.EventEmitter);

function fillDefaultOptions(options) {
  if (!options.ehlo) {
    options.ehlo = os.hostname();
  }
}

function setupListeners() {
  var self = this;

  this.rawClient.on('connect', function () {
    self.emit('connect');
  });

  this.rawClient.on('reply', function () {
    handleReply.apply(self, arguments);
  });

  this.rawClient.on('error', function (err) {
    self.readable = false;
    self.writable = false;
    self.emit('error', err);
  });

  this.rawClient.on('end', function () {
    self.readable = false;
    self.writable = false;
    self.emit('end');
  });
}

ClientRequest.prototype.writeHead = function (sender, rcpts, options) {
  assert.ok(this.writable, 'ClientRequest no longer writable.');

  if (this.currentMessageData) {
    this.currentMessageData.end();
    this.currentMessageData = null;
    this.currentMessage = null;
  }
  else {
    var lastMessage = this.messages[this.messages.length-1];
    if (lastMessage) {
      lastMessage.messageParts.push(null);
    }
  }

  this.messages.push(new ClientMessage(sender, rcpts, options));

  trySendingMore.call(this);
};

ClientRequest.prototype.write = function (part) {
  assert.ok(this.writable, 'ClientRequest no longer writable.');
  assert.ok(this.messages.length > 0, 'Call writeHead before write.');

  if (this.currentMessageData) {
    this.currentMessageData.write(part);
    return;
  }

  var lastMessage = this.messages[this.messages.length-1];
  lastMessage.messageParts.push(part);
};

function loadExtensions(ehloString) {
  this.extensions = extensions.parseEhloString(ehloString).extensions;
  this.rawClient.allowPipelining(this.extensions.has('PIPELINING'));
}

ClientRequest.prototype.end = function (part) {
  if (!this.writable) {
    return;
  }

  if (part) {
    this.write(part);
  }

  if (this.currentMessageData) {
    this.currentMessageData.end();
    this.currentMessageData = null;
    this.currentMessage = null;
  }
  else {
    var lastMessage = this.messages[this.messages.length-1];
    if (lastMessage) {
      lastMessage.messageParts.push(null);
    }
  }

  this.messages.push(null);
  trySendingMore.call(this);
  this.writable = false;
};

ClientRequest.prototype.destroy = function () {
  this.readable = false;
  this.writable = false;
  return this.rawClient.destroy();
};

function handleReply(reply, command) {
  if (command instanceof commands.Quit) {
    return;
  }

  if (command instanceof commands.Banner) {
    return handleBannerReply.call(this, reply, command);
  }
  
  if (command instanceof commands.Ehlo || command instanceof commands.Helo) {
    return handleEhloReply.call(this, reply, command);
  }

  if (command instanceof commands.Mail) {
    return handleMailReply.call(this, reply, command);
  }

  if (command instanceof commands.Rcpt) {
    return handleRcptReply.call(this, reply, command);
  }

  if (command instanceof commands.Data) {
    return handleDataReply.call(this, reply, command);
  }

  if (command instanceof commands.SendData) {
    return handleSendDataReply.call(this, reply, command);
  }
}

function handleBannerReply(reply, command) {
  if (!command.isSuccessReply(reply)) {
    this.emit('error', reply, command);
    return this.rawClient.sendCommand(new commands.Quit());
  }

  this.bannerReply = reply;
  this.rawClient.sendCommand(new commands.Ehlo(this.options.ehlo));
}

function handleEhloReply(reply, command) {
  if (!command.isSuccessReply(reply)) {
    if (reply.isPermanent() && command instanceof commands.Ehlo) {
      return this.rawClient.sendCommand(new commands.Helo(command.identifier));
    }
    this.emit('error', reply, command);
    return this.rawClient.sendCommand(new commands.Quit());
  }

  this.ehloReply = reply;

  if (command instanceof commands.Ehlo) {
    loadExtensions.call(this, reply.message);
  }

  return trySendingMore.call(this);
}

function handleMailReply(reply, command) {
  if (!command.isSuccessReply(reply)) {
    this.emit('response', reply, command);
    this.rawClient.discardCommands();
    this.currentMessage = null;
    return trySendingMore.call(this);
  }
}

function handleRcptReply(reply, command) {
  if (!this.currentMessage) {
    return;
  }

  this.currentMessage.checkRcptReply(reply);
}

function handleDataReply(reply, command) {
  if (!command.isSuccessReply(reply)) {
    this.emit('response', reply, command);
    this.currentMessage = null;
    return trySendingMore.call(this);
  }
  
  if (!this.currentMessage) {
    return trySendingMore.call(this);
  }

  this.currentMessageData = this.rawClient.startMessageData();
  if (!this.currentMessage.rcptAccepted) {
    this.currentMessageData.end();
    this.currentMessageData = null;
    this.currentMessage = null;
    return trySendingMore.call(this);
  }

  var i, parts = this.currentMessage.messageParts;
  for (i=0; i<parts.length; i++) {
    if (parts[i] === null) {
      this.currentMessageData.end();
      this.currentMessageData = null;
      this.currentMessage = null;
      return trySendingMore.call(this);
    }

    this.currentMessageData.write(parts[i]);
  }
}

function handleSendDataReply(reply, command) {
  this.emit('response', reply, command);
}

function trySendingMore() {
  if (this.currentMessage || !this.ehloReply) {
    return;
  }
  this.currentMessage = this.messages.shift();

  if (this.currentMessage === null) {
    this.rawClient.sendCommand(new commands.Quit());
    return;
  }

  if (this.currentMessage === undefined) {
    return;
  }

  this.currentMessage.sendEnvelope(this.rawClient);
}

function ClientMessage(sender, rcpts, options) {
  this.sender = sender;
  this.recipients = rcpts;
  this.options = options;

  this.rcptAccepted = false;
  this.messageParts = [];
}

ClientMessage.prototype.checkRcptReply = function (reply) {
  if (reply.isSuccess()) {
    this.rcptAccepted = true;
  }
};

ClientMessage.prototype.sendEnvelope = function (rawClient) {
  rawClient.sendCommand(new commands.Mail(this.sender, this.options));
  var i;
  for (i=0; i<this.recipients.length; i++) {
    rawClient.sendCommand(new commands.Rcpt(this.recipients[i], this.options));
  }
  rawClient.sendCommand(new commands.Data());
};

exports.request = request;

// vim:et:sw=2:ts=2:sts=2:
