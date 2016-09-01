'use strict';

var gulp = require('gulp');
var jasmine = require('gulp-jasmine');
var babel = require('gulp-babel');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var fncallback = require('gulp-fncallback');
var recast = require('recast');

const tests_concat_filename = 'all_fpcvt_plus_tests.js';

gulp.task('default', ['babel'], function () {
  gulp.src('test/spec/compiled/' + tests_concat_filename)
    // gulp-jasmine works on filepaths so you can't have any plugins before it 
    .pipe(jasmine({
    	verbose: true,
    	config: 'test/spec/support/jasmine.json',
    }));
});

gulp.task('babel', function () {
    return gulp.src(['fpcvt.js', 'fpcvt-alt*.js', 'test/spec/test.js'])
    		.pipe(concat(tests_concat_filename))
        .pipe(babel({
            presets: ['latest'],
            babelrc: true,
            compact: false,      // don't nuke my precious formatting! ;-)
        }))
/*
    		.pipe(uglify({
    			preserveComments: 'all',
    			//output: {
	    			mangle: false,
	    			warnings: true,
	    			compress: {
	    				sequences: false,
	    				dead_code: true,
	    				drop_debugger: true,
	    				conditionals: true,
	    				comparisons: true,
	    				unsafe_comps: true,
	    				evaluate: true,
	    				booleans: true,
	    				loops: true,
	    				unused: true,
	    				hoist_funs: false,
	    				hoist_vars: false,
	    				if_return: true,
	    				join_vars: false,
	    				cascade: true,
	    				collapse_vars: true,
	    				pure_getters: false,
	    				pure_funcs: [ 'Math.log' ],
	    				drop_console: false,
	    				keep_fargs: false,
	    				keep_fnames: true,
	    				passes: 1,
	    				global_defs: {
	    					DEBUG: false
	    				},
		    			// comments: 'all',
	    			},
	    			beatify: {
	    				'indent-level': 2,
	    				bracketize: true,
	    				'max-line-len': 160,
	    				semicolons: true,
	    				preamble: '',
	    				quote_style: 3,
		    			// comments: function (type, value, pos, line, file, nib) {
		    			// 	console.log('comment B', line);
		    			// 	return true;
		    			// },
	    			},
	    			comments: function (type, value, pos, line, file, nib) {
	    				console.log('comment A', line);
	    				return true;
	    			},
	    		//},
    		}))
*/
        .pipe(fncallback(function (file, enc, cb) {
      		console.log('callback: ', file, enc, this);
      		cb();
    		}, function (callback) {
      		console.log('callback-flush: ', this);
      		callback();
    		}))
        .pipe(gulp.dest('test/spec/compiled'));
}); 

function optimize_me() {

}