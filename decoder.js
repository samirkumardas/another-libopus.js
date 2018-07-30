import Libopus from 'libopus.js';

function Decoder(sampling_rate, channels) {
    this.channels = channels;
    var err = Libopus._malloc(4);
    this.handle = _opus_decoder_create(sampling_rate, this.channels, err);
    var err_num = Libopus.getValue(err, "i32");
    Libopus._free(err);
    if (err_num != 0) {
        throw new Error('Opus error on initiating '+ err_num);
    }
    this.frame_size = sampling_rate * 60 / 1000;
    var buf_size = 1275 * 3 + 7;
    var pcm_samples = this.frame_size * this.channels;
    this.buf_ptr = Libopus._malloc(buf_size);
    this.pcm_ptr = Libopus._malloc(4 * pcm_samples);
    this.buf = Libopus.HEAPU8.subarray(this.buf_ptr, this.buf_ptr + buf_size);
    this.pcm = Libopus.HEAPF32.subarray(this.pcm_ptr / 4, this.pcm_ptr / 4 + pcm_samples);
}
Decoder.prototype.decode = function(payload) {
    this.buf.set(new Uint8Array(payload));
    var ret = _opus_decode_float(this.handle, this.buf_ptr, payload.byteLength, this.pcm_ptr, this.frame_size, 0);
    return (ret < 0) ? ret : new Float32Array(this.pcm.subarray(0, ret * this.channels));
    if (ret < 0) {
        return ret;
    }
}
Decoder.prototype.destroy = function() {
    Libopus._free(this.handle);
    this.state = null;
    this.buf = null;
    this.pcm = null;
};