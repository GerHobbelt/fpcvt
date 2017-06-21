'use strict';

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
// some spare bits in the last word... We decide the few spare bits at the end is more beneficiary
// for our purposes as that gives us a little slack at least when encoding mantissas
// for high exponent values, etc.
var FPC_ENC_MODULO = 0x8000;
var FPC_ENC_MODULO_RECIPROCAL = 1 / FPC_ENC_MODULO;
var FPC_ENC_MAXLEN = function () {
  var l = Math.log(Math.pow(2, 53)) / Math.log(FPC_ENC_MODULO); // number of chars = words required to store worst case fp values
  l += 1;
  l |= 0;
  //
  // and since we want to see how easy it is to have run-away output for some fp numbers,
  // we enlarge the boundary criterium for debugging/diagnostics:
  //l *= 4  // just to detect nasty edge cases: will produce very long strings
  return l;
}();
var FPC_ENC_LOG2_TO_LOG10 = 1 / Math.log2(10);

// mask: 0x000F; offset: 0xFFF0:
var FPC_ENC_POSITIVE_ZERO = 0xFFF0;
var FPC_ENC_NEGATIVE_ZERO = 0xFFF1;
var FPC_ENC_POSITIVE_INFINITY = 0xFFF2;
var FPC_ENC_NEGATIVE_INFINITY = 0xFFF3;
var FPC_ENC_NAN = 0xFFF4;

var FPC_DEC_POSITIVE_ZERO = 0;
var FPC_DEC_NEGATIVE_ZERO = -0;
var FPC_DEC_POSITIVE_INFINITY = Infinity;
var FPC_DEC_NEGATIVE_INFINITY = -Infinity;
var FPC_DEC_NAN = NaN;

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
  //          Also note that at the high end of the exponent spectrum there's another
  //          oddity lurking:
  //
  //              Math.log2(Math.pow(2, 1023) * 1.9999999999999998) === 1024 
  //
  //          which technically would be a rounding error in `Math.log2`, while
  //
  //              Math.log2(Math.pow(2, 1023) * 1.9999999999999999) === Infinity
  //
  //          since
  //
  //              Math.pow(2, 1023) * 1.9999999999999999 === Infinity
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 !== Infinity   // at least on Chrome/V8. but this is really *begging* for it!
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 === 1.7976931348623157e+308
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 === Math.pow(2, 1023) * 1.9999999999999998
  //
  //          Consequently we'll have to check both upper and lower exponent limits to keep them
  //          within sane ranges:
  //          The lower exponents are for 'denormalized zeroes' which we can handle as-is, by turning
  //          their exponent into -1024, as does IEEE754 itself, while the upper edge oddity (exponent = +1024)
  //          must be treated separately (and it so happens that the treatment we choose also benefits
  //          another high exponent: +1023).
  //

  if (!flt) {
    // +0, -0 or NaN:
    if (isNaN(flt)) {
      return String.fromCharCode(FPC_ENC_NAN);
    } else {
      // detect negative zero:
      var is_negzero = Math.atan2(0, flt); // +0 --> 0, -0 --> PI
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
    var p = exp2 | 0; // --> +1023..-1024, pardon!, +1024..-1074 (!!!)
    if (p < -1024) {
      // Correct for our process: we actually want the bits in the IEE754 exponent, hence
      // exponents lower than -1024, a.k.a. *denormalized zeroes*, are treated exactly
      // like that in our code as well: we will produce leading mantissa ZERO words then.
      p = -1024;
    } else if (p >= 1023) {
      // We also need to process the exponent +1024 specially as that is another edge case
      // which we do not want to handle in our mainstream code flow where -1024 < p <= +1023
      // maximum performance means we want the least number of conditional checks 
      // (~ if/else constructs) in our execution path but I couldn't do without this extra one!

      // and produce the mantissa so that it's range now is [0..2>.
      p--; // drop power p by 1 so that we can safely encode p=+1024 (and p=+1023)
      var y = flt / Math.pow(2, p);
      y /= 4; // we do this in two steps to allow handling even the largest floating point values, which have p>=1023: Math.pow(2, p + 1) would fail for those!
      if (y >= 1) {
        throw new Error('fp float encoding: mantissa above allowed max for ' + flt);
      }

      // See performance test [test0008-array-join-vs-string-add]: string
      // concatenation is the fastest cross-platform.
      var a = '';
      var b = y;
      if (b < 0) {
        throw new Error('fp encoding: negative mantissa for ' + flt);
      }
      if (b === 0) {
        throw new Error('fp encoding: ZERO mantissa for ' + flt);
      }

      // and show the Unicode character codes for debugging/diagnostics:
      //var dbg = [0 /* Note: this slot will be *correctly* filled at the end */];
      //console.log('dbg @ start', 0, p + 1024 + s, flt, dbg, s, p, y, b);

      for (var i = 0; b && i < FPC_ENC_MAXLEN; i++) {
        b *= FPC_ENC_MODULO;
        var c = b | 0; // grab the integer part
        var d = b - c;

        //dbg[i + 1] = c;
        //console.log('dbg @ step', i, c, flt, dbg, s, p, y, b, d, '0x' + c.toString(16));

        a += String.fromCharCode(c);
        b = d;
      }

      // Note: we encode these 'very large floating point values' in the Unicode range 0xF800..0xF8FF 
      // (plus trailing mantissa words, of course!)
      //
      // encode sign + power + mantissa length in a Unicode char
      // (i E {1..4} as maximum size FPC_ENC_MAXLEN=4 ==> 2 bits of length @ bits 5.6 in word)
      //
      // Bits in word:
      // - 0..4: exponent; values +1020..+1024 with an offset of 1020 to make them all small positive numbers
      // - 7: sign
      // - 5,6: length 1..4: the number of words following to define the mantissa
      // - 8..15: (=0xF8) set to signal special 'near infinite' values; some of the same bits are also set for some special Unicode characters,
      //       so we can only have this particular value in bits 8..15
      //       in order to prevent a collision with those Unicode specials at 0xF900..0xFFFF.
      //
      --i;
      if (i > 3) {
        throw new Error('fp encode length too large');
      }
      if (b) {}
      var h = 0xF800 + p - 1020 + (s >> 12 - 7) + (i << 5); // brackets needed as + comes before <<   :-(
      if (h < 0xF800 || h >= 0xF900) {
        throw new Error('fp decimal long float near-inifinity number encoding: internal error: initial word out of range');
      }
      a = String.fromCharCode(h) + a;
      //dbg[0] = h;
      //console.log('dbg @ end', i, h, flt, dbg, s, p, y, b, '0x' + h.toString(16));
      return a;
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
      var dp = exp2 * FPC_ENC_LOG2_TO_LOG10 + 1 | 0;
      // Prevent crash for very small numbers (dp <= -307) and speeds up matters for any other values
      // which won't ever make it into the 'shorthand notation' anyway: here we replicate the `dp`
      // range check you also will see further below:
      //
      //     dp += 2;
      //     if (dp >= 0 && dp < 14 /* (L= 11 + 3) */ ) {
      if (dp >= -2 && dp < 12) {
        var dy;
        var dp_3 = dp - 3;
        // Because `dy = flt / Math.pow(10, dp - 3)` causes bitrot in `dy` LSB (so that, for example, input value 0.00077 becomes 76.9999999999999)
        // we produce the `dy` value in such a way that the power-of-10 multiplicant/divisor WILL be an INTEGER number, 
        // which does *not* produce the bitrot in the LSBit of the *decimal* mantissa `dy` that way:
        if (dp_3 < 0) {
          dy = flt * Math.pow(10, -dp_3); // take mantissa (which is guaranteed to be in range [0.999 .. 0]) and multiply by 1000
        } else {
          dy = flt / Math.pow(10, dp_3); // take mantissa (which is guaranteed to be in range [0.999 .. 0]) and multiply by 1000
        }
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

        // See performance test [test0012-modulo-vs-integer-check] for a technique comparison: 
        // this is the fastest on V8/Edge and second-fastest on FF. 
        var chk = dy | 0;
        //console.log('decimal float eligible? A:', { flt: flt, dy: dy, chk: chk, eq: chk === dy, dp: dp, exp2: exp2});
        if (chk === dy) {
          // alt check:   `(dy % 1) === 0`
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
          // 'reserved for future use' range. From that reserved range, we use
          // the range 0xF800..0xF8FF to represent floating point numbers with 
          // very high exponent values (p >= 1020), while the range 0xFFF0..0xFFF4
          // is used to represent special IEEE754 values such as NaN or Infinity.
          // 
          // ---
          //
          // Note: we now have our own set of 'denormalized' floating point values:
          // given the way we calculate decimal exponent and mantissa (by multiplying
          // with 1000), we will always have a minimum mantissa value of +100, as
          // any *smaller* value would have produced a lower *exponent*!
          // 
          // Next to that, note that we allocate a number of *binary bits* for the
          // mantissa, which can never acquire a value of +1000 or larger as there
          // the same reasoning applies: if such a value were possible, the exponent
          // would have been *raised* by +1 and the mantissa would have been reduced
          // to land within the +100..+999 range once again.
          // 
          // This means that a series of sub-ranges cannot ever be produced by this 
          // function:
          // 
          // - 0x8000      .. 0x8000+  99    (exponent '0', sign bit CLEAR) 
          // - 0x8000+1000 .. 0x8000+1023 
          // - 0x8400      .. 0x8400+  99    (exponent '0', sign bit SET) 
          // - 0x8400+1000 .. 0x8400+1023 
          // - 0x8800      .. 0x8800+  99    (exponent '1', sign bit CLEAR) 
          // - 0x8800+1000 .. 0x8800+1023 
          // - 0x8C00      .. 0x8C00+  99    (exponent '1', sign bit SET) 
          // - 0x8C00+1000 .. 0x8C00+1023 
          // - ... etc ...
          // 
          // One might be tempted to re-use these 'holes' in the output for other
          // purposes, but it's faster to have any special codes use their
          // own 'reserved range' as that would only take one extra conditional
          // check and since we now know (since perf test0006) that V8 isn't
          // too happy about long switch/case constructs, we are better off, 
          // performance wise, to strive for the minimum number of comparisons, 
          // rather than striving for a maximum fill of the available Unicode
          // space.
          // 
          // BTW: We could have applied this same reasoning when we went looking for
          // a range to use to encode those pesky near-infinity high exponent
          // floating point values (p >= 1023), but at the time we hadn't 
          // realized yet that we would have these (large) holes in the output 
          // range.
          // Now that we know these exist, we *might* consider filling one of
          // those 'holes' with those high-exponent values as those really only
          // take 5 bits (2 bits for exponent: 1023 or 1024, 1 bit for sign,
          // 2 bits for length) while they currently usurp the range 0xF800..0xF8FF
          // (with large holes in there as well!)
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
              //       at 0xD800..0xDFFF (and our own specials at 0xF800..0xFFFF).
              //
              // alt:                    __(!!s << 10)_   _dy_____
              dc = 0x8000 + (dp << 11) + (s ? 1024 : 0) + (dy | 0); // the `| 0` shouldn't be necessary but is there as a precaution
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
    }

    // and produce the mantissa so that it's range now is [0..2>: for powers > 0
    // the value y will be >= 1 while for negative powers, i.e. tiny numbers, the
    // value 0 < y < 1.
    p++; // increase power p by 1 so that we get a mantissa in the range [0 .. +1>; this causes trouble when the exponent is very high, hence those values are handled elsewhere
    var y = flt / Math.pow(2, p);
    if (y >= 1) {
      throw new Error('fp float encoding: mantissa above allowed max for ' + flt);
    }

    // See performance test [test0008-array-join-vs-string-add]: string
    // concatenation is the fastest cross-platform.
    var a = '';
    var b = y; // alt: y - 1, but that only gives numbers 0 < b < 1 for p > 0
    if (b < 0) {
      throw new Error('fp encoding: negative mantissa for ' + flt);
    }
    if (b === 0) {
      throw new Error('fp encoding: ZERO mantissa for ' + flt);
    }

    // and show the Unicode character codes for debugging/diagnostics:
    //var dbg = [0 /* Note: this slot will be *correctly* filled at the end */];
    //console.log('dbg @ start', 0, p + 1024 + s, flt, dbg, s, p, y, b);

    for (var i = 0; b && i < FPC_ENC_MAXLEN; i++) {
      b *= FPC_ENC_MODULO;
      var c = b | 0; // grab the integer part
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
    //       in order to prevent a collision with those Unicode specials at 0xD800..0xDFFF 
    //       (and our own specials at 0xF800..0xFFFF).
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
    if (b) {}
    var h = p + 1024 + s + (i << 13 /* i * 8192 */); // brackets needed as + comes before <<   :-(
    if (h >= 0x8000) {
      throw new Error('fp decimal long float encoding: internal error: initial word beyond 0x8000');
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
  // we do not want to spend any amount of time in the 'special values' overhead,
  // which would be added overhead if we did check for those *first* instead of *at the same time*
  // as we do here by looking at the top nibble immediately (Note: This ASSUMES your JS engine (Chrome V8?)
  // is smart enough to convert this switch/case statement set into a jump table, just like any
  // decent C-like language compiler would! It turns out not everyone out there is all that smart
  // yet... Sigh...):
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
      throw new Error('illegal fp encoding value in 0xD800-0xDFFF unicode range');

    case 0xF800:
      // specials:
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
            opt.consumed_length++;
            //console.log('decode-normal-len=1', m, s.charCodeAt(1));
            break;

          case 0x0020:
            // 2 more 15-bit words:
            im = s.charCodeAt(1);
            im <<= 15;
            im |= s.charCodeAt(2);
            m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
            opt.consumed_length += 2;
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
            opt.consumed_length += 3;
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
            opt.consumed_length += 4;
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
        return m;
      } else {
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
      break;

    case 0x8000:
    case 0x8800:
    case 0x9000:
    case 0x9800:
    case 0xA000:
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
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

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
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

      //console.log('decode-short-0', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      dp -= 3 + 2;

      var sflt = dm * Math.pow(10, dp);
      if (ds) {
        sflt = -sflt;
      }
      //console.log('decode-short-1', sflt, ds, dm, dp, c0, '0x' + c0.toString(16));
      return sflt;

    // (0xF900..0xFFF0: reserved for future use)
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
      //       in order to prevent a collision with those Unicode specials at 0xF800..0xFFFF.
      //
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

      //console.log('decode-short-0C', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      if (dp >= 15) {
        throw new Error('illegal fp encoding value in 0xF8xx-0xFFxx unicode range');
      }
      dp -= 3 + 2 + 1; // like above, but now also compensate for exponent bumping (0xB --> 0xC, ...)

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
      if (vs) {
        m = -m;
      }
      //console.log('decode-normal-2', m);
      return m;
  }
}

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
  //          Also note that at the high end of the exponent spectrum there's another
  //          oddity lurking:
  //
  //              Math.log2(Math.pow(2, 1023) * 1.9999999999999998) === 1024 
  //
  //          which technically would be a rounding error in `Math.log2`, while
  //
  //              Math.log2(Math.pow(2, 1023) * 1.9999999999999999) === Infinity
  //
  //          since
  //
  //              Math.pow(2, 1023) * 1.9999999999999999 === Infinity
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 !== Infinity   // at least on Chrome/V8. but this is really *begging* for it!
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 === 1.7976931348623157e+308
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 === Math.pow(2, 1023) * 1.9999999999999998
  //
  //          Consequently we'll have to check both upper and lower exponent limits to keep them
  //          within sane ranges:
  //          The lower exponents are for 'denormalized zeroes' which we can handle as-is, by turning
  //          their exponent into -1024, as does IEEE754 itself, while the upper edge oddity (exponent = +1024)
  //          must be treated separately (and it so happens that the treatment we choose also benefits
  //          another high exponent: +1023).
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
  var p = exp2 | 0; // --> +1023..-1024, pardon!, +1024..-1074 (!!!)
  switch (p) {
    // Handle the edge case p=+1024 and regular case p=+1023, which wouldn't work in the default mode further below due to `Math.pow(2, p+1)`:
    case 1023:
    case 1024:
      // We also need to process the exponent +1024 specially as that is another edge case
      // which we do not want to handle in our mainstream code flow where -1024 < p <= +1023
      // maximum performance means we want the least number of conditional checks 
      // (~ if/else constructs) in our execution path but I couldn't do without this extra one!

      // and produce the mantissa so that it's range now is [0..2>.
      p--; // drop power p by 1 so that we can safely encode p=+1024 (and p=+1023)
      var y = flt / Math.pow(2, p);
      y /= 4; // we do this in two steps to allow handling even the largest floating point values, which have p>=1023: Math.pow(2, p + 1) would fail for those!

      // See performance test [test0008-array-join-vs-string-add]: string
      // concatenation is the fastest cross-platform.
      var a = '';
      var b = y;

      // and show the Unicode character codes for debugging/diagnostics:
      //var dbg = [0 /* Note: this slot will be *correctly* filled at the end */];
      //console.log('dbg @ start', 0, p + 1024 + s, flt, dbg, s, p, y, b);

      for (var i = 0; b && i < FPC_ENC_MAXLEN; i++) {
        b *= FPC_ENC_MODULO;
        var c = b | 0; // grab the integer part
        var d = b - c;

        //dbg[i + 1] = c;
        //console.log('dbg @ step', i, c, flt, dbg, s, p, y, b, d, '0x' + c.toString(16));

        a += String.fromCharCode(c);
        b = d;
      }

      // Note: we encode these 'very large floating point values' in the Unicode range 0xF800..0xF8FF 
      // (plus trailing mantissa words, of course!)
      //
      // encode sign + power + mantissa length in a Unicode char
      // (i E {1..4} as maximum size FPC_ENC_MAXLEN=4 ==> 2 bits of length @ bits 5.6 in word)
      //
      // Bits in word:
      // - 0..4: exponent; values +1020..+1024 with an offset of 1020 to make them all small positive numbers
      // - 7: sign
      // - 5,6: length 1..4: the number of words following to define the mantissa
      // - 8..15: (=0xF8) set to signal special 'near infinite' values; some of the same bits are also set for some special Unicode characters,
      //       so we can only have this particular value in bits 8..15
      //       in order to prevent a collision with those Unicode specials at 0xF900..0xFFFF.
      //
      --i;
      var h = 0xF800 + p - 1020 + (s >> 12 - 7) + (i << 5); // brackets needed as + comes before <<   :-(
      a = String.fromCharCode(h) + a;
      //dbg[0] = h;
      //console.log('dbg @ end', i, h, flt, dbg, s, p, y, b, '0x' + h.toString(16));
      return a;

    // The power 0 also shows up when we treat a NaN or +/-Inf or +/-0:
    case 0:
      if (!flt) {
        // +0, -0 or NaN:
        if (isNaN(flt)) {
          return String.fromCharCode(FPC_ENC_NAN);
        } else {
          // detect negative zero:
          var is_negzero = Math.atan2(0, flt); // +0 --> 0, -0 --> PI
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
    case -9: // Math.log2(1e-3) ~ -9.966
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
    case 43:
      // Highest encodable number: Math.log2(999e10) ~ 43.18
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
      var dp = exp2 * FPC_ENC_LOG2_TO_LOG10 + 1 | 0;

      // first check exponent, only when in range perform the costly modulo operation
      // and comparison to further check conditions suitable for short float encoding.
      //
      // This also prevents a crash for very small numbers (dp <= -307) and speeds up matters for any other values
      // which won't ever make it into the 'shorthand notation' anyway.
      if (dp >= -2 && dp < 12 /* (L= 11 + 3) - o=2 */) {
          var dy;
          var dp_3 = dp - 3;
          // Because `dy = flt / Math.pow(10, dp - 3)` causes bitrot in `dy` LSB (so that, for example, input value 0.00077 becomes 76.9999999999999)
          // we produce the `dy` value in such a way that the power-of-10 multiplicant/divisor WILL be an INTEGER number, 
          // which does *not* produce the bitrot in the LSBit of the *decimal* mantissa `dy` that way:
          if (dp_3 < 0) {
            dy = flt * Math.pow(10, -dp_3); // take mantissa (which is guaranteed to be in range [0.999 .. 0]) and multiply by 1000
          } else {
            dy = flt / Math.pow(10, dp_3); // take mantissa (which is guaranteed to be in range [0.999 .. 0]) and multiply by 1000
          }
          //console.log('decimal float test:', flt, exp2, exp2 * FPC_ENC_LOG2_TO_LOG10, p, dp, dy);

          // See performance test [test0012-modulo-vs-integer-check] for a technique comparison: 
          // this is the fastest on V8/Edge and second-fastest on FF. 
          var chk = dy | 0;
          //console.log('decimal float eligible? A:', { flt: flt, dy: dy, chk: chk, eq: chk === dy, dp: dp, exp2: exp2});
          if (chk === dy) {
            // alt check:   `(dy % 1) === 0`
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
            // 'reserved for future use' range. From that reserved range, we use
            // the range 0xF800..0xF8FF to represent floating point numbers with 
            // very high exponent values (p >= 1020), while the range 0xFFF0..0xFFF4
            // is used to represent special IEEE754 values such as NaN or Infinity.
            // 
            // ---
            //
            // Note: we now have our own set of 'denormalized' floating point values:
            // given the way we calculate decimal exponent and mantissa (by multiplying
            // with 1000), we will always have a minimum mantissa value of +100, as
            // any *smaller* value would have produced a lower *exponent*!
            // 
            // Next to that, note that we allocate a number of *binary bits* for the
            // mantissa, which can never acquire a value of +!000 or larger as there
            // the same reasoning applies: if such a value were possible, the exponent
            // would have been *raised* by +1 and the mantissa would have been reduced
            // to land within the +100..+999 range once again.
            // 
            // This means that a series of sub-ranges cannot ever be produced by this 
            // function:
            // 
            // - 0x8000      .. 0x8000+  99    (exponent '0', sign bit CLEAR) 
            // - 0x8000+1000 .. 0x8000+1023 
            // - 0x8400      .. 0x8400+  99    (exponent '0', sign bit SET) 
            // - 0x8400+1000 .. 0x8400+1023 
            // - 0x8800      .. 0x8800+  99    (exponent '1', sign bit CLEAR) 
            // - 0x8800+1000 .. 0x8800+1023 
            // - 0x8C00      .. 0x8C00+  99    (exponent '1', sign bit SET) 
            // - 0x8C00+1000 .. 0x8C00+1023 
            // - ... etc ...
            // 
            // One might be tempted to re-use these 'holes' in the output for other
            // purposes, but it's faster to have any special codes use their
            // own 'reserved range' as that would only take one extra conditional
            // check and since we now know (since perf test0006) that V8 isn't
            // too happy about long switch/case constructs, we are better off, 
            // performance wise, to strive for the minimum number of comparisons, 
            // rather than striving for a maximum fill of the available Unicode
            // space.
            // 
            // BTW: We could have applied this same reasoning when we went looking for
            // a range to use to encode those pesky near-infinity high exponent
            // floating point values (p >= 1023), but at the time we hadn't 
            // realized yet that we would have these (large) holes in the output 
            // range.
            // Now that we know these exist, we *might* consider filling one of
            // those 'holes' with those high-exponent values as those really only
            // take 5 bits (2 bits for exponent: 1023 or 1024, 1 bit for sign,
            // 2 bits for length) while they currently usurp the range 0xF800..0xF8FF
            // (with large holes in there as well!)
            // 
            // ---
            // 
            // Offset the exponent so it's always positive when encoded:
            dp += 2;

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
            //       at 0xD800..0xDFFF (and our own specials at 0xF800..0xFFFF).
            //
            // alt:                    __(!!s << 10)_   _dy_____
            dc = 0x8000 + (dp << 11) + (s ? 1024 : 0) + (dy | 0); // the `| 0` shouldn't be necessary but is there as a precaution
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
      p++; // increase power p by 1 so that we get a mantissa in the range [0 .. +1>; this causes trouble when the exponent is very high, hence those values are handled elsewhere
      var y = flt / Math.pow(2, p);

      // See performance test [test0008-array-join-vs-string-add]: string
      // concatenation is the fastest cross-platform.
      var a = '';
      var b = y; // alt: y - 1, but that only gives numbers 0 < b < 1 for p > 0

      // and show the Unicode character codes for debugging/diagnostics:
      //var dbg = [0 /* Note: this slot will be *correctly* filled at the end */];
      //console.log('dbg @ start', 0, p + 1024 + s, flt, dbg, s, p, y, b);

      for (var i = 0; b && i < FPC_ENC_MAXLEN; i++) {
        b *= FPC_ENC_MODULO;
        var c = b | 0; // grab the integer part
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
      //       in order to prevent a collision with those Unicode specials at 0xD800..0xDFFF 
      //       (and our own specials at 0xF800..0xFFFF).
      //
      // Special values (with bit 15 set):
      // - +Inf
      // - -Inf
      // - NaN
      // - -0    (negative zero)
      // - +0    (positive zero)
      //
      --i;
      var h = p + 1024 + s + (i << 13 /* i * 8192 */); // brackets needed as + comes before <<   :-(
      a = String.fromCharCode(h) + a;
      //dbg[0] = h;
      //console.log('dbg @ end', i, h, flt, dbg, s, p, y, b, '0x' + h.toString(16));
      return a;
  }
}

function encode_fp_value3(flt) {
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
  //          Also note that at the high end of the exponent spectrum there's another
  //          oddity lurking:
  //
  //              Math.log2(Math.pow(2, 1023) * 1.9999999999999998) === 1024 
  //
  //          which technically would be a rounding error in `Math.log2`, while
  //
  //              Math.log2(Math.pow(2, 1023) * 1.9999999999999999) === Infinity
  //
  //          since
  //
  //              Math.pow(2, 1023) * 1.9999999999999999 === Infinity
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 !== Infinity   // at least on Chrome/V8. but this is really *begging* for it!
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 === 1.7976931348623157e+308
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 === Math.pow(2, 1023) * 1.9999999999999998
  //
  //          Consequently we'll have to check both upper and lower exponent limits to keep them
  //          within sane ranges:
  //          The lower exponents are for 'denormalized zeroes' which we can handle as-is, by turning
  //          their exponent into -1024, as does IEEE754 itself, while the upper edge oddity (exponent = +1024)
  //          must be treated separately (and it so happens that the treatment we choose also benefits
  //          another high exponent: +1023).
  //

  if (!flt) {
    // +0, -0 or NaN:
    if (isNaN(flt)) {
      return String.fromCharCode(FPC_ENC_NAN);
    } else {
      // detect negative zero:
      var is_negzero = Math.atan2(0, flt); // +0 --> 0, -0 --> PI
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
    var p = exp2 | 0; // --> +1023..-1024, pardon!, +1024..-1074 (!!!)
    if (p < -1024) {
      // Correct for our process: we actually want the bits in the IEE754 exponent, hence
      // exponents lower than -1024, a.k.a. *denormalized zeroes*, are treated exactly
      // like that in our code as well: we will produce leading mantissa ZERO words then.
      p = -1024;
    } else if (p >= 1023) {
      // We also need to process the exponent +1024 specially as that is another edge case
      // which we do not want to handle in our mainstream code flow where -1024 < p <= +1023
      // maximum performance means we want the least number of conditional checks 
      // (~ if/else constructs) in our execution path but I couldn't do without this extra one!

      // and produce the mantissa so that it's range now is [0..2>.
      p--; // drop power p by 1 so that we can safely encode p=+1024 (and p=+1023)
      var y = flt / Math.pow(2, p);
      y /= 4; // we do this in two steps to allow handling even the largest floating point values, which have p>=1023: Math.pow(2, p + 1) would fail for those!

      // See performance test [test0008-array-join-vs-string-add]: string
      // concatenation is the fastest cross-platform.
      var a = '';
      var b = y;

      // and show the Unicode character codes for debugging/diagnostics:
      //var dbg = [0 /* Note: this slot will be *correctly* filled at the end */];
      //console.log('dbg @ start', 0, p + 1024 + s, flt, dbg, s, p, y, b);

      for (var i = 0; b && i < FPC_ENC_MAXLEN; i++) {
        b *= FPC_ENC_MODULO;
        var c = b | 0; // grab the integer part
        var d = b - c;

        //dbg[i + 1] = c;
        //console.log('dbg @ step', i, c, flt, dbg, s, p, y, b, d, '0x' + c.toString(16));

        a += String.fromCharCode(c);
        b = d;
      }

      // Note: we encode these 'very large floating point values' in the Unicode range 0xF800..0xF8FF 
      // (plus trailing mantissa words, of course!)
      //
      // encode sign + power + mantissa length in a Unicode char
      // (i E {1..4} as maximum size FPC_ENC_MAXLEN=4 ==> 2 bits of length @ bits 5.6 in word)
      //
      // Bits in word:
      // - 0..4: exponent; values +1020..+1024 with an offset of 1020 to make them all small positive numbers
      // - 7: sign
      // - 5,6: length 1..4: the number of words following to define the mantissa
      // - 8..15: (=0xF8) set to signal special 'near infinite' values; some of the same bits are also set for some special Unicode characters,
      //       so we can only have this particular value in bits 8..15
      //       in order to prevent a collision with those Unicode specials at 0xF900..0xFFFF.
      //
      --i;
      var h = 0xF800 + p - 1020 + (s >> 12 - 7) + (i << 5); // brackets needed as + comes before <<   :-(
      a = String.fromCharCode(h) + a;
      //dbg[0] = h;
      //console.log('dbg @ end', i, h, flt, dbg, s, p, y, b, '0x' + h.toString(16));
      return a;
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
      var dp = exp2 * FPC_ENC_LOG2_TO_LOG10 + 1 | 0;

      // first check exponent, only when in range perform the costly modulo operation
      // and comparison to further check conditions suitable for short float encoding.
      //
      // This also prevents a crash for very small numbers (dp <= -307) and speeds up matters for any other values
      // which won't ever make it into the 'shorthand notation' anyway.
      if (dp >= -2 && dp < 12 /* (L=11 + 3) - o=2 */) {
          var dy;
          var dp_3 = dp - 3;
          // Because `dy = flt / Math.pow(10, dp - 3)` causes bitrot in `dy` LSB (so that, for example, input value 0.00077 becomes 76.9999999999999)
          // we produce the `dy` value in such a way that the power-of-10 multiplicant/divisor WILL be an INTEGER number, 
          // which does *not* produce the bitrot in the LSBit of the *decimal* mantissa `dy` that way:
          if (dp_3 < 0) {
            dy = flt * Math.pow(10, -dp_3); // take mantissa (which is guaranteed to be in range [0.999 .. 0]) and multiply by 1000
          } else {
            dy = flt / Math.pow(10, dp_3); // take mantissa (which is guaranteed to be in range [0.999 .. 0]) and multiply by 1000
          }
          //console.log('decimal float test:', flt, exp2, exp2 * FPC_ENC_LOG2_TO_LOG10, p, dp, dy);

          // See performance test [test0012-modulo-vs-integer-check] for a technique comparison: 
          // this is the fastest on V8/Edge and second-fastest on FF. 
          var chk = dy | 0;
          //console.log('decimal float eligible? A:', { flt: flt, dy: dy, chk: chk, eq: chk === dy, dp: dp, exp2: exp2});
          if (chk === dy) {
            // alt check:   `(dy % 1) === 0`
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
            // 'reserved for future use' range. From that reserved range, we use
            // the range 0xF800..0xF8FF to represent floating point numbers with 
            // very high exponent values (p >= 1020), while the range 0xFFF0..0xFFF4
            // is used to represent special IEEE754 values such as NaN or Infinity.
            // 
            // ---
            // 
            // Note: we now have our own set of 'denormalized' floating point values:
            // given the way we calculate decimal exponent and mantissa (by multiplying
            // with 1000), we will always have a minimum mantissa value of +100, as
            // any *smaller* value would have produced a lower *exponent*!
            // 
            // Next to that, note that we allocate a number of *binary bits* for the
            // mantissa, which can never acquire a value of +1000 or larger as there
            // the same reasoning applies: if such a value were possible, the exponent
            // would have been *raised* by +1 and the mantissa would have been reduced
            // to land within the +100..+999 range once again.
            // 
            // This means that a series of sub-ranges cannot ever be produced by this 
            // function:
            // 
            // - 0x8000      .. 0x8000+  99    (exponent '0', sign bit CLEAR) 
            // - 0x8000+1000 .. 0x8000+1023 
            // - 0x8400      .. 0x8400+  99    (exponent '0', sign bit SET) 
            // - 0x8400+1000 .. 0x8400+1023 
            // - 0x8800      .. 0x8800+  99    (exponent '1', sign bit CLEAR) 
            // - 0x8800+1000 .. 0x8800+1023 
            // - 0x8C00      .. 0x8C00+  99    (exponent '1', sign bit SET) 
            // - 0x8C00+1000 .. 0x8C00+1023 
            // - ... etc ...
            // 
            // One might be tempted to re-use these 'holes' in the output for other
            // purposes, but it's faster to have any special codes use their
            // own 'reserved range' as that would only take one extra conditional
            // check and since we now know (since perf test0006) that V8 isn't
            // too happy about long switch/case constructs, we are better off, 
            // performance wise, to strive for the minimum number of comparisons, 
            // rather than striving for a maximum fill of the available Unicode
            // space.
            // 
            // BTW: We could have applied this same reasoning when we went looking for
            // a range to use to encode those pesky near-infinity high exponent
            // floating point values (p >= 1023), but at the time we hadn't 
            // realized yet that we would have these (large) holes in the output 
            // range.
            // Now that we know these exist, we *might* consider filling one of
            // those 'holes' with those high-exponent values as those really only
            // take 5 bits (2 bits for exponent: 1023 or 1024, 1 bit for sign,
            // 2 bits for length) while they currently usurp the range 0xF800..0xF8FF
            // (with large holes in there as well!)
            // 
            // ---
            // 
            // Offset the exponent so it's always positive when encoded:
            dp += 2;

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
            //       at 0xD800..0xDFFF (and our own specials at 0xF800..0xFFFF).
            //
            // alt:                    __(!!s << 10)_   _dy_____
            dc = 0x8000 + (dp << 11) + (s ? 1024 : 0) + (dy | 0); // the `| 0` shouldn't be necessary but is there as a precaution
            //console.log('d10-dbg', dp, dy, s, '0x' + dc.toString(16), flt);
            return String.fromCharCode(dc);
          }
        }
    }

    // and produce the mantissa so that it's range now is [0..2>: for powers > 0
    // the value y will be >= 1 while for negative powers, i.e. tiny numbers, the
    // value 0 < y < 1.
    p++; // increase power p by 1 so that we get a mantissa in the range [0 .. +1>; this causes trouble when the exponent is very high, hence those values are handled elsewhere
    var y = flt / Math.pow(2, p);

    // See performance test [test0008-array-join-vs-string-add]: string
    // concatenation is the fastest cross-platform.
    var a = '';
    var b = y; // alt: y - 1, but that only gives numbers 0 < b < 1 for p > 0

    // and show the Unicode character codes for debugging/diagnostics:
    //var dbg = [0 /* Note: this slot will be *correctly* filled at the end */];
    //console.log('dbg @ start', 0, p + 1024 + s, flt, dbg, s, p, y, b);

    for (var i = 0; b && i < FPC_ENC_MAXLEN; i++) {
      b *= FPC_ENC_MODULO;
      var c = b | 0; // grab the integer part
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
    //       in order to prevent a collision with those Unicode specials at 0xD800..0xDFFF 
    //       (and our own specials at 0xF800..0xFFFF).
    //
    // Special values (with bit 15 set):
    // - +Inf
    // - -Inf
    // - NaN
    // - -0    (negative zero)
    // - +0    (positive zero)
    //
    --i;
    var h = p + 1024 + s + (i << 13 /* i * 8192 */); // brackets needed as + comes before <<   :-(
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

// This function is very close to `encode_fp_value2()` (fpcvt-alt1.js), where the only change is following 
// the findings from test0011 where a large-ish set (30+ only!) cases in a `switch/case` 
// causes a drop in performance in Chrome V8 engines as that engine doesn't convert a
// switch/case to a jump table like the other browsers do (MSIE Edge is much faster thanks
// to this, for example, but Mozilla FireFox also clearly performs a jump-table optimization
// on switch/case given the performance numbers obtained from that one; it seems V8 is
// the only one who doesn't inspect switch/case this way, so we resort to using if/elif/else
// constructs in here as then we code the subrange checks in fewer checks and thus *win*,
// at least in V8...)
// 
// As a result, this function differs very little from encode_fp_value(), except maybe for
// some conditional flow decisions being executed in a different order.


function encode_fp_value4(flt) {
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
  //          Also note that at the high end of the exponent spectrum there's another
  //          oddity lurking:
  //
  //              Math.log2(Math.pow(2, 1023) * 1.9999999999999998) === 1024 
  //
  //          which technically would be a rounding error in `Math.log2`, while
  //
  //              Math.log2(Math.pow(2, 1023) * 1.9999999999999999) === Infinity
  //
  //          since
  //
  //              Math.pow(2, 1023) * 1.9999999999999999 === Infinity
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 !== Infinity   // at least on Chrome/V8. but this is really *begging* for it!
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 === 1.7976931348623157e+308
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 === Math.pow(2, 1023) * 1.9999999999999998
  //
  //          Consequently we'll have to check both upper and lower exponent limits to keep them
  //          within sane ranges:
  //          The lower exponents are for 'denormalized zeroes' which we can handle as-is, by turning
  //          their exponent into -1024, as does IEEE754 itself, while the upper edge oddity (exponent = +1024)
  //          must be treated separately (and it so happens that the treatment we choose also benefits
  //          another high exponent: +1023).
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
  var p = exp2 | 0; // --> +1023..-1024, pardon!, +1024..-1074 (!!!)
  // The power 0 also shows up when we treat a NaN or +/-Inf or +/-0:
  if (p === 0) {
    if (!flt) {
      // +0, -0 or NaN:
      if (isNaN(flt)) {
        return String.fromCharCode(FPC_ENC_NAN);
      } else {
        // detect negative zero:
        var is_negzero = Math.atan2(0, flt); // +0 --> 0, -0 --> PI
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
  } else if (p >= 1023) {
    // We also need to process the exponent +1024 specially as that is another edge case
    // which we do not want to handle in our mainstream code flow where -1024 < p <= +1023
    // maximum performance means we want the least number of conditional checks 
    // (~ if/else constructs) in our execution path but I couldn't do without this extra one!

    // and produce the mantissa so that it's range now is [0..2>.
    p--; // drop power p by 1 so that we can safely encode p=+1024 (and p=+1023)
    var y = flt / Math.pow(2, p);
    y /= 4; // we do this in two steps to allow handling even the largest floating point values, which have p>=1023: Math.pow(2, p + 1) would fail for those!

    // See performance test [test0008-array-join-vs-string-add]: string
    // concatenation is the fastest cross-platform.
    var a = '';
    var b = y;

    // and show the Unicode character codes for debugging/diagnostics:
    //var dbg = [0 /* Note: this slot will be *correctly* filled at the end */];
    //console.log('dbg @ start', 0, p + 1024 + s, flt, dbg, s, p, y, b);

    for (var i = 0; b && i < FPC_ENC_MAXLEN; i++) {
      b *= FPC_ENC_MODULO;
      var c = b | 0; // grab the integer part
      var d = b - c;

      //dbg[i + 1] = c;
      //console.log('dbg @ step', i, c, flt, dbg, s, p, y, b, d, '0x' + c.toString(16));

      a += String.fromCharCode(c);
      b = d;
    }

    // Note: we encode these 'very large floating point values' in the Unicode range 0xF800..0xF8FF 
    // (plus trailing mantissa words, of course!)
    //
    // encode sign + power + mantissa length in a Unicode char
    // (i E {1..4} as maximum size FPC_ENC_MAXLEN=4 ==> 2 bits of length @ bits 5.6 in word)
    //
    // Bits in word:
    // - 0..4: exponent; values +1020..+1024 with an offset of 1020 to make them all small positive numbers
    // - 7: sign
    // - 5,6: length 1..4: the number of words following to define the mantissa
    // - 8..15: (=0xF8) set to signal special 'near infinite' values; some of the same bits are also set for some special Unicode characters,
    //       so we can only have this particular value in bits 8..15
    //       in order to prevent a collision with those Unicode specials at 0xF900..0xFFFF.
    //
    --i;
    var h = 0xF800 + p - 1020 + (s >> 12 - 7) + (i << 5); // brackets needed as + comes before <<   :-(
    a = String.fromCharCode(h) + a;
    //dbg[0] = h;
    //console.log('dbg @ end', i, h, flt, dbg, s, p, y, b, '0x' + h.toString(16));
    return a;
  }

  // The range <1e10..1e-3] can be encoded as short float when the value matches a few conditions:
  // (Do note that the exponents tested here in this switch/case are powers-of-TWO and thus have a
  // wider range compared to the decimal powers -3..+10)
  if (p >= -9 /* Math.log2(1e-3) ~ -9.966 */ && p < 44 /* Highest encodable number: Math.log2(999e10) ~ 43.15 */) {
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
      var dp = exp2 * FPC_ENC_LOG2_TO_LOG10 + 1 | 0;

      // first check exponent, only when in range perform the costly modulo operation
      // and comparison to further check conditions suitable for short float encoding.
      //
      // This also prevents a crash for very small numbers (dp <= -307) and speeds up matters for any other values
      // which won't ever make it into the 'shorthand notation' anyway.
      if (dp >= -2 && dp < 12 /* (L= 11 + 3) - o=2 */) {
          var dy;
          var dp_3 = dp - 3;
          // Because `dy = flt / Math.pow(10, dp - 3)` causes bitrot in `dy` LSB (so that, for example, input value 0.00077 becomes 76.9999999999999)
          // we produce the `dy` value in such a way that the power-of-10 multiplicant/divisor WILL be an INTEGER number, 
          // which does *not* produce the bitrot in the LSBit of the *decimal* mantissa `dy` that way:
          if (dp_3 < 0) {
            dy = flt * Math.pow(10, -dp_3); // take mantissa (which is guaranteed to be in range [0.999 .. 0]) and multiply by 1000
          } else {
            dy = flt / Math.pow(10, dp_3); // take mantissa (which is guaranteed to be in range [0.999 .. 0]) and multiply by 1000
          }
          //console.log('decimal float test:', flt, exp2, exp2 * FPC_ENC_LOG2_TO_LOG10, p, dp, dy);

          // See performance test [test0012-modulo-vs-integer-check] for a technique comparison: 
          // this is the fastest on V8/Edge and second-fastest on FF. 
          var chk = dy | 0;
          //console.log('decimal float eligible? A:', { flt: flt, dy: dy, chk: chk, eq: chk === dy, dp: dp, exp2: exp2});
          if (chk === dy) {
            // alt check:   `(dy % 1) === 0`
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
            // 'reserved for future use' range. From that reserved range, we use
            // the range 0xF800..0xF8FF to represent floating point numbers with 
            // very high exponent values (p >= 1020), while the range 0xFFF0..0xFFF4
            // is used to represent special IEEE754 values such as NaN or Infinity.
            // 
            // ---
            //
            // Note: we now have our own set of 'denormalized' floating point values:
            // given the way we calculate decimal exponent and mantissa (by multiplying
            // with 1000), we will always have a minimum mantissa value of +100, as
            // any *smaller* value would have produced a lower *exponent*!
            // 
            // Next to that, note that we allocate a number of *binary bits* for the
            // mantissa, which can never acquire a value of +!000 or larger as there
            // the same reasoning applies: if such a value were possible, the exponent
            // would have been *raised* by +1 and the mantissa would have been reduced
            // to land within the +100..+999 range once again.
            // 
            // This means that a series of sub-ranges cannot ever be produced by this 
            // function:
            // 
            // - 0x8000      .. 0x8000+  99    (exponent '0', sign bit CLEAR) 
            // - 0x8000+1000 .. 0x8000+1023 
            // - 0x8400      .. 0x8400+  99    (exponent '0', sign bit SET) 
            // - 0x8400+1000 .. 0x8400+1023 
            // - 0x8800      .. 0x8800+  99    (exponent '1', sign bit CLEAR) 
            // - 0x8800+1000 .. 0x8800+1023 
            // - 0x8C00      .. 0x8C00+  99    (exponent '1', sign bit SET) 
            // - 0x8C00+1000 .. 0x8C00+1023 
            // - ... etc ...
            // 
            // One might be tempted to re-use these 'holes' in the output for other
            // purposes, but it's faster to have any special codes use their
            // own 'reserved range' as that would only take one extra conditional
            // check and since we now know (since perf test0006) that V8 isn't
            // too happy about long switch/case constructs, we are better off, 
            // performance wise, to strive for the minimum number of comparisons, 
            // rather than striving for a maximum fill of the available Unicode
            // space.
            // 
            // BTW: We could have applied this same reasoning when we went looking for
            // a range to use to encode those pesky near-infinity high exponent
            // floating point values (p >= 1023), but at the time we hadn't 
            // realized yet that we would have these (large) holes in the output 
            // range.
            // Now that we know these exist, we *might* consider filling one of
            // those 'holes' with those high-exponent values as those really only
            // take 5 bits (2 bits for exponent: 1023 or 1024, 1 bit for sign,
            // 2 bits for length) while they currently usurp the range 0xF800..0xF8FF
            // (with large holes in there as well!)
            // 
            // ---
            // 
            // Offset the exponent so it's always positive when encoded:
            dp += 2;

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
            //       at 0xD800..0xDFFF (and our own specials at 0xF800..0xFFFF).
            //
            // alt:                    __(!!s << 10)_   _dy_____
            dc = 0x8000 + (dp << 11) + (s ? 1024 : 0) + (dy | 0); // the `| 0` shouldn't be necessary but is there as a precaution
            //console.log('d10-dbg', dp, dy, s, '0x' + dc.toString(16), flt);
            return String.fromCharCode(dc);
          }
        }
      // fall through!
    }

  // -1074..-1025: this range of exponents shows up when you handle denormalized zeroes:
  if (p < -1024) {
    // Correct for our process: we actually want the bits in the IEE754 exponent, hence
    // exponents lower than -1024, a.k.a. *denormalized zeroes*, are treated exactly
    // like that in our code as well: we will produce leading mantissa ZERO words then.
    p = -1024;
  }
  // fall through

  // and produce the mantissa so that it's range now is [0..2>: for powers > 0
  // the value y will be >= 1 while for negative powers, i.e. tiny numbers, the
  // value 0 < y < 1.
  p++; // increase power p by 1 so that we get a mantissa in the range [0 .. +1>; this causes trouble when the exponent is very high, hence those values are handled elsewhere
  var y = flt / Math.pow(2, p);

  // See performance test [test0008-array-join-vs-string-add]: string
  // concatenation is the fastest cross-platform.
  var a = '';
  var b = y; // alt: y - 1, but that only gives numbers 0 < b < 1 for p > 0

  // and show the Unicode character codes for debugging/diagnostics:
  //var dbg = [0 /* Note: this slot will be *correctly* filled at the end */];
  //console.log('dbg @ start', 0, p + 1024 + s, flt, dbg, s, p, y, b);

  for (var i = 0; b && i < FPC_ENC_MAXLEN; i++) {
    b *= FPC_ENC_MODULO;
    var c = b | 0; // grab the integer part
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
  //       in order to prevent a collision with those Unicode specials at 0xD800..0xDFFF 
  //       (and our own specials at 0xF800..0xFFFF).
  //
  // Special values (with bit 15 set):
  // - +Inf
  // - -Inf
  // - NaN
  // - -0    (negative zero)
  // - +0    (positive zero)
  //
  --i;
  var h = p + 1024 + s + (i << 13 /* i * 8192 */); // brackets needed as + comes before <<   :-(
  a = String.fromCharCode(h) + a;
  //dbg[0] = h;
  //console.log('dbg @ end', i, h, flt, dbg, s, p, y, b, '0x' + h.toString(16));
  return a;
}

function decode_fp_value2(s, opt) {
  // sample JS code to decode a IEEE754 floating point value from a Unicode string.
  //
  // With provision to detect +0/-0 and +/-Inf and NaN
  //
  opt = opt || { consumed_length: 0 };
  var idx = opt.consumed_length;
  opt.consumed_length++;

  var c0 = s.charCodeAt(idx);
  //console.log('decode task: ', s, s.length, c0, '0x' + c0.toString(16));

  // As we expect most encodings to be regular numbers, those will be in 0x0000..0x7FFF and
  // we do not want to spend any amount of time in the 'special values' overhead,
  // which would be added overhead if we did check for those *first* instead of *at the same time*
  // as we do here by looking at the top nibble immediately (Note: This ASSUMES your JS engine (Chrome V8?)
  // is smart enough to convert this switch/case statement set into a jump table, just like any
  // decent C-like language compiler would! It turns out not everyone out there is all that smart
  // yet... Sigh...):
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
      throw new Error('illegal fp encoding value in 0xD800-0xDFFF unicode range');

    case 0xF800:
      // specials:
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
            idx++;
            im = s.charCodeAt(idx);
            m = im / FPC_ENC_MODULO;
            opt.consumed_length++;
            //console.log('decode-normal-len=1', m, s.charCodeAt(1));
            break;

          case 0x0020:
            // 2 more 15-bit words:
            idx++;
            im = s.charCodeAt(idx);
            im <<= 15;
            idx++;
            im |= s.charCodeAt(idx);
            m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
            opt.consumed_length += 2;
            //console.log('decode-normal-len=2', m, s.charCodeAt(1), s.charCodeAt(2));
            break;

          case 0x0040:
            // 3 more 15-bit words: WARNING: this doesn't fit in an *integer* of 31 bits any more,
            // so we'll have to use floating point for at least one intermediate step!
            //
            // Oh, by the way, did you notice we use a Big Endian type encoding mechanism?  :-)
            idx++;
            im = s.charCodeAt(idx);
            m = im / FPC_ENC_MODULO;
            idx++;
            im = s.charCodeAt(idx);
            im <<= 15;
            idx++;
            im |= s.charCodeAt(idx);
            m += im / (FPC_ENC_MODULO * FPC_ENC_MODULO * FPC_ENC_MODULO);
            opt.consumed_length += 3;
            //console.log('decode-normal-len=3', m, s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3));
            break;

          case 0x0060:
            // 4 more 15-bit words, where the last one doesn't use all bits. We don't use
            // those surplus bits yet, so we're good to go when taking the entire word
            // as a value, no masking required there.
            //
            // WARNING: this doesn't fit in an *integer* of 31 bits any more,
            // so we'll have to use floating point for at least one intermediate step!
            idx++;
            im = s.charCodeAt(idx);
            im <<= 15;
            idx++;
            im |= s.charCodeAt(idx);
            m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
            idx++;
            im = s.charCodeAt(idx);
            im <<= 15;
            idx++;
            im |= s.charCodeAt(idx);
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

        // we do this in two steps to allow handling even the largest floating point values, which have p>=1023: Math.pow(2, p+1) would fail for those!
        // 
        // WARNING: The order of execution of this times-2 and the next power-of-2 multiplication is essential to not drop any LSBits for denormalized zero values!
        m *= 4;
        m *= Math.pow(2, p);
        if (vs) {
          m = -m;
        }
        //console.log('decode-normal-2', m);
        return m;
      } else {
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
      break;

    case 0x8000:
    case 0x8800:
    case 0x9000:
    case 0x9800:
    case 0xA000:
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
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

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
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

      //console.log('decode-short-0', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      dp -= 3 + 2;

      var sflt = dm * Math.pow(10, dp);
      if (ds) {
        sflt = -sflt;
      }
      //console.log('decode-short-1', sflt, ds, dm, dp, c0, '0x' + c0.toString(16));
      return sflt;

    // (0xF900..0xFFF0: reserved for future use)
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
      //       in order to prevent a collision with those Unicode specials at 0xF800..0xFFFF.
      //
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

      //console.log('decode-short-0C', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      if (dp >= 15) {
        throw new Error('illegal fp encoding value in 0xF8xx-0xFFxx unicode range');
      }
      dp -= 3 + 2 + 1; // like above, but now also compensate for exponent bumping (0xB --> 0xC, ...)

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
          idx++;
          im = s.charCodeAt(idx);
          m = im / FPC_ENC_MODULO;
          opt.consumed_length++;
          //console.log('decode-normal-len=1', m, s.charCodeAt(1));
          break;

        case 0x2000:
          // 2 more 15-bit words:
          idx++;
          im = s.charCodeAt(idx);
          im <<= 15;
          idx++;
          im |= s.charCodeAt(idx);
          m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
          opt.consumed_length += 2;
          //console.log('decode-normal-len=2', m, s.charCodeAt(1), s.charCodeAt(2));
          break;

        case 0x4000:
          // 3 more 15-bit words: WARNING: this doesn't fit in an *integer* of 31 bits any more,
          // so we'll have to use floating point for at least one intermediate step!
          //
          // Oh, by the way, did you notice we use a Big Endian type encoding mechanism?  :-)
          idx++;
          im = s.charCodeAt(idx);
          m = im / FPC_ENC_MODULO;
          idx++;
          im = s.charCodeAt(idx);
          im <<= 15;
          idx++;
          im |= s.charCodeAt(idx);
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
          idx++;
          im = s.charCodeAt(idx);
          im <<= 15;
          idx++;
          im |= s.charCodeAt(idx);
          m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
          idx++;
          im = s.charCodeAt(idx);
          im <<= 15;
          idx++;
          im |= s.charCodeAt(idx);
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
      if (vs) {
        m = -m;
      }
      //console.log('decode-normal-2', m);
      return m;
  }
}

// This function is very close to `decode_fp_value()` (fpcvt.js), where the only change is following 
// the findings from test0006 where a large-ish set (30+ only!) cases in a `switch/case` 
// causes a drop in performance in Chrome V8 engines as that engine doesn't convert a
// switch/case to a jump table like the other browsers do (MSIE Edge is much faster thanks
// to this, for example, but Mozilla FireFox also clearly performs a jump-table optimization
// on switch/case given the performance numbers obtained from that one; it seems V8 is
// the only one who doesn't inspect switch/case this way, so we resort to using if/elif/else
// constructs in here as then we code the subrange checks in fewer checks and thus *win*,
// at least in V8...)
// 
// As a result, this function differs very little from decode_fp_value(), except maybe for
// some conditional flow decisions being executed in a different order.
//
// ---
//
// Preliminary tests (test0005) indicate that this code is 30% (!) faster than the original
// in Chrome V8.
// Ditto in MSIE (Internet Explorer Edge) and this stuff is a whopping 50% faster on FireFox (v49a2, Developer Channel)!


function decode_fp_value3(s, opt) {
  // sample JS code to decode a IEEE754 floating point value from a Unicode string.
  //
  // With provision to detect +0/-0 and +/-Inf and NaN
  if (opt) {
    opt.consumed_length = 1;
  } else {
    opt = {
      consumed_length: 1
    };
  }

  var c0 = s.charCodeAt(0);
  //console.log('decode task: ', s, s.length, c0, '0x' + c0.toString(16));

  // As we expect most encodings to be regular numbers, those will be in 0x0000..0x7FFF and
  // we do not want to spend any amount of time in the 'special values' overhead,
  // which would be added overhead if we did check for those *first* instead of *at the same time*
  // as we do here by looking at the top nibble immediately (Note: This ASSUMES your JS engine (Chrome V8?)
  // is smart enough to convert this switch/case statement set into a jump table, just like any
  // decent C-like language compiler would! It turns out not everyone out there is all that smart
  // yet... Sigh...):
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
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

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
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

      //console.log('decode-short-0', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      dp -= 3 + 2;

      var sflt = dm * Math.pow(10, dp);
      if (ds) {
        sflt = -sflt;
      }
      //console.log('decode-short-1', sflt, ds, dm, dp, c0, '0x' + c0.toString(16));
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
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

      //console.log('decode-short-0C', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      if (dp >= 15) {
        throw new Error('illegal fp encoding value in 0xF800-0xFFFF unicode range');
      }
      dp -= 3 + 2 + 1; // like above, but now also compensate for exponent bumping (0xB --> 0xC, ...)

      var sflt = dm * Math.pow(10, dp);
      if (ds) {
        sflt = -sflt;
      }
      //console.log('decode-short-1C', sflt, ds, dm, dp, c0, '0x' + c0.toString(16));
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
            opt.consumed_length++;
            //console.log('decode-normal-len=1', m, s.charCodeAt(1));
            break;

          case 0x0020:
            // 2 more 15-bit words:
            im = s.charCodeAt(1);
            im <<= 15;
            im |= s.charCodeAt(2);
            m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
            opt.consumed_length += 2;
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
            opt.consumed_length += 3;
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
            opt.consumed_length += 4;
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
        return m;
      } else {
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
    if (vs) {
      m = -m;
    }
    //console.log('decode-normal-2', m);
    return m;
  }
}

// Exact replica of the original in fpcvt.js, but now with all error checks stripped for performance checking:

function encode_fp_value0(flt) {
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
  //          Also note that at the high end of the exponent spectrum there's another
  //          oddity lurking:
  //
  //              Math.log2(Math.pow(2, 1023) * 1.9999999999999998) === 1024 
  //
  //          which technically would be a rounding error in `Math.log2`, while
  //
  //              Math.log2(Math.pow(2, 1023) * 1.9999999999999999) === Infinity
  //
  //          since
  //
  //              Math.pow(2, 1023) * 1.9999999999999999 === Infinity
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 !== Infinity   // at least on Chrome/V8. but this is really *begging* for it!
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 === 1.7976931348623157e+308
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 === Math.pow(2, 1023) * 1.9999999999999998
  //
  //          Consequently we'll have to check both upper and lower exponent limits to keep them
  //          within sane ranges:
  //          The lower exponents are for 'denormalized zeroes' which we can handle as-is, by turning
  //          their exponent into -1024, as does IEEE754 itself, while the upper edge oddity (exponent = +1024)
  //          must be treated separately (and it so happens that the treatment we choose also benefits
  //          another high exponent: +1023).
  //

  if (!flt) {
    // +0, -0 or NaN:
    if (isNaN(flt)) {
      return String.fromCharCode(FPC_ENC_NAN);
    } else {
      // detect negative zero:
      var is_negzero = Math.atan2(0, flt); // +0 --> 0, -0 --> PI
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
    var p = exp2 | 0; // --> +1023..-1024, pardon!, +1024..-1074 (!!!)
    if (p < -1024) {
      // Correct for our process: we actually want the bits in the IEE754 exponent, hence
      // exponents lower than -1024, a.k.a. *denormalized zeroes*, are treated exactly
      // like that in our code as well: we will produce leading mantissa ZERO words then.
      p = -1024;
    } else if (p >= 1023) {
      // We also need to process the exponent +1024 specially as that is another edge case
      // which we do not want to handle in our mainstream code flow where -1024 < p <= +1023
      // maximum performance means we want the least number of conditional checks 
      // (~ if/else constructs) in our execution path but I couldn't do without this extra one!

      // and produce the mantissa so that it's range now is [0..2>.
      p--; // drop power p by 1 so that we can safely encode p=+1024 (and p=+1023)
      var y = flt / Math.pow(2, p);
      y /= 4; // we do this in two steps to allow handling even the largest floating point values, which have p>=1023: Math.pow(2, p + 1) would fail for those!

      // See performance test [test0008-array-join-vs-string-add]: string
      // concatenation is the fastest cross-platform.
      var a = '';
      var b = y;

      // and show the Unicode character codes for debugging/diagnostics:
      //var dbg = [0 /* Note: this slot will be *correctly* filled at the end */];
      //console.log('dbg @ start', 0, p + 1024 + s, flt, dbg, s, p, y, b);

      for (var i = 0; b && i < FPC_ENC_MAXLEN; i++) {
        b *= FPC_ENC_MODULO;
        var c = b | 0; // grab the integer part
        var d = b - c;

        //dbg[i + 1] = c;
        //console.log('dbg @ step', i, c, flt, dbg, s, p, y, b, d, '0x' + c.toString(16));

        a += String.fromCharCode(c);
        b = d;
      }

      // Note: we encode these 'very large floating point values' in the Unicode range 0xF800..0xF8FF 
      // (plus trailing mantissa words, of course!)
      //
      // encode sign + power + mantissa length in a Unicode char
      // (i E {1..4} as maximum size FPC_ENC_MAXLEN=4 ==> 2 bits of length @ bits 5.6 in word)
      //
      // Bits in word:
      // - 0..4: exponent; values +1020..+1024 with an offset of 1020 to make them all small positive numbers
      // - 7: sign
      // - 5,6: length 1..4: the number of words following to define the mantissa
      // - 8..15: (=0xF8) set to signal special 'near infinite' values; some of the same bits are also set for some special Unicode characters,
      //       so we can only have this particular value in bits 8..15
      //       in order to prevent a collision with those Unicode specials at 0xF900..0xFFFF.
      //
      --i;
      var h = 0xF800 + p - 1020 + (s >> 12 - 7) + (i << 5); // brackets needed as + comes before <<   :-(
      a = String.fromCharCode(h) + a;
      //dbg[0] = h;
      //console.log('dbg @ end', i, h, flt, dbg, s, p, y, b, '0x' + h.toString(16));
      return a;
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
      var dp = exp2 * FPC_ENC_LOG2_TO_LOG10 + 1 | 0;
      // Prevent crash for very small numbers (dp <= -307) and speeds up matters for any other values
      // which won't ever make it into the 'shorthand notation' anyway: here we replicate the `dp`
      // range check you also will see further below:
      //
      //     dp += 2;
      //     if (dp >= 0 && dp < 14 /* (L= 11 + 3) */ ) {
      if (dp >= -2 && dp < 12) {
        var dy;
        var dp_3 = dp - 3;
        // Because `dy = flt / Math.pow(10, dp - 3)` causes bitrot in `dy` LSB (so that, for example, input value 0.00077 becomes 76.9999999999999)
        // we produce the `dy` value in such a way that the power-of-10 multiplicant/divisor WILL be an INTEGER number, 
        // which does *not* produce the bitrot in the LSBit of the *decimal* mantissa `dy` that way:
        if (dp_3 < 0) {
          dy = flt * Math.pow(10, -dp_3); // take mantissa (which is guaranteed to be in range [0.999 .. 0]) and multiply by 1000
        } else {
          dy = flt / Math.pow(10, dp_3); // take mantissa (which is guaranteed to be in range [0.999 .. 0]) and multiply by 1000
        }
        //console.log('decimal float test:', flt, exp2, exp2 * FPC_ENC_LOG2_TO_LOG10, p, dp, dy);

        // See performance test [test0012-modulo-vs-integer-check] for a technique comparison: 
        // this is the fastest on V8/Edge and second-fastest on FF. 
        var chk = dy | 0;
        //console.log('decimal float eligible? A:', { flt: flt, dy: dy, chk: chk, eq: chk === dy, dp: dp, exp2: exp2});
        if (chk === dy) {
          // alt check:   `(dy % 1) === 0`
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
          // 'reserved for future use' range. From that reserved range, we use
          // the range 0xF800..0xF8FF to represent floating point numbers with 
          // very high exponent values (p >= 1020), while the range 0xFFF0..0xFFF4
          // is used to represent special IEEE754 values such as NaN or Infinity.
          // 
          // ---
          //
          // Note: we now have our own set of 'denormalized' floating point values:
          // given the way we calculate decimal exponent and mantissa (by multiplying
          // with 1000), we will always have a minimum mantissa value of +100, as
          // any *smaller* value would have produced a lower *exponent*!
          // 
          // Next to that, note that we allocate a number of *binary bits* for the
          // mantissa, which can never acquire a value of +1000 or larger as there
          // the same reasoning applies: if such a value were possible, the exponent
          // would have been *raised* by +1 and the mantissa would have been reduced
          // to land within the +100..+999 range once again.
          // 
          // This means that a series of sub-ranges cannot ever be produced by this 
          // function:
          // 
          // - 0x8000      .. 0x8000+  99    (exponent '0', sign bit CLEAR) 
          // - 0x8000+1000 .. 0x8000+1023 
          // - 0x8400      .. 0x8400+  99    (exponent '0', sign bit SET) 
          // - 0x8400+1000 .. 0x8400+1023 
          // - 0x8800      .. 0x8800+  99    (exponent '1', sign bit CLEAR) 
          // - 0x8800+1000 .. 0x8800+1023 
          // - 0x8C00      .. 0x8C00+  99    (exponent '1', sign bit SET) 
          // - 0x8C00+1000 .. 0x8C00+1023 
          // - ... etc ...
          // 
          // One might be tempted to re-use these 'holes' in the output for other
          // purposes, but it's faster to have any special codes use their
          // own 'reserved range' as that would only take one extra conditional
          // check and since we now know (since perf test0006) that V8 isn't
          // too happy about long switch/case constructs, we are better off, 
          // performance wise, to strive for the minimum number of comparisons, 
          // rather than striving for a maximum fill of the available Unicode
          // space.
          // 
          // BTW: We could have applied this same reasoning when we went looking for
          // a range to use to encode those pesky near-infinity high exponent
          // floating point values (p >= 1023), but at the time we hadn't 
          // realized yet that we would have these (large) holes in the output 
          // range.
          // Now that we know these exist, we *might* consider filling one of
          // those 'holes' with those high-exponent values as those really only
          // take 5 bits (2 bits for exponent: 1023 or 1024, 1 bit for sign,
          // 2 bits for length) while they currently usurp the range 0xF800..0xF8FF
          // (with large holes in there as well!)
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
              //       at 0xD800..0xDFFF (and our own specials at 0xF800..0xFFFF).
              //
              // alt:                    __(!!s << 10)_   _dy_____
              dc = 0x8000 + (dp << 11) + (s ? 1024 : 0) + (dy | 0); // the `| 0` shouldn't be necessary but is there as a precaution
              //console.log('d10-dbg', dp, dy, s, '0x' + dc.toString(16), flt);
              return String.fromCharCode(dc);
            }
        }
      }
    }

    // and produce the mantissa so that it's range now is [0..2>: for powers > 0
    // the value y will be >= 1 while for negative powers, i.e. tiny numbers, the
    // value 0 < y < 1.
    p++; // increase power p by 1 so that we get a mantissa in the range [0 .. +1>; this causes trouble when the exponent is very high, hence those values are handled elsewhere
    var y = flt / Math.pow(2, p);

    // See performance test [test0008-array-join-vs-string-add]: string
    // concatenation is the fastest cross-platform.
    var a = '';
    var b = y; // alt: y - 1, but that only gives numbers 0 < b < 1 for p > 0

    // and show the Unicode character codes for debugging/diagnostics:
    //var dbg = [0 /* Note: this slot will be *correctly* filled at the end */];
    //console.log('dbg @ start', 0, p + 1024 + s, flt, dbg, s, p, y, b);

    for (var i = 0; b && i < FPC_ENC_MAXLEN; i++) {
      b *= FPC_ENC_MODULO;
      var c = b | 0; // grab the integer part
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
    //       in order to prevent a collision with those Unicode specials at 0xD800..0xDFFF 
    //       (and our own specials at 0xF800..0xFFFF).
    //
    // Special values (with bit 15 set):
    // - +Inf
    // - -Inf
    // - NaN
    // - -0    (negative zero)
    // - +0    (positive zero)
    //
    --i;
    var h = p + 1024 + s + (i << 13 /* i * 8192 */); // brackets needed as + comes before <<   :-(
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

function decode_fp_value0(s, opt) {
  // sample JS code to decode a IEEE754 floating point value from a Unicode string.
  //
  // With provision to detect +0/-0 and +/-Inf and NaN
  //
  opt = opt || { consumed_length: 0 };
  opt.consumed_length = 1;

  var c0 = s.charCodeAt(0);
  //console.log('decode task: ', s, s.length, c0, '0x' + c0.toString(16));

  // As we expect most encodings to be regular numbers, those will be in 0x0000..0x7FFF and
  // we do not want to spend any amount of time in the 'special values' overhead,
  // which would be added overhead if we did check for those *first* instead of *at the same time*
  // as we do here by looking at the top nibble immediately (Note: This ASSUMES your JS engine (Chrome V8?)
  // is smart enough to convert this switch/case statement set into a jump table, just like any
  // decent C-like language compiler would! It turns out not everyone out there is all that smart
  // yet... Sigh...):
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
      throw new Error('illegal fp encoding value in 0xD800-0xDFFF unicode range');

    case 0xF800:
      // specials:
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
            opt.consumed_length++;
            //console.log('decode-normal-len=1', m, s.charCodeAt(1));
            break;

          case 0x0020:
            // 2 more 15-bit words:
            im = s.charCodeAt(1);
            im <<= 15;
            im |= s.charCodeAt(2);
            m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
            opt.consumed_length += 2;
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
            opt.consumed_length += 3;
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
            opt.consumed_length += 4;
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
        return m;
      } else {
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
      break;

    case 0x8000:
    case 0x8800:
    case 0x9000:
    case 0x9800:
    case 0xA000:
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
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

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
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

      //console.log('decode-short-0', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      dp -= 3 + 2;

      var sflt = dm * Math.pow(10, dp);
      if (ds) {
        sflt = -sflt;
      }
      //console.log('decode-short-1', sflt, ds, dm, dp, c0, '0x' + c0.toString(16));
      return sflt;

    // (0xF900..0xFFF0: reserved for future use)
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
      //       in order to prevent a collision with those Unicode specials at 0xF800..0xFFFF.
      //
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

      //console.log('decode-short-0C', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      dp -= 3 + 2 + 1; // like above, but now also compensate for exponent bumping (0xB --> 0xC, ...)

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
      if (vs) {
        m = -m;
      }
      //console.log('decode-normal-2', m);
      return m;
  }
}

// A near copy of decode_fp_value3() but with a different approach to the optional `opt.consumed_length`
// feedback.


function decode_fp_value4(s, opt) {
  // sample JS code to decode a IEEE754 floating point value from a Unicode string.
  //
  // With provision to detect +0/-0 and +/-Inf and NaN
  var consumed_length;

  var c0 = s.charCodeAt(0);
  //console.log('decode task: ', s, s.length, c0, '0x' + c0.toString(16));

  // As we expect most encodings to be regular numbers, those will be in 0x0000..0x7FFF and
  // we do not want to spend any amount of time in the 'special values' overhead,
  // which would be added overhead if we did check for those *first* instead of *at the same time*
  // as we do here by looking at the top nibble immediately (Note: This ASSUMES your JS engine (Chrome V8?)
  // is smart enough to convert this switch/case statement set into a jump table, just like any
  // decent C-like language compiler would! It turns out not everyone out there is all that smart
  // yet... Sigh...):
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
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

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
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

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
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

      //console.log('decode-short-0C', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      dp -= 3 + 2 + 1; // like above, but now also compensate for exponent bumping (0xB --> 0xC, ...)

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

//
// These alternative implementations apply a very important performance shortcut
// for the 'short notation' floating point values, where the thinking goes 
// like this:
//
// The 'short notation' always results in a single Unicode character. For
// 'short notation' that character's range is within the bounds of the range
// 0x8000-0xFFFF, if we include the specials and everything else that's
// 'short noted' -- we *ignore* the 'very high exponent' floating point 
// values encoded in range 0xF800-0xF8FF for now).
// 
// This is, at worst, a 32K range, hence why not try to **replace all the code**
// with a lookup table?
// test0011 has shown us that a hand-coded lookup table serving as a jump table
// representing a large switch/case has absolutely *rotten* performance, but
// now we are considering a direct lookup table where we do not need to jump
// to any code as the lookup table would serve as a direct mapping from
// Unicode character code to floating point value!
// 
// The remaining question there would be: can we also use that table for 
// speeding up our *encoding*?
// 
// The answer is YES, **IFF** a few criteria are kept intact:
// 
// - The encoded Unicode range is continuously increasing with floating point
//   *exponent* (again, we are ignoring the 'high exponent' values at 0xF800!)
//   
// - As long as we DO NOT re-map the 'denormalized' value holes in the encoded
//   range, we can guarantee that the mantissas always land between +100..+999
//   and given the contiguously increasing mapping for *exponents* AND the fact
//   that the mantissa is encoded in the lower bits of the word, we can also
//   GUARANTEE that the Unicode code map is contiguously increasing with the
//   *encoded floating point value*.
//   
// - Though there are known holes, these do not matter much, as we can then
//   transform the *encoding* process for 'short notation' floating point 
//   values to a binary search or similar search variant: an exact match would
//   then produce the Unicode *encoding* within a few cycles.
//   
// - 'Specials' such as NaN and 'very high exponent' values can be marked 
//   in the 32K lookup table for the *decoder* to execute a fast dispatch,
//   iff direct value lookup is not feasible -- it is for NaN, Infinity, et al!
// 
// WARNING:
// The trouble is that NEGATIVE floating point values are interspersed with
// POSITIVE floating point values as the sign bit is located at bit 12.
// Any search routine used to encode floating point values MUST reckon with
// this artifact as this is the only 'dis-contiguous' aspect of the mapping.
//   
// 
// Given the above, we would need 'offset' tables to help the search routine
// jump over the holes, plus we would need advanced logic to only scan the
// portion of the range that matches the SIGN of our floating value. The
// need for such 'hole jumping' and the need for 'complicated code' means a
// search routine like that would be SLOW; we envision the need for TWO
// offset tables: one to move to the next valid entry BELOW the sampled slot
// and another offset table to move to the next valid entry ABOVE the 
// sampled slot, thus clocking in a memory cost in lookup tables of at least
// 3*32K!
// 
// If we however encode the *encoding* lookup table separately, where we
// guarantee the table to be contiguous in both floating point VALUE and SIGN
// and having NO HOLES AT ALL, then we would be able to construct very fast
// binary search or other search algorithms to help deliver a fast *encode*,
// while only clocking in a 2*32K table cost!
//    
// Extra: we might want to consider creating an 'initial guess' helper table
// to cut down the binary search O(log N) from 15 iterations down to only
// a single exponent range (N=1000 --> 10 iterations), while we might then
// be able to use a numeric table index, which means we could then use simple 
// arrays for both encoding and decoding lookup tables.


// mapping Unicode character code to fp value or FALSE
var encode_fp_decode_lookup_table = encode_fp_init_decode_lookup_table();
// mapping floating point value to Unicode character code () to fp value or FALSE
var encode_fp_encode_lookup_table = encode_fp_init_encode_lookup_table();

function encode_fp_value5(flt) {
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
  //          Also note that at the high end of the exponent spectrum there's another
  //          oddity lurking:
  //
  //              Math.log2(Math.pow(2, 1023) * 1.9999999999999998) === 1024 
  //
  //          which technically would be a rounding error in `Math.log2`, while
  //
  //              Math.log2(Math.pow(2, 1023) * 1.9999999999999999) === Infinity
  //
  //          since
  //
  //              Math.pow(2, 1023) * 1.9999999999999999 === Infinity
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 !== Infinity   // at least on Chrome/V8. but this is really *begging* for it!
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 === 1.7976931348623157e+308
  //              Math.pow(2, 1023) * 1.9999999999999998889776975 === Math.pow(2, 1023) * 1.9999999999999998
  //
  //          Consequently we'll have to check both upper and lower exponent limits to keep them
  //          within sane ranges:
  //          The lower exponents are for 'denormalized zeroes' which we can handle as-is, by turning
  //          their exponent into -1024, as does IEEE754 itself, while the upper edge oddity (exponent = +1024)
  //          must be treated separately (and it so happens that the treatment we choose also benefits
  //          another high exponent: +1023).
  //

  if (!flt) {
    // +0, -0 or NaN:
    if (isNaN(flt)) {
      return String.fromCharCode(FPC_ENC_NAN);
    } else {
      // detect negative zero:
      var is_negzero = Math.atan2(0, flt); // +0 --> 0, -0 --> PI
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
    var p = exp2 | 0; // --> +1023..-1024, pardon!, +1024..-1074 (!!!)
    if (p < -1024) {
      // Correct for our process: we actually want the bits in the IEE754 exponent, hence
      // exponents lower than -1024, a.k.a. *denormalized zeroes*, are treated exactly
      // like that in our code as well: we will produce leading mantissa ZERO words then.
      p = -1024;
    } else if (p >= 1023) {
      // We also need to process the exponent +1024 specially as that is another edge case
      // which we do not want to handle in our mainstream code flow where -1024 < p <= +1023
      // maximum performance means we want the least number of conditional checks 
      // (~ if/else constructs) in our execution path but I couldn't do without this extra one!

      // and produce the mantissa so that it's range now is [0..2>.
      p--; // drop power p by 1 so that we can safely encode p=+1024 (and p=+1023)
      var y = flt / Math.pow(2, p);
      y /= 4; // we do this in two steps to allow handling even the largest floating point values, which have p>=1023: Math.pow(2, p + 1) would fail for those!
      if (y >= 1) {
        throw new Error('fp float encoding: mantissa above allowed max for ' + flt);
      }

      // See performance test [test0008-array-join-vs-string-add]: string
      // concatenation is the fastest cross-platform.
      var a = '';
      var b = y;
      if (b < 0) {
        throw new Error('fp encoding: negative mantissa for ' + flt);
      }
      if (b === 0) {
        throw new Error('fp encoding: ZERO mantissa for ' + flt);
      }

      // and show the Unicode character codes for debugging/diagnostics:
      //var dbg = [0 /* Note: this slot will be *correctly* filled at the end */];
      //console.log('dbg @ start', 0, p + 1024 + s, flt, dbg, s, p, y, b);

      for (var i = 0; b && i < FPC_ENC_MAXLEN; i++) {
        b *= FPC_ENC_MODULO;
        var c = b | 0; // grab the integer part
        var d = b - c;

        //dbg[i + 1] = c;
        //console.log('dbg @ step', i, c, flt, dbg, s, p, y, b, d, '0x' + c.toString(16));

        a += String.fromCharCode(c);
        b = d;
      }

      // Note: we encode these 'very large floating point values' in the Unicode range 0xF800..0xF8FF 
      // (plus trailing mantissa words, of course!)
      //
      // encode sign + power + mantissa length in a Unicode char
      // (i E {1..4} as maximum size FPC_ENC_MAXLEN=4 ==> 2 bits of length @ bits 5.6 in word)
      //
      // Bits in word:
      // - 0..4: exponent; values +1020..+1024 with an offset of 1020 to make them all small positive numbers
      // - 7: sign
      // - 5,6: length 1..4: the number of words following to define the mantissa
      // - 8..15: (=0xF8) set to signal special 'near infinite' values; some of the same bits are also set for some special Unicode characters,
      //       so we can only have this particular value in bits 8..15
      //       in order to prevent a collision with those Unicode specials at 0xF900..0xFFFF.
      //
      --i;
      if (i > 3) {
        throw new Error('fp encode length too large');
      }
      if (b) {}
      var h = 0xF800 + p - 1020 + (s >> 12 - 7) + (i << 5); // brackets needed as + comes before <<   :-(
      if (h < 0xF800 || h >= 0xF900) {
        throw new Error('fp decimal long float near-inifinity number encoding: internal error: initial word out of range');
      }
      a = String.fromCharCode(h) + a;
      //dbg[0] = h;
      //console.log('dbg @ end', i, h, flt, dbg, s, p, y, b, '0x' + h.toString(16));
      return a;
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
      var dp = exp2 * FPC_ENC_LOG2_TO_LOG10 + 1 | 0;
      // Prevent crash for very small numbers (dp <= -307) and speeds up matters for any other values
      // which won't ever make it into the 'shorthand notation' anyway: here we replicate the `dp`
      // range check you also will see further below:
      //
      //     dp += 2;
      //     if (dp >= 0 && dp < 14 /* (L= 11 + 3) */ ) {
      if (dp >= -2 && dp < 12) {
        var dy;
        var dp_3 = dp - 3;
        // Because `dy = flt / Math.pow(10, dp - 3)` causes bitrot in `dy` LSB (so that, for example, input value 0.00077 becomes 76.9999999999999)
        // we produce the `dy` value in such a way that the power-of-10 multiplicant/divisor WILL be an INTEGER number, 
        // which does *not* produce the bitrot in the LSBit of the *decimal* mantissa `dy` that way:
        if (dp_3 < 0) {
          dy = flt * Math.pow(10, -dp_3); // take mantissa (which is guaranteed to be in range [0.999 .. 0]) and multiply by 1000
        } else {
          dy = flt / Math.pow(10, dp_3); // take mantissa (which is guaranteed to be in range [0.999 .. 0]) and multiply by 1000
        }
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

        // See performance test [test0012-modulo-vs-integer-check] for a technique comparison: 
        // this is the fastest on V8/Edge and second-fastest on FF. 
        var chk = dy | 0;
        //console.log('decimal float eligible? A:', { flt: flt, dy: dy, chk: chk, eq: chk === dy, dp: dp, exp2: exp2});
        if (chk === dy) {
          // alt check:   `(dy % 1) === 0`
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
          // 'reserved for future use' range. From that reserved range, we use
          // the range 0xF800..0xF8FF to represent floating point numbers with 
          // very high exponent values (p >= 1020), while the range 0xFFF0..0xFFF4
          // is used to represent special IEEE754 values such as NaN or Infinity.
          // 
          // ---
          //
          // Note: we now have our own set of 'denormalized' floating point values:
          // given the way we calculate decimal exponent and mantissa (by multiplying
          // with 1000), we will always have a minimum mantissa value of +100, as
          // any *smaller* value would have produced a lower *exponent*!
          // 
          // Next to that, note that we allocate a number of *binary bits* for the
          // mantissa, which can never acquire a value of +1000 or larger as there
          // the same reasoning applies: if such a value were possible, the exponent
          // would have been *raised* by +1 and the mantissa would have been reduced
          // to land within the +100..+999 range once again.
          // 
          // This means that a series of sub-ranges cannot ever be produced by this 
          // function:
          // 
          // - 0x8000      .. 0x8000+  99    (exponent '0', sign bit CLEAR) 
          // - 0x8000+1000 .. 0x8000+1023 
          // - 0x8400      .. 0x8400+  99    (exponent '0', sign bit SET) 
          // - 0x8400+1000 .. 0x8400+1023 
          // - 0x8800      .. 0x8800+  99    (exponent '1', sign bit CLEAR) 
          // - 0x8800+1000 .. 0x8800+1023 
          // - 0x8C00      .. 0x8C00+  99    (exponent '1', sign bit SET) 
          // - 0x8C00+1000 .. 0x8C00+1023 
          // - ... etc ...
          // 
          // One might be tempted to re-use these 'holes' in the output for other
          // purposes, but it's faster to have any special codes use their
          // own 'reserved range' as that would only take one extra conditional
          // check and since we now know (since perf test0006) that V8 isn't
          // too happy about long switch/case constructs, we are better off, 
          // performance wise, to strive for the minimum number of comparisons, 
          // rather than striving for a maximum fill of the available Unicode
          // space.
          // 
          // BTW: We could have applied this same reasoning when we went looking for
          // a range to use to encode those pesky near-infinity high exponent
          // floating point values (p >= 1023), but at the time we hadn't 
          // realized yet that we would have these (large) holes in the output 
          // range.
          // Now that we know these exist, we *might* consider filling one of
          // those 'holes' with those high-exponent values as those really only
          // take 5 bits (2 bits for exponent: 1023 or 1024, 1 bit for sign,
          // 2 bits for length) while they currently usurp the range 0xF800..0xF8FF
          // (with large holes in there as well!)
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
              //       at 0xD800..0xDFFF (and our own specials at 0xF800..0xFFFF).
              //
              // alt:                    __(!!s << 10)_   _dy_____
              dc = 0x8000 + (dp << 11) + (s ? 1024 : 0) + (dy | 0); // the `| 0` shouldn't be necessary but is there as a precaution
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
    }

    // and produce the mantissa so that it's range now is [0..2>: for powers > 0
    // the value y will be >= 1 while for negative powers, i.e. tiny numbers, the
    // value 0 < y < 1.
    p++; // increase power p by 1 so that we get a mantissa in the range [0 .. +1>; this causes trouble when the exponent is very high, hence those values are handled elsewhere
    var y = flt / Math.pow(2, p);
    if (y >= 1) {
      throw new Error('fp float encoding: mantissa above allowed max for ' + flt);
    }

    // See performance test [test0008-array-join-vs-string-add]: string
    // concatenation is the fastest cross-platform.
    var a = '';
    var b = y; // alt: y - 1, but that only gives numbers 0 < b < 1 for p > 0
    if (b < 0) {
      throw new Error('fp encoding: negative mantissa for ' + flt);
    }
    if (b === 0) {
      throw new Error('fp encoding: ZERO mantissa for ' + flt);
    }

    // and show the Unicode character codes for debugging/diagnostics:
    //var dbg = [0 /* Note: this slot will be *correctly* filled at the end */];
    //console.log('dbg @ start', 0, p + 1024 + s, flt, dbg, s, p, y, b);

    for (var i = 0; b && i < FPC_ENC_MAXLEN; i++) {
      b *= FPC_ENC_MODULO;
      var c = b | 0; // grab the integer part
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
    //       in order to prevent a collision with those Unicode specials at 0xD800..0xDFFF 
    //       (and our own specials at 0xF800..0xFFFF).
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
    if (b) {}
    var h = p + 1024 + s + (i << 13 /* i * 8192 */); // brackets needed as + comes before <<   :-(
    if (h >= 0x8000) {
      throw new Error('fp decimal long float encoding: internal error: initial word beyond 0x8000');
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

function decode_fp_value5(s, opt) {
  // sample JS code to decode a IEEE754 floating point value from a Unicode string.
  //
  // With provision to detect +0/-0 and +/-Inf and NaN
  //
  opt = opt || { consumed_length: 0 };
  opt.consumed_length = 1;

  var c0 = s.charCodeAt(0);
  //console.log('decode task: ', s, s.length, c0, '0x' + c0.toString(16));

  // As we expect most encodings to be regular numbers, those will be in 0x0000..0x7FFF and
  // we do not want to spend any amount of time in the 'special values' overhead,
  // which would be added overhead if we did check for those *first* instead of *at the same time*
  // as we do here by looking at the top nibble immediately (Note: This ASSUMES your JS engine (Chrome V8?)
  // is smart enough to convert this switch/case statement set into a jump table, just like any
  // decent C-like language compiler would! It turns out not everyone out there is all that smart
  // yet... Sigh...):
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
      throw new Error('illegal fp encoding value in 0xD800-0xDFFF unicode range');

    case 0xF800:
      // specials:
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
            opt.consumed_length++;
            //console.log('decode-normal-len=1', m, s.charCodeAt(1));
            break;

          case 0x0020:
            // 2 more 15-bit words:
            im = s.charCodeAt(1);
            im <<= 15;
            im |= s.charCodeAt(2);
            m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
            opt.consumed_length += 2;
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
            opt.consumed_length += 3;
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
            opt.consumed_length += 4;
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
        return m;
      } else {
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
      break;

    case 0x8000:
    case 0x8800:
    case 0x9000:
    case 0x9800:
    case 0xA000:
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
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

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
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

      //console.log('decode-short-0', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      dp -= 3 + 2;

      var sflt = dm * Math.pow(10, dp);
      if (ds) {
        sflt = -sflt;
      }
      //console.log('decode-short-1', sflt, ds, dm, dp, c0, '0x' + c0.toString(16));
      return sflt;

    // (0xF900..0xFFF0: reserved for future use)
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
      //       in order to prevent a collision with those Unicode specials at 0xF800..0xFFFF.
      //
      var dm = c0 & 0x03FF; // 10 bits
      var ds = c0 & 0x0400; // bit 10 = sign
      var dp = c0 & 0x7800; // bits 11..14: exponent

      //console.log('decode-short-0C', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      if (dp >= 15) {
        throw new Error('illegal fp encoding value in 0xF8xx-0xFFxx unicode range');
      }
      dp -= 3 + 2 + 1; // like above, but now also compensate for exponent bumping (0xB --> 0xC, ...)

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
      if (vs) {
        m = -m;
      }
      //console.log('decode-normal-2', m);
      return m;
  }
}

function encode_fp_init_lookup_tables(low_offsets, high_offsets) {
  var last_known_good = 0; // WARNING: off by +1 so that we can easily encode 'don't know' in here!
  var first_pending_empty_slot = 0; // WARNING: off by +1 so that we can easily encode 'don't know' in here!
  var tbl = new Array(0x8000);

  for (var c0 = 0xF800; c0 < 0x10000; c0++) {
    tbl[c0 - 0x8000] = false;
  }
  for (var c0 = 0xD800; c0 < 0xE000; c0++) {
    tbl[c0 - 0x8000] = false;
  }

  tbl[FPC_ENC_POSITIVE_ZERO - 0x8000] = 0;
  tbl[FPC_ENC_NEGATIVE_ZERO - 0x8000] = 0;
  tbl[FPC_ENC_POSITIVE_INFINITY - 0x8000] = Infinity;
  tbl[FPC_ENC_NEGATIVE_INFINITY - 0x8000] = Infinity;
  tbl[FPC_ENC_NAN - 0x8000] = NaN;

  for (var c0 = 0x8000; c0 < 0xF800; c0++) {
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
        if (!first_pending_empty_slot) {
          first_pending_empty_slot = c0 + 1;
        }
        c0 = 0xDFFF - 1; // speed up the loop!
        break;

      case 0x8000:
      case 0x8800:
      case 0x9000:
      case 0x9800:
      case 0xA000:
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
        var dm = c0 & 0x03FF; // 10 bits
        var ds = c0 & 0x0400; // bit 10 = sign
        var dp = c0 & 0x7800; // bits 11..14: exponent

        // skip 'denormalized' values:
        if (dm < 100) {
          if (!first_pending_empty_slot) {
            first_pending_empty_slot = c0 + 1;
          }
          tbl[c0 - 0x8000] = false;
          continue;
        }
        if (dm >= 1000) {
          if (!first_pending_empty_slot) {
            first_pending_empty_slot = c0 + 1;
          }
          tbl[c0 - 0x8000] = false;
          continue;
        }

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
        var dm = c0 & 0x03FF; // 10 bits
        var ds = c0 & 0x0400; // bit 10 = sign
        var dp = c0 & 0x7800; // bits 11..14: exponent

        //console.log('decode-short-0', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
        dp >>>= 11;
        dp -= 3 + 2;

        var sflt = dm * Math.pow(10, dp);
        if (ds) {
          sflt = -sflt;
        }
        //console.log('decode-short-1', sflt, ds, dm, dp, c0, '0x' + c0.toString(16));
        return sflt;

      // (0xF900..0xFFF0: reserved for future use)
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
        //       in order to prevent a collision with those Unicode specials at 0xF800..0xFFFF.
        //
        var dm = c0 & 0x03FF; // 10 bits
        var ds = c0 & 0x0400; // bit 10 = sign
        var dp = c0 & 0x7800; // bits 11..14: exponent

        //console.log('decode-short-0C', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
        dp >>>= 11;
        if (dp >= 15) {
          throw new Error('illegal fp encoding value in 0xF8xx-0xFFxx unicode range');
        }
        dp -= 3 + 2 + 1; // like above, but now also compensate for exponent bumping (0xB --> 0xC, ...)

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
        if (vs) {
          m = -m;
        }
        //console.log('decode-normal-2', m);
        return m;
    }
  }
}

//
// Code to check the radix hash approach: M=671 @ size=33435
//  
function __find_fp_radix_hash_settings__() {
  var M, B, a, collisions, minv, maxv;

  var B = Math.log2(100 / 1000 * Math.pow(10, -3 + 1));

  for (var M = 1; M <= 1500; M += 1) {
    a = [];
    collisions = 0;
    minv = Infinity;
    maxv = -Infinity;
    var Z = B * M;
    var ZI = Z | 0;

    for (var i = -3; i < 15 - 3; i++) {
      for (var j = 100; j < 1000; j++) {
        var v = j / 1000 * Math.pow(10, i + 1);
        minv = Math.min(v, minv);
        maxv = Math.max(v, maxv);

        // the hash math under test:
        //var y = (Math.log2(v) - B) * M; 
        //var y = Math.log2(v) * M; 
        var y = Math.log2(v) * M;
        y -= Z;
        var z = y | 0;
        //z -= ZI; 
        if (!a[z]) {
          a[z] = v;
        } else {
          collisions++;
          if (0) {}
          if (collisions > 20) {
            break;
          }
        }
      }
    }
    if (!collisions) break;
  }

  return M;
}
var FPCVT_LUT_M = __find_fp_radix_hash_settings__();

function encode_fp_init_decode_lookup_table() {}
// mapping floating point value to Unicode character code () to fp value or FALSE
function encode_fp_init_encode_lookup_table() {}

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
    var c = str.charCodeAt(i); // a.k.a.  c = str[i];
    rv[i] = word2hex(c);
  }
  return '[' + rv.join(',') + ']';
}

var test_serialization = true;

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
  data.push(Math.pow(2, 1023) * 1.9999999999999998);
  data.push(1.7976931348623158e308); // == 1.7976931348623157e308
  data.push(1.7976931348623157e308);
  data.push(1.7976931348623156e308); // == 1.7976931348623155e308
  data.push(Math.pow(2, -1024) * 0.999999999999999);
  data.push(Math.pow(2, -1025) * 0.999999999999999);
  data.push(Math.pow(2, -1023) * 0.999999999999999);
  data.push(Math.pow(2, 1023) * 1.999999999999998);
  data.push(Math.pow(2, 1022) * 1.999999999999999);
  data.push(Math.pow(2, 1022) * 1.999999999999998);
  data.push(Math.pow(2, 1023) * 0.999999999999999);
  data.push(Math.pow(2, 1022) * 0.999999999999999);
  data.push(Math.pow(2, 1021) * 0.999999999999999);
  data.push(Math.pow(2, 1020) * 0.999999999999999);
  data.push(Math.pow(2, 1019) * 0.999999999999999);
  data.push(Math.pow(2, 1019) * 1.999999999999998);
  data.push(Math.pow(2, 1023) * 1.9999999999999999); // +Infinity
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
    var a = 1 + Math.random() * 21 | 0;
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
      var y = x / 20 + j / 20 + 1; // stay within the next power of 2: 1.0000 .. 1.9999
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
      var y = x + 1; // stay within the next power of 2: 1.0000 .. 1.9999
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
      var dm = i & 0x03FF; // 10 bits
      var ds = i & 0x0400; // bit 10 = sign
      var dp = i & 0x7800; // bits 11..14: exponent
      dp >>>= 11;
      dp -= 3 + 2;
    }
    // ZERO has a special encoding so 0x8000 is a shorthand code which can NEVER OCCUR:
    // however, the *actual* encoding for ZERO (+0) is also a shorthand hence the actual ZERO must also have length =1:
    else if (s.length !== t.length) {}
    data.push(z);
  }
  for (var i = -6; i <= 16; i++) {
    for (var j = 0; j < 1000; j++) {
      var x = Math.random();
      var y = x / 2 + 0.5; // stay within the current power of 2
      var z = Math.pow(2, i) * y;
      var w = Math.random() * 6 | 0;
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

  typeof console !== 'undefined';
}

// serialize / deserialize functions:
function classic_1(data, len, serialized_data) {
  for (var i = 0; i < len; i++) {
    var flt = data[i];

    var s = '' + flt; // fastest solution for encode
    var t = parseFloat(s); // fastest solution for decode
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
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
    if ( /* test_serialization && */t !== flt && (!isNaN(t) || !isNaN(flt))) {}
    if (dec_opt.consumed_length !== s.length) {}
    var s2 = encode_fp_value0(flt);
    if (s2 !== s) {}
    s2 = encode_fp_value2(flt);
    if (s2 !== s) {}
    s2 = encode_fp_value3(flt);
    if (s2 !== s) {}
    s2 = encode_fp_value4(flt);
    if (s2 !== s) {}
    dec_opt.consumed_length = 0;
    var t2 = decode_fp_value2(s, dec_opt);
    if (t2 !== flt && (!isNaN(t2) || !isNaN(flt))) {}
    if (dec_opt.consumed_length !== s.length) {}
    dec_opt.consumed_length = 0;
    t2 = decode_fp_value3(s, dec_opt);
    if (t2 !== flt && (!isNaN(t2) || !isNaN(flt))) {}
    if (dec_opt.consumed_length !== s.length) {}
    dec_opt.consumed_length = 0;
    t2 = decode_fp_value4(s, dec_opt);
    if (t2 !== flt && (!isNaN(t2) || !isNaN(flt))) {}
    if (dec_opt.consumed_length !== s.length) {}
  }
}

function custom_1(data, len, serialized_data) {
  //debugger;
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value0(flt);
    var t = decode_fp_value(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_2(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value2(flt);
    var t = decode_fp_value(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_3(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value3(flt);
    var t = decode_fp_value(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_4(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value4(flt);
    var t = decode_fp_value(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_5(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value(flt);
    var t = decode_fp_value2(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_6(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value2(flt);
    var t = decode_fp_value2(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_7(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value3(flt);
    var t = decode_fp_value2(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_8(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value4(flt);
    var t = decode_fp_value2(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_9(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value(flt);
    var t = decode_fp_value3(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_10(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value2(flt);
    var t = decode_fp_value3(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_11(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value3(flt);
    var t = decode_fp_value3(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_12(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value4(flt);
    var t = decode_fp_value3(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_13(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value(flt);
    var t = decode_fp_value4(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_14(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value2(flt);
    var t = decode_fp_value4(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_15(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value3(flt);
    var t = decode_fp_value4(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
  }
}

function custom_16(data, len, serialized_data) {
  for (var ii = 0; ii < len; ii++) {
    var flt = data[ii];

    var s = encode_fp_value4(flt);
    var t = decode_fp_value4(s);
    if (test_serialization && t !== flt && (!isNaN(t) || !isNaN(flt))) {}
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

describe('Give it some context', function () {
  describe('maybe a bit more context here', function () {
    it('should run here few assertions', function () {
      expect(true).toBe(true);
    });
  });
});