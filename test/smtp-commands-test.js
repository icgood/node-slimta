
var vows = require("vows"),
    assert = require("assert");

var commands = require("../lib/smtp/commands");

vows.describe("smtp commands").addBatch({
    'the CommandArgError constructor': {
        topic: new commands.CommandArgError('Descriptive message', {test: 123}),

        'makes message property': function (topic) {
            assert.equal(topic.message, 'Descriptive message');
        },

        'saves the original Command object': function (topic) {
            assert.ok(topic.command instanceof Object);
            assert.equal(topic.command.test, 123);
        }
    },

    'the Command constructor': {
        'passed just a name': {
            topic: new commands.Command('mail'),

            'has correct toString results': function (topic) {
                assert.equal(topic.toString(), 'mail');
            },

            'has case-insensitive is method': function (topic) {
                assert.ok(topic.is("mAIl"));
            },
        },

        'passed a name and arg': {
            topic: new commands.Command('mail', 'from:<test> size=1234'),

            'has correct toString results': function (topic) {
                assert.equal(topic.toString(), 'mail from:<test> size=1234');
            },

            'has case-insensitive is method': function (topic) {
                assert.ok(topic.is("mAIl"));
            },
        },
    },

    'the parseIntoCommands function': {
        'given a non-string': {
            topic: function () {
                commands.parseIntoCommands({});
            },

            'throws a TypeError': function (topic) {
                assert.ok(topic instanceof TypeError);
            }
        },

        'given a string with no endlines': {
            topic: commands.parseIntoCommands('testing'),

            'returns an empty array and string remainder': function (topic) {
                assert.ok(topic.commands instanceof Array);
                assert.equal(topic.commands.length, 0);
                assert.equal(topic.remainder, 'testing');
            },
        },

        'given a string with a CR but no LF': {
            topic: commands.parseIntoCommands('testing\r'),

            'returns an empty array and string remainder': function (topic) {
                assert.ok(topic.commands instanceof Array);
                assert.equal(topic.commands.length, 0);
                assert.equal(topic.remainder, 'testing\r');
            },
        },

        'given a string with one complete command': {
            topic: commands.parseIntoCommands('testing\n'),

            'returns an array of one Command object and string remainder': function (topic) {
                assert.equal(topic.commands.length, 1);
                assert.ok(topic.commands[0] instanceof commands.Command);
                assert.ok(topic.commands[0].is('TESTING'));
                assert.equal(topic.remainder, '');
            },
        },

        'given a empty but complete line': {
            topic: commands.parseIntoCommands("\n"),

            'returns an array of one InvalidSyntax object and a string remainder': function (topic) {
                assert.equal(topic.commands.length, 1);
                assert.ok(topic.commands[0] instanceof commands.InvalidSyntax);
                assert.equal(topic.commands[0].line, '');
                assert.equal(topic.remainder, '');
            },
        },

        'given a line with bad syntax': {
            topic: commands.parseIntoCommands('bad/command\n'),

            'returns an array of one InvalidSyntax object and a string remainder': function (topic) {
                assert.equal(topic.commands.length, 1);
                assert.ok(topic.commands[0] instanceof commands.InvalidSyntax);
                assert.equal(topic.commands[0].line, 'bad/command');
                assert.equal(topic.remainder, '');
            },
        },

        'given a string with one complete command with an arg': {
            topic: commands.parseIntoCommands('testing arg1 arg2\n'),

            'returns an array of one Command object and string remainder': function (topic) {
                assert.equal(topic.commands.length, 1);
                assert.ok(topic.commands[0].is('TESTING'));
                assert.ok('testing arg1 arg2', topic.commands[0].toString());
                assert.equal(topic.remainder, '');
            },
        },

        'given a string with several complete commands and one partial command': {
            topic: commands.parseIntoCommands('one\ntwo\nthree arg\nfour'),

            'returns an array of Command objects and string remainder': function (topic) {
                assert.equal(topic.commands.length, 3);
                assert.ok(topic.commands[0].is('ONE'));
                assert.ok(topic.commands[1].is('TWO'));
                assert.ok(topic.commands[2].is('THREE'));
                assert.equal(topic.commands[2].toString(), 'three arg');
                assert.equal(topic.remainder, 'four');
            },
        },

        'given partial message data': {
            topic: commands.parseIntoCommands('DATA\npartial\ndata\n'),

            'returns just a Data object': function (topic) {
                assert.equal(topic.commands.length, 1);
                assert.ok(topic.commands[0] instanceof commands.Data);
            },

            'message data is not interpreted as commands': function (topic) {
                assert.equal(topic.remainder, "partial\ndata\n");
            },
        },

        'given all known commands': {
            topic: commands.parseIntoCommands('EHLO there1\nHELO there2\nSTARTTLS\nMAIL FROM:<test1@address>\nRCPT TO:<test2@address>\nDATA\nmessage data\n.\nRSET\nQUIT\n'),

            'returns eight commands and a string remainder': function (topic) {
                assert.equal(topic.commands.length, 9);
                assert.equal(topic.remainder, '');
            },

            'returns a Ehlo object at index 0': function (topic) {
                var cmd = topic.commands[0];
                assert.ok(cmd instanceof commands.Ehlo);
                assert.equal(cmd.identifier, "there1");
            },

            'returns a Helo object at index 1': function (topic) {
                var cmd = topic.commands[1];
                assert.ok(cmd instanceof commands.Helo);
                assert.equal(cmd.identifier, "there2");
            },

            'returns a StartTls object at index 2': function (topic) {
                var cmd = topic.commands[2];
                assert.ok(cmd instanceof commands.StartTls);
            },

            'returns a Mail object at index 3': function (topic) {
                var cmd = topic.commands[3];
                assert.ok(cmd instanceof commands.Mail);
                assert.equal(cmd.address, "test1@address");
            },

            'returns a Rcpt object at index 4': function (topic) {
                var cmd = topic.commands[4];
                assert.ok(cmd instanceof commands.Rcpt);
                assert.equal(cmd.address, "test2@address");
            },

            'returns a Data object at index 5': function (topic) {
                var cmd = topic.commands[5];
                assert.ok(cmd instanceof commands.Data);
            },

            'returns a SendData object at index 6': function (topic) {
                var cmd = topic.commands[6];
                assert.ok(cmd instanceof commands.SendData);
                assert.equal(cmd.data, "message data");
            },

            'returns a Rset object at index 7': function (topic) {
                var cmd = topic.commands[7];
                assert.ok(cmd instanceof commands.Rset);
            },

            'returns a Quit object at index 8': function (topic) {
                var cmd = topic.commands[8];
                assert.ok(cmd instanceof commands.Quit);
            },

        },

        'given an unusual MAIL FROM': {
            'without brackets': {
                topic: commands.parseIntoCommands("MAIL FROM:test@address size=123\n"),
    
                'has the correct address': function (topic) {
                    var cmd = topic.commands[0];
                    assert.equal(cmd.address, 'test@address');
                },
            },

            'with just a left bracket': {
                topic: commands.parseIntoCommands("MAIL FROM:<test@address\n"),
    
                'has the correct address': function (topic) {
                    var cmd = topic.commands[0];
                    assert.equal(cmd.address, '<test@address');
                },
            },

            'with just a right bracket': {
                topic: commands.parseIntoCommands("MAIL FROM:test@address>\n"),
    
                'has the correct address': function (topic) {
                    var cmd = topic.commands[0];
                    assert.equal(cmd.address, 'test@address>');
                },
            },

            'with brackets and size parameter': {
                topic: commands.parseIntoCommands("MAIL FROM:<test@address> size=123\n"),
    
                'has the correct address and size': function (topic) {
                    var cmd = topic.commands[0];
                    assert.equal(cmd.address, "test@address");
                    assert.equal(cmd.options.size, 123);
                },
            },

            'with no "from:"': {
                topic: function () {
                    commands.parseIntoCommands("MAIL asdf\n");
                },
    
                'throws a CommandArgError': function (topic) {
                    assert.ok(topic instanceof commands.CommandArgError);
                    assert.ok(topic.command.is("MAIL"));
                    assert.equal(topic.command.toString(), "MAIL asdf");
                },
            },
        },
    },

    'the buildFromCommands function': {
        'with just an array of Command objects': {
            topic: commands.buildFromCommands([new commands.Banner(),
                                               new commands.Ehlo('there'),
                                               new commands.Mail('test1@address'),
                                               new commands.Rcpt('test2@address'),
                                               new commands.Data(),
                                               new commands.SendData('test\none\r\ntwo'),
                                               new commands.Quit()]),
    
            'has the correct result': function (topic) {
                expected = "EHLO there\r\nMAIL FROM:<test1@address>\r\nRCPT TO:<test2@address>\r\nDATA\r\ntest\none\r\ntwo\r\n.\r\nQUIT\r\n";
                assert.equal(topic, expected);
            },
        },

        'with an array of Command objects and a range': {
            topic: commands.buildFromCommands([new commands.Banner(),
                                               new commands.Ehlo('there'),
                                               new commands.Mail('test1@address'),
                                               new commands.Rcpt('test2@address'),
                                               new commands.Data(),
                                               new commands.SendData('test\none\r\ntwo'),
                                               new commands.Quit()], 2, 4),
    
            'has the correct result': function (topic) {
                expected = "MAIL FROM:<test1@address>\r\nRCPT TO:<test2@address>\r\n";
                assert.equal(topic, expected);
            },
        },

        'with an empty SendData command': {
            topic: commands.buildFromCommands([new commands.Data(), new commands.SendData('')]),

            'does not have a newline before the period': function (topic) {
                expected = "DATA\r\n.\r\n";
                assert.equal(topic, expected);
            },
        },
    },

    'the InvalidSyntax constructor': {
        topic: new commands.InvalidSyntax('bad/command'),

        'inherits Command': function (topic) {
            assert.ok(topic instanceof commands.Command);
        },

        'has correct toString results': function (topic) {
            assert.equal(topic.toString(), 'bad/command');
        },

        'has line property': function (topic) {
            assert.equal(topic.line, 'bad/command');
        },
    },

    'the Banner constructor': {
        topic: new commands.Banner(),

        'inherits Command': function (topic) {
            assert.ok(topic instanceof commands.Command);
        },
    },

    'the Ehlo constructor': {
        'with only identifier argument': {
            topic: new commands.Ehlo('there'),
    
            'inherits Command': function (topic) {
                assert.ok(topic instanceof commands.Command);
            },
    
            'is properly identified': function (topic) {
                assert.ok(topic.is("EHLO"));
            },
    
            'has correct toString results': function (topic) {
                assert.equal(topic.toString(), "EHLO there");
            },
        },
    },

    'the Helo constructor': {
        'with only identifier argument': {
            topic: new commands.Helo('there'),
    
            'inherits Command': function (topic) {
                assert.ok(topic instanceof commands.Command);
            },
    
            'is properly identified': function (topic) {
                assert.ok(topic.is("HELO"));
            },
    
            'has correct toString results': function (topic) {
                assert.equal(topic.toString(), "HELO there");
            },
        },
    },

    'the StartTls constructor': {
        topic: new commands.StartTls(),

        'inherits Command': function (topic) {
            assert.ok(topic instanceof commands.Command);
        },

        'is properly identified': function (topic) {
            assert.ok(topic.is("STARTTLS"));
        },

        'has correct toString results': function (topic) {
            assert.equal(topic.toString(), "STARTTLS");
        },
    },

    'the Mail constructor': {
        'with only address argument': {
            topic: new commands.Mail('test@address'),
    
            'inherits Command': function (topic) {
                assert.ok(topic instanceof commands.Command);
            },
    
            'is properly identified': function (topic) {
                assert.ok(topic.is("MAIL"));
            },
    
            'has correct toString results': function (topic) {
                assert.equal(topic.toString(), "MAIL FROM:<test@address>");
            },
        },

        'with address argument and size option': {
            topic: new commands.Mail('test@address', {size: 1234}),

            'has correct toString results': function (topic) {
                assert.equal(topic.toString(), "MAIL FROM:<test@address> SIZE=1234");
            },
        },
    },

    'the Rcpt constructor': {
        'with only address argument': {
            topic: new commands.Rcpt('test@address'),
    
            'inherits Command': function (topic) {
                assert.ok(topic instanceof commands.Command);
            },
    
            'is properly identified': function (topic) {
                assert.ok(topic.is("RCPT"));
            },
    
            'has correct toString results': function (topic) {
                assert.equal(topic.toString(), "RCPT TO:<test@address>");
            },
        },
    },

    'the Data constructor': {
        topic: new commands.Data(),

        'inherits Command': function (topic) {
            assert.ok(topic instanceof commands.Command);
        },

        'is properly identified': function (topic) {
            assert.ok(topic.is("DATA"));
        },

        'has correct toString results': function (topic) {
            assert.equal(topic.toString(), "DATA");
        },
    },

    'the Rset constructor': {
        topic: new commands.Rset(),

        'inherits Command': function (topic) {
            assert.ok(topic instanceof commands.Command);
        },

        'is properly identified': function (topic) {
            assert.ok(topic.is("RSET"));
        },

        'has correct toString results': function (topic) {
            assert.equal(topic.toString(), "RSET");
        },
    },

    'the Quit constructor': {
        topic: new commands.Quit(),

        'inherits Command': function (topic) {
            assert.ok(topic instanceof commands.Command);
        },

        'is properly identified': function (topic) {
            assert.ok(topic.is("QUIT"));
        },

        'has correct toString results': function (topic) {
            assert.equal(topic.toString(), "QUIT");
        },
    },
}).export(module);

// vim:et:sw=4:ts=4:sts=4:
