function Resampler(worker) {
    this.worker = worker;
    this.worker.addEventListener('message', function(e) {
        switch (e.data.type) {
            case 'init' :
                this.init(e.data.config.rate, e.data.config.channels);
                break;
            case 'resample' :
                this.resample(e.data.buffer);
                break;
            case 'destroy' :
                this.destroy();
                break;
            default:
        }
    });
}
Resampler.prototype.init = function(sampleRate, channels) {
    this.channels = channels;
    var err = Module._malloc(4);
    this.handle = _opus_Resampler_create(sampleRate, this.channels, err);
    var err_num = Module.getValue(err, "i32");
    Module._free(err);
    if (err_num != 0) {
        this.worker.postMessage({
            cmd:'error',
            error: err_num
        });
        return;
    }
    this.frame_size = sampleRate * 60 / 1000;
    var buf_size = 1275 * 3 + 7;
    var pcm_samples = this.frame_size * this.channels;
    this.buf_ptr = Module._malloc(buf_size);
    this.pcm_ptr = Module._malloc(4 * pcm_samples);
    this.buf = Module.HEAPU8.subarray(this.buf_ptr, this.buf_ptr + buf_size);
    this.pcm = Module.HEAPF32.subarray(this.pcm_ptr / 4, this.pcm_ptr / 4 + pcm_samples);
}

Resampler.prototype.resample = function(payload) {
    this.buf.set(new Uint8Array(payload));
    var ret = _opus_decode_float(this.handle, this.buf_ptr, payload.byteLength, this.pcm_ptr, this.frame_size, 0);
    if (ret < 0) {
        this.worker.postMessage({
            cmd:'error',
            error: ret
        });
    } else {
        this.worker.postMessage({
            cmd:'data',
            data: new Float32Array(this.pcm.subarray(0, ret * this.channels))
        });
    }
}

Resampler.prototype.destroy = function() {
    _opus_Resampler_destroy(this.handle);
    this.state = null;
    this.buf = null;
    this.pcm = null;
}
new Resampler(self);