var expect = require('chai').expect;
var setup  = require(__dirname + '/lib/setup');

var objects = null;
var states  = null;

function checkConnectionOfAdapter(cb, counter) {
    counter = counter || 0;
    if (counter > 60) {
        cb && cb('Cannot check connection');
        return;
    }

    states.getState('system.adapter.telegram.0.alive', function (err, state) {
        if (err) console.error(err);
        if (state && state.val) {
            cb && cb();
        } else {
            setTimeout(function () {
                checkConnectionOfAdapter(cb, counter + 1);
            }, 250);
        }
    });
}

function checkValueOfState(id, value, cb, counter) {
    counter = counter || 0;
    if (counter > 20) {
        cb && cb('Cannot check value Of State ' + id);
        return;
    }

    states.getState(id, function (err, state) {
        if (err) console.error(err);
        if (value === null && !state) {
            cb && cb();
        } else
        if (state && (value === undefined || state.val === value)) {
            cb && cb();
        } else {
            setTimeout(function () {
                checkValueOfState(id, value, cb, counter + 1);
            }, 500);
        }
    });
}

describe('Test Telegram', function() {
    before('Test Telegram: Start js-controller', function (_done) {
        this.timeout(600000); // because of first install from npm

        setup.setupController(async function () {
            var config = await setup.getAdapterConfig();
            // enable adapter
            config.common.enabled  = true;
            config.common.loglevel = 'debug';

            config.native.server = false;
            config.native.token = 'asd';

            await setup.setAdapterConfig(config.common, config.native);

            setup.startController(function (_objects, _states) {
                objects = _objects;
                states  = _states;
                _done();
            });
        });
    });

    it('Test Telegram: Check if adapter started', function (done) {
        this.timeout(5000);
        checkConnectionOfAdapter(done);
    });

    after('Test Telegram: Stop js-controller', function (done) {
        this.timeout(6000);

        setup.stopController(function (normalTerminated) {
            console.log('Adapter normal terminated: ' + normalTerminated);
            done();
        });
    });
});
