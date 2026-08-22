CC = gcc
CFLAGS = -O3 -Wall
LDFLAGS = -lm

all: sdr/adsb_demod

sdr/adsb_demod: sdr/adsb_demod.c
	$(CC) $(CFLAGS) $< -o $@ $(LDFLAGS)

clean:
	rm -f sdr/adsb_demod

run: all
	./venv/bin/python3 app.py
