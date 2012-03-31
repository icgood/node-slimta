
var util = require("util");

function Reply(code, message, esc) {
    this.code = code;
    this.codeType = code.charAt(0);

    if (!esc && esc !== "") {
        esc = generateMissingEsc(this.codeType);
    }

    if (esc) {
        this.message = [esc, message].join(" ");
    }
    else {
        this.message = message;
    }
}

function generateMissingEsc(type) {
    if (type === "2" || type === "4" || type === "5") {
        return type+".0.0";    
    }
}

Reply.prototype.toString = function () {
    var lines = this.message.split(/\r?\n/),
        retParts = [], i;

    if (lines.length === 1) {
        return [this.code, this.message].join(' ');
    }
    for (i=0; i<lines.length-1; i++) {
        retParts.push(this.code);
        retParts.push('-');
        retParts.push(lines[i]);
        retParts.push("\r\n");
    }
    retParts.push(this.code);
    retParts.push(' ');
    retParts.push(lines[lines.length-1]);
    
    return retParts.join('');
};

Reply.prototype.isSuccess = function () {
    return this.codeType === "2";
};

function InvalidSyntax(line) {
    this.line = line;
}
util.inherits(InvalidSyntax, Reply);

InvalidSyntax.prototype.toString = function () {
    return this.line;
};

InvalidSyntax.prototype.isSuccess = function () {
    return false;
};

var lineRe = /(.*)\r?\n/;
var partialReplyLineRe = /^\d\d\d-(.*)$/;
var finalReplyLineRe = /^(\d\d\d) (.*)$/;

function parseIntoReplies(data, ret) {
    ret = ret || {replies: [], current: [], remainder: data};

    var match = data.match(lineRe);
    if (!match) {
        return ret;
    }

    ret.remainder = data.slice(match[0].length);
    var line = match[1];

    match = line.match(finalReplyLineRe);
    if (match) {
        ret.current.push(match[2]);
        ret.replies.push(new Reply(match[1], ret.current.join("\r\n"), ""));
        ret.current = [];
        return parseIntoReplies(ret.remainder, ret);
    }

    match = line.match(partialReplyLineRe);
    if (match) {
        ret.current.push(match[1]);
        return parseIntoReplies(ret.remainder, ret);
    }

    ret.replies.push(new InvalidSyntax(line));
    return parseIntoReplies(ret.remainder, ret);
}

exports.Reply = Reply;
exports.InvalidSyntax = InvalidSyntax;
exports.parseIntoReplies = parseIntoReplies;

// vim:et:sw=4:ts=4:sts=4:
