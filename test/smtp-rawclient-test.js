
var vows = require('vows'),
    assert = require('assert');

var RawClient = require('../lib/smtp').RawClient,
    commands = require('../lib/smtp/commands'),
    replies = require('../lib/smtp/replies');

var mocksmtp = require('./helpers/mock-smtp');

vows.describe('smtp raw client').addBatch({
  'the RawClient constructor': {
    'given only the implied Banner command': {
      topic: function () {
        var mock = new mocksmtp.MockSmtpServer([], ['220 Welcome\r\n']);
        var topic = new RawClient(mock);
        mock.start();

        var stack = [];
        topic.on('reply', function (reply, command) {
          stack.push({reply: reply, command: command});
        });

        var self = this;
        topic.on('end', function () {
          self.callback(null, stack);
        });
      },

      'contains just one Banner command': function (stack) {
        assert.equal(stack.length, 1);
        assert.ok(stack[0].command instanceof commands.Banner);
      },

      'contains just one Reply': function (stack) {
        assert.equal(stack.length, 1);
        assert.ok(stack[0].reply instanceof replies.Reply);
        assert.equal(stack[0].reply.code, '220');
        assert.equal(stack[0].reply.message, 'Welcome');
      },
    },

    'sent an additional Ehlo command': {
      topic: function () {
        var mock = new mocksmtp.MockSmtpServer(['EHLO there\r\n'], ['220 Welcome\r\n', '250-Extensions\r\n250-and\r\n250 stuff\r\n']);
        var topic = new RawClient(mock);
        mock.start();
        topic.sendCommand(new commands.Ehlo('there'));

        var stack = [];
        topic.on('reply', function (reply, command) {
          stack.push({reply: reply, command: command});
        });

        var self = this;
        topic.on('end', function () {
          self.callback(null, stack);
        });
      },

      'contains Ehlo command after implied Banner': function (stack) {
        assert.equal(stack.length, 2);
        assert.ok(stack[0].command instanceof commands.Banner);
        assert.ok(stack[1].command instanceof commands.Ehlo);
      },

      'contains two replies': function (stack) {
        assert.equal(stack.length, 2);
        assert.equal(stack[0].reply.code, '220');
        assert.equal(stack[0].reply.message, 'Welcome');
        assert.equal(stack[1].reply.code, '250');
        assert.equal(stack[1].reply.message, 'Extensions\r\nand\r\nstuff');
      },
    },

    'given an entire SMTP session': {
      'without pipelining': {
        topic: function () {
          var mock = new mocksmtp.MockSmtpServer(
              ['EHLO there\r\n',
               'MAIL FROM:<sender@address>\r\n',
               'RCPT TO:<rcpt@address>\r\n',
               'DATA\r\n',
               'From: sender@address\r\nTo: rcpt@address\r\nSubject: test\r\n\r\nstuff\r\n\r\n.\r\n',
               'QUIT\r\n',],
              ['220 Welcome\r\n',
               '250-Extensions\r\n250-and\r\n250 stuff\r\n',
               '250 Sender accepted\r\n',
               '250 Recipient accepted\r\n',
               '354 Send your Data!\r\n',
               '250 Message accepted\r\n',
               '221 Quitting\r\n',]
            );
          var topic = new RawClient(mock);
          mock.start();
          topic.sendCommand(new commands.Ehlo('there'));
          topic.sendCommand(new commands.Mail('sender@address'));
          topic.sendCommand(new commands.Rcpt('rcpt@address'));
          topic.sendCommand(new commands.Data());
          topic.sendCommand(new commands.SendData('From: sender@address\r\nTo: rcpt@address\r\nSubject: test\r\n\r\nstuff\r\n'));
          topic.sendCommand(new commands.Quit());

          var stack = [];
          topic.on('reply', function (reply, command) {
            stack.push({reply: reply, command: command});
          });

          var self = this;
          topic.on('end', function () {
            self.callback(null, stack);
          });
        },

        'contains all the commands in order': function (stack) {
          assert.equal(stack.length, 7);
          assert.ok(stack[0].command instanceof commands.Banner);
          assert.ok(stack[1].command instanceof commands.Ehlo);
          assert.ok(stack[2].command instanceof commands.Mail);
          assert.ok(stack[3].command instanceof commands.Rcpt);
          assert.ok(stack[4].command instanceof commands.Data);
          assert.ok(stack[5].command instanceof commands.SendData);
          assert.ok(stack[6].command instanceof commands.Quit);
        },

        'contains all the replies as Reply objects': function (stack) {
          assert.equal(stack.length, 7);
          assert.equal(stack[0].reply.code, '220');
          assert.equal(stack[0].reply.message, 'Welcome');
          assert.equal(stack[1].reply.code, '250');
          assert.equal(stack[1].reply.message, 'Extensions\r\nand\r\nstuff');
          assert.equal(stack[2].reply.code, '250');
          assert.equal(stack[2].reply.message, 'Sender accepted');
          assert.equal(stack[3].reply.code, '250');
          assert.equal(stack[3].reply.message, 'Recipient accepted');
          assert.equal(stack[4].reply.code, '354');
          assert.equal(stack[4].reply.message, 'Send your Data!');
          assert.equal(stack[5].reply.code, '250');
          assert.equal(stack[5].reply.message, 'Message accepted');
          assert.equal(stack[6].reply.code, '221');
          assert.equal(stack[6].reply.message, 'Quitting');
        },
      },  

      'with pipelining': {
        topic: function () {
          var mock = new mocksmtp.MockSmtpServer(
              ['EHLO there\r\n',
               'MAIL FROM:<sender@address>\r\nRCPT TO:<rcpt@address>\r\nDATA\r\n',
               'From: sender@address\r\nTo: rcpt@address\r\nSubject: test\r\n\r\nstuff\r\n\r\n.\r\nQUIT\r\n',],
              ['220 Welcome\r\n',
               '250-Extensions\r\n250-and\r\n250 stuff\r\n',
               '250 Sender accepted\r\n250 Recipient accepted\r\n354 Send your Data!\r\n',
               '250 Message accepted\r\n221 Quitting\r\n',]
            );
          var topic = new RawClient(mock);
          topic.allowPipelining();
          mock.start();
          topic.sendCommand(new commands.Ehlo('there'));
          topic.sendCommand(new commands.Mail('sender@address'));
          topic.sendCommand(new commands.Rcpt('rcpt@address'));
          topic.sendCommand(new commands.Data());
          topic.sendCommand(new commands.SendData('From: sender@address\r\nTo: rcpt@address\r\nSubject: test\r\n\r\nstuff\r\n'));
          topic.sendCommand(new commands.Quit());

          var stack = [];
          topic.on('reply', function (reply, command) {
            stack.push({reply: reply, command: command});
          });

          var self = this;
          topic.on('end', function () {
            self.callback(null, stack);
          });
        },

        'contains all the commands in order': function (stack) {
          assert.equal(stack.length, 7);
          assert.ok(stack[0].command instanceof commands.Banner);
          assert.ok(stack[1].command instanceof commands.Ehlo);
          assert.ok(stack[2].command instanceof commands.Mail);
          assert.ok(stack[3].command instanceof commands.Rcpt);
          assert.ok(stack[4].command instanceof commands.Data);
          assert.ok(stack[5].command instanceof commands.SendData);
          assert.ok(stack[6].command instanceof commands.Quit);
        },

        'contains all the replies as Reply objects': function (stack) {
          assert.equal(stack.length, 7);
          assert.equal(stack[0].reply.code, '220');
          assert.equal(stack[0].reply.message, 'Welcome');
          assert.equal(stack[1].reply.code, '250');
          assert.equal(stack[1].reply.message, 'Extensions\r\nand\r\nstuff');
          assert.equal(stack[2].reply.code, '250');
          assert.equal(stack[2].reply.message, 'Sender accepted');
          assert.equal(stack[3].reply.code, '250');
          assert.equal(stack[3].reply.message, 'Recipient accepted');
          assert.equal(stack[4].reply.code, '354');
          assert.equal(stack[4].reply.message, 'Send your Data!');
          assert.equal(stack[5].reply.code, '250');
          assert.equal(stack[5].reply.message, 'Message accepted');
          assert.equal(stack[6].reply.code, '221');
          assert.equal(stack[6].reply.message, 'Quitting');
        },
      },
    },
  },
}).export(module);

// vim:et:sw=2:ts=2:sts=2:
