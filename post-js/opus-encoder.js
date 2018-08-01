var SpeexResampler = (function() {
    function SpeexResampler(channels, in_rate, out_rate, quality) {
        if (quality === void 0) {
            quality = 5;
        }
        this.handle = 0;
        this.in_ptr = 0;
        this.out_ptr = 0;
        this.in_capacity = 0;
        this.in_len_ptr = 0;
        this.out_len_ptr = 0;
        this.channels = channels;
        this.in_rate = in_rate;
        this.out_rate = out_rate;
        var err_ptr = Module._malloc(4);
        this.handle = _speex_resampler_init(channels, in_rate, out_rate, quality, err_ptr);
        if (Module.getValue(err_ptr, "i32") != 0)
            throw "speex_resampler_init failed: ret=" + Module.getValue(err_ptr, "i32");
        Module._free(err_ptr);
        this.in_len_ptr = Module._malloc(4);
        this.out_len_ptr = Module._malloc(4);
    }
    SpeexResampler.prototype.process = function(input) {
        if (!this.handle)
            throw "disposed object";
        var samples = input.length;
        var outSamples = Math.ceil(samples * this.out_rate / this.in_rate);
        var requireSize = samples * 4;
        if (this.in_capacity < requireSize) {
            if (this.in_ptr)
                Module._free(this.in_ptr);
            if (this.out_ptr)
                Module._free(this.out_ptr);
            this.in_ptr = Module._malloc(requireSize);
            this.out_ptr = Module._malloc(outSamples * 4);
            this.in_capacity = requireSize;
        }
        var ret;
        Module.setValue(this.in_len_ptr, samples / this.channels, "i32");
        Module.setValue(this.out_len_ptr, outSamples / this.channels, "i32");
        if (input.buffer == Module.HEAPF32.buffer) {
            ret = _speex_resampler_process_interleaved_float(this.handle, input.byteOffset, this.in_len_ptr, this.out_ptr, this.out_len_ptr);
        } else {
            Module.HEAPF32.set(input, this.in_ptr >> 2);
            ret = _speex_resampler_process_interleaved_float(this.handle, this.in_ptr, this.in_len_ptr, this.out_ptr, this.out_len_ptr);
        }
        if (ret != 0)
            throw "speex_resampler_process_interleaved_float failed: " + ret;
        var ret_samples = Module.getValue(this.out_len_ptr, "i32") * this.channels;
        return Module.HEAPF32.subarray(this.out_ptr >> 2, (this.out_ptr >> 2) + ret_samples);
    };
    SpeexResampler.prototype.destroy = function() {
        if (!this.handle)
            return;
        _speex_resampler_destroy(this.handle);
        this.handle = 0;
        Module._free(this.in_len_ptr);
        Module._free(this.out_len_ptr);
        if (this.in_ptr)
            Module._free(this.in_ptr);
        if (this.out_ptr)
            Module._free(this.out_ptr);
        this.in_len_ptr = this.out_len_ptr = this.in_ptr = this.out_ptr = 0;
    };
    return SpeexResampler;
})();

var OpusEncoder = (function() {
    function OpusEncoder(worker) {
        var _this = this;
        this.resampler = null;
        this.buf_pos = 0;
        this.worker = worker;
        this.worker.onmessage = function(ev) {
            _this.setup(ev.data);
        };
    }
    OpusEncoder.prototype.setup = function(config) {
        var _this = this;
        var err = Module._malloc(4);
        var app = config.params.application || 2049;
        var sampling_rate = config.params.sampling_rate || config.sampling_rate;
        var frame_duration = config.params.frame_duration || 20;
        if ([2.5, 5, 10, 20, 40, 60].indexOf(frame_duration) < 0) {
            this.worker.postMessage({
                status: -1,
                reason: "invalid frame duration"
            });
            return;
        }
        this.frame_size = sampling_rate * frame_duration / 1e3;
        this.channels = config.num_of_channels;
        this.handle = _opus_encoder_create(sampling_rate, config.num_of_channels, app, err);
        if (Module.getValue(err, "i32") != 0) {
            this.worker.postMessage({
                status: Module.getValue(err, "i32")
            });
            return;
        }
        if (sampling_rate != config.sampling_rate) {
            try {
                this.resampler = new SpeexResampler(config.num_of_channels, config.sampling_rate, sampling_rate)
            } catch (e) {
                this.worker.postMessage({
                    status: -1,
                    reason: e
                });
                return;
            }
        }
        var buf_size = 4 * this.frame_size * this.channels;
        this.buf_ptr = Module._malloc(buf_size);
        this.buf = Module.HEAPF32.subarray(this.buf_ptr / 4, (this.buf_ptr + buf_size) / 4);
        var out_size = 1275 * 3 + 7;
        this.out_ptr = Module._malloc(out_size);
        this.out = Module.HEAPU8.subarray(this.out_ptr, this.out_ptr + out_size);
        this.worker.onmessage = function(ev) {
            _this.encode(ev.data);
        };
        var opus_header_buf = new ArrayBuffer(19);
        var view8 = new Uint8Array(opus_header_buf);
        var view32 = new Uint32Array(opus_header_buf,12,1);
        var magic = "OpusHead";
        for (var i = 0; i < magic.length; ++i)
            view8[i] = magic.charCodeAt(i);
        view8[8] = 1;
        view8[9] = this.channels;
        view8[10] = view8[11] = 0;
        view32[0] = sampling_rate;
        view8[16] = view8[17] = 0;
        view8[18] = 0;
        this.worker.postMessage({
            status: 0,
            packets: [{
                data: opus_header_buf
            }]}, 
            [opus_header_buf]);
    };

    OpusEncoder.prototype.encode = function(data) {
        var samples = data.samples;
        if (this.resampler) {
            try {
                samples = this.resampler.process(samples)
            } catch (e) {
                this.worker.postMessage({
                    status: -1,
                    reason: e
                });
                return;
            }
        }
        var packets = [];
        var transfer_list = [];
        while (samples && samples.length > 0) {
            var size = Math.min(samples.length, this.buf.length - this.buf_pos);
            this.buf.set(samples.subarray(0, size), this.buf_pos);
            this.buf_pos += size;
            samples = samples.subarray(size);
            if (this.buf_pos == this.buf.length) {
                this.buf_pos = 0;
                var ret = _opus_encode_float(this.handle, this.buf_ptr, this.frame_size, this.out_ptr, this.out.byteLength);
                if (ret < 0) {
                    this.worker.postMessage({
                        status: ret
                    });
                    return;
                }
                var packet = {
                    data: (new Uint8Array(this.out.subarray(0, ret))).buffer
                };
                packets.push(packet);
                transfer_list.push(packet.data);
            }
        }
        this.worker.postMessage({
            status: 0,
            packets: packets
        }, transfer_list);
    };
    return OpusEncoder;
})();
new OpusEncoder(this);