### Building from source

How to Decode:

var worker = new Worker('dist/decoder.js');
worker.postMessage({
    type: 'init',
    config: {
        sampleRate: this.config.sampleRate,
        channels: this.config.channels
    }
});
worker.onmessage = (e) => {
    switch (e.data.type) {
        case 'error' :
            console.log('decoding error ' + e.data.error);
            break;
        case 'data' :
            console.log(e.data.payload); // decoded data
            break;
        default:
    }
};

/* Now send opus packet to worker */
worker.postMessage({
    type: 'decode',
    buffer: opus_packet_buffer
});


How to encode:

var worker = new Worker('dist/encoder.js');

worker.onmessage = (e) => {
    switch (e.data.type) {
        case 'error' :
            console.log('encoding error ' + e.data.error);
            break;
        case 'data' :
            cb(e.data.payload);
            break;
        default:
    }
};

worker.postMessage({
    type: 'init',
    config: {
        application: 2049, /* 2049 = audio, 2048 = VoIP*/
        frameDuration: this.config.frameDuration,
        originalRate: this.audioCtx.sampleRate, 
        sampleRate: this.config.sampleRate,
        channels: this.node.channelCount,
        params: {
            cbr: true /* If you want cbr, then set this flag true */
        }
    }
});


/* Now send pcm buffer to worker */
this.worker.postMessage({
    type: 'encode',
    buffer: pcm_buffer
});



Note: Prebuilt javascript are available in `dist/`. Also you can build as follows:

1. git submodule update --init --recursive
2. Run `make clean`
3. Run `make`

