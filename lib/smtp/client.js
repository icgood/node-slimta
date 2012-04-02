
var events = require("events"),
    assert = require("assert"),
    util = require("util");

var commands = require("./commands"),
    replies = require("./replies");

function Client(reader, writer) {
    events.EventEmitter.call(this);
    this.reader = reader;
    this.writer = writer || reader;

    this.commandStack = [new commands.Banner()];
    this.replyStack = [];
    this.sent = 1;
    this.quit = false;

    setupListeners(this);
}
util.inherits(Client, events.EventEmitter);

function end(self) {
    self.reader.destroy();
    if (self.writer !== self.reader) {
        self.writer.destroy();
    }
    self.emit('end');
}

function setupListeners(self) {
    self.reader.on('connect', function () {
        self.emit('connect');
    });

    var received = '';
    self.reader.on('data', function (buf) {
        received += buf;
        var ret = replies.parseIntoReplies(received);
        received = ret.remainder;

        var i;
        for (i=0; i<ret.replies.length; i++) {
            var reply = ret.replies[i];
            var command = self.commandStack[self.replyStack.length];
            self.replyStack.push(reply);
            self.emit('reply', command, reply);
        }

        if (self.quit && self.replyStack.length === self.commandStack.length) {
            end(self);
        }
        else {
            sendMore(self);
        }
    });

    self.reader.on('end', function () {
        end(self);
    });
}

function buildMore(self, flush) {
    var end,
        start = self.sent;

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
        self.writer.write(data);
    }
}

Client.prototype.seeHistory = function (callback) {
    var i;
    for (i=0; i<this.commandStack.length; i++) {
        callback(this.commandStack[i], this.replyStack[i]);
    }
};

Client.prototype.sendCommand = function (command, flush) {
    this.commandStack.push(command);
    if (command.is("QUIT")) {
        this.quit = true;
    }
    sendMore(this, flush);
};

Client.prototype.flushCommands = function () {
    sendMore(this, true);
};

exports.commands = commands;
exports.replies = replies;
exports.Client = Client;

// vim:et:sw=4:ts=4:sts=4:
