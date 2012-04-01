
var util = require("util");

function CommandArgError(message, command) {
    Error.call(this);
    Error.captureStackTrace(this, CommandArgError);
    this.message = message;
    this.command = command;
}
util.inherits(CommandArgError, Error);

function Command(name, arg) {
    this.name = name;
    this.arg = arg;
    this.pipelined = false;
}

Command.prototype.toString = function () {
    if (!this.arg) {
        return this.name;
    }

    return [this.name, this.arg].join(' ');
};

Command.prototype.is = function (name) {
    var myName = this.name.toUpperCase();
    return myName === name.toUpperCase();
};

Command.prototype.isPipelined = function () {
    return this.pipelined === true;
};

Command.prototype.pushOnto = function (stack) {
    stack.push(this.toString());
};

function factory(name, arg) {
    var upperName = name.toUpperCase();

    if (upperName === "EHLO") {
        return new Ehlo(arg);
    }
    if (upperName === "HELO") {
        return new Helo(arg);
    }
    if (upperName === "STARTTLS") {
        return new StartTls();
    }
    if (upperName === "MAIL") {
        return parseMail(arg);
    }
    if (upperName === "RCPT") {
        return parseRcpt(arg);
    }
    if (upperName === "DATA") {
        return new Data();
    }
    if (upperName === "RSET") {
        return new Rset();
    }
    if (upperName === "QUIT") {
        return new Quit();
    }

    return new Command(name, arg);
}

var lineRe = /(.*)\r?\n/;
var commandRe = /^([a-zA-Z]+)([ \t]+(.*))?\s*$/;

function buildFromCommands(stack, start, end) {
    var i, lines = [];
    start = start || 0;
    end = end || stack.length;
    for (i=start; i<end; i++) {
        stack[i].pushOnto(lines);
    }
    lines.push('');
    return lines.join('\r\n');
}

function parseIntoCommands(data, ret) {
    ret = ret || {commands: [], remainder: data};

    var match = data.match(lineRe);
    if (!match) {
        return ret;
    }
    ret.remainder = data.slice(match[0].length);
    var line = match[1];

    match = line.match(commandRe);
    if (!match) {
        ret.commands.push(new InvalidSyntax(line));
    }
    else {
        ret.commands.push(factory(match[1], match[3]));
    }

    return parseIntoCommands(ret.remainder, ret);
}

function InvalidSyntax(line) {
    Command.call(this, line);
    this.line = line;
}
util.inherits(InvalidSyntax, Command);

function Banner() {
    Command.call(this, "[BANNER]");
}
util.inherits(Banner, Command);

Banner.prototype.toString = function () {
    return "[[Banner]]";
};

Banner.prototype.pushOnto = function (stack) {
    // Intentionally no-op.
};

function Ehlo(identifier) {
    Command.call(this, "EHLO");
    this.arg = identifier;
    this.identifier = identifier;
}
util.inherits(Ehlo, Command);

function Helo(identifier) {
    Command.call(this, "HELO");
    this.arg = identifier;
    this.identifier = identifier;
}
util.inherits(Helo, Command);

function StartTls() {
    Command.call(this, "STARTTLS");
}
util.inherits(StartTls, Command);

function Mail(address, options) {
    Command.call(this, "MAIL");
    this.pipelined = true;
    if (options && options.size) {
        this.arg = ["FROM:<", address, "> SIZE=", options.size].join('');
    }
    else {
        this.arg = ["FROM:<", address, ">"].join('');
    }
    this.address = address;
    this.options = options;
}
util.inherits(Mail, Command);

var mailRe = /^from\s*:\s*(.*)/i;
var mailReWithBrackets = /^<(.*)>([^\n>]*)$/;
var mailReWithoutBrackets = /^(\S*)/;
var mailReSizeOption = /\bsize=(\d+)\b/i;

function parseMail(arg) {
    var match = arg.match(mailRe);
    if (!match) {
        throw new CommandArgError("Bad argument.", new Command("MAIL", arg));
    }

    arg = match[1];
    match = arg.match(mailReWithBrackets);
    if (!match) {
        match = arg.match(mailReWithoutBrackets);
        return new Mail(match[1]);
    }

    var address = match[1],
        extra = match[2],
        options = {};

    match = extra.match(mailReSizeOption);
    if (match) {
        options.size = Number(match[1]);
    }

    return new Mail(address, options);
}

function Rcpt(address, options) {
    Command.call(this, "RCPT");
    this.pipelined = true;
    this.arg = ["TO:<", address, ">"].join('');
    this.address = address;
    this.options = options;
}
util.inherits(Rcpt, Command);

var rcptRe = /^to\s*:\s*(.*)/i;
var rcptReWithBrackets = /^<(.*)>([^\n>]*)$/;
var rcptReWithoutBrackets = /^(\S*)/;

function parseRcpt(arg) {
    var match = arg.match(rcptRe);
    if (!match) {
        throw new CommandArgError("Bad argument.", new Command("RCPT", arg));
    }

    arg = match[1];
    match = arg.match(rcptReWithBrackets);
    if (!match) {
        match = arg.match(rcptReWithoutBrackets);
        return new Rcpt(match[1]);
    }

    var address = match[1],
        extra = match[2],
        options = {};

    return new Rcpt(address, options);
}

function Data() {
    Command.call(this, "DATA");
}
util.inherits(Data, Command);

function SendData(data) {
    Command.call(this, "[SENDDATA]");
    this.pipelined = true;
    this.data = data;
}
util.inherits(SendData, Command);

SendData.prototype.toString = function () {
    return "[[Message Data]]";
};

SendData.prototype.pushOnto = function (stack) {
    stack.push(this.data);
    stack.push(".");
};

function Rset() {
    Command.call(this, "RSET");
}
util.inherits(Rset, Command);

function Quit() {
    Command.call(this, "QUIT");
}
util.inherits(Quit, Command);

exports.CommandArgError = CommandArgError;
exports.Command = Command;
exports.buildFromCommands = buildFromCommands;
exports.parseIntoCommands = parseIntoCommands;

exports.InvalidSyntax = InvalidSyntax;
exports.Banner = Banner;
exports.Ehlo = Ehlo;
exports.Helo = Helo;
exports.StartTls = StartTls;
exports.Mail = Mail;
exports.Rcpt = Rcpt;
exports.Data = Data;
exports.SendData = SendData;
exports.Rset = Rset;
exports.Quit = Quit;

// vim:et:sw=4:ts=4:sts=4:
