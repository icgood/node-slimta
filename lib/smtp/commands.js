
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

Command.prototype.isSuccessReply = function (reply) {
  return (reply.code === "250");
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

function buildFromCommands(stack, start, end) {
  var i, lines = [], len = stack.length;
  start = start || 0;
  if (end === undefined || end > len) {
    end = len;
  }
  for (i=start; i<end; i++) {
    stack[i].pushOnto(lines);
  }
  lines.push('');
  return lines.join('\r\n');
}

var lineRe = /(.*)\r?\n/;
var commandRe = /^([a-zA-Z]+)([ \t]+(.*))?\s*$/;
var noDataRe = /^\.\r?\n/;

function checkNoData(data, ret) {
  var noDataMatch = data.match(noDataRe);
  if (noDataMatch) {
    ret.commands.push(new SendData());
    ret.remainder = data.slice(noDataMatch[0].length);
    return true;
  }
  return false;
}

function parseMessageData(data, ret) {
  if (!ret.dataRe) {
    if (checkNoData (data, ret)) {
      return parseIntoCommands(ret.remainder, ret);
    }

    ret.dataRe = /\r?\n\.\r?\n/g;
  }

  var dataMatch = ret.dataRe.exec(data);
  if (!dataMatch) {
    if (data.length >= 5) {
      ret.dataRe.lastIndex = data.length - 5;
    }
    return ret;
  }

  var fullData = data.slice(0, dataMatch.index);
  ret.commands.push(new SendData(fullData));

  var nextCommandIndex = dataMatch.index + dataMatch[0].length;
  ret.remainder = data.slice(nextCommandIndex);

  return parseIntoCommands(ret.remainder, ret);
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
  var newCommand, nextParser = parseIntoCommands;
  if (!match) {
    newCommand = new InvalidSyntax(line);
  }
  else {
    newCommand = factory(match[1], match[3]);
    if (newCommand.is("DATA")) {
      nextParser = parseMessageData;
    }
  }
  ret.commands.push(newCommand);

  return nextParser(ret.remainder, ret);
}

function InvalidSyntax(line) {
  Command.call(this, line);
  this.line = line;
}
util.inherits(InvalidSyntax, Command);

InvalidSyntax.prototype.isSuccessReply = function () {
  return false;
};

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

Banner.prototype.isSuccessReply = function (reply) {
  return (reply.code === "220");
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

StartTls.prototype.isSuccessReply = function (reply) {
  return (reply.code === "220");
};

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

  var address = match[1];
  var extra = match[2];
  var options = {};

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

  var address = match[1];
  var extra = match[2];
  var options = {};

  return new Rcpt(address, options);
}

function Data() {
  Command.call(this, "DATA");
}
util.inherits(Data, Command);

Data.prototype.isSuccessReply = function (reply) {
  return (reply.code === "354");
};

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
  if (this.data) {
    stack.push(this.data);
  }
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

Quit.prototype.isSuccessReply = function () {
  return true;
};

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

// vim:et:sw=2:ts=2:sts=2:
