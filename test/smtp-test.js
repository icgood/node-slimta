
var vows = require("vows"),
    assert = require("assert");

var smtp = require("../lib/smtp");

vows.describe("smtp").addBatch({
    'exports': {
        topic: smtp,

        'the client module': function (topic) {
            assert.ok(topic.client);
        },

        'the server module': function (topic) {
            assert.ok(topic.server);
        },
    },
}).export(module);

// vim:et:sw=4:ts=4:sts=4:
