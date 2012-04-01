
var vows = require("vows"),
    assert = require("assert");

var client = require("../lib/smtp/client"),
    commands = client.commands,
    replies = client.replies;

var mocksmtp = require("./helpers/mock-smtp");

vows.describe("smtp client").addBatch({
    'exports': {
        topic: client,

        'the Client constructor': function (topic) {
            assert.ok(topic.Client);
        },

        'the commands module': function (topic) {
            assert.equal(topic.commands, require("../lib/smtp/commands"));
        },

        'the replies module': function (topic) {
            assert.equal(topic.replies, require("../lib/smtp/replies"));
        },

    },

    'the Client constructor': {
        'given only the implied Banner command': {
            topic: function () {
                var mock = new mocksmtp.MockSmtpServer([], ["220 Welcome\r\n"]);
                var topic = new client.Client(mock, mock);
                topic.on('end', this.callback);
                mock.start();
            },

            'contains just one Banner command': function (err) {
                assert.ifError(err);
                var cmdHistory = [];
                this.seeHistory(function (command, reply) {
                    cmdHistory.push(command);
                });

                assert.equal(cmdHistory.length, 1);
                assert.ok(cmdHistory[0] instanceof commands.Banner);
            },

            'contains just one Reply': function (err) {
                assert.ifError(err);
                var replyHistory = [];
                this.seeHistory(function (command, reply) {
                    replyHistory.push(reply);
                });

                assert.equal(replyHistory.length, 1);
                assert.ok(replyHistory[0] instanceof replies.Reply);
                assert.equal(replyHistory[0].code, "220");
                assert.equal(replyHistory[0].message, "Welcome");
            },
        },

        'sent an additional Ehlo command': {
            topic: function () {
                var mock = new mocksmtp.MockSmtpServer(["EHLO there\r\n"], ["220 Welcome\r\n", "250-Extensions\r\n250-and\r\n250 stuff\r\n"]);
                var topic = new client.Client(mock, mock);
                topic.on('end', this.callback);
                mock.start();
                topic.sendCommand(new commands.Ehlo("there"));
            },

            'contains Ehlo command after implied Banner': function (err) {
                assert.ifError(err);
                var cmdHistory = [];
                this.seeHistory(function (command, reply) {
                    cmdHistory.push(command);
                });

                assert.equal(cmdHistory.length, 2);
                assert.ok(cmdHistory[0] instanceof commands.Banner);
                assert.ok(cmdHistory[1] instanceof commands.Ehlo);
            },

            'contains two replies': function (err) {
                assert.ifError(err);
                var replyHistory = [];
                this.seeHistory(function (command, reply) {
                    replyHistory.push(reply);
                });

                assert.equal(replyHistory.length, 2);
                assert.equal(replyHistory[0].code, "220");
                assert.equal(replyHistory[0].message, "Welcome");
                assert.equal(replyHistory[1].code, "250");
                assert.equal(replyHistory[1].message, "Extensions\r\nand\r\nstuff");
            },
        },
 
        'sent an entire SMTP session': {
            topic: function () {
                var mock = new mocksmtp.MockSmtpServer(
                        ["EHLO there\r\n",
                         "MAIL FROM:<sender@address>\r\nRCPT TO:<rcpt@address>\r\nDATA\r\n",
                         "From: sender@address\r\nTo: rcpt@address\r\nSubject: test\r\n\r\nstuff\r\n\r\n.\r\nQUIT\r\n",],
                        ["220 Welcome\r\n",
                         "250-Extensions\r\n250-and\r\n250 stuff\r\n",
                         "250 Sender accepted\r\n250 Recipient accepted\r\n354 Send your Data!\r\n",
                         "250 Message accepted\r\n221 Quitting\r\n",]
                    );
                var topic = new client.Client(mock, mock);
                topic.on('end', this.callback);
                mock.start();
                topic.sendCommand(new commands.Ehlo("there"));
                topic.sendCommand(new commands.Mail("sender@address"));
                topic.sendCommand(new commands.Rcpt("rcpt@address"));
                topic.sendCommand(new commands.Data());
                topic.sendCommand(new commands.SendData("From: sender@address\r\nTo: rcpt@address\r\nSubject: test\r\n\r\nstuff\r\n"));
                topic.sendCommand(new commands.Quit());
            },

            'contains all the commands in order': function (err) {
                assert.ifError(err);
                var cmdHistory = [];
                this.seeHistory(function (command, reply) {
                    cmdHistory.push(command);
                });

                assert.equal(cmdHistory.length, 7);
                assert.ok(cmdHistory[0] instanceof commands.Banner);
                assert.ok(cmdHistory[1] instanceof commands.Ehlo);
                assert.ok(cmdHistory[2] instanceof commands.Mail);
                assert.ok(cmdHistory[3] instanceof commands.Rcpt);
                assert.ok(cmdHistory[4] instanceof commands.Data);
                assert.ok(cmdHistory[5] instanceof commands.SendData);
                assert.ok(cmdHistory[6] instanceof commands.Quit);
            },

            'contains all the replies as Reply objects': function (err) {
                assert.ifError(err);
                var replyHistory = [];
                this.seeHistory(function (command, reply) {
                    replyHistory.push(reply);
                });

                assert.equal(replyHistory.length, 7);
                assert.equal(replyHistory[0].code, "220");
                assert.equal(replyHistory[0].message, "Welcome");
                assert.equal(replyHistory[1].code, "250");
                assert.equal(replyHistory[1].message, "Extensions\r\nand\r\nstuff");
                assert.equal(replyHistory[2].code, "250");
                assert.equal(replyHistory[2].message, "Sender accepted");
                assert.equal(replyHistory[3].code, "250");
                assert.equal(replyHistory[3].message, "Recipient accepted");
                assert.equal(replyHistory[4].code, "354");
                assert.equal(replyHistory[4].message, "Send your Data!");
                assert.equal(replyHistory[5].code, "250");
                assert.equal(replyHistory[5].message, "Message accepted");
                assert.equal(replyHistory[6].code, "221");
                assert.equal(replyHistory[6].message, "Quitting");
            },
        },
   },
}).export(module);

// vim:et:sw=4:ts=4:sts=4:
