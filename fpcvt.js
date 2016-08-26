

// See also:
//
//   - https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html
//     + https://ece.uwaterloo.ca/~dwharder/NumericalAnalysis/02Numerics/Double/paper.pdf
//     + http://perso.ens-lyon.fr/jean-michel.muller/goldberg.pdf
//   - http://steve.hollasch.net/cgindex/coding/ieeefloat.html
//   - https://en.wikipedia.org/wiki/IEEE_floating_point
//   - https://www.cs.umd.edu/class/sum2003/cmsc311/Notes/Data/float.html
//   - https://www.doc.ic.ac.uk/~eedwards/compsys/float/
//




// The modulo 0x8000 takes 4 characters for a mantissa of 52 bits, while the same goes
// for modulo 0x4000.
// So we either have the upper bit at mask 0x4000 available on every char or we have
// some spare bits in the last word...
const FPC_ENC_MODULO = 0x8000;
const FPC_ENC_MAXLEN = (function () {
  var l = Math.log(Math.pow(2, 53)) / Math.log(FPC_ENC_MODULO);   // number of chars = words required to store worst case fp values
  l += 1;
  l |= 0;
  //
  // and since we want to see how easy it is to have run-away output for some fp numbers,
  // we enlarge the boundary criterium for debugging/diagnostics:
  //l *= 4  // just to detect nasty edge cases: will produce very long strings
  return l;
})();
const FPC_ENC_LOG2_TO_LOG10 = 1 / Math.log2(10);

// mask: 0x000F; offset: 0xFFF0:
const FPC_ENC_POSITIVE_ZERO     = 0xFFF0;
const FPC_ENC_NEGATIVE_ZERO     = 0xFFF1;
const FPC_ENC_POSITIVE_INFINITY = 0xFFF2;
const FPC_ENC_NEGATIVE_INFINITY = 0xFFF3;
const FPC_ENC_NAN               = 0xFFF4;

const FPC_DEC_POSITIVE_ZERO     = 0;
const FPC_DEC_NEGATIVE_ZERO     = -0;
const FPC_DEC_POSITIVE_INFINITY = Infinity;
const FPC_DEC_NEGATIVE_INFINITY = -Infinity;
const FPC_DEC_NAN               = NaN;






/*
Performance Test of encode_fp_value() vs. vanilla JS:

Test                                    Ops/sec

Chrome 
Version 54.0.2810.2 canary (64-bit)

Classic : toString                      14,361
                                        ±1.46%
                                        49% slower

Classic : add to string (= '' + val)    28,519
                                        ±2.66%
                                        fastest

Classic :: toPrecision(max)             2,304
                                        ±0.23%
                                        92% slower

Custom :: v1                            2,659
                                        ±0.30%
                                        90% slower

Custom :: v2                            2,907
                                        ±0.43%
                                        90% slower

Custom :: v3                            2,752
                                        ±0.90%
                                        90% slower

Chrome 
Version 51.0.2704.3 m

Classic : toString                      17,234
                                        ±1.93%
                                        18% slower

Classic : add to string (= '' + val)    20,962
                                        ±1.65%
                                        fastest

Classic :: toPrecision(max)             1,813
                                        ±0.46%
                                        91% slower

Custom :: v1                            2,313
                                        ±0.72%
                                        89% slower

Custom :: v2                            2,566
                                        ±1.07%
                                        88% slower

Custom :: v3                            2,486
                                        ±0.72%
                                        88% slower

Chrome 
Version 52.0.2743.82 m

Classic : toString                      20,120
                                        ±1.85%
                                        20% slower

Classic : add to string (= '' + val)    25,011
                                        ±1.89%
                                        fastest

Classic :: toPrecision(max)             1,871
                                        ±0.98%
                                        92% slower

Custom :: v1                            2,318
                                        ±0.99%
                                        91% slower

Custom :: v2                            2,593
                                        ±0.71%
                                        90% slower

Custom :: v3                            2,477
                                        ±0.88%
                                        90% slower

MSIE 
Version Edge 25.10586.0.0

Classic : toString                      1,942 
                                        ±0.59%
                                        26% slower
                                        (✕ 1.4) 

Classic : add to string                 2,147 
                                        ±0.40%
                                        18% slower
                                        (✕ 1.2) 

Classic :: toPrecision(max)             1,821 
                                        ±0.63%
                                        31% slower
                                        (✕ 1.4) 

Custom :: v1                            2,261 
                                        ±1.42%
                                        15% slower
                                        (✕ 1.2) 

Custom :: v2                            2,655 
                                        ±1.24%
                                        fastest
                                        (✕ 1) 

Custom :: v3                            2,403 
                                        ±1.12%
                                        9% slower
                                        (✕ 1.1) 

FireFox
Version 47.0.1

Classic : toString                      1,754
                                        ±1.57%
                                        50% slower
                                        (✕ 2.0)

Classic : add to string                 1,785
                                        ±0.50%
                                        49% slower
                                        (✕ 2.0)

Classic :: toPrecision(max)             1,290
                                        ±1.68%
                                        64% slower
                                        (✕ 2.7)

Custom :: v1                            3,285
                                        ±2.67%
                                        8% slower
                                        (✕ 1.1)

Custom :: v2                            3,568
                                        ±2.45%
                                        fastest
                                        (✕ 1)

Custom :: v3                            3,558
                                        ±2.85%
                                        fastest
                                        (✕ 1)

FireFox
Version 49.0a2 (developer / aurora)

Classic : toString                      2,033
                                        ±1.01%
                                        37% slower
                                        (✕ 1.6)

Classic : add to string                 2,063
                                        ±0.77%
                                        36% slower
                                        (✕ 1.6)

Classic :: toPrecision(max)             1,342
                                        ±2.19%
                                        59% slower
                                        (✕ 2.4)

Custom :: v1                            2,835
                                        ±2.43%
                                        13% slower
                                        (✕ 1.2)

Custom :: v2                            3,272
                                        ±2.60%
                                        fastest
                                        (✕ 1)

Custom :: v3                            3,140
                                        ±2.57%
                                        4% slower
                                        (✕ 1.0)


Note: 
When you take out the sanity checks `if (...) throw new Error(...)` then you gain about 10%:
2367 ops/sec -> 2657 ops/sec in another test run.

Note: 
There's a *huge* difference in performance, both relative and absolute, for these buggers in MSIE, FF and Chrome!

The 'classic' code wins by a factor of about 2 in Chrome, but amazingly enough our custom encoder wins in FF and is on par in MSIE.
Our *encoder* revision 2 is the fastest of our bunch, relatively speaking, so it seems
the big switch/case in there wins over the two nested `if()`s in the other two, while extra `if()`s
in the code slow it down a lot -- compare v1 and v3: the 'short float' decision making alteration
only adds very little to the performance while it turned out getting rid of the error-throwing
sanity checks made up the brunt of the gain of v3 vs. v1.

---

At least that's what the initial set of test runs seems to indicate...
*/


function encode_fp_value(flt) {
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
  } else if (isFinite(flt)) {
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
    var p = exp2 | 0;  // --> +1023..-1024, pardon!, +1024..-1074 (!!!)
    if (p < -1023) {
      // Correct for our process: we actually want the bits in the IEE754 exponent, hence
      // exponents lower than -1024, a.k.a. *denormalized zeroes*, are treated exactly
      // like that in our code as well: we will produce leading mantissa ZERO words then.
      // 
      // We also need to process the exponent -1024 specially as we have another edge case at p=+1024
      // which we do not want to check for separately: maximum performance means we want the least
      // number of conditional checks (~ if/else constructs) in our execution path!
      p = -1023;
    } else {
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
      if (dy < 0) {
        throw new Error('fp decimal short float encoding: negative mantissa');
      }
      if (dy === 0) {
        throw new Error('fp decimal short float encoding: ZERO mantissa');
      }
      if (dy > 1000) {
        throw new Error('fp decimal short float encoding: 3 digits check');
      }
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
        // `dy < 1024` is not required, theoretically, but here as a precaution:
        if (dp >= 0 && dp < 14 /* (L= 11 + 3) */ /* && dy < 1024 */) {
          // short float eligible value for sure!
          var dc;

          // make sure to skip the 0xD8xx range by bumping the exponent:
          if (dp >= 11) {
            // dp = 0xB --> dp = 0xC, ...
            dp++;
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
          if (dc >= 0xF800) {
            throw new Error('fp decimal short float encoding: internal error: beyond 0xF800');
          }
          if (dc >= 0xD800 && dc < 0xE000) {
            throw new Error('fp decimal short float encoding: internal error: landed in 0xD8xx block');
          }
          //console.log('d10-dbg', dp, dy, s, '0x' + dc.toString(16), flt);
          return String.fromCharCode(dc);
        }
      }
    }

    // and produce the mantissa so that it's range now is [0..2>: for powers > 0
    // the value y will be >= 1 while for negative powers, i.e. tiny numbers, the
    // value 0 < y < 1.
    p--;                          // drop power p by 1 so that we can safely encode p=+1024; the lower bound is already limited to -1023 instead of -1024 so we're good...
    var y = flt / Math.pow(2, p); 
    y /= 2;                       // we do this in two steps to allow handling even the largest floating point values, which have p=1024: Math.pow(2, p) would fail for those!
    if (y >= 1) {
      throw new Error('fp float encoding: mantissa above allowed max');
    }

    var a = '';
    var b = y;       // alt: y - 1, but that only gives numbers 0 < b < 1 for p > 0
    if (b < 0) {
      throw new Error('fp encoding: negative mantissa');
    }
    if (b === 0) {
      throw new Error('fp encoding: ZERO mantissa');
    }

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
    if (i > 3) {
      throw new Error('fp encode length too large');
    }
    var h = p + 1024 + s + (i << 13 /* i * 8192 */ );   // brackets needed as + comes before <<   :-(
    if (h >= 0xF800) {
      throw new Error('fp decimal long float encoding: internal error: initial word beyond 0xD800');
    }
    a = String.fromCharCode(h) + a;
    //dbg[0] = h;
    //console.log('dbg @ end', i, h, flt, dbg, s, p, y, b, '0x' + h.toString(16));
    return a;
  } else {
    // -Inf / +Inf
    if (flt > 0) {
      return String.fromCharCode(FPC_ENC_POSITIVE_INFINITY);
    } else {
      return String.fromCharCode(FPC_ENC_NEGATIVE_INFINITY);
    }
  }
}




/*
Performance Test of decode_fp_value() vs. vanilla JS:

Test                                    Ops/sec

CustomD :: v1                           21,885
                                        ±1.24%
                                        fastest

ClassicD : parseFloat                   5,143
                                        ±0.61%
                                        76% slower

ClassicD : multiply (= 1 * string)      4,744
                                        ±0.49%
                                        78% slower
*/


function decode_fp_value(s, opt) {
  // sample JS code to decode a IEEE754 floating point value from a Unicode string.
  //
  // With provision to detect +0/-0 and +/-Inf and NaN
  //
  opt = opt || { consumed_length: 0 };
  opt.consumed_length = 1;

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
  switch (c0 & 0xF800) {
  // This range spans the Unicode extended character ranges ('Surrogates') and MUST NOT be used by us for 'binary encoding'
  // purposes as we would than clash with any potential Unicode validators out there! The key of the current
  // design is that the encoded output is, itself, *legal* Unicode -- though admittedly I don't bother with
  // the Unicode conditions surrounding shift characters such as these:
  // 
  //   Z̤̺̦̤̰̠̞̃̓̓̎ͤ͒a̮̩̞͎̦̘̮l̖̯̞̝̗̥͙͋̔̆͊ͤ͐̚g͖̣̟̼͙ͪ̆͌̇ỏ̘̯̓ ̮̣͉̺̽͑́i̶͎̳̲ͭͅs̗̝̱̜̱͙̽ͥ̋̄ͨ̑͠ ̬̲͇̭̖ͭ̈́̃G̉̐̊ͪ͟o͓̪̗̤̳̱̅ȍ̔d̳̑ͥͧ̓͂ͤ ́͐́̂to̮̘̖̱͉̜̣ͯ̄͗ǫ̬͚̱͈̮̤̞̿̒ͪ!͆̊ͬͥ̆̊͋
  // 
  // which reside in the other ranges that we DO employ for our own nefarious encoding purposes!
  case 0xD800:
    throw new Error('illegal fp encoding value in 0xD8xx-0xDFxx unicode range');

  case 0xF800:
    // specials:
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
      throw new Error('illegal fp encoding value in 0xF8xx-0xFFxx unicode range');
    }
    break;

  case 0x8000:
  case 0x8800:
  case 0x9000:
  case 0x9800:
  case 0xA000:
    // 'human values' encoded as 'short floats':
    //
    // Bits in word:
    // - 0..9: integer mantissa; values 0..1023
    // - 10: sign
    // - 11..14: exponent 0..9 with offset -3 --> -3..+6
    // - 15: set to signal special values; this bit is also set for some special Unicode characters,
    //       so we can only set this bit and have particular values in bits 0..14 at the same time
    //       in order to prevent a collision with those Unicode specials at 0xD800..0xDFFF.
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
    return sflt;

  case 0xA800:
  case 0xB000:
  case 0xB800:
  case 0xC000:
  case 0xC800:
  case 0xD000:
    // 'human values' encoded as 'short floats':
    //
    // Bits in word:
    // - 0..9: integer mantissa; values 0..1023
    // - 10: sign
    // - 11..14: exponent 0..9 with offset -3 --> -3..+6
    // - 15: set to signal special values; this bit is also set for some special Unicode characters,
    //       so we can only set this bit and have particular values in bits 0..14 at the same time
    //       in order to prevent a collision with those Unicode specials at 0xD800..0xDFFF.
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
    return sflt;

  // (0xF800..0xFFFF: reserved for future use)
  case 0xE000:
  case 0xE800:
  case 0xF000:
    // 'human values' encoded as 'short floats':
    //
    // Bits in word:
    // - 0..9: integer mantissa; values 0..1023
    // - 10: sign
    // - 11..14: exponent 10..12 with offset -3 --> 7..9
    // - 15: set to signal special values; this bit is also set for some special Unicode characters,
    //       so we can only set this bit and have particular values in bits 0..14 at the same time
    //       in order to prevent a collision with those Unicode specials at 0xD800..0xDFFF.
    //
    var dm = c0 & 0x03FF;      // 10 bits
    var ds = c0 & 0x0400;      // bit 10 = sign
    var dp = c0 & 0x7800;      // bits 11..14: exponent

    //console.log('decode-short-0C', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
    dp >>>= 11;
    if (dp >= 15) {
      throw new Error('illegal fp encoding value in 0xF8xx-0xFFxx unicode range');
    }
    dp -= 3 + 2 + 1;            // like above, but now also compensate for exponent bumping (0xB --> 0xC, ...)

    var sflt = dm * Math.pow(10, dp);
    if (ds) {
      sflt = -sflt;
    }
    //console.log('decode-short-1C', sflt, ds, dm, dp, c0, '0x' + c0.toString(16));
    return sflt;

  default:
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
      opt.consumed_length++;
      //console.log('decode-normal-len=1', m, s.charCodeAt(1));
      break;

    case 0x2000:
      // 2 more 15-bit words:
      im = s.charCodeAt(1);
      im <<= 15;
      im |= s.charCodeAt(2);
      m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
      opt.consumed_length += 2;
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
      opt.consumed_length += 3;
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
      opt.consumed_length += 4;
      //console.log('decode-normal-len=4', m, s.charCodeAt(1) / FPC_ENC_MODULO, s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3), s.charCodeAt(4));
      break;
    }
    //console.log('decode-normal-1', vs, m, p, opt.consumed_length);
    m *= Math.pow(2, p);
    m *= 2;                       // we do this in two steps to allow handling even the largest floating point values, which have p=1023: Math.pow(2, p+1) would fail for those!
    if (vs) {
      m = -m;
    }
    //console.log('decode-normal-2', m);
    return m;
  }
}








console.info('fpcvt loaded');

