var Resampler = (function() {
    function Resampler(worker) {
        var _this = this;
        this.resampler = null;
        this.worker = worker;
        this.worker.onmessage = function(e) {
            _this.setup(e.data);
        }
    }
    Resampler.prototype.setup = function(config) {
        var _this = this;
        try {
            this.resampler = new SpeexResampler(config.channels, config.in_sampling_rate, config.out_sampling_rate, config.quality || 5);
            this.worker.postMessage({
                status: 0
            });
            this.worker.onmessage = function(e) {
                _this.process(e.data.samples);
            }
        } catch (e) {
            this.worker.postMessage({
                status: -1,
                reason: e
            });
        }
    };
    Resampler.prototype.process = function(input) {
        try {
            var ret = new Float32Array(this.resampler.process(input));
            this.worker.postMessage({
                status: 0,
                result: ret
            }, [ret.buffer]);
        } catch (e) {
            this.worker.postMessage({
                status: -1,
                reason: e
            });
        }
    };
    return Resampler;
})();
new Resampler(this);