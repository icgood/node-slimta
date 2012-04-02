
var util = require("util"),
    assert = require("assert");

function EsmtpExtensions() {
    this.extensions = {};
}

EsmtpExtensions.prototype.reset = function () {
    this.extensions = {};
};

EsmtpExtensions.prototype.has = function (name) {
    return this.extensions[name.toUpperCase()];
};

EsmtpExtensions.prototype.add = function (name, param) {
    this.extensions[name.toUpperCase()] = param || true;
};

EsmtpExtensions.prototype.drop = function (name) {
    delete this.extensions[name.toUpperCase()];
};

var lineBreakRe = /\r?\n/;
var extensionRe = /^\s*([a-zA-Z0-9][a-zA-Z0-9\-]*)([ \t]+(.*?))?\s*$/;

function parseEhloString(data) {
    var ret = new EsmtpExtensions();
    var i, lines = data.split(lineBreakRe);

    for (i=1; i<lines.length; i++) {
        var match = lines[i].match(extensionRe);
        if (match) {
            ret.add(match[1], match[3]);
        }
    }
    return {extensions: ret, header: lines[0]};
}

function buildEhloString(ext, header) {
    assert.ok(ext instanceof EsmtpExtensions, "expected EsmtpExtension object.");
    var extensions = ext.extensions;
    var key, lines = [header];
    for (key in extensions) {
        if (extensions.hasOwnProperty(key)) {
            if (extensions[key] === true) {
                lines.push(key);
            }
            else {
                lines.push([key, extensions[key]].join(" "));
            }
        }
    }
    return lines.join("\r\n");
}

exports.EsmtpExtensions = EsmtpExtensions;
exports.parseEhloString = parseEhloString;
exports.buildEhloString = buildEhloString;

// vim:et:sw=4:ts=4:sts=4:
