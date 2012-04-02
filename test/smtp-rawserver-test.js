
var vows = require("vows"),
    assert = require("assert");

var RawServer = require("../lib/smtp/rawserver").RawServer,
    commands = require("../lib/smtp/commands"),
    replies = require("../lib/smtp/replies");

var mocksmtp = require("./helpers/mock-smtp");

vows.describe("smtp server").addBatch({
    'the RawServer constructor': {

    },
}).export(module);

// vim:et:sw=4:ts=4:sts=4:
