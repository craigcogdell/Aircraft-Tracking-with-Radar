CC = gcc
CFLAGS = -O3 -Wall

all: sdr/adsb_demod sdr/rtl_sdr

sdr/adsb_demod: sdr/adsb_demod.c
	$(CC) $(CFLAGS) $< -o $@ -lm

sdr/rtl_sdr: sdr/rtl_sdr.c
	$(CC) $(CFLAGS) $< -o $@ -ldl

clean:
	rm -f sdr/adsb_demod sdr/rtl_sdr

run: all
	./venv/bin/python3 app.py
