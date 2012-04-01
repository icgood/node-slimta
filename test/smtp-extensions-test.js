
var vows = require("vows"),
    assert = require("assert");

var extensions = require("../lib/smtp/extensions");

vows.describe("smtp extensions").addBatch({
    'exports': {
        topic: extensions,

        'the EsmtpExtensions constructor': function (topic) {
            assert.ok(topic.EsmtpExtensions);
        },

        'the parseEhloString function': function (topic) {
            assert.ok(topic.parseEhloString);
        },

        'the buildEhloString function': function (topic) {
            assert.ok(topic.buildEhloString);
        },
    },

    'the EsmtpExtensions constructor': {
        topic: new extensions.EsmtpExtensions(),

        'does not have an arbitrary extension': function (topic) {
            assert.ok(!topic.has("nonexistent"));
        },

        'adds new extensions': {
            topic: function (ext) {
                ext.add("test1");
                ext.add("test2");
                ext.add("test3", "stuff");
                return ext;
            },

            'has the extension with no parameter': function (topic) {
                assert.ok(topic.has("test2"));
            },

            'has the extension with a parameter': function (topic) {
                assert.equal(topic.has("test3"), "stuff");
            },

            'one is dropped': {
                topic: function (ext) {
                    ext.drop("test1");
                    return ext;
                },

                'and no longer exists': function (topic) {
                    assert.ok(!topic.has("test1"));
                },

                'and the rest after reset': {
                    topic: function (ext) {
                        ext.reset();
                        return ext;
                    },

                    'no longer exist': function (topic) {
                        assert.ok(!topic.has("test2"));
                        assert.ok(!topic.has("test3"));
                    },
                },
            },
        },

    },
}).export(module);

// vim:et:sw=4:ts=4:sts=4:
