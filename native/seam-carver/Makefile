INCLUDE=include
OUT=build
SRC=src

CC=gcc
CFLAGS=-I$(INCLUDE)

$(OUT)/%.o: $(SRC)/%.c $(INCLUDE)/*.h
	mkdir -p $(OUT)
	$(CC) -c -o $@ $< $(CFLAGS)

_OBJ = main.o stb_impl.o graph_pixel.o graph_pixel_pixel.o graph_pixel_no_pixel.o
OBJ = $(patsubst %,$(OUT)/%,$(_OBJ))

seam-carver: $(OBJ)
	$(CC) -o $@ $^

.PHONY: clean build
clean:
	rm -f $(OUT)/*.o seam-carver

build: seam-carver
