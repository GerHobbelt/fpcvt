



function encode_fp_value2(flt) {
  // sample JS code to encode a IEEE754 floating point value in a Unicode string.
  //
  // With provision to detect and store +0/-0 and +/-Inf and NaN
  //
  //
  // Post Scriptum: encoding a fp number like this takes 1-5 Unicode characters
  // (if we also encode mantissa length in the power character) so it MIGHT
  // be better to provide a separate encoding for when the fp value can be printed
  // in less bytes -- and then then there are the integers and decimal fractions
  // used often by humans: multiply by 1K or 1M and you get another series of
  // integers, most of the time!
  // modulo: we can use 0x8000 or any lower power of 2 to prevent producing illegal Unicode
  // sequences (the extra Unicode pages are triggered by a set of codes in the upper range
  // which we cannot create this way, so no Unicode verifiers will ever catch us for being
  // illegal now!)
  //
  // WARNING: the exponent is not exactly 12 bits when you look at the Math.log2()
  //          output, as there are these near-zero values to consider up to exponent
  //          -1074 (-1074 + 52 = -1022 ;-) ) a.k.a. "denormalized zeroes":
  //
  //              Math.log2(Math.pow(2,-1074)) === -1074
  //              Math.log2(Math.pow(2,-1075)) === -Infinity
  //
  //              Math.pow(2,1023) * Math.pow(2,-1073) === 8.881784197001252e-16
  //              Math.pow(2,1023) * Math.pow(2,-1074) === 4.440892098500626e-16
  //              Math.pow(2,1023) * Math.pow(2,-1075) === 0
  //              Math.pow(2,1023) * Math.pow(2,-1076) === 0
  //

  // encode sign in bit 12
  var s;
  if (flt < 0) {
    s = 4096;
    flt = -flt;
  } else {
    s = 0;
  }

  // extract power from fp value    (WARNING: MSIE does not support log2(), see MDN!)
  var exp2 = Math.log2(flt);
  var p = exp2 | 0;  // --> +1023..-1024, pardon!, -1074 (!!!)
  switch (p) {
  // The power 0 also shows up when we treat a NaN or +/-Inf or +/-0:
  case 0:
    if (!flt) {
      // +0, -0 or NaN:
      if (isNaN(flt)) {
        return String.fromCharCode(FPC_ENC_NAN);
      } else {
        // detect negative zero:
        var is_negzero = Math.atan2(0, flt);  // +0 --> 0, -0 --> PI
        if (is_negzero) {
          return String.fromCharCode(FPC_ENC_NEGATIVE_ZERO);
        } else {
          return String.fromCharCode(FPC_ENC_POSITIVE_ZERO);
        }
      }
    } else if (!isFinite(flt)) {
      // -Inf / +Inf
      if (flt > 0) {
        return String.fromCharCode(FPC_ENC_POSITIVE_INFINITY);
      } else {
        return String.fromCharCode(FPC_ENC_NEGATIVE_INFINITY);
      }
    }
    // fall through!

  // The range <1e10..1e-3] can be encoded as short float when the value matches a few conditions:
  // (Do note that the exponents tested here in this switch/case are powers-of-TWO and thus have a
  // wider range compared to the decimal powers -3..+10)
  case -9:			  // Math.log2(1e-3) ~ -9.966
  case -8:
  case -7:
  case -6:
  case -5:
  case -4:
  case -3:
  case -2:
  case -1:
  //case 0:
  case 1:
  case 2:
  case 3:
  case 4:
  case 5:
  case 6:
  case 7:
  case 8:
  case 9:
  case 10:
  case 11:
  case 12:
  case 13:
  case 14:
  case 15:
  case 16:
  case 17:
  case 18:
  case 19:
  case 20:
  case 21:
  case 22:
  case 23:
  case 24:
  case 25:
  case 26:
  case 27:
  case 28:
  case 29:
  case 30:
  case 31:
  case 32:
  case 33:
  case 34:
  case 35:
  case 36:
  case 37:
  case 38:
  case 39:
  case 40:
  case 41:
  case 42:
  case 43:			// Highest encodable number: Math.log2(999e10) ~ 43.18
    // if (!isFinite(flt)) {
    //   throw new Error('fp encoding: internal failure in short float: not a finite number');
    // }

    // Note:
    // We encode a certain range and type of values specially as that will deliver shorter Unicode
    // sequences: 'human' values like `4200` and `0.125` (1/8th) are almost always
    // not encoded *exactly* in IEE754 floats due to their base(2) storage nature.
    //
    // Here we detect quickly if the mantissa would span at most 3 decimal digits
    // and the exponent happens to be within reasonable range: when this is the
    // case, we encode them as a *decimal short float* in 13 bits, which happen
    // to fit snugly in the Unicode word range 0x8000..0xC000 or in a larger
    // *decimal float* which spans two words: 13+15 bits.
    var dp = (exp2 * FPC_ENC_LOG2_TO_LOG10 + 1) | 0;
    var dy = flt / Math.pow(10, dp - 3);    // take mantissa (which is guaranteed to be in range [0.999 .. 0]) and multiply by 1000
    //console.log('decimal float test:', flt, exp2, exp2 * FPC_ENC_LOG2_TO_LOG10, p, dp, dy);

    // fist check exponent, only when in range perform the costly modulo operation
    // and comparison to further check conditions suitable for short float encoding.
    //
    // `dy < 1024` is not required, theoretically, but here as a precaution:
    if (dp >= -2 && dp <= 11 /* (L= 11 + 3) - o=2 */ /* && dy < 1024 */) {
      var chk = dy % 1;
      //console.log('decimal float eligible? A:', flt, dy, chk, dp);
      if (chk === 0) {                     // alt check:   `(dy | 0) === dy`
        // this input value is potentially eligible for 'short decimal float encoding'...
        //
        // *short* decimal floats take 13-14 bits (10+~4) at 
        // 0x8000..0xD7FF + 0xE000..0xF7FF (since we skip the Unicode Surrogate range
        // at 0xD800.0xDFFF (http://unicodebook.readthedocs.io/unicode_encodings.html#utf-16-surrogate-pairs).
        // 
        // Our original design had the requirement (more like a *wish* really)
        // that 'short floats' have decimal exponent -3..+6 at least and encode
        // almost all 'human numbers', i.e. values that humans enter regularly
        // in their data: these values usually only have 2-3 significant
        // digits so we should be able to encode those in a rather tiny mantissa.
        // 
        // The problem then is with encoding decimal fractions as quite many of them
        // don't fit a low-digit-count *binary* mantissa, e.g. 0.5 or 0.3 are
        // a nightmare if you want *precise* encoding in a tiny binary mantissa.
        // The solution we came up with was to multiply the number by a decimal power
        // of 10 so that 'eligible' decimal fractions would actually look like 
        // integer numbers: when you multiply by 1000, 0.3 becomes 300 which is
        // perfectly easy to encode in a tiny mantissa (we would need 9 bits).
        // 
        // Then the next problem would be to encode large integers, e.g. 1 million,
        // in a tiny mantissa: hence we came up with the notion of a *decimal*
        // *floating* *point* value notation for 'short values': we note the 
        // power as a decimal rather than a binary power and then define the
        // mantissa as an integer value from, say, 1..1000, hence 1 million (1e6)
        // would then be encoded as (power=6,mantissa=1), for example.
        // 
        // It is more interesting to look at values like 0.33 or 15000: the latter
        // SHOULD NOT be encoded as (power=4,mantissa=1.5) because that wouldn't work,
        // but instead the latter should be encoded as (power=3,mantissa=15) to
        // ensure we get a small mantissa.
        // As we noted before that 'human values' have few significant digits in
        // the decimal value, the key is to multiply the value with a decimal 
        // power until the significant digits are in the integer range, i.e. if
        // we expect to encode 3-digit values, we 'shift the decimal power by +3' 
        // so that the mantissa, previously in the range 0..1, now will be in the
        // range 0..1e3, hence input value 0.33 becomes 0.33e0, shifted by 
        // decimal power +3 this becomes 330e-3 (330 * 10e-3 === 0.330 === 0.33e0),
        // which can be encoded precisely in a 9-bit mantissa.
        // Ditto for example value 15000: while the binary floating point would
        // encode this as the equivalent of 0.15e6, we transform this into 150e3,
        // which fits in a 9 bit mantissa as well.
        // 
        // ---
        // 
        // Now that we've addressed the non-trivial 'decimal floating point' 
        // concept from 'short float notation', we can go and check how many 
        // decimal power values we can store: given that we need to *skip*
        // the Unicode Surrogate ranges (High and Low) at 0xD800..0xDFFF, plus
        // the Unicode specials at the 0xFFF0..0xFFFF range we should look at
        // the available bit patterns here... (really we only would be bothered
        // about 0xFFFD..0xFFFF, but it helps us in other ways to make this 
        // range a wee little wider: then we can use those code points to 
        // store the special floating point values NaN, Inf, etc.)
        // 
        // For 'short floats' we have the code range 0x8000..0xFFFF, excluding
        // those skip ranges, i.e. bit15 is always SET for 'short float'. Now
        // let's look at the bit patterns available for our decimal power,
        // assuming sign and a mantissa good for 3 decimal significant digits
        // is placed in the low bits zone (3 decimal digits takes 10 bits):
        // This gives us 0x80-0xD0 ~ $1000 0sxx .. $1101 0sxx 
        // + 0xE0-0xF0 ~ $1110 0sxx .. $1111 0sxx
        // --> power values 0x10..0x1A minus 0x10 --> [0x00..0x0A] --> 11 exponent values.
        // + 0x1C..0x1E minus 0x1C --> [0x00..0x02]+offset=11 --> 3 extra values! 
        //
        // As we want to be able to store 'millis' and 'millions' at least,
        // there's plenty room as that required range is 10 (6+1+3: don't 
        // forget about the power value 0!). With this range, it's feasible
        // to also support all high *billions* (1E9) as well thanks to the extra range 0x1C..0x1E
        // in Unicode code points 0xE000..0xF7FF.
        // 
        // As we choose to only go up to 0xF7FF, we keep 0xF800..0xFFFF as a 
        // 'reserved for future use' range.
        // 
        // ---
        // 
        // Offset the exponent so it's always positive when encoded:
        dp += 2;

        // short float eligible value for sure!
        var dc;

        // make sure to skip the 0xD8xx range by bumping the exponent:
        if (dp > 10) {
          // dp = 0xA --> dp = 0xC, ...
          dp += 2;
        }

        //
        // Bits in word:
        // - 0..9: integer mantissa; values 0..1023
        // - 10: sign
        // - 11..14: exponent 0..9 with offset -3 --> -3..+6
        // - 15: set to signal special values; this bit is also set for some special Unicode characters,
        //       so we can only set this bit and have particular values in bits 0..14 at the same time
        //       in order to prevent a collision with those Unicode specials ('surrogates') 
        //       at 0xD800..0xDFFF.
        //
        // alt:                    __(!!s << 10)_   _dy_____
        dc = 0x8000 + (dp << 11) + (s ? 1024 : 0) + (dy | 0);                  // the `| 0` shouldn't be necessary but is there as a precaution
        //console.log('d10-dbg', dp, dy, s, '0x' + dc.toString(16), flt);
        return String.fromCharCode(dc);
      }
    }
    // fall through!

  // this range of exponents shows up when you handle denormalized zeroes:
  case -1074:
  case -1073:
  case -1072:
  case -1071:
  case -1070:
  case -1069:
  case -1068:
  case -1067:
  case -1066:
  case -1065:
  case -1064:
  case -1063:
  case -1062:
  case -1061:
  case -1060:
  case -1059:
  case -1058:
  case -1057:
  case -1056:
  case -1055:
  case -1054:
  case -1053:
  case -1052:
  case -1051:
  case -1050:
  case -1049:
  case -1048:
  case -1047:
  case -1046:
  case -1045:
  case -1044:
  case -1043:
  case -1042:
  case -1041:
  case -1040:
  case -1039:
  case -1038:
  case -1037:
  case -1036:
  case -1035:
  case -1034:
  case -1033:
  case -1032:
  case -1031:
  case -1030:
  case -1029:
  case -1028:
  case -1027:
  case -1026:
  case -1025:
    if (p < -1024) {
      // Correct for our process: we actually want the bits in the IEE754 exponent, hence
      // exponents lower than -1024, a.k.a. *denormalized zeroes*, are treated exactly
      // like that in our code as well: we will produce leading mantissa ZERO words then.
      p = -1024;
    }
    // fall through

  default:
    // and produce the mantissa so that it's range now is [0..2>: for powers > 0
    // the value y will be >= 1 while for negative powers, i.e. tiny numbers, the
    // value 0 < y < 1.
    var y = flt / Math.pow(2, p);
    y /= 2;                       // we do this in two steps to allow handling even the largest floating point values, which have p=1023: Math.pow(2, p+1) would fail for those!
    // if (y >= 1) {
    //   throw new Error('fp float encoding: mantissa above allowed max');
    // }

    var a = '';
    var b = y;       // alt: y - 1, but that only gives numbers 0 < b < 1 for p > 0
    // if (b < 0) {
    //   throw new Error('fp encoding: negative mantissa');
    // }
    // if (b === 0) {
    //   throw new Error('fp encoding: ZERO mantissa');
    // }

    // and show the Unicode character codes for debugging/diagnostics:
    //var dbg = [0 /* Note: this slot will be *correctly* filled at the end */];
    //console.log('dbg @ start', 0, p + 1024 + s, flt, dbg, s, p, y, b);

    for (var i = 0; b && i < FPC_ENC_MAXLEN; i++) {
      b *= FPC_ENC_MODULO;
      var c = b | 0;                  // grab the integer part
      var d = b - c;

      //dbg[i + 1] = c;
      //console.log('dbg @ step', i, c, flt, dbg, s, p, y, b, d, '0x' + c.toString(16));

      a += String.fromCharCode(c);
      b = d;
    }

    // encode sign + power + mantissa length in a Unicode char
    // (i E {0..4} as maximum size FPC_ENC_MAXLEN=4 ==> 3 bits of length @ bits 13.14.15 in word)
    //
    // Bits in word:
    // - 0..11: exponent; values -1024..+1023 with an offset of 1024 to make them all positive numbers
    // - 12: sign
    // - 13,14: length 1..4: the number of words following to define the mantissa
    // - 15: set to signal special values; this bit is also set for some special Unicode characters,
    //       so we can only set this bit and have particular values in bits 0..14 at the same time
    //       in order to prevent a collision with those Unicode specials at 0xD800..0xDFFF.
    //
    // Special values (with bit 15 set):
    // - +Inf
    // - -Inf
    // - NaN
    // - -0    (negative zero)
    // - +0    (positive zero)
    //
    --i;
    // if (i > 3) {
    //   throw new Error('fp encode length too large');
    // }
    var h = p + 1024 + s + (i << 13 /* i * 8192 */ );   // brackets needed as + comes before <<   :-(
    a = String.fromCharCode(h) + a;
    //dbg[0] = h;
    //console.log('dbg @ end', i, h, flt, dbg, s, p, y, b, '0x' + h.toString(16));
    return a;
  }
}








console.info('fpcvt-alt1 loaded');

