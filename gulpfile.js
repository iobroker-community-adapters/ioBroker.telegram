const gulp = require('gulp');
const fs = require('fs');
const cp = require('child_process');
const del = require('del');
const src = __dirname + '/src/';

function build() {
    const version = JSON.parse(fs.readFileSync(__dirname + '/package.json').toString('utf8')).version;
    const data    = JSON.parse(fs.readFileSync(src + 'package.json').toString('utf8'));

    data.version = version;

    fs.writeFileSync(src + 'package.json', JSON.stringify(data, null, 4));

    return new Promise((resolve, reject) => {
        const options = {
            stdio: 'pipe',
            cwd: src
        };

        console.log(options.cwd);

        let script = src + 'node_modules/vite/bin/vite.js';
        if (!fs.existsSync(script)) {
            script = __dirname + '/node_modules/vite/bin/vite.js';
        }
        if (!fs.existsSync(script)) {
            console.error('Cannot find execution file: ' + script);
            reject('Cannot find execution file: ' + script);
        } else {
            const child = cp.fork(script, ['build'], options);
            child.stdout.on('data', data => console.log(data.toString()));
            child.stderr.on('data', data => console.log(data.toString()));
            child.on('close', code => {
                console.log(`child process exited with code ${code}`);
                code ? reject('Exit code: ' + code) : resolve();
            });
        }
    });
}

gulp.task('0-clean', () => del(['admin/rules/**/*', 'dist/**/*']));

gulp.task('1-compile', async () => build());

gulp.task('2-copy', () => Promise.all([
    gulp.src(['src/dist/assets/*.js', '!src/dist/assets/__federation_shared_*.js', '!src/dist/assets/__federation_lib_semver.js']).pipe(gulp.dest('admin/rules')),
    gulp.src(['src/dist/assets/*.map', '!src/dist/assets/__federation_shared_*.map', '!src/dist/assets/__federation_lib_semver.js.map']).pipe(gulp.dest('admin/rules')),
    gulp.src(['src/src/i18n/*.json']).pipe(gulp.dest('admin/rules/i18n')),
]));

gulp.task('build', gulp.series(['0-clean', '1-compile', '2-copy']));

gulp.task('default', gulp.series(['build']));