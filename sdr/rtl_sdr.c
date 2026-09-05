/**
 * High-Performance Standalone RTL-SDR Raw IQ Streaming Utility
 * Dynamically links against librtlsdr to stream Mode-S / ADS-B IQ samples.
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <strings.h>
#include <signal.h>
#include <unistd.h>
#include <dlfcn.h>

typedef void* rtlsdr_dev_t;
typedef void (*rtlsdr_read_async_cb_t)(unsigned char *buf, uint32_t len, void *ctx);

typedef int (*fn_rtlsdr_get_device_count)(void);
typedef const char* (*fn_rtlsdr_get_device_name)(uint32_t index);
typedef int (*fn_rtlsdr_open)(rtlsdr_dev_t **dev, uint32_t index);
typedef int (*fn_rtlsdr_close)(rtlsdr_dev_t *dev);
typedef int (*fn_rtlsdr_set_center_freq)(rtlsdr_dev_t *dev, uint32_t freq);
typedef uint32_t (*fn_rtlsdr_get_center_freq)(rtlsdr_dev_t *dev);
typedef int (*fn_rtlsdr_set_sample_rate)(rtlsdr_dev_t *dev, uint32_t rate);
typedef uint32_t (*fn_rtlsdr_get_sample_rate)(rtlsdr_dev_t *dev);
typedef int (*fn_rtlsdr_set_tuner_gain_mode)(rtlsdr_dev_t *dev, int manual);
typedef int (*fn_rtlsdr_set_tuner_gain)(rtlsdr_dev_t *dev, int gain);
typedef int (*fn_rtlsdr_set_freq_correction)(rtlsdr_dev_t *dev, int ppm);
typedef int (*fn_rtlsdr_set_bias_tee)(rtlsdr_dev_t *dev, int on);
typedef int (*fn_rtlsdr_reset_buffer)(rtlsdr_dev_t *dev);
typedef int (*fn_rtlsdr_set_agc_mode)(rtlsdr_dev_t *dev, int on);
typedef int (*fn_rtlsdr_get_tuner_gain)(rtlsdr_dev_t *dev);
typedef int (*fn_rtlsdr_read_async)(rtlsdr_dev_t *dev, rtlsdr_read_async_cb_t cb, void *ctx, uint32_t buf_num, uint32_t buf_len);
typedef int (*fn_rtlsdr_cancel_async)(rtlsdr_dev_t *dev);

static fn_rtlsdr_get_device_count   p_rtlsdr_get_device_count = NULL;
static fn_rtlsdr_get_device_name    p_rtlsdr_get_device_name = NULL;
static fn_rtlsdr_open               p_rtlsdr_open = NULL;
static fn_rtlsdr_close              p_rtlsdr_close = NULL;
static fn_rtlsdr_set_center_freq    p_rtlsdr_set_center_freq = NULL;
static fn_rtlsdr_get_center_freq    p_rtlsdr_get_center_freq = NULL;
static fn_rtlsdr_set_sample_rate    p_rtlsdr_set_sample_rate = NULL;
static fn_rtlsdr_get_sample_rate    p_rtlsdr_get_sample_rate = NULL;
static fn_rtlsdr_set_tuner_gain_mode p_rtlsdr_set_tuner_gain_mode = NULL;
static fn_rtlsdr_set_tuner_gain     p_rtlsdr_set_tuner_gain = NULL;
static fn_rtlsdr_get_tuner_gain     p_rtlsdr_get_tuner_gain = NULL;
static fn_rtlsdr_set_agc_mode       p_rtlsdr_set_agc_mode = NULL;
static fn_rtlsdr_set_freq_correction p_rtlsdr_set_freq_correction = NULL;
static fn_rtlsdr_set_bias_tee       p_rtlsdr_set_bias_tee = NULL;
static fn_rtlsdr_reset_buffer       p_rtlsdr_reset_buffer = NULL;
static fn_rtlsdr_read_async         p_rtlsdr_read_async = NULL;
static fn_rtlsdr_cancel_async       p_rtlsdr_cancel_async = NULL;

static rtlsdr_dev_t *dev = NULL;
static FILE *out_file = NULL;
static volatile int do_exit = 0;

static void sig_handler(int sig) {
    (void)sig;
    do_exit = 1;
    if (dev && p_rtlsdr_close) {
        p_rtlsdr_close(dev);
        dev = NULL;
    }
    _exit(0);
}

static void rtlsdr_callback(unsigned char *buf, uint32_t len, void *ctx) {
    (void)ctx;
    if (do_exit) return;
    if (out_file && len > 0) {
        size_t written = fwrite(buf, 1, len, out_file);
        if (written != len) {
            do_exit = 1;
            if (dev && p_rtlsdr_cancel_async) {
                p_rtlsdr_cancel_async(dev);
            }
        }
    }
}

static int load_librtlsdr(void) {
    const char *libs[] = {
        "librtlsdr.so.0",
        "librtlsdr.so.2",
        "librtlsdr.so",
        "/usr/lib/x86_64-linux-gnu/librtlsdr.so.0",
        "/usr/local/lib/librtlsdr.so",
        NULL
    };

    void *h = NULL;
    for (int i = 0; libs[i]; i++) {
        h = dlopen(libs[i], RTLD_NOW);
        if (h) break;
    }

    if (!h) {
        fprintf(stderr, "[RTL-SDR] Error: librtlsdr shared library not found.\n");
        return -1;
    }

    p_rtlsdr_get_device_count   = (fn_rtlsdr_get_device_count)dlsym(h, "rtlsdr_get_device_count");
    p_rtlsdr_get_device_name    = (fn_rtlsdr_get_device_name)dlsym(h, "rtlsdr_get_device_name");
    p_rtlsdr_open               = (fn_rtlsdr_open)dlsym(h, "rtlsdr_open");
    p_rtlsdr_close              = (fn_rtlsdr_close)dlsym(h, "rtlsdr_close");
    p_rtlsdr_set_center_freq    = (fn_rtlsdr_set_center_freq)dlsym(h, "rtlsdr_set_center_freq");
    p_rtlsdr_get_center_freq    = (fn_rtlsdr_get_center_freq)dlsym(h, "rtlsdr_get_center_freq");
    p_rtlsdr_set_sample_rate    = (fn_rtlsdr_set_sample_rate)dlsym(h, "rtlsdr_set_sample_rate");
    p_rtlsdr_get_sample_rate    = (fn_rtlsdr_get_sample_rate)dlsym(h, "rtlsdr_get_sample_rate");
    p_rtlsdr_set_tuner_gain_mode = (fn_rtlsdr_set_tuner_gain_mode)dlsym(h, "rtlsdr_set_tuner_gain_mode");
    p_rtlsdr_set_tuner_gain     = (fn_rtlsdr_set_tuner_gain)dlsym(h, "rtlsdr_set_tuner_gain");
    p_rtlsdr_get_tuner_gain     = (fn_rtlsdr_get_tuner_gain)dlsym(h, "rtlsdr_get_tuner_gain");
    p_rtlsdr_set_agc_mode       = (fn_rtlsdr_set_agc_mode)dlsym(h, "rtlsdr_set_agc_mode");
    p_rtlsdr_set_freq_correction = (fn_rtlsdr_set_freq_correction)dlsym(h, "rtlsdr_set_freq_correction");
    p_rtlsdr_set_bias_tee       = (fn_rtlsdr_set_bias_tee)dlsym(h, "rtlsdr_set_bias_tee");
    p_rtlsdr_reset_buffer       = (fn_rtlsdr_reset_buffer)dlsym(h, "rtlsdr_reset_buffer");
    p_rtlsdr_read_async         = (fn_rtlsdr_read_async)dlsym(h, "rtlsdr_read_async");
    p_rtlsdr_cancel_async       = (fn_rtlsdr_cancel_async)dlsym(h, "rtlsdr_cancel_async");

    if (!p_rtlsdr_open || !p_rtlsdr_close || !p_rtlsdr_read_async) {
        fprintf(stderr, "[RTL-SDR] Error: Missing essential functions in librtlsdr.\n");
        return -1;
    }

    return 0;
}

int main(int argc, char **argv) {
    signal(SIGINT, sig_handler);
    signal(SIGTERM, sig_handler);
    signal(SIGPIPE, sig_handler);

    uint32_t freq = 1090000000;
    uint32_t rate = 2000000;
    int gain_auto = 0;
    int gain_val = 496; // 49.6 dB default
    int agc_enable = 1; // Default RTL2832U digital AGC enabled for high Mode-S sensitivity
    int ppm = 0;
    int bias_tee = 0;
    int test_only = 0;
    uint32_t dev_index = 0;
    const char *out_filename = "-";

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-f") == 0 && i + 1 < argc) {
            freq = (uint32_t)atoll(argv[++i]);
        } else if (strcmp(argv[i], "-s") == 0 && i + 1 < argc) {
            rate = (uint32_t)atoll(argv[++i]);
        } else if (strcmp(argv[i], "-d") == 0 && i + 1 < argc) {
            dev_index = (uint32_t)atoi(argv[++i]);
        } else if (strcmp(argv[i], "-t") == 0) {
            test_only = 1;
        } else if (strcmp(argv[i], "-a") == 0 && i + 1 < argc) {
            agc_enable = atoi(argv[++i]);
        } else if (strcmp(argv[i], "-g") == 0 && i + 1 < argc) {
            i++;
            if (strcasecmp(argv[i], "auto") == 0 || atoi(argv[i]) == -1) {
                gain_auto = 1;
            } else {
                gain_auto = 0;
                gain_val = (int)(atof(argv[i]) * 10.0 + 0.5);
            }
        } else if (strcmp(argv[i], "-p") == 0 && i + 1 < argc) {
            ppm = atoi(argv[++i]);
        } else if (strcmp(argv[i], "-b") == 0 && i + 1 < argc) {
            bias_tee = atoi(argv[++i]);
        } else if (argv[i][0] != '-') {
            out_filename = argv[i];
        }
    }

    if (load_librtlsdr() != 0) {
        return 1;
    }

    int dev_count = p_rtlsdr_get_device_count ? p_rtlsdr_get_device_count() : 1;
    if (dev_count == 0) {
        fprintf(stderr, "[RTL-SDR] No RTL-SDR hardware devices detected.\n");
        return 1;
    }

    if (p_rtlsdr_open(&dev, dev_index) < 0) {
        fprintf(stderr, "[RTL-SDR] Failed to open RTL-SDR device #%u\n", dev_index);
        return 1;
    }

    if (test_only) {
        const char *name = p_rtlsdr_get_device_name ? p_rtlsdr_get_device_name(dev_index) : "RTL2832U Dongle";
        printf("RTL-SDR device #%u ready: %s\n", dev_index, name ? name : "Generic RTL2832U");
        p_rtlsdr_close(dev);
        return 0;
    }

    if (strcmp(out_filename, "-") == 0) {
        out_file = stdout;
        setvbuf(stdout, NULL, _IOFBF, 65536);
    } else {
        out_file = fopen(out_filename, "wb");
        if (!out_file) {
            fprintf(stderr, "[RTL-SDR] Failed to open output file: %s\n", out_filename);
            p_rtlsdr_close(dev);
            return 1;
        }
    }

    p_rtlsdr_set_sample_rate(dev, rate);
    p_rtlsdr_set_center_freq(dev, freq);

    if (gain_auto) {
        p_rtlsdr_set_tuner_gain_mode(dev, 0);
    } else {
        p_rtlsdr_set_tuner_gain_mode(dev, 1);
        p_rtlsdr_set_tuner_gain(dev, gain_val);
    }

    if (agc_enable && p_rtlsdr_set_agc_mode) {
        p_rtlsdr_set_agc_mode(dev, 1);
    }

    if (ppm != 0 && p_rtlsdr_set_freq_correction) {
        p_rtlsdr_set_freq_correction(dev, ppm);
    }
    if (bias_tee && p_rtlsdr_set_bias_tee) {
        p_rtlsdr_set_bias_tee(dev, 1);
    }

    p_rtlsdr_reset_buffer(dev);

    int actual_gain = gain_val;
    if (!gain_auto && p_rtlsdr_get_tuner_gain) {
        int g = p_rtlsdr_get_tuner_gain(dev);
        if (g > 0) actual_gain = g;
    }

    fprintf(stderr, "[RTL-SDR] Active: %u Hz, Rate: %u S/s, Gain: %s (%.1f dB), AGC: %s\n",
            freq, rate, gain_auto ? "auto" : "manual", (float)actual_gain / 10.0f,
            agc_enable ? "ON" : "OFF");

    p_rtlsdr_read_async(dev, rtlsdr_callback, NULL, 0, 0);

    p_rtlsdr_close(dev);
    dev = NULL;

    if (out_file && out_file != stdout) {
        fclose(out_file);
    }
    return 0;
}
