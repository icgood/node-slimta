
var events = require("events"),
    util = require("util");

var commands = require("./commands"),
    replies = require("./replies");

function Server(reader, writer) {
    events.EventEmitter.call(this);
    this.reader = reader;
    this.writer = writer || reader;
}
util.inherits(Server, events.EventEmitter);

exports.commands = commands;
exports.replies = replies;
exports.Server = Server;

// vim:et:sw=4:ts=4:sts=4:
