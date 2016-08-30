'use strict';

var gulp = require('gulp');
var jasmine = require('gulp-jasmine');
var babel = require('gulp-babel');
var concat = require('gulp-concat');

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
    return gulp.src(['fpcvt*.js', 'test/spec/test.js'])
    		.pipe(concat(tests_concat_filename))
        .pipe(babel({
            presets: ['latest'],
            babelrc: true,
            compact: false,      // don't nuke my precious formatting! ;-)
        }))
        .pipe(gulp.dest('test/spec/compiled'));
}); 
