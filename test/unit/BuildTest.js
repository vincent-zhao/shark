/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
// +--------------------------------------------------------------------+
// | (C) 2011-2012 Alibaba Group Holding Limited.                       |
// | This program is free software; you can redistribute it and/or      |
// | modify it under the terms of the GNU General Public License        |
// | version 2 as published by the Free Software Foundation.            |
// +--------------------------------------------------------------------+
// Author: pengchun <pengchun@taobao.com>

var should  = require('should');
var fs      = require('fs');
var Build   = require(__dirname + '/../../lib/build.js');

describe('build library', function() {

  /* {{{ should_build_fileset_works_fine() */
  it('should_build_fileset_works_fine', function() {

    var _files  = [];
    Build.fileset(__dirname + '/../', function(fname) {
      _files.push(fname);
    });
    _files.should.include(__filename);

    Build.fileset(__filename, function(fname) {
        fname.should.eql(__filename);
    });

    try {
      var _files  = [];
      Build.fileset(__dirname + '/i_am_not_exist', function(fname) {
        _files.push(fname);
      });
    } catch (e) {
    }
    _files.should.eql([]);
  });
  /* }}} */

  /* {{{ should_build_setmode_works_fine() */
  it('should_build_setmode_works_fine', function() {
    Build.setmode(__filename, 0644);

    var _me = fs.statSync(__filename);
    should.ok(_me.mode & 0400);
    should.ok(_me.mode & 0200);
    should.ok(!(_me.mode & 0100));

    Build.setmode(__filename, 0777);
    var _me = fs.statSync(__filename);
    should.ok(_me.mode & 040);
    should.ok(_me.mode & 020);
    should.ok(_me.mode & 010);

    Build.setmode(__filename, 0644);
  });
  /* }}} */

  /* {{{ should_build_init_works_fine() */
  it('should_build_init_works_fine', function() {
    var _me = Build.init(undefined, __dirname);

    var the = (new Date()).getTime();

    _me.makedir(__dirname + '/etc/build').makedir('etc/build');
    _me.makeconf(__dirname + '/../../build/tpl/test/test.properties', 'etc/build/test1.properties', {
      'test.c3.value'   : the,
    });

    var _me = Build.init('etc/build/test1.properties', __dirname);
    _me.property().should.eql({
      'test.c1' : '123dsf=4 5有效',
      'test.c2' : '"replace last data"',
      'test.c3' : the + '',
    });
  });
  /* }}} */

});
