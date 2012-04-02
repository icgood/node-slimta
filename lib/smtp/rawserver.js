
var events = require("events"),
    util = require("util"),
    os = require("os");

var commands = require("./commands"),
    replies = require("./replies");

function RawServer(reader, writer, banner) {
    events.EventEmitter.call(this);
    this.reader = reader;
    this.writer = writer || reader;

    this.commandStack = [];
    this.replyStack = [banner || new replies.Reply("220", [os.hostname(), "ESMTP"].join(" "))];
    this.sent = 1;
    this.quit = false;

    setupListeners(this);
}
util.inherits(RawServer, events.EventEmitter);

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
        var ret = commands.parseIntoCommands(received);
        received = ret.remainder;

        var i;
        for (i=0; i<ret.commands.length; i++) {
            var command = ret.commands[i];
            self.commandStack.push(command);
            self.emit('command', command);
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

function OrderedServerResponse(replyStack, i) {
    this.replyStack = replyStack;
    this.i = i;
}

exports.RawServer = RawServer;

// vim:et:sw=4:ts=4:sts=4:
