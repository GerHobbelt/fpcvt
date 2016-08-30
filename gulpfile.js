'use strict';

var gulp = require('gulp');
var jasmine = require('gulp-jasmine');

gulp.task('default', function () {
  gulp.src('test/spec/test.js')
    // gulp-jasmine works on filepaths so you can't have any plugins before it 
    .pipe(jasmine({
    	verbose: true,
    	config: 'test/spec/support/jasmine.json',
    }));
});
