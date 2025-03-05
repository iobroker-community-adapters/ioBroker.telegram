const { deleteFoldersRecursive, npmInstall, buildReact, copyFiles } = require('@iobroker/build-tools');

const srcAdmin = `${__dirname}/src-admin/`;
const src = `${__dirname}/src/`;

function rulesClean() {
    deleteFoldersRecursive(`${__dirname}/admin/rules`);
    deleteFoldersRecursive(`${__dirname}/src/build`);
}

function rulesCopy() {
    copyFiles(['src/build/**/*', '!*.json'], 'admin/rules');
    copyFiles(['src/src/i18n/*.json'], 'admin/rules/i18n');
}

function adminClean() {
    deleteFoldersRecursive(`${__dirname}/admin/custom`);
    deleteFoldersRecursive(`${srcAdmin}build`);
}
function adminCopy() {
    copyFiles(['src-admin/build/assets/*.js', '!src-admin/build/static/js/vendors*.js'], 'admin/custom/assets');
    copyFiles(['src-admin/build/assets/*.map', '!src-admin/build/static/js/vendors*.map'], 'admin/custom/assets');
    copyFiles(['src-admin/build/customComponents.js'], 'admin/custom');
    copyFiles(['src-admin/build/customComponents.js.map'], 'admin/custom');
    copyFiles(['src-admin/src/i18n/*.json'], 'admin/custom/i18n');
}

if (process.argv.includes('--rules-0-clean')) {
    rulesClean();
} else if (process.argv.includes('--rules-1-npm')) {
    npmInstall(src).catch(e => {
        console.error(e);
        process.exit(2);
    });
} else if (process.argv.includes('--rules-2-compile')) {
    buildReact(src, { rootDir: src, vite: true, tsc: true }).catch(e => {
        console.error(e);
        process.exit(2);
    });
} else if (process.argv.includes('--rules-3-copy')) {
    rulesCopy();
} else if (process.argv.includes('--rules-build')) {
    rulesClean();
    npmInstall(src)
        .then(() => buildReact(src, { rootDir: src, vite: true, tsc: true }))
        .then(() => rulesCopy())
        .catch(e => {
            console.error(e);
            process.exit(2);
        });
} else if (process.argv.includes('--admin-0-clean')) {
    adminClean();
} else if (process.argv.includes('--admin-1-npm')) {
    npmInstall(srcAdmin);
} else if (process.argv.includes('--admin-2-compile')) {
    buildReact(srcAdmin, { rootDir: srcAdmin, craco: true });
} else if (process.argv.includes('--admin-3-copy')) {
    adminCopy();
} else if (process.argv.includes('--admin-build')) {
    adminClean();
    npmInstall(srcAdmin)
        .then(() => buildReact(srcAdmin, { rootDir: srcAdmin, vite: true, tsc: true }))
        .then(() => adminCopy())
        .catch(e => {
            console.error(e);
            process.exit(2);
        });
} else if (process.argv.includes('--default')) {
    rulesClean();
    adminClean();
    npmInstall(src)
        .then(() => buildReact(src, { rootDir: src, vite: true, tsc: true }))
        .then(() => rulesCopy())
        .then(() => npmInstall(srcAdmin))
        .then(() => buildReact(srcAdmin, { rootDir: srcAdmin, vite: true, tsc: true }))
        .then(() => adminCopy())
        .catch(e => {
            console.error(e);
            process.exit(2);
        });
}
