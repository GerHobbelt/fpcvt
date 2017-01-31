# FPCVT


[![build status](https://secure.travis-ci.org/GerHobbelt/fpcvt.png)](https://travis-ci.org/search/fpcvt)


Convert floating point to packed binary format which can live in a fully Unicode compliant string - use when pure Float64Array-like binary storage is not an option or when storage space is costly (many floating point values are stored in one 16 bit word)


# Design Goals & Decisions


## Primary Usage Targets

You use me[^1] when you care about several of these items:

+ Storage Size Anywhere

  : your RAM, network and storage costs are a major concern

+ Load / Save / Messaging Speed 

  : run-time performance is a major concern, both in *data processing* and at *boundary crossing*[#Boundary Crossing Cost],
    both to/from remote server (network transfer costs) and internally ([postMessage] to/from other *threads* a.k.a. [Web Workers]) 

+ Large / Huge Application Size

  : your application churns a lot of single-type or mixed data and is large, potentially even huge. One standardized,
    size and speed optimal format to use in all transfers is a boon[^2]     

  : your application is *processing* a lot of floating point data (raw or mixed with other stuff) --- and you must fetch
    and send large amounts of data to other machines / applications (servers, databases, ...) 



[^1]:
either the FPCVT code directly or any of my derivatives, such as 
[GerHobbelt/UBON], 
[GerHobbelt/jison/examples#user-content-compiled_calc-a-calculus-interpreter-and-compiler] or 
[GerHobbelt/gonzo-research/grammars/]

[^2]:
as you are not interested in encoding a single floating point value but probably *a lot of them*, possibly in 
conjunction with other data types, both JavaScript native and structured / custom, you may want to check out the
[GerHobbelt/UBON] derivative serialization/deserialization/encoding/decoding library, as that one might 
very well suit your goals as well as mine!




## Goals

+ take up minimal space in storage (localStorage, primarily, but also a concern in run-time RAM as **we target large & _huge_ web applications**) or near-minimal (run-time RAM, 

This encoder SHOULD produce an **optimal**[#optimal] 16-bit unsigned integer word output sequence for
input 64 bit IEEE-754 floating point values.

The primary output target are JavaScript *strings* for these reasons:

+ target destinations are 

  + local storage (localStorage), which is string-based and size-limited on almost all browsers,

  + server storage (database), where we don't care if these strings are treated as BLOBs or otherwise: this target MUST 
    treat the data as BINARY.

  + browser and server in-memory run-time JavaScript variables

    > RAM memory storage cost for large sets of data is 
    > minimal for JavaScript strings (when a lot of data 
    > can be stored in a single string and indexed directly, 
    > which is a cross-platform ability as all browsers support 
    > this via the native String type and APIs such as 
    > [charCodeAt].

    > ### Typed Array Storage
    >
    > Alternatively we can use the compact binary storage available
    > in modern browsers using [Typed Arrays]: [UInt16Array] can serve
    > the same purpose as the JavaScript [String] for us, without any
    > of the [#Security Considerations](security restrictions) inherent
    > to JavaScript Strings, while also offering *faster* indexed access. 

+ Strings are a *native* JavaScript type and can be sent across the network
  with no overhead[#no JSON needed]: the [#Boundary Crossing Cost] is the
  smallest of all data types in JavaScript.  


...TBD...








# Security Considerations


- output is a series of 16 bit 'words' (unsigned integers), encoded as a JavaScript string (which itself is UCS-2)


...TBD...




output is Unicode UTF-16 compliant: no output (16-bit) word 


http://security.stackexchange.com/questions/85476/which-unicode-control-characters-should-a-web-app-not-accept

- we MAY output U+0000 as part of the encoded output: 

  + word 0 MAY be U+0000 (when followed by 1 word of mantissa)

  + word 1..3 MAY be U+0000 when encoding [denormalized IEEE-754 zero] values

  + we ASSUME all receiving nodes involved are NULL character safe as we are: this means that
    when you produce a C language based alternative reader for the UBON format, you MUST NOT
    treat the encoded data as a (wchar_t) *string* but instead MUST treat it as a BINARY stream.

- We're Unicode UTF-16 Safe as we prevent the encoder from ever producing a Low / High Plane 
  Unicode code point (U+D800..U+DFFF)


...TBD...




# Development History Notes

Most of the initial work was done in the GerHobbelt/Benchmark and GerHobbelt/gonzo-research repositories.

All the FPCVT work has been extracted from these repositories and rebased into this repo.

