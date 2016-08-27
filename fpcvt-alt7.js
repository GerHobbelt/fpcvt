

// A near copy of decode_fp_value3() but with a approach to the optional `opt.consumed_length`
// feedback.


function decode_fp_value4(s, opt) {
  // sample JS code to decode a IEEE754 floating point value from a Unicode string.
  //
  // With provision to detect +0/-0 and +/-Inf and NaN
  var consumed_length;

  var c0 = s.charCodeAt(0);
  //console.log('decode task: ', s, s.length, c0, '0x' + c0.toString(16));

  // As we expect most encodings to be regular numbers, those will be in 0x0000..0x7FFF and
  // we don't want to spend the least amount of time in the 'special values' overhead,
  // which would be added overhead if we did check for those *first* instead of *at the same time*
  // as we do here by looking at the top nibble immediately:
  // 
  // nibble value:
  // 0..7: regular 'long encoding' floating point values. Act as *implicit* NUM opcodes.
  // 8..C: 'short float' encoded floating point values. Act as *implicit* NUM opcodes.
  // D: part of this range is illegal ('DO NOT USE') but the lower half (0xD000..0xD7FF),
  //    about 2K codes worth, is used for the 'short float' encoded floating point values.
  // E: rest of the range for 'short float' encoded floating point values. 
  //    Act as *implicit* NUM opcodes.
  // F: rest of the range for 'short float' encoded floating point values. 
  //    Act as *implicit* NUM opcodes. (0xF800..0xFFFF: reserved for future use) 
  if (c0 & 0x8000) {
    // We're entering the realm of 'short float' values, special codes and Unicode Surrogates...
    if (c0 < 0xA800) {
      // 'short float' range 0x8000..0xA7FF

      // 'human values' encoded as 'short floats' (negative decimal powers):
      //
      // Bits in word:
      // - 0..9: integer mantissa; values 0..1023
      // - 10: sign
      // - 11..14: exponent 0..9 with offset -3 --> -3..+6
      // - 15: set to signal special values; this bit is also set for some special Unicode characters,
      //       so we can only set this bit and have particular values in bits 0..14 at the same time
      //       in order to prevent a collision with those Unicode specials at 0xF800..0xFFFF.
      //
      var dm = c0 & 0x03FF;      // 10 bits
      var ds = c0 & 0x0400;      // bit 10 = sign
      var dp = c0 & 0x7800;      // bits 11..14: exponent

      //console.log('decode-short-0', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      dp -= 3 + 2;

      // Because `dm * Math.pow(10, dp)` causes bitrot in LSB (so that, for example, input value 0.0036 becomes 0..0036000000000000003)
      // we reproduce the value another way, which does *not* produce the bitrot in the LSBit of the *decimal* mantissa:
      var sflt = dm / Math.pow(10, -dp);
      if (ds) {
        sflt = -sflt;
      }
      //console.log('decode-short-1', sflt, ds, dm, dp, c0, '0x' + c0.toString(16));
      if (opt) {
        opt.consumed_length = 1;
      }
      return sflt;
    } else if (c0 < 0xD800) {
      // 'short float' range 0xA800..0xD7FF

      // 'human values' encoded as 'short floats' (non-negative decimal powers):
      //
      // Bits in word:
      // - 0..9: integer mantissa; values 0..1023
      // - 10: sign
      // - 11..14: exponent 0..9 with offset -3 --> -3..+6
      // - 15: set to signal special values; this bit is also set for some special Unicode characters,
      //       so we can only set this bit and have particular values in bits 0..14 at the same time
      //       in order to prevent a collision with those Unicode specials at 0xF800..0xFFFF.
      //
      var dm = c0 & 0x03FF;      // 10 bits
      var ds = c0 & 0x0400;      // bit 10 = sign
      var dp = c0 & 0x7800;      // bits 11..14: exponent

      //console.log('decode-short-0', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      dp -= 3 + 2;

      var sflt = dm * Math.pow(10, dp);
      if (ds) {
        sflt = -sflt;
      }
      //console.log('decode-short-1', sflt, ds, dm, dp, c0, '0x' + c0.toString(16));
      if (opt) {
        opt.consumed_length = 1;
      }
      return sflt;
    } else if (c0 >= 0xE000 && c0 < 0xF800) {
      // 'short float' range 0xE000..0xF7FF
      //
      // (0xF900..0xFFF0: reserved for future use)

      // 'human values' encoded as 'short floats':
      //
      // Bits in word:
      // - 0..9: integer mantissa; values 0..1023
      // - 10: sign
      // - 11..14: exponent 10..12 with offset -3 --> 7..9
      // - 15: set to signal special values; this bit is also set for some special Unicode characters,
      //       so we can only set this bit and have particular values in bits 0..14 at the same time
      //       in order to prevent a collision with those Unicode specials at 0xF800..0xFFFF.
      //
      var dm = c0 & 0x03FF;      // 10 bits
      var ds = c0 & 0x0400;      // bit 10 = sign
      var dp = c0 & 0x7800;      // bits 11..14: exponent

      //console.log('decode-short-0C', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      dp -= 3 + 2 + 1;            // like above, but now also compensate for exponent bumping (0xB --> 0xC, ...)

      var sflt = dm * Math.pow(10, dp);
      if (ds) {
        sflt = -sflt;
      }
      //console.log('decode-short-1C', sflt, ds, dm, dp, c0, '0x' + c0.toString(16));
      if (opt) {
        opt.consumed_length = 1;
      }
      return sflt;
    } else if (c0 >= 0xF800) {
      // Specials or 'reserved for future use':
      // (0xF900..0xFFF0: reserved for future use)

      if (c0 < 0xF900) {
        // 'regular' near-infinity floating point values:
        //
        // Bits in word:
        // - 0..4: exponent; values +1020..+1024 with an offset of 1020 to make them all small positive numbers
        // - 7: sign
        // - 5,6: length 1..4: the number of words following to define the mantissa
        // - 8..15: 0xF8
        //
        var len = c0 & 0x0060;
        var vs = c0 & 0x0080;
        var p = c0 & 0x001F;

        p += 1020;
        //console.log('decode-normal-0', vs, p, len, '0x' + len.toString(16), c0, '0x' + c0.toString(16));

        // we don't need to loop to decode the mantissa: we know how much stuff will be waiting for us still
        // so this is fundamentally an unrolled loop coded as a switch/case:
        var m;
        var im;
        // no need to shift len before switch()ing on it: it's still the same number of possible values anyway:
        switch (len) {
        case 0x0000:
          // 1 more 15-bit word:
          im = s.charCodeAt(1);
          m = im / FPC_ENC_MODULO;
          consumed_length = 1 + 1;
          //console.log('decode-normal-len=1', m, s.charCodeAt(1));
          break;

        case 0x0020:
          // 2 more 15-bit words:
          im = s.charCodeAt(1);
          im <<= 15;
          im |= s.charCodeAt(2);
          m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
          consumed_length = 2 + 1;
          //console.log('decode-normal-len=2', m, s.charCodeAt(1), s.charCodeAt(2));
          break;

        case 0x0040:
          // 3 more 15-bit words: WARNING: this doesn't fit in an *integer* of 31 bits any more,
          // so we'll have to use floating point for at least one intermediate step!
          //
          // Oh, by the way, did you notice we use a Big Endian type encoding mechanism?  :-)
          im = s.charCodeAt(1);
          m = im / FPC_ENC_MODULO;
          im = s.charCodeAt(2);
          im <<= 15;
          im |= s.charCodeAt(3);
          m += im / (FPC_ENC_MODULO * FPC_ENC_MODULO * FPC_ENC_MODULO);
          consumed_length = 3 + 1;
          //console.log('decode-normal-len=3', m, s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3));
          break;

        case 0x0060:
          // 4 more 15-bit words, where the last one doesn't use all bits. We don't use
          // those surplus bits yet, so we're good to go when taking the entire word
          // as a value, no masking required there.
          //
          // WARNING: this doesn't fit in an *integer* of 31 bits any more,
          // so we'll have to use floating point for at least one intermediate step!
          im = s.charCodeAt(1);
          im <<= 15;
          im |= s.charCodeAt(2);
          m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
          im = s.charCodeAt(3);
          im <<= 15;
          im |= s.charCodeAt(4);
          // Nasty Thought(tm): as we don't mask the lowest bits of that byte we MAY
          // receive some cruft below the lowest significant bit of the encoded mantissa
          // when we re-use those bits for other purposes one day. However, we can argue
          // that we don't need to mask them bits anyway as they would disappear as
          // noise below the least significant mantissa bit anyway. :-)
          m += im / (FPC_ENC_MODULO * FPC_ENC_MODULO * FPC_ENC_MODULO * FPC_ENC_MODULO);
          consumed_length = 4 + 1;
          //console.log('decode-normal-len=4', m, s.charCodeAt(1) / FPC_ENC_MODULO, s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3), s.charCodeAt(4));
          break;
        }
        //console.log('decode-normal-1', vs, m, p, opt.consumed_length);

        // we do this in two steps to allow handling even the largest floating point values, which have p>=1023: Math.pow(2, p+1) would fail for those!
        // 
        // WARNING: The order of execution of this times-2 and the next power-of-2 multiplication is essential to not drop any LSBits for denormalized zero values!
        m *= 4;                       
        m *= Math.pow(2, p);
        if (vs) {
          m = -m;
        }
        //console.log('decode-normal-2', m);
        if (opt) {
          opt.consumed_length = consumed_length;
        }
        return m;
      } else {
        if (opt) {
          opt.consumed_length = 1;
        }
        switch (c0) {
        case FPC_ENC_POSITIVE_ZERO:
          return 0;

        case FPC_ENC_NEGATIVE_ZERO:
          return -0;

        case FPC_ENC_POSITIVE_INFINITY:
          return Infinity;

        case FPC_ENC_NEGATIVE_INFINITY:
          return -Infinity;

        case FPC_ENC_NAN:
          return NaN;

        default:
          throw new Error('illegal fp encoding value in 0xF900-0xFFFF Unicode range');
        }
      }
    } else {
      // This range spans the Unicode extended character ranges ('Surrogates') and MUST NOT be used by us for 'binary encoding'
      // purposes as we would than clash with any potential Unicode validators out there! The key of the current
      // design is that the encoded output is, itself, *legal* Unicode -- though admittedly I don't bother with
      // the Unicode conditions surrounding shift characters such as these:
      // 
      //   Z̤̺̦̤̰̠̞̃̓̓̎ͤ͒a̮̩̞͎̦̘̮l̖̯̞̝̗̥͙͋̔̆͊ͤ͐̚g͖̣̟̼͙ͪ̆͌̇ỏ̘̯̓ ̮̣͉̺̽͑́i̶͎̳̲ͭͅs̗̝̱̜̱͙̽ͥ̋̄ͨ̑͠ ̬̲͇̭̖ͭ̈́̃G̉̐̊ͪ͟o͓̪̗̤̳̱̅ȍ̔d̳̑ͥͧ̓͂ͤ ́͐́̂to̮̘̖̱͉̜̣ͯ̄͗ǫ̬͚̱͈̮̤̞̿̒ͪ!͆̊ͬͥ̆̊͋
      // 
      // which reside in the other ranges that we DO employ for our own nefarious encoding purposes!
      throw new Error('illegal fp encoding value in 0xD800-0xDFFF Unicode range');
    }
  } else {
    // range 0x0000..0x7FFF:
    // 
    // 'regular' floating point values:
    //
    // Bits in word:
    // - 0..11: exponent; values -1024..+1023 with an offset of 1024 to make them all positive numbers
    // - 12: sign
    // - 13,14: length 1..4: the number of words following to define the mantissa
    // - 15: 0 (zero)
    //
    var len = c0 & 0x6000;
    var vs = c0 & 0x1000;
    var p = c0 & 0x0FFF;

    p -= 1024;
    //console.log('decode-normal-0', vs, p, len, '0x' + len.toString(16), c0, '0x' + c0.toString(16));

    // we don't need to loop to decode the mantissa: we know how much stuff will be waiting for us still
    // so this is fundamentally an unrolled loop coded as a switch/case:
    var m;
    var im;
    // no need to shift len before switch()ing on it: it's still the same number of possible values anyway:
    switch (len) {
    case 0x0000:
      // 1 more 15-bit word:
      im = s.charCodeAt(1);
      m = im / FPC_ENC_MODULO;
      consumed_length = 1 + 1;
      //console.log('decode-normal-len=1', m, s.charCodeAt(1));
      break;

    case 0x2000:
      // 2 more 15-bit words:
      im = s.charCodeAt(1);
      im <<= 15;
      im |= s.charCodeAt(2);
      m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
      consumed_length = 2 + 1;
      //console.log('decode-normal-len=2', m, s.charCodeAt(1), s.charCodeAt(2));
      break;

    case 0x4000:
      // 3 more 15-bit words: WARNING: this doesn't fit in an *integer* of 31 bits any more,
      // so we'll have to use floating point for at least one intermediate step!
      //
      // Oh, by the way, did you notice we use a Big Endian type encoding mechanism?  :-)
      im = s.charCodeAt(1);
      m = im / FPC_ENC_MODULO;
      im = s.charCodeAt(2);
      im <<= 15;
      im |= s.charCodeAt(3);
      m += im / (FPC_ENC_MODULO * FPC_ENC_MODULO * FPC_ENC_MODULO);
      consumed_length = 3 + 1;
      //console.log('decode-normal-len=3', m, s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3));
      break;

    case 0x6000:
      // 4 more 15-bit words, where the last one doesn't use all bits. We don't use
      // those surplus bits yet, so we're good to go when taking the entire word
      // as a value, no masking required there.
      //
      // WARNING: this doesn't fit in an *integer* of 31 bits any more,
      // so we'll have to use floating point for at least one intermediate step!
      im = s.charCodeAt(1);
      im <<= 15;
      im |= s.charCodeAt(2);
      m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
      im = s.charCodeAt(3);
      im <<= 15;
      im |= s.charCodeAt(4);
      // Nasty Thought(tm): as we don't mask the lowest bits of that byte we MAY
      // receive some cruft below the lowest significant bit of the encoded mantissa
      // when we re-use those bits for other purposes one day. However, we can argue
      // that we don't need to mask them bits anyway as they would disappear as
      // noise below the least significant mantissa bit anyway. :-)
      m += im / (FPC_ENC_MODULO * FPC_ENC_MODULO * FPC_ENC_MODULO * FPC_ENC_MODULO);
      consumed_length = 4 + 1;
      //console.log('decode-normal-len=4', m, s.charCodeAt(1) / FPC_ENC_MODULO, s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3), s.charCodeAt(4));
      break;
    }
    //console.log('decode-normal-1', vs, m, p, opt.consumed_length);
    m *= Math.pow(2, p);
    if (vs) {
      m = -m;
    }
    //console.log('decode-normal-2', m);
    if (opt) {
      opt.consumed_length = consumed_length;
    }
    return m;
  }
}








console.info('fpcvt-alt7 loaded');

