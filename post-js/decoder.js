(function(self) {

    var decoder;
    self.addEventListener('message', function(e) {
        switch (e.data.type) {
            case 'init' :
                decoder = new Decoder(e.data.config.sampleRate, e.data.config.channels);
                break;
            case 'decode' :
                decoder.decode(e.data.buffer);
                break;
            case 'destroy' :
                decoder.destroy();
                break;
            default:
        }
    });

    function Decoder(sampleRate, channels) {
        this.channels = channels;
        var err = Module._malloc(4);
        this.handle = _opus_decoder_create(sampleRate, this.channels, err);
        var errNum = Module.getValue(err, "i32");
        Module._free(err);
        if (errNum != 0) {
            self.postMessage({
                type:'error',
                error: errNum
            });
            return;
        }
        this.frameSize = sampleRate * 60 / 1000;
        var bufSize = 1275 * 3 + 7;
        var pcmSamples = this.frameSize * this.channels;
        this.bufPtr = Module._malloc(bufSize);
        this.pcmPtr = Module._malloc(4 * pcmSamples);
        this.buf = Module.HEAPU8.subarray(this.bufPtr, this.bufPtr + bufSize);
        this.pcm = Module.HEAPF32.subarray(this.pcmPtr / 4, this.pcmPtr / 4 + pcmSamples);
    }

    Decoder.prototype.decode = function(payload) {
        this.buf.set(new Uint8Array(payload));
        var ret = _opus_decode_float(this.handle, this.bufPtr, payload.byteLength, this.pcmPtr, this.frameSize, 0);
        if (ret < 0) {
            self.postMessage({
                type:'error',
                error: ret
            });
        } else {
            self.postMessage({
                type:'data',
                payload: new Float32Array(this.pcm.subarray(0, ret * this.channels))
            });
        }
    }

    Decoder.prototype.destroy = function() {
        _opus_decoder_destroy(this.handle);
        this.handle = null;
        this.buf = null;
        this.pcm = null;
    }
})(self);