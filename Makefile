OUTPUT_DIR=./build
EMCC_OPTS=-O3 --memory-init-file 0 --closure 1 -s NO_FILESYSTEM=1 -s MODULARIZE=1
EXPORTS:='_speex_resampler_init','_speex_resampler_destroy','_speex_resampler_process_interleaved_float'

SPEEXDSP_DIR=./speexdsp
SPEEXDSP_OBJ=$(SPEEXDSP_DIR)/.libs/libspeexdsp.a

SPEEXDSP_JS=$(OUTPUT_DIR)/resampler.js

default: $(SPEEXDSP_JS)

clean:
	rm -rf $(OUTPUT_DIR) $(SPEEXDSP_DIR)
	mkdir $(OUTPUT_DIR)

.PHONY: clean default

$(SPEEXDSP_DIR):
	git submodule update --init --recursive
	cd $(SPEEXDSP_DIR); git checkout ${LIBOPUS_STABLE}

$(SPEEXDSP_OBJ): $(SPEEXDSP_DIR)
	cd $(SPEEXDSP_DIR); ./autogen.sh
	cd $(SPEEXDSP_DIR); emconfigure ./configure --disable-extra-programs --disable-doc
	cd $(SPEEXDSP_DIR); emmake make

$(SPEEXDSP_JS): $(SPEEXDSP_OBJ)
	emcc -o $@ $(EMCC_OPTS) -s EXPORTED_FUNCTIONS="[$(EXPORTS)]" $(SPEEXDSP_OBJ)