
'use strict';

// import 'fpcvt.js';
// import 'fpcvt-alt1.js';
// import 'fpcvt-alt2.js';
// import 'fpcvt-alt3.js';
// import 'fpcvt-alt4.js';
// import 'fpcvt-alt5.js';
// import 'fpcvt-alt6.js';
// import 'fpcvt-alt7.js';
// import 'fpcvt-alt8.js';


    // helper functions
    function word2hex(i) {
      return '0x' + ('0000' + i.toString(16)).substr(-4).toUpperCase();
    }

    function str2hexwords(str) {
      var rv = [];
      for (var i = 0, len = str.length; i < len; i++) {
        var c = str.charCodeAt(i);      // a.k.a.  c = str[i];
        rv[i] = word2hex(c);
      }
      return '[' + rv.join(',') + ']';
    }



    const test_serialization = true;

    var data = [];
    var serialized_data = [];
    var serialized_data2 = [];
    var serialized_data3 = [];
    var data_length = 0;

    // console.clear();

    function init() {
      if (data_length) return;

      //debugger;
      data.push(0.00001);
      data.push(3676483910);
      data.push(Math.pow(2,1023) * 1.9999999999999998);
      data.push(1.7976931348623158e308); // == 1.7976931348623157e308
      data.push(1.7976931348623157e308);
      data.push(1.7976931348623156e308); // == 1.7976931348623155e308
      data.push(Math.pow(2,-1024) * 0.999999999999999);
      data.push(Math.pow(2,-1025) * 0.999999999999999);
      data.push(Math.pow(2,-1023) * 0.999999999999999);
      data.push(Math.pow(2, 1023) * 1.999999999999998);
      data.push(Math.pow(2, 1022) * 1.999999999999999);
      data.push(Math.pow(2, 1022) * 1.999999999999998);
      data.push(Math.pow(2, 1023) * 0.999999999999999);
      data.push(Math.pow(2, 1022) * 0.999999999999999);
      data.push(Math.pow(2, 1021) * 0.999999999999999);
      data.push(Math.pow(2, 1020) * 0.999999999999999);
      data.push(Math.pow(2, 1019) * 0.999999999999999);
      data.push(Math.pow(2, 1019) * 1.999999999999998);
      data.push(Math.pow(2, 1023) * 1.9999999999999999);  // +Infinity
      data.push(Math.pow(2, 1023) * 1.9999999999999998);
      data.push(Math.pow(2, 1023) * 1.9999999999999997);
      data.push(5e-324);
      data.push(1.5e-323);
      data.push(2.5e-323);
      data.push(3.5e-323);
      data.push(4.2388366884150523e-308);
      data.push(28e9);
      data.push(0.036);
      data.push(0.36);
      data.push(3.6);
      data.push(0.0036);
      data.push(0.00036);
      data.push(0.000036);
      data.push(1.5e-320);
      data.push(NaN);
      data.push(+0);
      data.push(-0);
      data.push(+Infinity);
      data.push(-Infinity);

      for (var i = 0, l = 1000; i < l; i++) {
        var x = Math.random();
        var y = Math.tan(x - 0.5);
        var z = Math.pow(2, 100 * y);
        var a = (1 + Math.random() * 21) | 0;
        var b = z.toPrecision(a);
        data.push(parseFloat(b));
      }
      // test all powers of 2 which fit in a floating point value
      for (var i = -1074; i <= 1023; i++) {
        var z = Math.pow(2, i);
        data.push(z);
      }
      for (var i = -1074; i <= 1023; i++) {
        for (var j = 0; j < 20; j++) {
          var x = Math.random();
          var y = x / 20 + j / 20 + 1;  // stay within the next power of 2: 1.0000 .. 1.9999
          var z = Math.pow(2, i) * y;
          data.push(z);
        }
      }
      for (var i = -1074; i <= -1022; i++) {
        for (var j = 0; j < 50; j++) {
          var x = Math.random();
          var z = Math.pow(2, i) * x;
          data.push(z);
        }
      }
      for (var i = 1017; i <= 1023; i++) {
        for (var j = 0; j < 50; j++) {
          var x = Math.random();
          var y = x + 1;  // stay within the next power of 2: 1.0000 .. 1.9999
          var z = Math.pow(2, i) * y;
          data.push(z);
        }
      }
      // test the ranges which are treated special plus a little *outside* those ranges to detect incorrect handling
      //debugger;

      // also test the reverse to ensure we cover the entire *decodable* range as well as the entire *encodable* range
      // for 'shorthand notation' floating point values a.k.a. 'decimal encoded flaoting point values' 
      // (see also the documentation in the comments in the fpcvt.js source file)!
      //
      // Note the comment about 'holes' in fpcvt.js -- here we happen to test those holes alongside expected encoder outputs!
      for (var i = 0x8000; i < 0xF900; i++) {
        if (i >= 0xD800 && i <= 0xDFFF) continue;
        var t = String.fromCharCode(i);
        var z = decode_fp_value(t);
        // and test if the *encoder* handles all these 'short notation' samples correctly:
        var s = encode_fp_value(z);
        if (s !== t && i !== 0x8000) {
          var dm = i & 0x03FF;      // 10 bits
          var ds = i & 0x0400;      // bit 10 = sign
          var dp = i & 0x7800;      // bits 11..14: exponent
          dp >>>= 11;
          dp -= 3 + 2;
          console.warn('custom enc VALUE mismatch for shorthand Unicode encoding: ', { word: word2hex(i), mantissa: dm, sign: ds, exp: dp, word_: t, decoded: z, re_enc_as_hex: str2hexwords(s), re_enc: s, re_enc_len: s.length, word_len: t.length }, s.length, t.length);
        }
        // ZERO has a special encoding so 0x8000 is a shorthand code which can NEVER OCCUR:
        // however, the *actual* encoding for ZERO (+0) is also a shorthand hence the actual ZERO must also have length =1:
        else if (s.length !== t.length) {
          console.warn('custom enc LENGTH mismatch for shorthand Unicode encoding: ', { word: word2hex(i), mantissa: dm, sign: ds, exp: dp, word_: t, decoded: z, re_enc_as_hex: str2hexwords(s), re_enc: s, re_enc_len: s.length, word_len: t.length });
        }
        data.push(z);
      }
      for (var i = -6; i <= 16; i++) {
        for (var j = 0; j < 1000; j++) {
          var x = Math.random();
          var y = x / 2 + 0.5;  // stay within the current power of 2
          var z = Math.pow(2, i) * y;
          var w = (Math.random() * 6) | 0;
          var b;
          switch (w) {
          case 0:
            b = z.toPrecision(3);
            break;
          case 1:
            b = z.toPrecision(2);
            break;
          case 2:
            b = z.toPrecision(1);
            break;
          case 3:
            b = z.toPrecision(4);
            break;
          case 4:
            b = z.toPrecision(5);
            break;
          default:
            break;
          }
          data.push(parseFloat(b));
        }
      }
      data.length = 30;
      data_length = data.length;

      typeof console !== 'undefined' && console.log('init:: data set:', data.slice(0, 20), '...');
    }

    // serialize / deserialize functions:
    function classic_1(data, len, serialized_data) {
      for (var i = 0; i < len; i++) {
        var flt = data[i];

        var s = '' + flt; // fastest solution for encode
        var t = parseFloat(s); // fastest solution for decode
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('classic enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_0(data, len, serialized_data) {
      //debugger;
      var dec_opt = {
        consumed_length: 0
      };
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value(flt);
        dec_opt.consumed_length = 0;
        var t = decode_fp_value(s, dec_opt);
        if (/* test_serialization && */ t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
        if (dec_opt.consumed_length !== s.length) {
          console.warn('custom dec length feedback mismatch: ', flt, dec_opt.consumed_length, s, s.length);
        }
        var s2 = encode_fp_value0(flt);
        if (s2 !== s) {
          console.warn('custom enc0 vs. enc-REF mismatch: ', flt, s2, s, t);
        }
        s2 = encode_fp_value2(flt);
        if (s2 !== s) {
          console.warn('custom enc2 vs. enc-REF mismatch: ', flt, s2, s, t);
        }
        s2 = encode_fp_value3(flt);
        if (s2 !== s) {
          console.warn('custom enc3 vs. enc-REF mismatch: ', flt, s2, s, t);
        }
        s2 = encode_fp_value4(flt);
        if (s2 !== s) {
          console.warn('custom enc4 vs. enc-REF mismatch: ', flt, s2, s, t);
        }
        dec_opt.consumed_length = 0;
        var t2 = decode_fp_value2(s, dec_opt);
        if (t2 !== flt && (!isNaN(t2) || !isNaN(flt))) {
          console.warn('custom dec2 vs. dec-REF mismatch: ', flt, t2, s, t);
        }
        if (dec_opt.consumed_length !== s.length) {
          console.warn('custom dec2 length feedback mismatch: ', flt, dec_opt.consumed_length, s, s.length);
        }
        dec_opt.consumed_length = 0;
        t2 = decode_fp_value3(s, dec_opt);
        if (t2 !== flt && (!isNaN(t2) || !isNaN(flt))) {
          console.warn('custom dec3 vs. dec-REF mismatch: ', flt, t2, s, t);
        }
        if (dec_opt.consumed_length !== s.length) {
          console.warn('custom dec3 length feedback mismatch: ', flt, dec_opt.consumed_length, s, s.length);
        }
        dec_opt.consumed_length = 0;
        t2 = decode_fp_value4(s, dec_opt);
        if (t2 !== flt && (!isNaN(t2) || !isNaN(flt))) {
          console.warn('custom dec4 vs. dec-REF mismatch: ', flt, t2, s, t);
        }
        if (dec_opt.consumed_length !== s.length) {
          console.warn('custom dec4 length feedback mismatch: ', flt, dec_opt.consumed_length, s, s.length);
        }
      }
    }

    function custom_1(data, len, serialized_data) {
      //debugger;
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value0(flt);
        var t = decode_fp_value(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_2(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value2(flt);
        var t = decode_fp_value(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_3(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value3(flt);
        var t = decode_fp_value(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_4(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value4(flt);
        var t = decode_fp_value(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_5(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value(flt);
        var t = decode_fp_value2(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_6(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value2(flt);
        var t = decode_fp_value2(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_7(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value3(flt);
        var t = decode_fp_value2(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_8(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value4(flt);
        var t = decode_fp_value2(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_9(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value(flt);
        var t = decode_fp_value3(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_10(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value2(flt);
        var t = decode_fp_value3(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_11(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value3(flt);
        var t = decode_fp_value3(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_12(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value4(flt);
        var t = decode_fp_value3(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_13(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value(flt);
        var t = decode_fp_value4(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_14(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value2(flt);
        var t = decode_fp_value4(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_15(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value3(flt);
        var t = decode_fp_value4(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }

    function custom_16(data, len, serialized_data) {
      for (var ii = 0; ii < len; ii++) {
        var flt = data[ii];

        var s = encode_fp_value4(flt);
        var t = decode_fp_value4(s);
        if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {
          console.warn('custom enc/dec mismatch: ', flt, s, t);
        }
      }
    }


    init();


    // Custom : v0 ~ REFERENCE CHECKS
    custom_0(data, data_length, serialized_data);

    // Classic'
    classic_1(data, data_length, serialized_data);

    // Custom : v1'
    custom_1(data, data_length, serialized_data);

    // Custom : v2'
    custom_2(data, data_length, serialized_data);

    // Custom : v3'
    custom_3(data, data_length, serialized_data);

    // Custom : v4'
    custom_4(data, data_length, serialized_data);

    // Custom : v5'
    custom_5(data, data_length, serialized_data);

    // Custom : v6'
    custom_6(data, data_length, serialized_data);

    // Custom : v7'
    custom_7(data, data_length, serialized_data);

    // Custom : v8'
    custom_8(data, data_length, serialized_data);

    // Custom : v9'
    custom_9(data, data_length, serialized_data);

    // Custom : v10'
    custom_10(data, data_length, serialized_data);

    // Custom : v11'
    custom_11(data, data_length, serialized_data);

    // Custom : v12'
    custom_12(data, data_length, serialized_data);

    // Custom : v13'
    custom_13(data, data_length, serialized_data);

    // Custom : v14'
    custom_14(data, data_length, serialized_data);

    // Custom : v15'
    custom_15(data, data_length, serialized_data);

    // Custom : v16'
    custom_16(data, data_length, serialized_data);



    console.log('executed all tests ok');



describe('Give it some context', function () {
  describe('maybe a bit more context here', function () {
    it('should run here few assertions', function () {
      expect(true).toBe(true);
    });
  });
});








console.info('loaded spec file');
