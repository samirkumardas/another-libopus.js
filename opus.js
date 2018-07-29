import { Encoder, Decoder } from 'libopus.js';

let sampleRate,
    noOfChannels,
    encorder;

self.onmessage = function (e) {
    switch (e.data.command) {
        case 'init':
            init(e.data.config);
            break;
        case 'encode':
            encode(e.data.buffers);
            break;
        default:
    }
};

function init(config) {
    sampleRate = config.sampleRate;
    noOfChannels = config.noOfChannels;
    encorder = new Encoder({
        rate: sampleRate, 
        channels: noOfChannels
    });
}

function encode(buffers) {
    let samples = interleave(buffers);
    let result = encorder.encode(samples);
    self.postMessage({command: 'opus', data: result});
}

function interleave(buffers) {
    let interleavedBuffers = [];
    if (noOfChannels === 1) {
        return buffers[0];
    }
    for ( let i = 0; i < buffers.length; i++ ) {
        for ( let channel = 0; channel < noOfChannels; channel++ ) {
            interleavedBuffers[i * noOfChannels + channel] = buffers[channel][i];
        }
    }
    return interleavedBuffers;
}